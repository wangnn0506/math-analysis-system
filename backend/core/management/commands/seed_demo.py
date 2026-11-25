from django.core.management.base import BaseCommand
from django.contrib.auth.models import User,Group
from core.api import parent_group_name
from core.models import Classroom,Student,KnowledgePoint
class Command(BaseCommand):
    help='幂等创建虚拟演示数据，不覆盖已有账号密码或班级资料'
    def handle(self,*args,**kwargs):
        teacher,_=User.objects.get_or_create(username='teacher',defaults={'first_name':'陈老师'})
        if not teacher.has_usable_password() or not teacher.password:teacher.set_password('MathDemo2026!');teacher.save()
        teacher.groups.add(Group.objects.get_or_create(name='teacher')[0])
        parent,created=User.objects.get_or_create(username='parent',defaults={'first_name':'林同学家长'})
        if created:parent.set_password('MathDemo2026!');parent.save()
        parent.groups.add(Group.objects.get_or_create(name='parent')[0],Group.objects.get_or_create(name=parent_group_name(teacher.id))[0])
        classroom,_=Classroom.objects.get_or_create(teacher=teacher,name='高一（1）班',defaults={'grade':'高一'})
        for i in range(1,21):
            s,_=Student.objects.get_or_create(number=f'DEMO{i:03}',defaults={'name':f'示例学生{i:02}','classroom':classroom})
            if i==1:s.guardians.add(parent)
        for code,name in [('1.1','集合运算'),('2.1','函数性质'),('3.1','三角函数'),('4.1','数列'),('5.1','概率统计')]:KnowledgePoint.objects.get_or_create(code=code,defaults={'name':name})
        self.stdout.write(self.style.SUCCESS('演示账号、1个班级、20名虚拟学生已准备好'))
