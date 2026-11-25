"""Original, intentionally small teaching samples, no external question bank."""
import io
from docx import Document

TEXTS=[
'自编示例：集合、函数与概率',
'本卷共3题，共20分。所有题目为演示自编。',
'一、单项选择题',
r'1. （5分）已知 $A=\{1,2,3\}$，$B=\{2,4\}$，则 $A\cap B=$（    ）。',
r'A. $\{1\}$    B. $\{2\}$    C. $\{3\}$    D. $\{4\}$',
'二、填空题',
r'2. （7分）函数 $f(x)=(x-2)^2+1$ 的最小值为________。',
'三、解答题',
'3. （8分）袋中有3个红球、2个蓝球。每个球被摸到的机会相同，随机摸出1个球。',
'（1）求摸到红球的概率。',
'（2）求摸到蓝球的概率，并说明两者概率之和为什么为1。',
]
def sample_docx():
    doc=Document()
    for t in TEXTS:doc.add_paragraph(t)
    f=io.BytesIO();doc.save(f);return f.getvalue()
