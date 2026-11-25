import { useEffect, useState, type FormEvent } from 'react';
import {
  Users,
  Plus,
  ArrowRight,
  Search,
  UserRound,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import { Card } from './ui/components';
import { api, ApiError } from './api';
type Classroom = {
  id: number;
  name: string;
  grade: string;
  student_count: number;
};
type Student = {
  id: number;
  name: string;
  number: string;
  classroom: number;
  guardians: number[];
  guardian_names: string[];
};
type Parent = { id: number; username: string; first_name: string };
type Teacher = { name: string; username: string; role: string };
type Analysis = {
  name: string;
  reports: {
    id: number;
    title: string;
    date: string;
    average_rate: number | null;
    students: {
      absent: boolean;
      recorded: number;
      question_count: number;
      total: number | null;
    }[];
  }[];
};
const tabNames = ['班级列表', '学生档案', '家长绑定', '新建班级'];
export default function ClassManager() {
  const [user, setUser] = useState<Teacher | null>(null);
  const [ready, setReady] = useState(false);
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [tab, setTab] = useState(0);
  const [grade, setGrade] = useState('全部年级');
  const [classId, setClassId] = useState('');
  const [query, setQuery] = useState('');
  const [binding, setBinding] = useState('全部状态');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<
    'student' | 'parent' | 'binding' | 'profile' | ''
  >('');
  const [student, setStudent] = useState<Student | null>(null);
  const [chosen, setChosen] = useState<number[]>([]);
  const [report, setReport] = useState<Analysis | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState('');
  async function load() {
    setLoading(true);
    try {
      const [classrooms, roster, parentAccounts] = await Promise.all([
        api<Classroom[]>('classrooms/'),
        api<Student[]>('students/'),
        api<Parent[]>('parents/'),
      ]);
      setClasses(classrooms);
      setStudents(roster);
      setParents(parentAccounts);
    } finally {
      setLoading(false);
    }
  }
  async function loadSession() {
    const currentUser = await api<Teacher>('auth/me/');
    setUser(currentUser);
    if (currentUser.role === 'teacher') await load();
  }

  async function initialize() {
    setError('');
    setReady(false);
    try {
      await api('auth/csrf/');
      await loadSession();
    } catch (e) {
      if (!(e instanceof ApiError && [401, 403].includes(e.status)))
        setError((e as Error).message);
    } finally {
      setReady(true);
    }
  }
  useEffect(() => {
    void initialize();
  }, []);
  useEffect(() => {
    if (!modal) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) setModal('');
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [modal, busy]);
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setError('');
    try {
      await api('auth/csrf/');
      await api('auth/login/', data);
      await loadSession();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await api('auth/logout/', {});
      setUser(null);
      setClasses([]);
      setStudents([]);
      setParents([]);
      setModal('');
      setNotice('');
      await api('auth/csrf/');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save(
    event: FormEvent<HTMLFormElement>,
    submit: (data: Record<string, FormDataEntryValue>) => Promise<unknown>,
  ) {
    event.preventDefault();
    if (busy) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await submit(data);
      setModal('');
      if (tab === 3) setTab(0);
      setNotice('已保存到本地数据库。');
      await load();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const createClassroom = (data: Record<string, FormDataEntryValue>) =>
    api('classrooms/', { ...data, name: String(data.name).trim() });
  const createStudent = (data: Record<string, FormDataEntryValue>) =>
    api('students/', {
      ...data,
      name: String(data.name).trim(),
      number: String(data.number).trim(),
      classroom: Number(data.classroom),
    });
  const createParent = (data: Record<string, FormDataEntryValue>) =>
    api('parents/', data);
  const updateBinding = () => {
    if (!student) return Promise.reject(new Error('请选择要设置绑定的学生。'));
    return api(`students/${student.id}/`, { guardians: chosen }, 'PATCH');
  };
  const modalSubmit =
    modal === 'student'
      ? createStudent
      : modal === 'parent'
        ? createParent
        : updateBinding;
  const visibleClasses = classes.filter(
    (classroom) => grade === '全部年级' || classroom.grade === grade,
  );
  const bindingCounts = new Map<number, { bound: number; unbound: number }>();
  for (const student of students) {
    const counts = bindingCounts.get(student.classroom) ?? {
      bound: 0,
      unbound: 0,
    };
    if (student.guardians.length) counts.bound++;
    else counts.unbound++;
    bindingCounts.set(student.classroom, counts);
  }
  function open(kind: typeof modal, s: Student | null = null) {
    setModal(kind);
    setStudent(s);
    setChosen(s?.guardians || []);
    setError('');
    setNotice('');
    setReport(null);
    setReportError('');
    if (kind === 'profile' && s) {
      setReportBusy(true);
      api<Analysis>(`students/${s.id}/analysis/`)
        .then(setReport)
        .catch((e) => setReportError(e.message))
        .finally(() => setReportBusy(false));
    }
  }
  const filtered = students.filter(
    (s) =>
      (!classId || s.classroom === Number(classId)) &&
      (s.name + s.number).toLowerCase().includes(query.toLowerCase()) &&
      (binding === '全部状态' ||
        (binding === '已绑定'
          ? s.guardians.length > 0
          : s.guardians.length === 0)),
  );
  const classSelect = (
    <select
      aria-label="筛选班级"
      value={classId}
      onChange={(e) => setClassId(e.target.value)}
    >
      <option value="">全部班级</option>
      {classes.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
  if (!ready)
    return (
      <Card>
        <div className="class-empty" role="status">
          正在连接本地教师服务…
        </div>
      </Card>
    );
  if (!user || user.role !== 'teacher')
    return (
      <Card>
        <div className="auth-panel">
          <span className="auth-icon">
            <Users size={28} />
          </span>
          <h2>{user ? '请使用教师账户' : '登录教师工作空间'}</h2>
          <p>班级、学生和家长绑定通过本地服务保存。</p>
          {user ? (
            <>
              <p>当前账户没有教师管理权限。</p>
              <button className="button" disabled={busy} onClick={logout}>
                退出并切换账户
              </button>
            </>
          ) : (
            <form onSubmit={login}>
              <label>
                教师账号
                <input name="username" autoComplete="username" required />
              </label>
              <label>
                密码
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>
              <button className="button" disabled={busy}>
                {busy ? '正在登录…' : '登录'}
              </button>
            </form>
          )}
          {error && (
            <div role="alert" className="form-error">
              {error}
            </div>
          )}
          <button className="text-button" disabled={busy} onClick={initialize}>
            <RefreshCw size={14} />
            重新连接
          </button>
        </div>
      </Card>
    );
  return (
    <div className="class-manager">
      <div className="class-toolbar">
        <div className="page-tabs" role="tablist" aria-label="班级管理页面">
          {tabNames.map((name, i) => (
            <button
              key={name}
              role="tab"
              aria-selected={tab === i}
              disabled={busy}
              className={tab === i ? 'selected' : ''}
              onClick={() => {
                setTab(i);
                setError('');
                setNotice('');
              }}
            >
              {name}
            </button>
          ))}
        </div>
        <button
          className="button"
          disabled={busy}
          onClick={() => {
            setTab(3);
            setError('');
            setNotice('');
          }}
        >
          <Plus size={16} />
          新建班级
        </button>
      </div>
      <div className="connection-bar">
        <span>
          <i />
          本地服务已连接 · {user.name || user.username}
        </span>
        <div>
          <button
            className="text-button"
            disabled={loading || busy}
            onClick={() => {
              setError('');
              load().catch((e) => setError(e.message));
            }}
          >
            <RefreshCw size={14} />
            刷新
          </button>
          <button className="text-button" disabled={busy} onClick={logout}>
            <LogOut size={14} />
            退出登录
          </button>
        </div>
      </div>
      {error && (
        <div role="alert" className="form-error">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="form-success">
          {notice}
        </div>
      )}
      {loading && (
        <p role="status" className="caption">
          正在更新数据…
        </p>
      )}
      {tab === 0 && (
        <>
          <div className="class-filters">
            <select
              aria-label="筛选年级"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
            >
              {[
                '全部年级',
                ...Array.from(
                  new Set([
                    '高一',
                    '高二',
                    '高三',
                    ...classes.map((c) => c.grade),
                  ]),
                ),
              ].map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </div>
          <div className="class-cards">
            {visibleClasses.map((c) => (
              <Card key={c.id}>
                <div className="class-card-heading">
                  <div>
                    <h2>{c.name}</h2>
                    <p>{c.grade}数学 · 教学班级</p>
                  </div>
                  <Users size={22} />
                </div>
                <div className="class-metrics">
                  <div>
                    <strong>{c.student_count}</strong>
                    <small>学生人数</small>
                  </div>
                  <div>
                    <strong>{bindingCounts.get(c.id)?.bound ?? 0}</strong>
                    <small>已绑定家长</small>
                  </div>
                  <div>
                    <strong>{bindingCounts.get(c.id)?.unbound ?? 0}</strong>
                    <small>待绑定学生</small>
                  </div>
                </div>
                <button
                  className="button secondary full-width"
                  onClick={() => {
                    setClassId(String(c.id));
                    setQuery('');
                    setBinding('全部状态');
                    setTab(1);
                  }}
                >
                  查看学生 <ArrowRight size={15} />
                </button>
              </Card>
            ))}
          </div>
          {!visibleClasses.length && (
            <Card>
              <div className="class-empty">
                <Users size={32} />
                <h2>暂无班级</h2>
                <p>创建第一个班级，开始管理学生与家长绑定。</p>
                <button className="button" onClick={() => setTab(3)}>
                  新建班级
                </button>
              </div>
            </Card>
          )}
        </>
      )}
      {(tab === 1 || tab === 2) && (
        <>
          <div className="class-filters">
            {classSelect}
            <div className="search-field">
              <Search size={17} />
              <input
                aria-label="搜索学生"
                placeholder="搜索姓名或学号"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {tab === 2 && (
              <select
                aria-label="绑定状态"
                value={binding}
                onChange={(e) => setBinding(e.target.value)}
              >
                {['全部状态', '已绑定', '未绑定'].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            )}
          </div>
          <Card
            title={tab === 1 ? '学生档案' : '学生与家长绑定'}
            extra={
              <button
                className="button"
                disabled={busy || (tab === 1 && !classes.length)}
                onClick={() => open(tab === 1 ? 'student' : 'parent')}
              >
                <Plus size={15} />
                {tab === 1 ? '添加学生' : '创建家长账号'}
              </button>
            }
          >
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>学生姓名</th>
                    <th>学号</th>
                    <th>班级</th>
                    <th>家长绑定</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <span className="student-name">
                          <span className="small-avatar">
                            <UserRound size={15} />
                          </span>
                          {s.name}
                        </span>
                      </td>
                      <td>{s.number}</td>
                      <td>{classes.find((c) => c.id === s.classroom)?.name}</td>
                      <td>
                        {s.guardians.length ? (
                          <span className="status-bound">
                            {s.guardian_names.join('、')}
                          </span>
                        ) : (
                          <span className="status-pending">未绑定</span>
                        )}
                      </td>
                      <td>
                        <div className="row-actions">
                          {tab === 1 && (
                            <button
                              className="button secondary"
                              onClick={() => open('profile', s)}
                            >
                              查看档案
                            </button>
                          )}
                          <button
                            className="text-button"
                            onClick={() => open('binding', s)}
                          >
                            设置绑定
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!filtered.length && (
              <div className="class-empty">
                <h2>暂无匹配学生</h2>
                <p>
                  {classes.length
                    ? '请调整筛选，或添加学生。'
                    : '请先新建班级，再添加学生。'}
                </p>
              </div>
            )}
            <p className="table-count">共 {filtered.length} 名学生</p>
          </Card>
          {tab === 2 && (
            <Card title="可绑定的家长账号">
              <div className="parent-list">
                {parents.map((p) => (
                  <div key={p.id}>
                    <span className="small-avatar">
                      <UserRound size={16} />
                    </span>
                    <div>
                      <strong>{p.first_name || p.username}</strong>
                      <small>{p.username}</small>
                    </div>
                  </div>
                ))}
              </div>
              {!parents.length && (
                <p className="caption">
                  暂无家长账号，请先创建账号，再选择学生设置绑定。
                </p>
              )}
            </Card>
          )}
        </>
      )}
      {tab === 3 && (
        <Card title="新建班级">
          <form
            className="class-form"
            onSubmit={(event) => void save(event, createClassroom)}
          >
            <label>
              班级名称
              <input
                name="name"
                required
                maxLength={80}
                pattern=".*\S.*"
                placeholder="例如：高二（3）班"
              />
            </label>
            <label>
              年级
              <select name="grade" aria-label="年级">
                <option>高一</option>
                <option>高二</option>
                <option>高三</option>
              </select>
            </label>
            <p className="caption">
              创建后可在学生档案中添加学生，并设置家长绑定。
            </p>
            <div className="form-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setTab(0)}
              >
                取消
              </button>
              <button className="button" disabled={busy}>
                {busy ? '正在保存…' : '创建班级'}
              </button>
            </div>
          </form>
        </Card>
      )}
      {modal && (
        <div className="modal-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="class-dialog-title"
            className="modal class-dialog"
          >
            <h2 id="class-dialog-title">
              {modal === 'student'
                ? '添加学生'
                : modal === 'parent'
                  ? '创建家长账号'
                  : modal === 'binding'
                    ? `设置家长绑定 · ${student?.name}`
                    : `学生档案 · ${student?.name}`}
            </h2>
            {modal === 'profile' ? (
              <>
                <div className="profile-summary">
                  <span>学号：{student?.number}</span>
                  <span>
                    班级：
                    {classes.find((c) => c.id === student?.classroom)?.name}
                  </span>
                  <span>
                    家长：{student?.guardian_names.join('、') || '未绑定'}
                  </span>
                </div>
                <h3>个人学情 · 历次考试</h3>
                {reportBusy ? (
                  <p role="status">正在读取个人学情…</p>
                ) : reportError ? (
                  <p role="alert" className="form-error">
                    {reportError}
                  </p>
                ) : report?.reports.length ? (
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>考试</th>
                          <th>日期</th>
                          <th>得分率</th>
                          <th>状态</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.reports.map((r) => (
                          <tr key={r.id}>
                            <td>{r.title}</td>
                            <td>{r.date}</td>
                            <td>
                              {r.average_rate === null
                                ? '—'
                                : `${r.average_rate}%`}
                            </td>
                            <td>
                              {r.students[0]?.absent
                                ? '缺考'
                                : r.students[0]?.recorded ===
                                    r.students[0]?.question_count
                                  ? '完整'
                                  : r.students[0]?.recorded
                                    ? '未录完'
                                    : '未录入'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="class-empty">
                    暂无考试记录，导入成绩后将显示个人学情。
                  </p>
                )}
                <button
                  autoFocus
                  className="button secondary"
                  onClick={() => setModal('')}
                >
                  关闭
                </button>
              </>
            ) : (
              <form
                className="class-form"
                onSubmit={(event) => void save(event, modalSubmit)}
              >
                {modal === 'student' && (
                  <>
                    <label>
                      学生姓名
                      <input
                        autoFocus
                        name="name"
                        required
                        maxLength={80}
                        pattern=".*\S.*"
                      />
                    </label>
                    <label>
                      学号
                      <input
                        name="number"
                        required
                        maxLength={40}
                        pattern=".*\S.*"
                      />
                    </label>
                    <label>
                      所属班级
                      <select
                        aria-label="所属班级"
                        name="classroom"
                        defaultValue={classId || classes[0]?.id}
                      >
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
                {modal === 'parent' && (
                  <>
                    <label>
                      家长姓名
                      <input autoFocus name="name" required maxLength={80} />
                    </label>
                    <label>
                      登录账号
                      <input
                        name="username"
                        required
                        pattern="[a-zA-Z0-9_]{3,40}"
                        placeholder="3–40位字母、数字或下划线"
                      />
                    </label>
                    <label>
                      初始密码
                      <input
                        name="password"
                        type="password"
                        required
                        minLength={10}
                        autoComplete="new-password"
                      />
                    </label>
                    <p className="caption">
                      密码至少 10 位。请通过合适的渠道告知家长。
                    </p>
                  </>
                )}
                {modal === 'binding' && (
                  <>
                    <p>可选择多个家长；清空并保存将解除此学生的全部绑定。</p>
                    <div className="binding-options">
                      {parents.map((p) => (
                        <label key={p.id}>
                          <input
                            type="checkbox"
                            checked={chosen.includes(p.id)}
                            onChange={(e) =>
                              setChosen(
                                e.target.checked
                                  ? [...chosen, p.id]
                                  : chosen.filter((id) => id !== p.id),
                              )
                            }
                          />
                          {p.first_name}（{p.username}）
                        </label>
                      ))}
                    </div>
                    {!parents.length && (
                      <p className="caption">
                        暂无可选账号，请先在“家长绑定”页面创建家长账号。
                      </p>
                    )}
                  </>
                )}
                {error && (
                  <div role="alert" className="form-error">
                    {error}
                  </div>
                )}
                <div className="form-actions">
                  <button
                    type="button"
                    className="button secondary"
                    disabled={busy}
                    onClick={() => {
                      setModal('');
                      setError('');
                    }}
                  >
                    取消
                  </button>
                  <button
                    className="button"
                    disabled={
                      busy ||
                      (modal === 'binding' && !parents.length && !chosen.length)
                    }
                  >
                    {busy ? '正在保存…' : '确认保存'}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
