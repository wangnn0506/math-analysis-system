from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.urls import reverse

from core.api import is_teacher
from core.demo_samples import sample_docx
from core.documents import extract_docx
from core.models import KnowledgePoint, Paper, PaperItem, PracticePublication, PracticeTopic
from core.topics import public_content

SLUG = 'demo-sets-and-intersections'


class Command(BaseCommand):
    help = '创建一份自编集合题的双语专题，不覆盖现有内容。'

    def add_arguments(self, parser):
        parser.add_argument('--teacher', default='teacher', help='接收演示专题的现有教师账号。')
        parser.add_argument('--publish', action='store_true', help='直接发布新建的自编演示内容。')

    @transaction.atomic
    def handle(self, *args, **options):
        teacher = get_user_model().objects.filter(username=options['teacher']).first()
        if teacher is None or not is_teacher(teacher):
            raise CommandError('请先准备教师账号。演示环境可以运行 seed_demo。')
        if PracticeTopic.objects.filter(slug=SLUG).exists():
            self.stdout.write('演示地址已被使用，保留现有内容。')
            return

        items, _, _ = extract_docx(sample_docx())
        paper = Paper.objects.create(teacher=teacher, title='集合运算 · 自编样题', status='confirmed')
        item = PaperItem.objects.create(
            paper=paper, position=0, number='1', kind='single',
            stem=items[0]['stem'], points=5, needs_review=False,
        )
        tag, _ = KnowledgePoint.objects.get_or_create(code='1.1', defaults={'name': '集合运算'})
        item.knowledge.add(tag)
        topic = PracticeTopic.objects.create(
            teacher=teacher, paper=paper, slug=SLUG, title='集合运算入门',
            description='根据两个有限集合求交集。适合复习集合中的共同元素。',
            english={
                'title': 'Sets and Intersections',
                'description': 'Practice finding the common elements of two finite sets.',
                'stems': {str(item.id): (
                    r'Let $A=\{1,2,3\}$ and $B=\{2,4\}$. Which set is $A\cap B$?'
                    '\n'
                    r'A. $\{1\}$    B. $\{2\}$    C. $\{3\}$    D. $\{4\}$'
                )},
            },
        )
        topic.questions.add(item)
        if options['publish']:
            PracticePublication.objects.create(topic=topic, revision=topic.revision, content=public_content(topic))
            self.stdout.write(reverse('topic-public', args=[SLUG]))
            self.stdout.write(reverse('topic-public-en', args=[SLUG]))
        else:
            self.stdout.write('双语演示草稿已创建，可在题库管理中预览和发布。')
