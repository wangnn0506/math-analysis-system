import io,tempfile
from decimal import Decimal
from docx import Document
from docx.oxml import OxmlElement
from django.test import TestCase,override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth.models import User,Group
from rest_framework.test import APIClient
from openpyxl import load_workbook
from .models import *
from .analysis import analyze
from .documents import extract_docx


def doc_bytes(texts):
    d=Document()
    for text in texts:d.add_paragraph(text)
    f=io.BytesIO();d.save(f);return f.getvalue()

class WorkflowTests(TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(dir='local' if __import__('os').path.isdir('local') else None)
        self.override=override_settings(MEDIA_ROOT=self.temp.name);self.override.enable()
        self.addCleanup(self.temp.cleanup);self.addCleanup(self.override.disable)
        self.t=User.objects.create_user('t');self.t.groups.add(Group.objects.get_or_create(name='teacher')[0])
        self.other=User.objects.create_user('other');self.other.groups.add(Group.objects.get(name='teacher'))
        self.parent=User.objects.create_user('parent')
        self.c=Classroom.objects.create(name='虚拟班',teacher=self.t)
        self.s1=Student.objects.create(number='01',name='甲',classroom=self.c);self.s1.guardians.add(self.parent)
        self.s2=Student.objects.create(number='02',name='乙',classroom=self.c)
        self.k1=KnowledgePoint.objects.create(code='A',name='集合');self.k2=KnowledgePoint.objects.create(code='B',name='函数')
        self.client=APIClient();self.client.force_authenticate(self.t)
    def paper(self):
        data=doc_bytes(['自编测试','一、单项选择题','1. （5分）集合交集 A.1 B.2','二、解答题','2. （10分）计算 $x^2$。'])
        r=self.client.post('/api/v1/papers/',{'file':SimpleUploadedFile('试卷.docx',data)},format='multipart')
        self.assertEqual(r.status_code,201,r.data);return r.data
    def confirmed(self):
        p=self.paper()
        for i in p['items']:i['needs_review']=False;i['knowledge']=[self.k1.id,self.k2.id] if i['number']=='1' else [self.k2.id]
        r=self.client.patch(f'/api/v1/papers/{p["id"]}/',p,format='json');self.assertEqual(r.status_code,200,r.data)
        r=self.client.post(f'/api/v1/papers/{p["id"]}/confirm/',{'revision':r.data['revision']},format='json');self.assertEqual(r.status_code,200,r.data)
        return Paper.objects.get(id=p['id'])
    def exam(self):
        p=self.confirmed()
        r=self.client.post('/api/v1/exams/',{'title':'测试','classroom':self.c.id,'paper':p.id,'date':'2026-10-23'},format='json');self.assertEqual(r.status_code,200,r.data)
        return Exam.objects.get(id=r.data[0]['id'])
    def workbook(self,e,rows=None):
        r=self.client.get(f'/api/v1/exams/{e.id}/template/');self.assertEqual(r.status_code,200)
        wb=load_workbook(io.BytesIO(b''.join(r.streaming_content)))
        if rows:
            for n,row in enumerate(rows,2):
                for c,v in enumerate(row,1):wb['逐题成绩'].cell(n,c,v)
        return wb
    def preview(self,e,wb):
        f=io.BytesIO();wb.save(f)
        return self.client.post(f'/api/v1/exams/{e.id}/score-imports/',{'file':SimpleUploadedFile('成绩.xlsx',f.getvalue())},format='multipart')
    def commit(self,b,**kw):return self.client.post(f'/api/v1/score-imports/{b}/commit/',kw,format='json')
    def test_docx_dynamic_questions_and_unknown_marks(self):
        items,w,t=extract_docx(doc_bytes(['一、填空题','3. 无分数','4. （7分）求值','(1) 小问']))
        self.assertEqual([i['number'] for i in items],['3','4']);self.assertIsNone(items[0]['points']);self.assertIn('(1)',items[1]['stem'])
    def test_omml_preserved_as_explicit_warning(self):
        d=Document();p=d.add_paragraph('1. （5分）计算：');m=OxmlElement('m:oMath');r=OxmlElement('m:r');t=OxmlElement('m:t');t.text='x';r.append(t);m.append(r);p._p.append(m);f=io.BytesIO();d.save(f)
        items,w,_=extract_docx(f.getvalue());self.assertTrue(w);self.assertIn('原生公式待转换',items[0]['stem'])
    def test_bad_file_rejected(self):
        r=self.client.post('/api/v1/papers/',{'file':SimpleUploadedFile('x.docx',b'not a docx')},format='multipart');self.assertEqual(r.status_code,400)
    def test_review_required(self):
        p=self.paper();r=self.client.post(f'/api/v1/papers/{p["id"]}/confirm/',{'revision':1},format='json');self.assertEqual(r.status_code,400)
    def test_structure_frozen(self):
        p=self.confirmed();r=self.client.get(f'/api/v1/papers/{p.id}/');r=self.client.patch(f'/api/v1/papers/{p.id}/',r.data,format='json');self.assertEqual(r.status_code,400)
    def test_duplicate_numbers_rejected(self):
        p=self.paper();p['items'][1]['number']='1';r=self.client.patch(f'/api/v1/papers/{p["id"]}/',p,format='json');self.assertEqual(r.status_code,400)
    def test_stale_draft_rejected(self):
        p=self.paper();self.client.patch(f'/api/v1/papers/{p["id"]}/',p,format='json');r=self.client.patch(f'/api/v1/papers/{p["id"]}/',p,format='json');self.assertEqual(r.status_code,409)
    def test_foreign_source_and_exam_blocked(self):
        e=self.exam();self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(f'/api/v1/papers/{e.paper_id}/source/').status_code,404)
        self.assertEqual(self.client.get(f'/api/v1/exams/{e.id}/template/').status_code,404)
    def test_draft_cannot_create_exam(self):
        p=self.paper();r=self.client.post('/api/v1/exams/',{'title':'x','classroom':self.c.id,'paper':p['id'],'date':'2026-10-23'},format='json');self.assertEqual(r.status_code,404)
    def test_import_is_preview_until_confirm_and_idempotent(self):
        e=self.exam();r=self.preview(e,self.workbook(e,[['01','甲','正常',0,10],['02','乙','缺考',None,None]]));self.assertEqual(r.data['errors'],[])
        self.assertEqual(Result.objects.count(),0);self.assertEqual(self.commit(r.data['id']).status_code,200);self.assertEqual(self.commit(r.data['id']).status_code,200);self.assertEqual(Result.objects.count(),2)
        a=analyze(e);self.assertEqual(a['average_rate'],66.67);self.assertEqual(a['complete_count'],1);self.assertEqual(a['knowledge'][0]['rate'],0);self.assertEqual(a['knowledge'][1]['rate'],80)
    def test_zero_missing_and_absent_distinct(self):
        e=self.exam();r=self.preview(e,self.workbook(e,[['01','甲','正常',0,None],['02','乙','缺考',None,None]]));self.commit(r.data['id']);a=analyze(e)
        self.assertEqual(a['students'][0]['total'],0);self.assertEqual(a['students'][0]['recorded'],1);self.assertIsNone(a['students'][0]['rate']);self.assertTrue(a['students'][1]['absent']);self.assertIsNone(a['average_rate'])
    def test_bad_rows_atomic(self):
        e=self.exam();r=self.preview(e,self.workbook(e,[['01','甲','正常',6,10],['01','乙','正常',2,5]]));self.assertEqual(len(r.data['errors']),2);self.assertEqual(self.commit(r.data['id']).status_code,400);self.assertEqual(Result.objects.count(),0)
    def test_header_tamper(self):
        e=self.exam();w=self.workbook(e);w['逐题成绩']['D1']='题999';self.assertEqual(self.preview(e,w).status_code,400)
    def test_wrong_exam_template(self):
        e=self.exam();w=self.workbook(e);other=Exam.objects.create(title='other',paper=e.paper,classroom=self.c,date='2026-10-24');self.assertEqual(self.preview(other,w).status_code,400)
    def test_formulas_and_nonfinite_invalid(self):
        e=self.exam();r=self.preview(e,self.workbook(e,[['01','甲','正常','=1+1','NaN']]));self.assertTrue(r.data['errors'])
    def test_duplicate_file_rejected(self):
        e=self.exam();w=self.workbook(e,[['01','甲','正常',3,10]]);r=self.preview(e,w);self.commit(r.data['id']);r2=self.preview(e,w);self.assertTrue(r2.data['duplicate']);self.assertEqual(self.commit(r2.data['id'],overwrite=True).status_code,400)
    def test_overwrite_requires_explicit_approval(self):
        e=self.exam();r=self.preview(e,self.workbook(e,[['01','甲','正常',3,10]]));self.commit(r.data['id']);r2=self.preview(e,self.workbook(e,[['01','甲','正常',4,10]]));self.assertEqual(self.commit(r2.data['id']).status_code,400);self.assertEqual(self.commit(r2.data['id'],overwrite=True).status_code,200)
    def test_stale_preview_cannot_overwrite_new_scores(self):
        e=self.exam();a=self.preview(e,self.workbook(e,[['01','甲','正常',3,10]]));b=self.preview(e,self.workbook(e,[['01','甲','正常',4,10]]));self.commit(a.data['id']);self.assertEqual(self.commit(b.data['id'],overwrite=True).status_code,409)
    def test_parent_reports_are_filtered(self):
        e=self.exam();self.client.force_authenticate(self.parent)
        r=self.client.get(f'/api/v1/students/{self.s1.id}/analysis/');self.assertEqual(r.status_code,200);self.assertEqual(len(r.data['reports'][0]['students']),1)
        self.assertEqual(self.client.get(f'/api/v1/students/{self.s2.id}/analysis/').status_code,403)
        self.assertEqual(self.client.get(f'/api/v1/exams/{e.id}/analysis/').status_code,403)
    def test_exam_roster_is_snapshot(self):
        e=self.exam();self.s1.name='改名';self.s1.save();self.assertEqual(e.members.get(student=self.s1).name,'甲')

    def test_invalid_extracted_marks_require_manual_review(self):
        items,w,_=extract_docx(doc_bytes(['1. （999999分）错误分值','2. （0分）错误分值','3. （1.234分）错误分值']))
        self.assertTrue(w);self.assertTrue(all(i['points'] is None for i in items))
    def test_trends_chronological_and_student_specific(self):
        e=self.exam();a=self.preview(e,self.workbook(e,[['01','甲','正常',0,10],['02','乙','正常',5,10]]));self.commit(a.data['id'])
        earlier=Exam.objects.create(title='较早考试',paper=e.paper,classroom=self.c,date='2026-10-01')
        for s in [self.s1,self.s2]:ExamMember.objects.create(exam=earlier,student=s,name=s.name,number=s.number)
        b=self.preview(earlier,self.workbook(earlier,[['01','甲','正常',0,0],['02','乙','缺考',None,None]]));self.commit(b.data['id'])
        r=self.client.get(f'/api/v1/exams/{e.id}/analysis/');self.assertEqual([x['average_rate'] for x in r.data['trend']],[0,83.33])
        self.client.force_authenticate(self.parent)
        r=self.client.get(f'/api/v1/students/{self.s1.id}/analysis/');self.assertEqual([x['average_rate'] for x in r.data['trend']],[0,66.67])
