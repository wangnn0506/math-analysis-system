from django.test import TestCase
from django.contrib.auth.models import User,Group
from rest_framework.test import APIClient
from .models import Classroom,Student

class AccessTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.t=User.objects.create_user('teacher',password='testpass123')
        cls.t.groups.add(Group.objects.create(name='teacher'))
        cls.other=User.objects.create_user('other',password='testpass123')
        cls.other.groups.add(Group.objects.get(name='teacher'))
        cls.p=User.objects.create_user('parent',password='testpass123')
        cls.p.groups.add(Group.objects.create(name='parent'),Group.objects.create(name=f'parents_of_{cls.t.id}'))
        cls.c=Classroom.objects.create(name='甲班',teacher=cls.t)
        cls.foreign=Classroom.objects.create(name='乙班',teacher=cls.other)
        cls.s=Student.objects.create(number='S001',name='虚拟学生',classroom=cls.c)
        cls.s.guardians.add(cls.p)
        cls.foreign_student=Student.objects.create(number='S002',name='其他学生',classroom=cls.foreign)
    def setUp(self):self.client=APIClient();self.client.force_authenticate(self.t)
    def test_login_requires_csrf(self):
        c=APIClient(enforce_csrf_checks=True)
        self.assertEqual(c.post('/api/v1/auth/login/',{'username':'teacher','password':'testpass123'},format='json').status_code,403)
        token=c.get('/api/v1/auth/csrf/').json()['csrfToken']
        self.assertEqual(c.post('/api/v1/auth/login/',{'username':'teacher','password':'testpass123'},format='json',HTTP_X_CSRFTOKEN=token).status_code,200)
        self.assertEqual(c.get('/api/v1/auth/me/').json()['role'],'teacher')
    def test_anonymous_cannot_read(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/v1/students/').status_code,403)
    def test_teacher_scope(self):
        self.assertEqual(len(self.client.get('/api/v1/students/').json()),1)
        self.assertEqual(self.client.patch(f'/api/v1/classrooms/{self.foreign.id}/',{'name':'bad'}).status_code,404)
    def test_foreign_class_rejected(self):
        r=self.client.post('/api/v1/students/',{'name':'x','number':'S003','classroom':self.foreign.id})
        self.assertEqual(r.status_code,400)
    def test_duplicate_number(self):
        r=self.client.post('/api/v1/students/',{'name':'x','number':'S001','classroom':self.c.id})
        self.assertEqual(r.status_code,400)
    def test_parent_only_own_children(self):
        self.client.force_authenticate(self.p)
        self.assertEqual([x['number'] for x in self.client.get('/api/v1/parent/children/').json()],['S001'])
        self.assertEqual(self.client.get('/api/v1/students/').status_code,403)
    def test_create_real_class_student_and_binding(self):
        c=self.client.post('/api/v1/classrooms/',{'name':'新班','grade':'高二'}).json()
        r=self.client.post('/api/v1/students/',{'name':'新增','number':'S003','classroom':c['id'],'guardians':[self.p.id]},format='json')
        self.assertEqual(r.status_code,201)
        self.assertEqual(Student.objects.get(number='S003').guardians.get(),self.p)
    def test_foreign_parent_rejected(self):
        self.client.force_authenticate(self.other)
        r=self.client.patch(f'/api/v1/students/{self.foreign_student.id}/',{'guardians':[self.p.id]},format='json')
        self.assertEqual(r.status_code,400)
    def test_postgresql(self):
        from django.db import connection
        self.assertEqual(connection.vendor,'postgresql')
        self.assertIn('PostgreSQL',self.client.get('/api/v1/overview/').json()['database'])
