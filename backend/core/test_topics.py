from django.contrib.auth.models import Group, User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import Paper, PaperItem


@override_settings(DEBUG=False)
class PracticeTopicTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        teachers = Group.objects.create(name='teacher')
        cls.owner = User.objects.create_user('owner')
        cls.other = User.objects.create_user('other')
        cls.parent = User.objects.create_user('parent')
        cls.owner.groups.add(teachers)
        cls.other.groups.add(teachers)
        cls.paper = Paper.objects.create(
            teacher=cls.owner, status='confirmed', title='内部试卷标题',
            source_text='原卷内部说明', source='papers/internal.docx',
        )
        cls.chosen = cls.question(cls.paper, 1, '<script>unsafe</script>公开题干')
        cls.omitted = cls.question(cls.paper, 2, '未选中的题干')
        cls.foreign_paper = Paper.objects.create(teacher=cls.other, status='confirmed')
        cls.foreign = cls.question(cls.foreign_paper, 1, '其他教师的题目')
        cls.draft_paper = Paper.objects.create(teacher=cls.owner, status='draft')
        cls.draft_question = cls.question(cls.draft_paper, 1, '待确认试卷的题目')

    @staticmethod
    def question(paper, position, stem):
        return PaperItem.objects.create(
            paper=paper, position=position, number=str(position), stem=stem,
            kind='single', points=5, needs_review=False,
        )

    def setUp(self):
        self.teacher = APIClient()
        self.teacher.force_authenticate(self.owner)
        self.payload = {
            'slug': 'algebra-basics', 'title': '代数练习', 'description': '基础练习',
            'paper_id': self.paper.id, 'question_ids': [self.chosen.id],
        }

    def create_topic(self):
        response = self.teacher.post('/api/v1/topics/', self.payload, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        return response.json()

    def publication(self, topic, action='publish', approved=True):
        return self.teacher.post(
            f'/api/v1/topics/{topic["id"]}/{action}/',
            {'revision': topic['revision'], 'approved_for_publication': approved},
            format='json',
        )

    def test_draft_preview_is_private_and_uses_selected_questions(self):
        topic = self.create_topic()
        self.assertEqual(self.client.get(topic['public_url']).status_code, 404)
        self.assertEqual(self.client.get(topic['preview_url']).status_code, 404)
        for user in (self.other, self.parent):
            with self.subTest(user=user.username):
                self.client.force_login(user)
                self.assertEqual(self.client.get(topic['preview_url']).status_code, 404)
        self.client.force_login(self.owner)
        preview = self.client.get(topic['preview_url'])
        self.assertContains(preview, '公开题干')
        self.assertNotContains(preview, '未选中的题干')
        self.assertEqual(preview['X-Robots-Tag'], 'noindex')
        self.assertIn('no-store', preview['Cache-Control'])

    def test_publication_is_a_snapshot_and_can_be_taken_down(self):
        original = self.create_topic()
        self.assertEqual(self.publication(original, approved=False).status_code, 400)
        self.assertEqual(self.publication(original).status_code, 200)
        url = original['public_url']
        published = self.client.get(url)
        self.assertContains(published, '代数练习')
        self.assertContains(published, '&lt;script&gt;unsafe&lt;/script&gt;公开题干')
        for private in ('<script>unsafe', '原卷内部说明', '内部试卷标题', 'internal.docx', '未选中的题干'):
            self.assertNotContains(published, private)
        self.assertIn('no-store', published['Cache-Control'])

        updated = self.teacher.patch(
            f'/api/v1/topics/{original["id"]}/',
            {**self.payload, 'title': '新版练习', 'question_ids': [self.omitted.id], 'revision': original['revision']},
            format='json',
        )
        self.assertEqual(updated.status_code, 200, updated.data)
        draft = updated.json()
        self.assertEqual(draft['published_revision'], original['revision'])
        self.assertNotContains(self.client.get(url), '新版练习')
        self.assertEqual(self.publication(original).status_code, 409)
        self.assertEqual(self.publication(draft).status_code, 200)
        republished = self.client.get(url)
        self.assertContains(republished, '新版练习')
        self.assertContains(republished, '未选中的题干')
        self.assertNotContains(republished, '公开题干')

        self.assertEqual(self.publication(draft, 'unpublish').status_code, 200)
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(
            self.teacher.get(f'/api/v1/topics/{draft["id"]}/').json()['title'], '新版练习',
        )

    def test_selection_rejects_foreign_unconfirmed_and_duplicate_items(self):
        selections = [
            (self.foreign_paper.id, [self.foreign.id]),
            (self.draft_paper.id, [self.draft_question.id]),
            (self.paper.id, [self.foreign.id]),
            (self.paper.id, [self.chosen.id, self.chosen.id]),
        ]
        for paper, questions in selections:
            with self.subTest(paper=paper, questions=questions):
                response = self.teacher.post(
                    '/api/v1/topics/',
                    {**self.payload, 'paper_id': paper, 'question_ids': questions},
                    format='json',
                )
                self.assertEqual(response.status_code, 400)

    def test_other_teacher_cannot_read_modify_or_publish_topic(self):
        topic = self.create_topic()
        self.teacher.force_authenticate(self.other)
        path = f'/api/v1/topics/{topic["id"]}/'
        self.assertEqual(self.teacher.get('/api/v1/topics/').json(), [])
        self.assertEqual(self.teacher.get(path).status_code, 404)
        self.assertEqual(self.teacher.patch(path, {}, format='json').status_code, 404)
        self.assertEqual(self.publication(topic).status_code, 404)
        self.assertEqual(
            self.teacher.get(f'/api/v1/papers/{self.paper.id}/topic-questions/').status_code, 404,
        )

    def test_duplicate_slug_does_not_create_a_second_draft(self):
        self.create_topic()
        duplicate = self.teacher.post('/api/v1/topics/', self.payload, format='json')
        self.assertEqual(duplicate.status_code, 400)
        self.assertIn('slug', duplicate.json())
        self.assertEqual(len(self.teacher.get('/api/v1/topics/').json()), 1)

    def test_english_requires_every_selected_translation_before_publication(self):
        self.payload['english'] = {'title': 'Sets and Intersections', 'description': '', 'stems': {}}
        draft = self.create_topic()
        self.assertIsNone(draft['english_preview_url'])
        self.assertEqual(self.publication(draft).status_code, 400)

    @override_settings(PUBLIC_BASE_URL='https://practice.example')
    def test_bilingual_publication_controls_links_switcher_and_sitemap(self):
        self.payload['english'] = {
            'title': 'Sets and Intersections', 'description': 'Find the intersection of two sets.',
            'stems': {str(self.chosen.id): r'Find $A\cap B$.'},
        }
        draft = self.create_topic()
        self.assertIsNotNone(draft['english_preview_url'])
        self.assertIsNone(draft['english_public_url'])
        self.assertNotContains(self.client.get('/sitemap.xml'), draft['slug'])
        published = self.publication(draft).json()

        english = self.client.get(published['english_public_url'])
        self.assertContains(english, '<html lang="en">')
        self.assertContains(english, 'Sets and Intersections')
        self.assertContains(english, 'rel="canonical" href="https://practice.example' + published['english_public_url'])
        self.assertContains(english, 'hreflang="zh-CN"')
        self.assertContains(english, 'katex.min.js')
        self.assertNotContains(self.client.get(draft['public_url']), 'katex.min.js')
        sitemap = self.client.get('/sitemap.xml')
        self.assertContains(sitemap, 'https://practice.example' + published['english_public_url'])
        self.assertContains(sitemap, 'https://practice.example' + draft['public_url'])
        self.publication(draft, 'unpublish')
        self.assertEqual(self.client.get(published['english_public_url']).status_code, 404)
        self.assertNotContains(self.client.get('/sitemap.xml'), draft['slug'])
