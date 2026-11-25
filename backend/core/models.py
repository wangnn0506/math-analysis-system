from django.db import models
from django.conf import settings
from django.db.models import Q

class Classroom(models.Model):
    name=models.CharField(max_length=80)
    teacher=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.PROTECT)
    grade=models.CharField(max_length=30,default='高一')
    created_at=models.DateTimeField(auto_now_add=True)

class Student(models.Model):
    classroom=models.ForeignKey(Classroom,on_delete=models.PROTECT,related_name='students')
    number=models.CharField(max_length=40,unique=True)
    name=models.CharField(max_length=80)
    guardians=models.ManyToManyField(settings.AUTH_USER_MODEL,related_name='children',blank=True)

class KnowledgePoint(models.Model):
    code=models.CharField(max_length=30,unique=True)
    name=models.CharField(max_length=100)

class Paper(models.Model):
    source=models.FileField(upload_to='papers/',blank=True)
    revision=models.PositiveIntegerField(default=1)
    source_text=models.TextField(blank=True)
    title=models.CharField(max_length=150)
    teacher=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.PROTECT)
    status=models.CharField(max_length=20,default='draft')
    warnings=models.JSONField(default=list)
    created_at=models.DateTimeField(auto_now_add=True)

class PaperItem(models.Model):
    paper=models.ForeignKey(Paper,on_delete=models.CASCADE,related_name='items')
    number=models.CharField(max_length=30)
    position=models.PositiveIntegerField()
    kind=models.CharField(max_length=30,default='unknown')
    stem=models.TextField()
    points=models.DecimalField(max_digits=6,decimal_places=2,null=True)
    knowledge=models.ManyToManyField(KnowledgePoint,blank=True)
    needs_review=models.BooleanField(default=True)
    class Meta:
        ordering=['position','id']
        constraints=[models.UniqueConstraint(fields=['paper','number'],name='unique_paper_number'),models.CheckConstraint(condition=Q(points__gte=0)|Q(points__isnull=True),name='positive_item_points')]

class Exam(models.Model):
    score_revision=models.PositiveIntegerField(default=0)
    title=models.CharField(max_length=150)
    classroom=models.ForeignKey(Classroom,on_delete=models.PROTECT)
    paper=models.ForeignKey(Paper,on_delete=models.PROTECT)
    date=models.DateField()

class Result(models.Model):
    exam=models.ForeignKey(Exam,on_delete=models.CASCADE,related_name='results')
    student=models.ForeignKey(Student,on_delete=models.PROTECT)
    absent=models.BooleanField(default=False)
    class Meta:
        constraints=[models.UniqueConstraint(fields=['exam','student'],name='unique_exam_student')]

class Score(models.Model):
    result=models.ForeignKey(Result,on_delete=models.CASCADE,related_name='scores')
    item=models.ForeignKey(PaperItem,on_delete=models.PROTECT)
    value=models.DecimalField(max_digits=6,decimal_places=2,null=True)
    class Meta:
        constraints=[models.UniqueConstraint(fields=['result','item'],name='unique_score'),models.CheckConstraint(condition=Q(value__gte=0)|Q(value__isnull=True),name='nonnegative_score')]

class ImportBatch(models.Model):
    score_revision=models.PositiveIntegerField(default=0)
    exam=models.ForeignKey(Exam,on_delete=models.PROTECT)
    owner=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.PROTECT)
    digest=models.CharField(max_length=64)
    rows=models.JSONField(default=list)
    errors=models.JSONField(default=list)
    committed=models.BooleanField(default=False)
    created_at=models.DateTimeField(auto_now_add=True)

class ExamMember(models.Model):
    """Freeze participating students at exam creation; later class changes do not alter history."""
    exam=models.ForeignKey(Exam,on_delete=models.CASCADE,related_name='members')
    student=models.ForeignKey(Student,on_delete=models.PROTECT)
    name=models.CharField(max_length=80)
    number=models.CharField(max_length=40)
    class Meta:
        constraints=[models.UniqueConstraint(fields=['exam','student'],name='unique_exam_member')]


class PracticeTopic(models.Model):
    """Teacher-owned draft. Its public URL stays stable across revisions."""

    teacher = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    paper = models.ForeignKey(Paper, on_delete=models.PROTECT)
    slug = models.SlugField(max_length=80, unique=True)
    title = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    english = models.JSONField(default=dict, blank=True)
    questions = models.ManyToManyField(PaperItem, related_name='practice_topics')
    revision = models.PositiveIntegerField(default=1)
    updated_at = models.DateTimeField(auto_now=True)


class PracticePublication(models.Model):
    """Public copy of explicitly selected fields from one draft revision."""

    topic = models.OneToOneField(PracticeTopic, on_delete=models.CASCADE, related_name='publication')
    revision = models.PositiveIntegerField()
    content = models.JSONField()
    published_at = models.DateTimeField(auto_now=True)
