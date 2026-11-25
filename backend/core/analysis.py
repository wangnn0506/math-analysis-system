from decimal import Decimal
from .models import Result

def analyze(exam,student_id=None):
    items=list(exam.paper.items.prefetch_related('knowledge'))
    members=list(exam.members.select_related('student'))
    if student_id is not None:members=[m for m in members if m.student_id==student_id]
    results={r.student_id:r for r in exam.results.prefetch_related('scores')}
    maximum=sum((i.points for i in items),Decimal(0)); rows=[]; per={i.id:[] for i in items}; kp={}
    for m in members:
        r=results.get(m.student_id);values={s.item_id:s.value for s in r.scores.all()} if r else {}
        absent=bool(r and r.absent);total=Decimal(0);answered=0
        for item in items:
            value=values.get(item.id)
            if absent or value is None:continue
            total+=value;answered+=1;per[item.id].append(value)
            tags=list(item.knowledge.all())
            for tag in tags:
                entry=kp.setdefault(tag.id,{'name':tag.name,'earned':Decimal(0),'possible':Decimal(0),'samples':0})
                entry['earned']+=value/len(tags);entry['possible']+=item.points/len(tags);entry['samples']+=1
        complete=answered==len(items) and bool(items) and not absent
        rows.append({'student_id':m.student_id,'name':m.name,'number':m.number,'absent':absent,'recorded':answered,'question_count':len(items),'complete':complete,'total':float(total) if answered else None,'rate':round(float(total/maximum*100),2) if complete and maximum else None})
    complete_totals=[sum((s.value for s in results[r['student_id']].scores.all() if s.value is not None),Decimal(0)) for r in rows if r['complete']]
    rates=[r['rate'] for r in rows if r['rate'] is not None]
    distribution=[{'name':name,'count':sum(low<=v<high for v in rates)} for name,low,high in [('0–39%',0,40),('40–59%',40,60),('60–79%',60,80),('80–100%',80,101)]]
    knowledge=[{'name':v['name'],'rate':round(float(v['earned']/v['possible']*100),2) if v['possible'] else None,'samples':v['samples']} for v in kp.values()]
    knowledge.sort(key=lambda k:k['rate'] if k['rate'] is not None else 101)
    return {'id':exam.id,'title':exam.title,'date':str(exam.date),'maximum':float(maximum),'students':rows,'complete_count':len(rates),'member_count':len(members),'average_rate':round(float(sum(complete_totals)/len(complete_totals)/maximum*100),2) if complete_totals and maximum else None,'distribution':distribution,'knowledge':knowledge,'items':[{'number':i.number,'rate':round(float(sum(per[i.id])/len(per[i.id])/i.points*100),2) if per[i.id] and i.points else None,'samples':len(per[i.id])} for i in items]}
