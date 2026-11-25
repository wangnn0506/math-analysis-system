from django.db import IntegrityError, transaction
from django.conf import settings
from django.http import Http404
from django.shortcuts import get_object_or_404, render
from django.urls import reverse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_safe
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .api import Teacher, is_teacher
from .models import Paper, PracticePublication, PracticeTopic


class EnglishInput(serializers.Serializer):
    title = serializers.CharField(max_length=150, allow_blank=True)
    description = serializers.CharField(max_length=1000, allow_blank=True)
    stems = serializers.DictField(
        child=serializers.CharField(max_length=40000, allow_blank=True),
    )


class TopicInput(serializers.Serializer):
    english = EnglishInput(required=False)
    title = serializers.CharField(max_length=150)
    description = serializers.CharField(max_length=1000, allow_blank=True)
    paper_id = serializers.IntegerField(min_value=1)
    question_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1), allow_empty=False, max_length=300,
    )

    def validate(self, attrs):
        paper = Paper.objects.filter(
            teacher=self.context['teacher'], status='confirmed', id=attrs['paper_id'],
        ).first()
        if paper is None:
            raise serializers.ValidationError({'paper_id': '请选择自己已确认的试卷。'})
        questions = list(paper.items.filter(id__in=attrs['question_ids'], needs_review=False))
        if len(questions) != len(attrs['question_ids']):
            raise serializers.ValidationError({'question_ids': '请选择该试卷中不重复的已审核题目。'})
        english = attrs.get('english')
        if english is not None and set(english['stems']) - {str(question.id) for question in questions}:
            raise serializers.ValidationError({'english': '英文题干必须对应已选题目。'})
        return {**attrs, 'questions': questions}


class NewTopicInput(TopicInput):
    slug = serializers.RegexField(r'\A[a-z0-9]+(?:-[a-z0-9]+)*\Z', max_length=80)


class UpdatedTopicInput(TopicInput):
    revision = serializers.IntegerField(min_value=1)


class PublicationInput(serializers.Serializer):
    revision = serializers.IntegerField(min_value=1)
    approved_for_publication = serializers.BooleanField(required=False)


def topic_data(topic, *, detail=False):
    publication = getattr(topic, 'publication', None)
    data = {
        'id': topic.id,
        'slug': topic.slug,
        'title': topic.title,
        'revision': topic.revision,
        'published_revision': publication.revision if publication else None,
        'published_at': publication.published_at if publication else None,
        'preview_url': reverse('topic-preview', args=[topic.id]),
        'public_url': reverse('topic-public', args=[topic.slug]),
    }
    if detail:
        question_ids = list(topic.questions.values_list('id', flat=True))
        data.update(
            english=topic.english,
            english_preview_url=reverse('topic-preview-en', args=[topic.id]) if english_complete(topic.english, question_ids) else None,
            english_public_url=reverse('topic-public-en', args=[topic.slug]) if publication and 'en' in publication.content else None,
            description=topic.description,
            paper_id=topic.paper_id,
            question_ids=question_ids,
        )
    return data


def english_requested(english):
    return english and (english.get('title') or english.get('description') or any(english.get('stems', {}).values()))


def english_complete(english, question_ids):
    return english.get('title') and all(english.get('stems', {}).get(str(pk)) for pk in question_ids)


def public_content(topic):
    questions = list(topic.questions.all())
    content = {
        'title': topic.title,
        'description': topic.description,
        'questions': [{'stem': question.stem, 'kind': question.kind} for question in questions],
    }
    english = topic.english
    if english_complete(english, [question.id for question in questions]):
        content['en'] = {
            'title': english['title'],
            'description': english['description'],
            'questions': [
                {'stem': english['stems'][str(question.id)], 'kind': question.kind}
                for question in questions
            ],
        }
    return content


def apply_draft(topic, data):
    topic.title = data['title']
    topic.description = data['description']
    topic.paper_id = data['paper_id']
    english = data.get('english', topic.english)
    if english:
        selected = {str(question.id) for question in data['questions']}
        topic.english = {
            **english, 'stems': {
                key: stem for key, stem in english.get('stems', {}).items() if key in selected and stem
            },
        }
    topic.save()
    topic.questions.set(data['questions'])


def version_conflict():
    return Response({'detail': '专题已被更新，请重新打开后再操作。'}, status=409)


@api_view(['GET', 'POST'])
@permission_classes([Teacher])
def topics(request):
    if request.method == 'GET':
        drafts = PracticeTopic.objects.filter(teacher=request.user).select_related('publication')
        return Response([topic_data(topic) for topic in drafts.order_by('-updated_at', '-id')])

    form = NewTopicInput(data=request.data, context={'teacher': request.user})
    form.is_valid(raise_exception=True)
    slug = form.validated_data['slug']
    try:
        with transaction.atomic():
            topic = PracticeTopic(teacher=request.user, slug=slug)
            apply_draft(topic, form.validated_data)
    except IntegrityError:
        if PracticeTopic.objects.filter(slug=slug).exists():
            raise serializers.ValidationError({'slug': '这个公开地址已经被使用。'})
        raise
    return Response(topic_data(topic, detail=True), status=201)


@api_view(['GET', 'PATCH'])
@permission_classes([Teacher])
def topic_detail(request, pk):
    with transaction.atomic():
        topic = get_object_or_404(PracticeTopic.objects.select_for_update(), pk=pk, teacher=request.user)
        if request.method == 'GET':
            return Response(topic_data(topic, detail=True))

        form = UpdatedTopicInput(data=request.data, context={'teacher': request.user})
        form.is_valid(raise_exception=True)
        if form.validated_data['revision'] != topic.revision:
            return version_conflict()
        topic.revision += 1
        apply_draft(topic, form.validated_data)
        return Response(topic_data(topic, detail=True))


@api_view(['GET'])
@permission_classes([Teacher])
def topic_questions(request, pk):
    paper = get_object_or_404(Paper, pk=pk, teacher=request.user, status='confirmed')
    return Response(list(paper.items.filter(needs_review=False).values('id', 'number', 'stem')))


@api_view(['POST'])
@permission_classes([Teacher])
def set_publication(request, pk, *, publish):
    form = PublicationInput(data=request.data)
    form.is_valid(raise_exception=True)
    with transaction.atomic():
        topic = get_object_or_404(PracticeTopic.objects.select_for_update(), pk=pk, teacher=request.user)
        if form.validated_data['revision'] != topic.revision:
            return version_conflict()
        if publish:
            if form.validated_data.get('approved_for_publication') is not True:
                raise serializers.ValidationError('请确认内容可公开发布。')
            content = public_content(topic)
            if english_requested(topic.english) and 'en' not in content:
                raise serializers.ValidationError('请补齐英文标题和所有已选题目的英文题干，或清空英文内容后再发布。')
            publication = getattr(topic, 'publication', None)
            if publication is None or publication.revision != topic.revision:
                PracticePublication.objects.update_or_create(
                    topic_id=topic.id,
                    defaults={'revision': topic.revision, 'content': content},
                )
        else:
            PracticePublication.objects.filter(topic_id=topic.id).delete()

        # Read again after the mutation so the reverse relation reflects the current publication.
        return Response(topic_data(PracticeTopic.objects.get(pk=pk), detail=True))


def render_topic(request, content, language, urls, *, preview=False):
    variant = content.get('en') if language == 'en' else content
    if variant is None:
        raise Http404
    return render(request, 'core/practice_topic.html', {
        'content': variant,
        'english': language == 'en',
        'preview': preview,
        'urls': urls,
        'canonical': None if preview else absolute_url(request, urls[language]),
        'alternates': {} if preview else {key: absolute_url(request, value) for key, value in urls.items()},
        'has_math': any('$' in question['stem'] or r'\(' in question['stem'] or r'\[' in question['stem']
                        for question in variant['questions']),
    })


def absolute_url(request, path):
    return settings.PUBLIC_BASE_URL + path if settings.PUBLIC_BASE_URL else request.build_absolute_uri(path)


@require_safe
@never_cache
def topic_preview(request, pk, language='zh'):
    if not is_teacher(request.user):
        raise Http404
    with transaction.atomic():
        topic = get_object_or_404(PracticeTopic.objects.select_for_update(), pk=pk, teacher=request.user)
        content = public_content(topic)
    urls = {'zh': reverse('topic-preview', args=[pk])}
    if 'en' in content:
        urls['en'] = reverse('topic-preview-en', args=[pk])
    response = render_topic(request, content, language, urls, preview=True)
    response['X-Robots-Tag'] = 'noindex'
    return response


def public_urls(slug, content):
    urls = {'zh': reverse('topic-public', args=[slug])}
    if 'en' in content:
        urls['en'] = reverse('topic-public-en', args=[slug])
    return urls


@require_safe
@never_cache
def public_topic(request, slug, language='zh'):
    publication = get_object_or_404(PracticePublication, topic__slug=slug)
    return render_topic(request, publication.content, language, public_urls(slug, publication.content))


@require_safe
@never_cache
def topic_sitemap(request):
    entries = [
        {'url': absolute_url(request, url), 'lastmod': publication.published_at.date().isoformat()}
        for publication in PracticePublication.objects.select_related('topic').order_by('topic__slug')
        for url in public_urls(publication.topic.slug, publication.content).values()
    ]
    return render(request, 'core/topic_sitemap.xml', {'entries': entries}, content_type='application/xml')
