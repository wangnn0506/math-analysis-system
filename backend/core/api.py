from django.contrib.auth import authenticate,login,logout
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_http_methods
from django.db import connection
from rest_framework import serializers,viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import BasePermission
from .models import Classroom,Student,KnowledgePoint,Paper,Exam
import json

@require_http_methods(['GET'])
def csrf(request):
    return JsonResponse({'csrfToken':get_token(request)})

@csrf_protect
@require_http_methods(['POST'])
def sign_in(request):
    try: body=json.loads(request.body)
    except (ValueError,TypeError):return JsonResponse({'detail':'请求格式错误'},status=400)
    user=authenticate(request,username=body.get('username'),password=body.get('password'))
    if user is None:return JsonResponse({'detail':'账号或密码错误'},status=400)
    login(request,user)
    return JsonResponse({'username':user.username})

@api_view(['POST'])
def sign_out(request):
    logout(request)
    return Response({'ok':True})

@api_view(['GET'])
def me(request):
    return Response({'id':request.user.id,'username':request.user.username,'name':request.user.first_name,'role':'teacher' if is_teacher(request.user) else 'parent'})

def is_teacher(user):
    return user.is_authenticated and user.groups.filter(name='teacher').exists()


def parent_group_name(teacher_id):
    return f'parents_of_{teacher_id}'


class Teacher(BasePermission):
    def has_permission(self,request,view):
        return is_teacher(request.user)

class ClassroomSerializer(serializers.ModelSerializer):
    student_count=serializers.IntegerField(source='students.count',read_only=True)
    class Meta:
        model=Classroom
        fields=['id','name','grade','student_count','created_at']
        read_only_fields=['created_at']

class ClassroomViewSet(viewsets.ModelViewSet):
    serializer_class=ClassroomSerializer
    permission_classes=[Teacher]
    http_method_names=['get','post','patch','head','options']
    def get_queryset(self):return Classroom.objects.filter(teacher=self.request.user).order_by('-id')
    def perform_create(self,serializer):serializer.save(teacher=self.request.user)

class StudentSerializer(serializers.ModelSerializer):
    guardian_names=serializers.SerializerMethodField()
    class Meta:
        model=Student
        fields=['id','name','number','classroom','guardians','guardian_names']
    def get_guardian_names(self,obj):return [guardian.username for guardian in obj.guardians.all()]
    def validate_classroom(self,value):
        if value.teacher_id!=self.context['request'].user.id:raise serializers.ValidationError('无权使用此班级')
        return value
    def validate_guardians(self,values):
        if any(not u.groups.filter(name=parent_group_name(self.context["request"].user.id)).exists() for u in values):raise serializers.ValidationError('只能绑定家长账号')
        return values

class StudentViewSet(viewsets.ModelViewSet):
    serializer_class=StudentSerializer
    permission_classes=[Teacher]
    http_method_names=['get','post','patch','head','options']
    def get_queryset(self):
        qs=Student.objects.filter(classroom__teacher=self.request.user).prefetch_related('guardians').order_by('number')
        return qs.filter(classroom_id=self.request.query_params['classroom']) if self.request.query_params.get('classroom') else qs

@api_view(['GET'])
def children(request):
    qs=Student.objects.filter(guardians=request.user).select_related('classroom')
    return Response([{'id':s.id,'name':s.name,'number':s.number,'classroom_name':s.classroom.name} for s in qs])

@api_view(['GET'])
def overview(request):
    teacher=is_teacher(request.user)
    students=Student.objects.filter(classroom__teacher=request.user) if teacher else Student.objects.filter(guardians=request.user)
    with connection.cursor() as cursor:cursor.execute('SELECT version()'); db=cursor.fetchone()[0].split(' on ')[0]
    return Response({'classrooms':Classroom.objects.filter(teacher=request.user).count() if teacher else students.values('classroom').distinct().count(),'students':students.count(),'papers':Paper.objects.filter(teacher=request.user).count() if teacher else 0,'exams':Exam.objects.filter(classroom__teacher=request.user).count() if teacher else 0,'database':db,'milestone':'M1 · 账号、班级与家长绑定'})

@api_view(['GET','POST'])
@permission_classes([Teacher])
def parents(request):
    # Only parent accounts created by this teacher are available for binding.
    group_name=parent_group_name(request.user.id)
    from django.contrib.auth.models import Group
    group,_=Group.objects.get_or_create(name=group_name)
    if request.method=='POST':
        class ParentInput(serializers.Serializer):
            username=serializers.RegexField(r'^[a-zA-Z0-9_]{3,40}$')
            name=serializers.CharField(max_length=80)
            password=serializers.CharField(min_length=10,max_length=128)
        form=ParentInput(data=request.data);form.is_valid(raise_exception=True)
        d=form.validated_data
        if User.objects.filter(username=d['username']).exists():return Response({'detail':'账号已存在'},status=400)
        u=User.objects.create_user(d['username'],password=d['password'],first_name=d['name'])
        u.groups.add(group,Group.objects.get_or_create(name='parent')[0])
    return Response(list(User.objects.filter(groups=group).values('id','username','first_name')))
