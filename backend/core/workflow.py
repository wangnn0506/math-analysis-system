"""Teacher-reviewed papers, immutable exam structure, preview/commit score imports."""
import io,hashlib,uuid,json
from decimal import Decimal,InvalidOperation
from django.db import transaction
from django.core.files.base import ContentFile
from django.core import signing
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import api_view,permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from openpyxl import Workbook,load_workbook
from openpyxl.styles import Font,PatternFill,Alignment
from .models import Paper,PaperItem,KnowledgePoint,Classroom,Exam,ExamMember,Result,Score,ImportBatch,Student
from .api import Teacher, is_teacher
from .documents import extract_docx,validate_office
from .analysis import analyze

class ItemInput(serializers.Serializer):
    number=serializers.CharField(max_length=30)
    stem=serializers.CharField(max_length=40000)
    kind=serializers.ChoiceField(['unknown','single','multiple','blank','written'])
    points=serializers.DecimalField(max_digits=6,decimal_places=2,min_value=Decimal('.01'),allow_null=True)
    knowledge=serializers.PrimaryKeyRelatedField(queryset=KnowledgePoint.objects.all(),many=True)
    needs_review=serializers.BooleanField()

class PaperInput(serializers.Serializer):
    title=serializers.CharField(max_length=150)
    revision=serializers.IntegerField(min_value=1)
    items=ItemInput(many=True,allow_empty=False,max_length=300)
    def validate_items(self,items):
        numbers=[i['number'] for i in items]
        if len(set(numbers))!=len(numbers):raise ValidationError('题号重复，请修改')
        return items

def paper_data(p):
    return {'id':p.id,'title':p.title,'status':p.status,'revision':p.revision,'warnings':p.warnings,'source_text':p.source_text,'has_source':bool(p.source),'items':[{'number':i.number,'stem':i.stem,'kind':i.kind,'points':str(i.points) if i.points is not None else None,'knowledge':list(i.knowledge.values_list('id',flat=True)),'needs_review':i.needs_review} for i in p.items.all()]}

@api_view(['GET','POST'])
@permission_classes([Teacher])
def papers(request):
    if request.method=='GET':return Response([{'id':p.id,'title':p.title,'status':p.status,'count':p.items.count()} for p in Paper.objects.filter(teacher=request.user).order_by('-id')])
    upload=request.FILES.get('file')
    if not upload or not upload.name.lower().endswith('.docx'):raise ValidationError('请上传.docx试卷')
    if upload.size>10*1024*1024:raise ValidationError('文件超过10MB')
    data=upload.read();items,warnings,text=extract_docx(data)
    with transaction.atomic():
        p=Paper.objects.create(teacher=request.user,title=upload.name[:-5][:150],warnings=warnings,source_text=text)
        p.source.save(f'{uuid.uuid4().hex}.docx',ContentFile(data))
        for pos,item in enumerate(items):
            item.pop('knowledge');PaperItem.objects.create(paper=p,position=pos,**item)
    return Response(paper_data(p),status=201)

@api_view(['GET','PATCH'])
@permission_classes([Teacher])
def paper_detail(request,pk):
    if request.method=='GET':return Response(paper_data(get_object_or_404(Paper,id=pk,teacher=request.user)))
    form=PaperInput(data=request.data);form.is_valid(raise_exception=True);d=form.validated_data
    with transaction.atomic():
        p=get_object_or_404(Paper.objects.select_for_update(),id=pk,teacher=request.user)
        if p.status!='draft':raise ValidationError('试卷已确认并冻结；修改请重新导入新版本')
        if d['revision']!=p.revision:return Response({'detail':'草稿已被更新，请重新打开后修改'},status=409)
        p.items.all().delete() # Replace only the draft's extracted blocks; original file stays retained.
        for pos,item in enumerate(d['items']):
            tags=item.pop('knowledge');obj=PaperItem.objects.create(paper=p,position=pos,**item);obj.knowledge.set(tags)
        p.title=d['title'];p.revision+=1;p.save()
    return Response(paper_data(p))

@api_view(['POST'])
@permission_classes([Teacher])
def confirm_paper(request,pk):
    with transaction.atomic():
        p=get_object_or_404(Paper.objects.select_for_update(),id=pk,teacher=request.user)
        if request.data.get('revision')!=p.revision:return Response({'detail':'请先保存并使用最新草稿确认'},status=409)
        if p.status=='confirmed':return Response(paper_data(p))
        items=list(p.items.all())
        if not items or any(i.needs_review or i.points is None or i.kind=='unknown' or not i.knowledge.exists() for i in items):raise ValidationError('每题必须核对题型、分值、知识点并勾选已审核')
        if p.warnings and request.data.get('acknowledge_warnings') is not True:raise ValidationError('请确认已对照原卷处理识别提示')
        p.status='confirmed';p.revision+=1;p.save()
    return Response(paper_data(p))

@api_view(['GET'])
@permission_classes([Teacher])
def paper_source(request,pk):
    p=get_object_or_404(Paper,id=pk,teacher=request.user)
    if not p.source:raise ValidationError('没有原始文件')
    return FileResponse(p.source.open('rb'),as_attachment=True,filename='original.docx')

@api_view(['GET'])
@permission_classes([Teacher])
def knowledge(request):return Response(list(KnowledgePoint.objects.order_by('code').values('id','code','name')))

@api_view(['GET','POST'])
@permission_classes([Teacher])
def exams(request):
    if request.method=='POST':
        class Input(serializers.Serializer):
            title=serializers.CharField(max_length=150)
            classroom=serializers.IntegerField()
            paper=serializers.IntegerField()
            date=serializers.DateField()
        form=Input(data=request.data);form.is_valid(raise_exception=True);d=form.validated_data
        c=get_object_or_404(Classroom,id=d['classroom'],teacher=request.user)
        p=get_object_or_404(Paper,id=d['paper'],teacher=request.user,status='confirmed')
        if not c.students.exists():raise ValidationError('班级尚无学生，请先添加学生')
        with transaction.atomic():
            e=Exam.objects.create(title=d['title'],classroom=c,paper=p,date=d['date'])
            ExamMember.objects.bulk_create([ExamMember(exam=e,student=s,name=s.name,number=s.number) for s in c.students.all()])
    return Response([{'id':e.id,'title':e.title,'date':str(e.date),'classroom':e.classroom_id,'classroom_name':e.classroom.name,'paper_title':e.paper.title,'students':e.members.count(),'imports':e.importbatch_set.filter(committed=True).count()} for e in Exam.objects.filter(classroom__teacher=request.user).select_related('classroom','paper').order_by('-date','-id')])

def structure(e):return {'exam':e.id,'paper':e.paper_id,'items':[[i.id,i.number,str(i.points)] for i in e.paper.items.all()]}
def headers(e):return ['学号','姓名','状态']+[f'题{i.number}（满分{i.points}）' for i in e.paper.items.all()]

@api_view(['GET'])
@permission_classes([Teacher])
def score_template(request,pk):
    e=get_object_or_404(Exam,id=pk,classroom__teacher=request.user,paper__status='confirmed')
    wb=Workbook();ws=wb.active;ws.title='逐题成绩';ws.append(headers(e))
    for m in e.members.order_by('number'):ws.append([m.number,m.name,'正常']+[None]*e.paper.items.count())
    for row in ws:
        for cell in row:
            if isinstance(cell.value,str):cell.data_type='s'
    for c in ws[1]:c.fill=PatternFill('solid',fgColor='245C48');c.font=Font(color='FFFFFF',bold=True)
    ws.freeze_panes='D2';ws.auto_filter.ref=ws.dimensions
    from openpyxl.utils import get_column_letter
    for n in range(1,ws.max_column+1):ws.column_dimensions[get_column_letter(n)].width=22
    meta=wb.create_sheet('_structure');meta['A1']=signing.dumps(structure(e));meta.sheet_state='hidden'
    note=wb.create_sheet('填写说明');note.append(['考试',e.title]);note.append(['班级',e.classroom.name]);note.append(['状态填写 正常 或 缺考；未录入留空，零分写0。缺考行的题目得分全部留空。']);note.append(['不要更改题号列、学号或姓名；重新下载其他考试模板后填写。']);note.column_dimensions['A'].width=90
    for sheet in wb:
        for row in sheet:
            for cell in row:
                if isinstance(cell.value,str):cell.data_type='s'
    f=io.BytesIO();wb.save(f);f.seek(0)
    return FileResponse(f,as_attachment=True,filename=f'exam-{e.id}-scores.xlsx')

@api_view(['POST'])
@permission_classes([Teacher])
def preview_scores(request,pk):
    e=get_object_or_404(Exam,id=pk,classroom__teacher=request.user)
    upload=request.FILES.get('file')
    if not upload or not upload.name.lower().endswith('.xlsx'):raise ValidationError('请上传对应的.xlsx成绩模板')
    if upload.size>10*1024*1024:raise ValidationError('文件超过10MB')
    data=upload.read();validate_office(data)
    try:wb=load_workbook(io.BytesIO(data),data_only=False)
    except Exception:raise ValidationError('无法读取Excel文件')
    try:signed=signing.loads(wb['_structure']['A1'].value)
    except Exception:raise ValidationError('模板标识缺失或被修改，请下载本场考试模板')
    if signed!=structure(e):raise ValidationError('试卷题号、分值或考试关联不匹配，请下载对应模板')
    if '逐题成绩' not in wb:raise ValidationError('缺少“逐题成绩”工作表')
    ws=wb['逐题成绩']
    if ws.max_row>5001:raise ValidationError('单次导入最多5000行')
    if [c.value for c in ws[1]]!=headers(e):raise ValidationError('题号列或表头不匹配，请保留模板原表头')
    members={m.number:m for m in e.members.all()};items=list(e.paper.items.all());seen=set();rows=[];errors=[]
    for n,row in enumerate(ws.iter_rows(min_row=2,values_only=True),2):
        if all(v is None for v in row):continue
        number=str(row[0] if row[0] is not None else '').strip();name=str(row[1] or '').strip();status=str(row[2] or '').strip()
        issues=[];member=members.get(number)
        if not member:issues.append('学号不在本场考试名单中')
        elif name!=member.name:issues.append('姓名与学号不匹配')
        if number in seen:issues.append('学生重复');
        seen.add(number)
        if status not in ('正常','缺考'):issues.append('状态必须为正常或缺考')
        scores=[]
        for item,value in zip(items,row[3:]):
            if value is None or value=='':scores.append(None);continue
            if status=='缺考':issues.append('缺考学生不能填写得分')
            try:
                v=Decimal(str(value))
                if not v.is_finite() or v<0 or v>item.points or v.as_tuple().exponent < -2:raise InvalidOperation
                scores.append(str(v.quantize(Decimal('0.01'))))
            except (InvalidOperation,ValueError):issues.append(f'题{item.number}须为0至{item.points}的数字（至多2位小数）');scores.append(None)
        if issues:errors.append({'row':n,'student':number,'detail':'；'.join(issues)})
        elif member:rows.append({'student':member.student_id,'name':name,'number':number,'absent':status=='缺考','scores':scores})
    if not rows and not errors:errors.append({'row':0,'student':'','detail':'没有可导入成绩行'})
    batch=ImportBatch.objects.create(exam=e,owner=request.user,digest=hashlib.sha256(json.dumps({'structure':structure(e),'rows':sorted(rows,key=lambda r:r['student'])},sort_keys=True).encode()).hexdigest(),rows=rows,errors=errors,score_revision=e.score_revision)
    return Response({'id':batch.id,'rows':rows,'errors':errors,'existing_count':e.results.filter(student_id__in=[r['student'] for r in rows]).count(),'duplicate':e.importbatch_set.filter(digest=batch.digest,committed=True).exists()})

@api_view(['POST'])
@permission_classes([Teacher])
def commit_scores(request,pk):
    with transaction.atomic():
        batch=get_object_or_404(ImportBatch.objects.select_for_update(),id=pk,owner=request.user,exam__classroom__teacher=request.user)
        e=Exam.objects.select_for_update().get(id=batch.exam_id)
        if batch.committed:return Response({'ok':True,'message':'本批次已经导入，无需重复提交'})
        if batch.errors:raise ValidationError('存在校验错误，请修正文件并重新预览')
        if e.importbatch_set.filter(digest=batch.digest,committed=True).exists():raise ValidationError('相同文件已导入，不重复写入')
        if batch.score_revision!=e.score_revision:return Response({'detail':'成绩已变化，请重新上传预览后确认'},status=409)
        if e.results.filter(student_id__in=[r['student'] for r in batch.rows]).exists() and request.data.get('overwrite') is not True:raise ValidationError('已有成绩，需明确确认覆盖本次所列学生')
        items=list(e.paper.items.all())
        for row in batch.rows:
            r,_=Result.objects.update_or_create(exam=e,student_id=row['student'],defaults={'absent':row['absent']})
            for item,value in zip(items,row['scores']):Score.objects.update_or_create(result=r,item=item,defaults={'value':value})
        batch.committed=True;batch.save();e.score_revision+=1;e.save()
    return Response({'ok':True,'message':'成绩已保存'})

@api_view(['GET'])
@permission_classes([Teacher])
def exam_analysis(request,pk):
    e=get_object_or_404(Exam,id=pk,classroom__teacher=request.user)
    data=analyze(e)
    data['trend']=[{'name':f'{x.date} {x.title}',**{k:v for k,v in analyze(x).items() if k in ('average_rate','complete_count','member_count')}} for x in Exam.objects.filter(classroom=e.classroom).order_by('date','id')]
    return Response(data)

@api_view(['GET'])
def student_analysis(request,pk):
    s=get_object_or_404(Student,id=pk)
    allowed=s.classroom.teacher_id==request.user.id or s.guardians.filter(id=request.user.id).exists()
    if not allowed:return Response({'detail':'无权查看该学生'},status=403)
    es=Exam.objects.filter(members__student=s).order_by('date','id')
    if is_teacher(request.user):es=es.filter(classroom__teacher=request.user)
    reports=[analyze(e,s.id) for e in es]
    return Response({'name':s.name,'reports':reports,'trend':[{'name':f'{r["date"]} {r["title"]}','average_rate':r['average_rate'],'complete_count':r['complete_count'],'member_count':1} for r in reports]})

@api_view(['GET'])
@permission_classes([Teacher])
def sample_paper(request):
    from .demo_samples import sample_docx
    return FileResponse(io.BytesIO(sample_docx()),as_attachment=True,filename='demo-original-3questions.docx')
