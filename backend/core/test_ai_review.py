from unittest.mock import patch

from django.contrib.auth.models import Group, User
from django.test import TestCase
from rest_framework.test import APIClient

from .models import KnowledgePoint, Paper, PaperItem


class ReviewSuggestionTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        teachers = Group.objects.create(name='teacher')
        cls.owner = User.objects.create_user('teacher')
        cls.other = User.objects.create_user('other')
        cls.owner.groups.add(teachers)
        cls.other.groups.add(teachers)
        cls.paper = Paper.objects.create(teacher=cls.owner, title='自编卷')
        cls.question = PaperItem.objects.create(
            paper=cls.paper, position=0, number='1', stem='求集合的交集。',
        )
        cls.tag = KnowledgePoint.objects.create(code='1.1', name='集合运算')

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.owner)
        self.url = f'/api/v1/papers/{self.paper.id}/question-suggestion/'
        self.data = {'revision': 1, 'stem': self.question.stem}

    def test_local_result_does_not_change_draft_or_review_state(self):
        response = self.client.post(self.url, self.data, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['mode'], 'local')
        self.assertEqual(response.json()['knowledge'][0]['id'], self.tag.id)
        self.question.refresh_from_db()
        self.assertFalse(self.question.knowledge.exists())
        self.assertTrue(self.question.needs_review)
        self.assertEqual(self.client.post(self.url, {**self.data, 'revision': 2}).status_code, 409)
        self.assertEqual(
            self.client.post(f'/api/v1/papers/{self.paper.id}/confirm/', {'revision': 1}, format='json').status_code,
            400,
        )

    def test_model_gets_only_question_and_catalog_and_created_result_is_validated(self):
        call = {
            'id': 'tool-test', 'type': 'function',
            'function': {'name': 'list_knowledge_points', 'arguments': '{}'},
        }
        responses = [{'tool_calls': [call]}, {'content': '{"codes":["1.1"],"reason":"题目考查交集。"}'}]
        with patch('core.ai_review.model_available', return_value=True), patch(
            'core.ai_review.completion', side_effect=responses,
        ) as completion:
            response = self.client.post(self.url, {**self.data, 'allow_external': True}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.json()['mode'], 'model')
        self.assertEqual(completion.call_count, 2)
        messages = completion.call_args.args[0]
        self.assertEqual(messages[-1]['tool_call_id'], 'tool-test')
        self.assertNotIn(self.paper.title, str(messages))
        self.assertNotIn('"id"', messages[-1]['content'])

    def test_unconfigured_unavailable_or_invalid_model_leaves_manual_review_available(self):
        data = {**self.data, 'allow_external': True}
        with patch('core.ai_review.model_available', return_value=False):
            self.assertEqual(self.client.post(self.url, data, format='json').status_code, 503)
        with patch('core.ai_review.model_available', return_value=True), patch(
            'core.ai_review.model_tags', return_value={'codes': ['not-listed'], 'reason': 'bad'},
        ):
            self.assertEqual(self.client.post(self.url, data, format='json').status_code, 503)
        with patch('core.ai_review.model_available', return_value=True), patch(
            'core.ai_review.completion', side_effect=TimeoutError,
        ):
            self.assertEqual(self.client.post(self.url, data, format='json').status_code, 503)
        updated = self.client.patch(f'/api/v1/papers/{self.paper.id}/', {
            'title': self.paper.title, 'revision': 1,
            'items': [{
                'number': '1', 'stem': self.question.stem, 'kind': 'single', 'points': '5',
                'knowledge': [self.tag.id], 'needs_review': False,
            }],
        }, format='json')
        self.assertEqual(updated.status_code, 200, updated.data)

    def test_other_teacher_cannot_request_suggestions(self):
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.post(self.url, self.data, format='json').status_code, 404)
