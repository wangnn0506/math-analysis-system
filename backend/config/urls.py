from django.urls import include, path
from rest_framework.routers import DefaultRouter

from core import api, topics
from core import workflow as w
from core.ai_review import question_suggestion
from core.topic_assets import topic_asset

router = DefaultRouter()
router.register('classrooms', api.ClassroomViewSet, basename='classrooms')
router.register('students', api.StudentViewSet, basename='students')

urlpatterns = [
    path('api/v1/', include(router.urls)),
    path('api/v1/auth/csrf/', api.csrf),
    path('api/v1/auth/login/', api.sign_in),
    path('api/v1/auth/logout/', api.sign_out),
    path('api/v1/auth/me/', api.me),
    path('api/v1/overview/', api.overview),
    path('api/v1/parent/children/', api.children),
    path('api/v1/parents/', api.parents),
    path('api/v1/papers/', w.papers),
    path('api/v1/papers/<int:pk>/', w.paper_detail),
    path('api/v1/papers/<int:pk>/confirm/', w.confirm_paper),
    path('api/v1/papers/<int:pk>/source/', w.paper_source),
    path('api/v1/papers/<int:pk>/question-suggestion/', question_suggestion),
    path('api/v1/papers/<int:pk>/topic-questions/', topics.topic_questions),
    path('api/v1/knowledge/', w.knowledge),
    path('api/v1/exams/', w.exams),
    path('api/v1/exams/<int:pk>/template/', w.score_template),
    path('api/v1/exams/<int:pk>/score-imports/', w.preview_scores),
    path('api/v1/score-imports/<int:pk>/commit/', w.commit_scores),
    path('api/v1/exams/<int:pk>/analysis/', w.exam_analysis),
    path('api/v1/students/<int:pk>/analysis/', w.student_analysis),
    path('api/v1/demo/paper/', w.sample_paper),
    path('api/v1/topics/', topics.topics),
    path('api/v1/topics/<int:pk>/', topics.topic_detail),
    path('api/v1/topics/<int:pk>/publish/', topics.set_publication, {'publish': True}),
    path('api/v1/topics/<int:pk>/unpublish/', topics.set_publication, {'publish': False}),
    path('topic-previews/<int:pk>/', topics.topic_preview, name='topic-preview'),
    path('topic-previews/<int:pk>/en/', topics.topic_preview, {'language': 'en'}, name='topic-preview-en'),
    path('practice-topics/<slug:slug>/', topics.public_topic, name='topic-public'),
    path('en/practice-topics/<slug:slug>/', topics.public_topic, {'language': 'en'}, name='topic-public-en'),
    path('sitemap.xml', topics.topic_sitemap, name='topic-sitemap'),
    path('topic-assets/<path:asset>', topic_asset, name='topic-asset'),
]
