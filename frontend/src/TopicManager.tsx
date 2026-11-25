import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from './api';
import { Card } from './ui/components';
import './topics.css';

type TopicSummary = {
  id: number;
  slug: string;
  title: string;
  revision: number;
  published_revision: number | null;
  preview_url: string;
  public_url: string;
};
type English = {
  title: string;
  description: string;
  stems: Record<string, string>;
};
type Draft = {
  english: English;
  slug: string;
  title: string;
  description: string;
  paper_id: number | null;
  question_ids: number[];
};
type Topic = TopicSummary &
  Omit<Draft, 'slug' | 'english'> & {
    english: Partial<English>;
    english_preview_url: string | null;
    english_public_url: string | null;
  };
type Paper = { id: number; title: string; status: string; count: number };
type Question = { id: number; number: string; stem: string };
type PageData = { topics: TopicSummary[]; papers: Paper[] };

function status(topic: TopicSummary) {
  if (topic.published_revision === null) return '未发布';
  return topic.published_revision === topic.revision
    ? '已发布'
    : '已发布 · 有新草稿';
}

export default function TopicManager() {
  const [data, setData] = useState<PageData>();
  const [editor, setEditor] = useState<Topic | 'new' | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([api<TopicSummary[]>('topics/'), api<Paper[]>('papers/')])
      .then(([topics, papers]) => {
        if (active)
          setData({
            topics,
            papers: papers.filter((paper) => paper.status === 'confirmed'),
          });
      })
      .catch((error: Error) => {
        if (!active) return;
        if (error instanceof ApiError && [401, 403].includes(error.status))
          setNeedsLogin(true);
        else setError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  async function open(id: number) {
    setOpening(true);
    setError('');
    try {
      setEditor(await api<Topic>(`topics/${id}/`));
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setOpening(false);
    }
  }

  function sync(topic: Topic) {
    setData(
      (current) =>
        current && {
          ...current,
          topics: [
            topic,
            ...current.topics.filter(({ id }) => id !== topic.id),
          ],
        },
    );
  }

  if (loading)
    return (
      <Card>
        <p role="status">正在读取练习专题…</p>
      </Card>
    );
  if (needsLogin) {
    return (
      <Card title="需要教师登录">
        <p>请先到班级管理登录教师账户。</p>
        <a href="#classes">前往班级管理</a>
      </Card>
    );
  }
  if (!data) {
    return (
      <Card title="无法读取练习专题">
        <p role="alert" className="form-error">
          {error}
        </p>
        <button
          className="button secondary"
          onClick={() => {
            setError('');
            setLoading(true);
            setAttempt((value) => value + 1);
          }}
        >
          重试
        </button>
      </Card>
    );
  }
  if (editor) {
    return (
      <TopicEditor
        initialTopic={editor === 'new' ? null : editor}
        papers={data.papers}
        onChange={sync}
        onBack={() => setEditor(null)}
      />
    );
  }

  return (
    <div className="topic-stack">
      <Card
        title="公开练习专题"
        extra={
          <button
            className="button"
            disabled={opening || !data.papers.length}
            onClick={() => setEditor('new')}
          >
            新建专题
          </button>
        }
      >
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {!data.papers.length && (
          <p>
            请先在<a href="#exams">考试试卷</a>中完成一份试卷的审核，再来选题。
          </p>
        )}
        {opening && <p role="status">正在读取专题…</p>}
        {!data.topics.length && data.papers.length > 0 && (
          <p>暂无专题。可以从已确认的试卷选题，创建第一份练习专题。</p>
        )}
        <ul className="topic-list">
          {data.topics.map((topic) => (
            <li key={topic.id}>
              <div>
                <strong>{topic.title}</strong>
                <p>{status(topic)}</p>
              </div>
              <button
                className="button secondary"
                disabled={opening}
                onClick={() => void open(topic.id)}
              >
                编辑
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function draftFrom(topic: Topic | null): Draft {
  return {
    title: topic?.title ?? '',
    description: topic?.description ?? '',
    slug: topic?.slug ?? '',
    paper_id: topic?.paper_id ?? null,
    question_ids: topic?.question_ids ?? [],
    english: { title: '', description: '', stems: {}, ...topic?.english },
  };
}

function TopicEditor({
  initialTopic,
  papers,
  onChange,
  onBack,
}: {
  initialTopic: Topic | null;
  papers: Paper[];
  onChange: (topic: Topic) => void;
  onBack: () => void;
}) {
  const [saved, setSaved] = useState(initialTopic);
  const [draft, setDraft] = useState(() => draftFrom(initialTopic));
  const [dirty, setDirty] = useState(false);
  const [selection, setSelection] = useState<{
    paperId: number;
    questions: Question[];
  } | null>(null);
  const [questionError, setQuestionError] = useState<{
    paperId: number;
    message: string;
  } | null>(null);
  const [questionAttempt, setQuestionAttempt] = useState(0);
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const paperId = draft.paper_id;
  const questions =
    selection?.paperId === paperId ? selection?.questions : undefined;
  const currentQuestionError =
    questionError?.paperId === paperId ? questionError?.message : undefined;

  useEffect(() => {
    if (paperId === null) return;
    let active = true;
    api<Question[]>(`papers/${paperId}/topic-questions/`)
      .then((questions) => {
        if (active) setSelection({ paperId, questions });
      })
      .catch((error: Error) => {
        if (active) setQuestionError({ paperId, message: error.message });
      });
    return () => {
      active = false;
    };
  }, [paperId, questionAttempt]);

  useEffect(() => {
    if (!dirty) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function edit(patch: Partial<Draft>) {
    setDraft({ ...draft, ...patch });
    setApproved(false);
    setDirty(true);
    setNotice('');
  }

  async function send(operation: () => Promise<Topic>, message: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const topic = await operation();
      setSaved(topic);
      setDraft(draftFrom(topic));
      setDirty(false);
      setConflict(false);
      setApproved(false);
      setNotice(message);
      onChange(topic);
    } catch (error) {
      setError((error as Error).message);
      setConflict(error instanceof ApiError && error.status === 409);
    } finally {
      setBusy(false);
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !paperId || !draft.question_ids.length) return;
    void send(async () => {
      await api('auth/csrf/');
      const { slug, english, ...fields } = draft;
      const translation = {
        ...english,
        stems: Object.fromEntries(
          draft.question_ids.map((id) => [id, english.stems[id] ?? '']),
        ),
      };
      return saved
        ? api<Topic>(
            `topics/${saved.id}/`,
            { ...fields, english: translation, revision: saved.revision },
            'PATCH',
          )
        : api<Topic>('topics/', { ...fields, english: translation, slug });
    }, '草稿已保存，可以打开预览。');
  }

  function setPublication(publish: boolean) {
    if (!saved) return;
    if (
      !publish &&
      !window.confirm('下线后，访问公开链接将显示页面不存在。确定下线？')
    )
      return;
    void send(
      async () => {
        await api('auth/csrf/');
        return api<Topic>(
          `topics/${saved.id}/${publish ? 'publish' : 'unpublish'}/`,
          {
            revision: saved.revision,
            approved_for_publication: approved,
          },
        );
      },
      publish ? '专题已发布，可以打开公开页。' : '专题已下线，草稿仍可编辑。',
    );
  }

  const hasPublication = saved !== null && saved.published_revision !== null;
  const canPublish =
    saved && saved.published_revision !== saved.revision && !dirty && !conflict;

  return (
    <div className="topic-stack">
      <div className="topic-actions">
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => {
            if (!dirty || window.confirm('有未保存的修改，确定返回？'))
              onBack();
          }}
        >
          返回专题列表
        </button>
        {saved && <span className="topic-status">{status(saved)}</span>}
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="form-success">
          {notice}
        </p>
      )}
      {conflict && saved && (
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => {
            if (
              !dirty ||
              window.confirm('重新加载会丢弃当前未保存的内容，继续吗？')
            ) {
              void send(
                () => api<Topic>(`topics/${saved.id}/`),
                '已载入最新草稿。',
              );
            }
          }}
        >
          载入最新草稿
        </button>
      )}
      <Card title={saved ? '编辑专题' : '新建专题'}>
        <form className="topic-form" onSubmit={save}>
          <fieldset className="topic-stack" disabled={busy}>
            <label>
              标题
              <input
                value={draft.title}
                required
                maxLength={150}
                onChange={(event) => edit({ title: event.target.value })}
              />
            </label>
            <label>
              简介
              <textarea
                value={draft.description}
                maxLength={1000}
                rows={3}
                onChange={(event) => edit({ description: event.target.value })}
              />
            </label>
            <label>
              公开地址标识
              <input
                value={draft.slug}
                required
                readOnly={!!saved}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                maxLength={80}
                placeholder="例如 algebra-basics"
                onChange={(event) => edit({ slug: event.target.value })}
              />
            </label>
            <p className="topic-hint">
              使用小写英文字母、数字和短横线。创建后地址保持固定。
            </p>
            <label>
              来源试卷
              <select
                aria-label="来源试卷"
                required
                value={paperId ?? ''}
                onChange={(event) => {
                  setSelection(null);
                  setQuestionError(null);
                  edit({
                    paper_id: Number(event.target.value) || null,
                    question_ids: [],
                    english: { ...draft.english, stems: {} },
                  });
                }}
              >
                <option value="">选择已确认的试卷</option>
                {papers.map((paper) => (
                  <option key={paper.id} value={paper.id}>
                    {paper.title}（{paper.count} 题）
                  </option>
                ))}
              </select>
            </label>
            {paperId && (
              <div className="topic-stack">
                <h3>选择题目（已选 {draft.question_ids.length} 题）</h3>
                {currentQuestionError ? (
                  <div>
                    <p className="form-error" role="alert">
                      {currentQuestionError}
                    </p>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => {
                        setQuestionError(null);
                        setQuestionAttempt((value) => value + 1);
                      }}
                    >
                      重试读取题目
                    </button>
                  </div>
                ) : !questions ? (
                  <p role="status">正在读取试卷题目…</p>
                ) : (
                  <ul className="topic-list">
                    {questions.map((question) => (
                      <li key={question.id}>
                        <label className="topic-question">
                          <input
                            type="checkbox"
                            checked={draft.question_ids.includes(question.id)}
                            onChange={(event) =>
                              edit({
                                question_ids: event.target.checked
                                  ? [...draft.question_ids, question.id]
                                  : draft.question_ids.filter(
                                      (id) => id !== question.id,
                                    ),
                              })
                            }
                          />
                          <span>
                            <strong>原题号 {question.number}</strong>
                            <span className="topic-stem">{question.stem}</span>
                          </span>
                        </label>
                      </li>
                    ))}
                    {!questions.length && <li>所选试卷暂无可发布的题目。</li>}
                  </ul>
                )}
              </div>
            )}
            <details>
              <summary>英文版（可选）</summary>
              <div className="topic-stack topic-translation" lang="zh-CN">
                <p className="topic-hint">
                  如需发布英文版，请填写英文标题和每道已选题目的英文题干。英文简介可留空。
                </p>
                <label>
                  英文标题
                  <input
                    lang="en"
                    value={draft.english.title}
                    maxLength={150}
                    onChange={(event) =>
                      edit({
                        english: {
                          ...draft.english,
                          title: event.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label>
                  英文简介
                  <textarea
                    lang="en"
                    value={draft.english.description}
                    maxLength={1000}
                    rows={3}
                    onChange={(event) =>
                      edit({
                        english: {
                          ...draft.english,
                          description: event.target.value,
                        },
                      })
                    }
                  />
                </label>
                {questions
                  ?.filter(({ id }) => draft.question_ids.includes(id))
                  .map(({ id, number }) => (
                    <label key={id}>
                      第 {number} 题英文题干
                      <textarea
                        lang="en"
                        value={draft.english.stems[id] ?? ''}
                        maxLength={40000}
                        rows={4}
                        onChange={(event) =>
                          edit({
                            english: {
                              ...draft.english,
                              stems: {
                                ...draft.english.stems,
                                [id]: event.target.value,
                              },
                            },
                          })
                        }
                      />
                    </label>
                  ))}
              </div>
            </details>
            <div className="topic-actions">
              <button
                className="button"
                disabled={
                  busy ||
                  !dirty ||
                  conflict ||
                  !questions ||
                  !draft.question_ids.length
                }
              >
                {busy ? '正在处理…' : '保存草稿'}
              </button>
            </div>
          </fieldset>
        </form>
      </Card>
      {saved && (
        <Card title="预览与发布">
          <div className="topic-stack">
            {dirty && (
              <p className="topic-hint">
                保存当前修改后即可预览新版。公开页继续显示上次发布的内容。
              </p>
            )}
            {!dirty && !conflict && (
              <a href={saved.preview_url} target="_blank" rel="noreferrer">
                打开草稿预览
              </a>
            )}
            {!dirty && !conflict && saved.english_preview_url && (
              <a
                href={saved.english_preview_url}
                target="_blank"
                rel="noreferrer"
              >
                打开英文草稿预览
              </a>
            )}
            {saved.english_public_url && (
              <a
                href={saved.english_public_url}
                target="_blank"
                rel="noreferrer"
              >
                打开英文公开页
              </a>
            )}
            {hasPublication && (
              <a href={saved.public_url} target="_blank" rel="noreferrer">
                打开公开页
              </a>
            )}
            {canPublish && (
              <label className="topic-question">
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={approved}
                  onChange={(event) => setApproved(event.target.checked)}
                />
                <span>
                  我已核对预览，题目是可公开使用的自编内容，且不含学生个人信息。
                </span>
              </label>
            )}
            <div className="topic-actions">
              {canPublish && (
                <button
                  className="button"
                  disabled={!approved || busy}
                  onClick={() => setPublication(true)}
                >
                  {hasPublication ? '发布新版' : '发布专题'}
                </button>
              )}
              {hasPublication && (
                <button
                  className="button secondary"
                  disabled={busy || dirty || conflict}
                  onClick={() => setPublication(false)}
                >
                  下线专题
                </button>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
