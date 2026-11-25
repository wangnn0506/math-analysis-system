import {
  ChevronRight,
  Users,
  GraduationCap,
  FileCheck,
  Clock,
  ArrowRight,
  CircleAlert,
  UserRoundPlus,
  FileUp,
  ChartArea,
  ClipboardPlus,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Card, Action } from './ui/components';
import type { Page } from './Dashboard';

const trend = [
  { name: '第一次月考', score: 94 },
  { name: '第二次月考', score: 103 },
  { name: '期中考试', score: 101 },
  { name: '第三次月考', score: 108.5 },
];
export default function DashboardHome({ go }: { go: (page: Page) => void }) {
  return (
    <>
      <div className="stats">
        {(
          [
            {
              title: '管理班级',
              value: '3',
              icon: Users,
              color: 'blue',
              to: 'classes',
            },
            {
              title: '学生总数',
              value: '126',
              icon: GraduationCap,
              color: 'blue',
              to: 'classes',
            },
            {
              title: '已完成考试',
              value: '6',
              icon: FileCheck,
              color: 'green',
              to: 'exams',
            },
            {
              title: '待处理事项',
              value: '2',
              icon: Clock,
              color: 'orange',
              to: null,
            },
          ] as const
        ).map(({ title, value, icon: Icon, color, to }) => (
          <button
            className="card stat"
            key={title}
            onClick={() =>
              to === null
                ? document
                    .getElementById('todos')
                    ?.scrollIntoView({ behavior: 'smooth' })
                : go(to)
            }
          >
            <div>
              <span>{title}</span>
              <Icon className={color} size={20} />
            </div>
            <strong>{value}</strong>
          </button>
        ))}
      </div>
      <div className="dashboard-grid">
        <Card
          title="班级数学成绩趋势"
          extra={<span className="caption">高二（3）班</span>}
          className="trend-card"
        >
          <div
            className="chart"
            role="img"
            aria-label="演示班级均分：第一次月考94，第二次月考103，期中101，第三次月考108.5"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={trend}
                margin={{ top: 16, right: 18, left: -12, bottom: 10 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="#edf0f4"
                  strokeDasharray="3 5"
                />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: '#737373' }}
                  interval={0}
                  tickMargin={12}
                />
                <YAxis
                  domain={[70, 130]}
                  ticks={[70, 85, 100, 115, 130]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 13, fill: '#737373' }}
                />
                <Tooltip
                  formatter={(v) => [`${v} 分`, '班级均分']}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                  }}
                />
                <Line
                  dataKey="score"
                  stroke="#5798ff"
                  strokeWidth={2.5}
                  dot={{
                    r: 4.5,
                    fill: '#5798ff',
                    stroke: 'white',
                    strokeWidth: 2,
                  }}
                  activeDot={{ r: 6 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="demo-label">演示数据</p>
        </Card>
        <Card
          title="重点关注知识点"
          extra={<span className="caption">最近一次考试</span>}
          className="knowledge-card"
        >
          <div>
            {[
              ['导数与函数单调性', 47, '#eba653'],
              ['圆锥曲线', 55, '#eba653'],
              ['空间向量', 68, '#2563eb'],
              ['概率与统计', 82, '#14a187'],
            ].map(([name, value, color]) => (
              <div className="knowledge" key={name}>
                <div>
                  <span>{name}</span>
                  <span>{value}%</span>
                </div>
                <div className="track">
                  <div
                    style={{ width: `${value}%`, background: String(color) }}
                  />
                </div>
              </div>
            ))}
          </div>
          <Action secondary onClick={() => go('analysis')}>
            查看完整分析 <ArrowRight size={16} />
          </Action>
        </Card>
        <Card title="待处理事项">
          <div id="todos" className="todos">
            <button className="todo warning" onClick={() => go('exams')}>
              <CircleAlert size={19} />
              <span>
                <strong>期中模拟卷：1 处题目分值待确认</strong>
                <small>点击进入审核</small>
              </span>
              <ChevronRight size={18} />
            </button>
            <button className="todo" onClick={() => go('classes')}>
              <UserRoundPlus size={19} />
              <span>3 名学生尚未完成家长绑定</span>
              <ChevronRight size={18} />
            </button>
          </div>
        </Card>
        <Card title="快捷入口">
          <div className="quick-grid">
            {(
              [
                ['管理班级', Users, 'classes'],
                ['导入试卷', FileUp, 'exams'],
                ['查看学情', ChartArea, 'analysis'],
                ['布置练习', ClipboardPlus, 'practice'],
              ] as const
            ).map(([title, Icon, to]) => (
              <button key={title} onClick={() => go(to)}>
                <Icon size={21} />
                <span>{title}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
