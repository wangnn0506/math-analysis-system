"""Conservative DOCX extraction. Never infer missing marks or silently flatten equations."""
import io,re,zipfile
from decimal import Decimal
from docx import Document
from rest_framework.exceptions import ValidationError

NUMBER=re.compile(r'^\s*(\d{1,3})\s*(?:[.．、](?!\d)|[)）])\s*(.*)',re.S)
SECTION=re.compile(r'^\s*[一二三四五六七八九十]+[、．.]')
KINDS={'单选':'single','单项选择':'single','多选':'multiple','多项选择':'multiple','填空':'blank','解答':'written'}

def validate_office(data):
    if len(data)>10*1024*1024:raise ValidationError('文件超过10MB，请缩小后重试')
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            if sum(i.file_size for i in z.infolist())>40*1024*1024 or len(z.infolist())>3000:raise ValidationError('文件解压体积或结构超过本地演示限制')
    except zipfile.BadZipFile:raise ValidationError('不是有效的Office文件')

def extract_docx(data):
    validate_office(data)
    try:doc=Document(io.BytesIO(data))
    except Exception:raise ValidationError('无法读取.docx，请用Word重新另存为.docx')
    warnings=[];lines=[]
    # Include table paragraphs in original XML order; warn that layout needs checking.
    if doc.tables:warnings.append('包含表格，已提取单元格文字；题目顺序与表格关系必须对照原卷核对。')
    for p in doc.element.body.xpath('.//w:p'):
        chunks=[]
        def walk(node):
            tag=node.tag.split('}')[-1]
            if tag in ('oMath','oMathPara'):
                if tag=='oMathPara':
                    for child in node:walk(child)
                else:
                    txt=''.join(x.text or '' for x in node.iter() if x.tag.endswith('}t'))
                    chunks.append('[原生公式待转换：'+txt+']')
                    warnings.append('包含Word原生公式（OMML）：文本仅作定位，未保留数学结构；请对照原卷改为LaTeX公式。')
            elif tag in ('drawing','pict','object'):
                chunks.append('[图片或嵌入对象：请对照原卷核对]')
                warnings.append('包含图片或嵌入对象：当前版本保留原文件，页面不还原这些内容，请下载原卷核对。')
            elif tag=='t':chunks.append(node.text or '')
            elif tag in ('br','cr'):chunks.append('\n')
            elif tag=='tab':chunks.append('\t')
            else:
                for child in node:walk(child)
        walk(p)
        if p.xpath('./w:pPr/w:numPr'):warnings.append('发现Word自动编号：可能未提取题号，请人工补全题目边界与编号。')
        line=''.join(chunks).strip()
        if line:lines.append(line)
    if not lines:raise ValidationError('未读取到文字；可能为纯图片试卷，请转换或手动建立题目')
    items=[];current=None;kind='unknown';seen=set()
    for line in lines:
        if SECTION.match(line):
            for word,value in KINDS.items():
                if word in line:kind=value;break
            current=None
            continue
        m=NUMBER.match(line)
        if m:
            num=m.group(1)
            if num in seen:
                warnings.append('出现重复题号，可能为小题或新分节，请人工调整。');num=f'{num}-{len(items)+1}'
            seen.add(num)
            points=re.search(r'[（(]\s*(?:本小题\s*)?(\d+(?:\.\d+)?)\s*分\s*[)）]',m.group(2))
            mark=points.group(1) if points else None
            if mark and (not Decimal('0')<Decimal(mark)<=Decimal('9999.99') or Decimal(mark).as_tuple().exponent < -2):
                warnings.append(f'题{num}分值格式或范围异常，请人工填写。');mark=None
            current={'number':num,'stem':m.group(2),'kind':kind,'points':mark,'knowledge':[],'needs_review':True}
            items.append(current)
        elif current:current['stem']+='\n'+line
    if not items:
        warnings.append('未可靠识别题号。已将全文放入一个待拆分题块，请手动调整。')
        items=[{'number':'1','stem':'\n'.join(lines),'kind':'unknown','points':None,'knowledge':[],'needs_review':True}]
    if len(items)>300:raise ValidationError('题块超过300，请分卷导入')
    return items,list(dict.fromkeys(warnings)),'\n'.join(lines)
