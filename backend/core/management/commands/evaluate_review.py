import json
from time import perf_counter

from django.core.management.base import BaseCommand, CommandError

from core.ai_review import KEYWORDS, SuggestionUnavailable, model_available, suggest

# Human-labeled synthetic examples. Code 2.1 is intentionally ambiguous for the
# local rules in the first example, which is about polynomial function behavior.
EXAMPLES = [
    ('function-no-cue', '求 f(x)=(x-2)^2+1 在实数范围的取值区间。', {'2.1'}),
    ('intersection', r'求集合 $A\cap B$，其中 $A=\{1,2\}$，$B=\{2,3\}$。', {'1.1'}),
    ('quadratic', '求函数 f(x)=(x-2)^2+1 的最小值。', {'2.1'}),
    ('trig', '求正弦函数在一个周期内的最大值。', {'3.1'}),
    ('sequence', '已知等差数列首项为2，公差为3，求通项。', {'4.1'}),
    ('probability', '袋中有3个红球和2个蓝球，随机摸一个，求红球概率。', {'5.1'}),
    ('multi-topic', '列出集合中的偶数，再求随机取到偶数的概率。', {'1.1', '5.1'}),
    ('outside-catalog', '求点 (1,2) 到直线 y=3 的距离。', set()),
]
NAMES = ['集合运算', '函数性质', '三角函数', '数列', '概率统计']


class Command(BaseCommand):
    help = '用人工标注的自编题评估知识点建议。默认仅运行本地规则。'

    def add_arguments(self, parser):
        parser.add_argument('--model', action='store_true', help='将这些自编题发送给已配置的模型。')

    def handle(self, *args, **options):
        external = options['model']
        if external and not model_available():
            raise CommandError('请配置 OPENAI_API_KEY 和 MATH_AI_MODEL。')

        points = [
            {'id': index, 'code': code, 'name': name}
            for index, (code, name) in enumerate(zip(KEYWORDS, NAMES, strict=True), 1)
        ]
        started = perf_counter()
        rows = []
        for example, stem, expected in EXAMPLES:
            try:
                predicted = {tag['code'] for tag in suggest(stem, points, external=external)['knowledge']}
                rows.append({
                    'name': example, 'expected': sorted(expected), 'predicted': sorted(predicted),
                    'exact': expected == predicted,
                })
            except SuggestionUnavailable:
                rows.append({'name': example, 'expected': sorted(expected), 'error': 'suggestion unavailable'})

        available = [row for row in rows if 'exact' in row]
        exact = sum(row['exact'] for row in available)
        self.stdout.write(json.dumps({
            'mode': 'model' if external else 'local',
            'cases': len(rows),
            'exact_match_rate': round(exact / len(rows), 4),
            'correction_needed_rate': round((len(available) - exact) / len(available), 4) if available else None,
            'failed_requests': len(rows) - len(available),
            'elapsed_ms': round((perf_counter() - started) * 1000),
            'cases_detail': rows,
        }, ensure_ascii=False, indent=2))
