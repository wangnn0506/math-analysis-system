import { lazy, Suspense, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BookOpenCheck,
  LayoutGrid,
  Users,
  Copy,
  ChartNoAxesCombined,
  ClipboardList,
  LibraryBig,
  PanelLeft,
  Bell,
  UserRound,
  ChevronRight,
  Plus,
  CircleHelp,
  X,
} from 'lucide-react';
import { Card, Action } from './ui/components';
import './dashboard.css';

const DashboardHome = lazy(() => import('./DashboardHome'));
const ClassManager = lazy(() => import('./ClassManager'));
const PaperManager = lazy(() => import('./PaperManager'));
const TopicManager = lazy(() => import('./TopicManager'));
const navigation = [
  { id: 'dashboard', title: '工作台', Icon: LayoutGrid },
  { id: 'classes', title: '班级管理', Icon: Users },
  { id: 'exams', title: '考试试卷', Icon: Copy },
  { id: 'analysis', title: '学情分析', Icon: ChartNoAxesCombined },
  { id: 'practice', title: '练习任务', Icon: ClipboardList },
  { id: 'questions', title: '题库管理', Icon: LibraryBig },
] as const;
export type Page = (typeof navigation)[number]['id'];
function currentPage(): Page {
  return (
    navigation.find(({ id }) => id === window.location.hash.slice(1))?.id ??
    'dashboard'
  );
}
function App() {
  const [page, setPage] = useState(currentPage);
  const [dialog, setDialog] = useState('');
  const pageTitle = navigation.find(({ id }) => id === page)?.title;
  function go(page: Page) {
    setPage(page);
    window.location.hash = page;
  }
  useEffect(() => {
    const sync = () => setPage(currentPage());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  return (
    <div className="workspace">
      <aside className="sidebar">
        <a className="brand" href="#dashboard" onClick={() => go('dashboard')}>
          <span className="brand-icon">
            <BookOpenCheck size={25} />
          </span>
          <span>
            错题通<small>TEACHER</small>
          </span>
        </a>
        <div className="nav-label">教学管理</div>
        <nav aria-label="主导航">
          {navigation.map(({ id, title, Icon }) => (
            <button
              key={title}
              aria-current={page === id ? 'page' : undefined}
              className={page === id ? 'nav-item active' : 'nav-item'}
              onClick={() => go(id)}
            >
              <Icon size={19} />
              {title}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="help" onClick={() => setDialog('使用帮助')}>
            <strong>
              <CircleHelp size={16} />
              使用帮助
            </strong>
            <small>查看导入说明与常见问题</small>
          </button>
          <div className="teacher">
            <span className="avatar">
              <UserRound size={20} />
            </span>
            <div>
              <strong>数学教师</strong>
              <small>{page === 'classes' ? '教师工作空间' : '演示账户'}</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main">
        <header>
          <div className="breadcrumb">
            <PanelLeft size={16} />
            <span>教学管理</span>
            <ChevronRight size={15} />
            <strong>{page === 'dashboard' ? '教学工作台' : pageTitle}</strong>
          </div>
          <div className="header-actions">
            <button aria-label="通知" onClick={() => setDialog('消息通知')}>
              <Bell size={19} />
            </button>
            <button
              aria-label="教师账户"
              className="avatar"
              onClick={() => setDialog('演示账户')}
            >
              <UserRound size={20} />
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <h1>{page === 'dashboard' ? '教学工作台' : pageTitle}</h1>
              <p>
                {page === 'dashboard'
                  ? '查看班级动态、最近考试与待办任务'
                  : page === 'classes'
                    ? '管理班级、学生资料与家长绑定'
                    : page === 'exams'
                      ? '导入 Word 试卷，逐题核对后确认冻结'
                      : page === 'questions'
                        ? '从已确认试卷选题，预览并发布公开练习专题'
                        : '此页面将在后续按新 UI 实现'}
              </p>
            </div>
            {page === 'dashboard' && (
              <Action onClick={() => go('exams')}>
                <Plus size={17} />
                导入试卷
              </Action>
            )}
          </div>
          <Suspense
            fallback={
              <Card>
                <p role="status">正在加载页面…</p>
              </Card>
            }
          >
            {page === 'dashboard' ? (
              <DashboardHome go={go} />
            ) : page === 'classes' ? (
              <ClassManager />
            ) : page === 'exams' ? (
              <PaperManager />
            ) : page === 'questions' ? (
              <TopicManager />
            ) : (
              <PlaceholderPage
                title={pageTitle}
                onBack={() => go('dashboard')}
              />
            )}
          </Suspense>
          <footer>
            <span>错题通 · 教师工作台</span>
            <span>
              {page === 'classes'
                ? '班级管理 · 本地业务服务'
                : page === 'exams'
                  ? '试卷审核 · 本地业务服务'
                  : page === 'questions'
                    ? '公开练习专题 · 本地业务服务'
                    : '工作台为虚拟演示数据'}
            </span>
          </footer>
        </main>
      </div>
      {dialog && (
        <div className="modal-backdrop" onClick={() => setDialog('')}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={dialog}
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              autoFocus
              aria-label="关闭"
              className="close"
              onClick={() => setDialog('')}
            >
              <X size={20} />
            </button>
            <h2>{dialog}</h2>
            <p>
              {dialog === '使用帮助'
                ? '操作流程：建立班级 → 导入 Word → 人工审核题目 → 生成动态 Excel → 导入成绩 → 学情分析 → 布置练习。'
                : dialog === '消息通知'
                  ? '当前为 UI 预览，没有真实业务通知。'
                  : '数学教师 · 本地演示账户；页面中的班级、学生与成绩均为虚拟数据。'}
            </p>
            <Action onClick={() => setDialog('')}>知道了</Action>
          </section>
        </div>
      )}
    </div>
  );
}
function PlaceholderPage({
  title,
  onBack,
}: {
  title: string | undefined;
  onBack: () => void;
}) {
  return (
    <Card>
      <div className="placeholder">
        <h2>{title}</h2>
        <p>此页面正在按新版设计逐步完善。</p>
        <p>此页面业务内容将在下一轮按提供的截图补齐。</p>
        <Action secondary onClick={onBack}>
          返回教学工作台
        </Action>
      </div>
    </Card>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
