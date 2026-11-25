import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, ApiError } from './api';
import { Card } from './ui/components';
import { QuestionSuggestion } from './QuestionSuggestion';
import './papers.css';

const kinds = {
  unknown: '待确定',
  single: '单选题',
  multiple: '多选题',
  blank: '填空题',
  written: '解答题',
};

type Item = {
  number: string;
  stem: string;
  kind: keyof typeof kinds;
  points: string | null;
  knowledge: number[];
  needs_review: boolean;
};

type PaperSummary = {
  id: number;
  title: string;
  status: 'draft' | 'confirmed';
  count: number;
};
type Paper = Omit<PaperSummary, 'count'> & {
  revision: number;
  warnings: string[];
  source_text: string;
  has_source: boolean;
  items: Item[];
};
type KnowledgePoint = { id: number; code: string; name: string };
type EditableItem = Item & { key: string };

export default function PaperManager() {
  const [papers, setPapers] = useState<PaperSummary[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgePoint[]>([]);
  const [selection, setSelection] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<PaperSummary[]>('papers/'),
      api<KnowledgePoint[]>('knowledge/'),
    ])
      .then(([list, tags]) => {
        if (cancelled) return;
        setPapers(list);
        setKnowledge(tags);
      })
      .catch((error: Error) => {
        if (cancelled) return;
        if (error instanceof ApiError && [401, 403].includes(error.status)) {
          setNeedsLogin(true);
        } else {
          setError(error.message);
          setLoadFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function synchronize(paper: Paper) {
    const summary = {
      id: paper.id,
      title: paper.title,
      status: paper.status,
      count: paper.items.length,
    };
    setPapers((list) =>
      list.some(({ id }) => id === paper.id)
        ? list.map((row) => (row.id === paper.id ? summary : row))
        : [summary, ...list],
    );
  }

  async function openPaper(operation: () => Promise<Paper>) {
    setError('');
    setBusy(true);
    try {
      const paper = await operation();
      synchronize(paper);
      setSelection(paper);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const file = data.get('file');
    if (
      !(file instanceof File) ||
      !file.name.toLowerCase().endsWith('.docx') ||
      file.size > 10 * 1024 * 1024
    ) {
      setError('请选择不超过 10 MB 的 .docx 文件。');
      return;
    }
    void openPaper(async () => {
      await api('auth/csrf/');
      return api<Paper>('papers/', data);
    });
  }

  if (loading)
    return (
      <Card>
        <p role="status">正在读取试卷…</p>
      </Card>
    );
  if (needsLogin) {
    return (
      <Card title="需要教师登录">
        <p>请先到班级管理登录教师账户，再返回考试试卷。</p>
        <a href="#classes">前往班级管理</a>
      </Card>
    );
  }

  if (loadFailed) {
    return (
      <Card title="无法读取试卷">
        <p className="form-error" role="alert">
          {error}
        </p>
        <button
          className="button secondary"
          onClick={() => {
            setLoading(true);
            setLoadFailed(false);
            setError('');
            setAttempt((value) => value + 1);
          }}
        >
          重试
        </button>
      </Card>
    );
  }

  if (selection) {
    return (
      <PaperReview
        paper={selection}
        knowledge={knowledge}
        onChange={synchronize}
        onBack={() => {
          setSelection(null);
          setError('');
        }}
      />
    );
  }

  return (
    <div className="paper-page">
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Card title="上传 Word 试卷">
        <p>上传后生成草稿。请对照原卷核对题目、分值和知识点。</p>
        <form className="paper-upload" onSubmit={upload}>
          <label>
            试卷文件（.docx，最大 10 MB）
            <input
              name="file"
              type="file"
              accept=".docx"
              required
              disabled={busy}
            />
          </label>
          <div className="paper-actions">
            <button className="button" disabled={busy}>
              上传并拆题
            </button>
            <a href="/api/v1/demo/paper/">下载三题样卷</a>
          </div>
        </form>
      </Card>
      <Card title="试卷列表">
        {busy && <p role="status">正在处理试卷…</p>}
        {papers.length === 0 && !error && (
          <p>暂无试卷，可下载样卷体验审核流程。</p>
        )}
        <ul className="paper-list">
          {papers.map((paper) => (
            <li key={paper.id}>
              <div>
                <strong>{paper.title}</strong>
                <p>
                  {paper.count} 题 ·{' '}
                  {paper.status === 'draft' ? '草稿' : '已确认'}
                </p>
              </div>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  void openPaper(() => api<Paper>(`papers/${paper.id}/`))
                }
              >
                {paper.status === 'draft' ? '审核' : '查看'}
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function PaperReview({
  paper,
  knowledge,
  onChange,
  onBack,
}: {
  paper: Paper;
  knowledge: KnowledgePoint[];
  onChange: (paper: Paper) => void;
  onBack: () => void;
}) {
  const [saved, setSaved] = useState(paper);
  const [modelAvailable, setModelAvailable] = useState(false);
  const suggestionPath = `papers/${paper.id}/question-suggestion/`;
  useEffect(() => {
    if (paper.status !== 'draft') return;
    let active = true;
    api<{ model_available: boolean }>(suggestionPath)
      .then(({ model_available }) => {
        if (active) setModelAvailable(model_available);
      })
      .catch(() => {
        if (active) setModelAvailable(false);
      });
    return () => {
      active = false;
    };
  }, [paper.status, suggestionPath]);
  const [title, setTitle] = useState(paper.title);
  const [items, setItems] = useState<EditableItem[]>(() =>
    paper.items.map(editable),
  );
  const [dirty, setDirty] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState('');
  const frozen = saved.status === 'confirmed';
  const pending = items.filter(
    (item) => item.needs_review || !reviewable(item),
  ).length;
  const total = items.reduce(
    (sum, item) => sum + (Number(item.points) || 0),
    0,
  );

  function changeItems(updated: EditableItem[]) {
    setItems(updated);
    setDirty(true);
    setNotice('');
  }

  function updateItem(key: string, patch: Partial<Item>) {
    changeItems(
      items.map((item) =>
        item.key === key ? { ...item, needs_review: true, ...patch } : item,
      ),
    );
  }

  async function request(operation: () => Promise<Paper>, message: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await operation();
      setSaved(result);
      setTitle(result.title);
      setItems((previous) =>
        result.items.map((item, index) => ({
          ...item,
          key: previous[index]?.key ?? crypto.randomUUID(),
        })),
      );
      setDirty(false);
      setConflict(false);
      setConfirming(false);
      setNotice(message);
      onChange(result);
    } catch (error) {
      setError((error as Error).message);
      setConflict(error instanceof ApiError && error.status === 409);
    } finally {
      setBusy(false);
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!items.length) {
      setError('请至少保留一道题。');
      return;
    }
    void request(
      () =>
        api<Paper>(
          `papers/${saved.id}/`,
          {
            title,
            revision: saved.revision,
            items: items.map(({ key: _key, ...item }) => item),
          },
          'PATCH',
        ),
      '草稿已保存。',
    );
  }

  return (
    <div className="paper-page">
      <div className="paper-actions">
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => {
            if (!dirty || window.confirm('有未保存的修改，确定返回试卷列表？'))
              onBack();
          }}
        >
          返回试卷列表
        </button>
        {saved.has_source && (
          <a href={`/api/v1/papers/${saved.id}/source/`}>下载原卷</a>
        )}
      </div>
      <Card title={frozen ? '已确认试卷' : '试卷审核'}>
        <p>
          {items.length} 题 · 已填分值合计 {Number(total.toFixed(2))} 分 ·{' '}
          {pending} 题待审核
        </p>
        {saved.warnings.length > 0 && (
          <div className="paper-warning">
            <strong>拆题提示</strong>
            <ul>
              {saved.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
        {saved.source_text && (
          <details>
            <summary>查看提取的原卷文字</summary>
            <pre>{saved.source_text}</pre>
          </details>
        )}
      </Card>
      <form onSubmit={save} className="paper-page">
        <fieldset
          className="paper-fields"
          disabled={frozen || busy || confirming}
        >
          <Card title="试卷内容">
            <label>
              试卷名称
              <input
                value={title}
                maxLength={150}
                required
                onChange={(event) => {
                  setTitle(event.target.value);
                  setDirty(true);
                  setNotice('');
                }}
              />
            </label>
          </Card>
          {items.map((item, index) => (
            <QuestionEditor
              key={item.key}
              item={item}
              index={index}
              knowledge={knowledge}
              editable={!frozen}
              suggestion={
                !frozen && (
                  <QuestionSuggestion
                    path={suggestionPath}
                    revision={saved.revision}
                    stem={item.stem}
                    model={modelAvailable}
                    onApply={(ids) => updateItem(item.key, { knowledge: ids })}
                  />
                )
              }
              onChange={(patch) => updateItem(item.key, patch)}
              onInsert={() =>
                changeItems([
                  ...items.slice(0, index + 1),
                  emptyItem(),
                  ...items.slice(index + 1),
                ])
              }
              onRemove={() =>
                changeItems(items.filter(({ key }) => key !== item.key))
              }
              canInsert={items.length < 300}
              canRemove={items.length > 1}
            />
          ))}
          {!frozen && (
            <button
              type="button"
              className="button secondary"
              disabled={items.length >= 300}
              onClick={() => changeItems([...items, emptyItem()])}
            >
              新增题目
            </button>
          )}
        </fieldset>
        <Card>
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
          {busy && <p role="status">正在保存或读取试卷…</p>}
          {conflict && (
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => {
                if (
                  !dirty ||
                  window.confirm(
                    '载入服务端版本会丢弃本页未保存的修改，继续吗？',
                  )
                ) {
                  setAcknowledged(false);
                  void request(
                    () => api<Paper>(`papers/${saved.id}/`),
                    '已载入最新版本。',
                  );
                }
              }}
            >
              载入最新版本
            </button>
          )}
          {!frozen && saved.warnings.length > 0 && (
            <label className="paper-check">
              <input
                type="checkbox"
                checked={acknowledged}
                disabled={busy || confirming}
                onChange={(event) => setAcknowledged(event.target.checked)}
              />
              已对照原卷处理拆题提示
            </label>
          )}
          {!frozen && !confirming && (
            <>
              <p>保存草稿并完成所有题目审核后，即可确认冻结。</p>
              <div className="paper-actions">
                <button
                  className="button secondary"
                  disabled={busy || !dirty || conflict}
                >
                  保存草稿
                </button>
                <button
                  type="button"
                  className="button"
                  disabled={
                    busy ||
                    dirty ||
                    conflict ||
                    !items.length ||
                    pending > 0 ||
                    (!!saved.warnings.length && !acknowledged)
                  }
                  onClick={() => setConfirming(true)}
                >
                  确认试卷
                </button>
              </div>
            </>
          )}
          {!frozen && confirming && (
            <>
              <p>确认后题目结构将冻结。确定使用当前版本吗？</p>
              <div className="paper-actions">
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={() => setConfirming(false)}
                >
                  继续检查
                </button>
                <button
                  type="button"
                  className="button"
                  disabled={busy || conflict}
                  onClick={() =>
                    void request(
                      () =>
                        api<Paper>(`papers/${saved.id}/confirm/`, {
                          revision: saved.revision,
                          acknowledge_warnings: acknowledged,
                        }),
                      '试卷已确认并冻结。',
                    )
                  }
                >
                  冻结试卷
                </button>
              </div>
            </>
          )}
        </Card>
      </form>
    </div>
  );
}

function editable(item: Item): EditableItem {
  return { ...item, key: crypto.randomUUID() };
}

function emptyItem(): EditableItem {
  return editable({
    number: '',
    stem: '',
    kind: 'unknown',
    points: null,
    knowledge: [],
    needs_review: true,
  });
}

function reviewable(item: Item) {
  const points = Number(item.points);
  return (
    item.number.trim() &&
    item.stem.trim() &&
    item.kind !== 'unknown' &&
    Number.isFinite(points) &&
    points >= 0.01 &&
    points <= 9999.99 &&
    item.knowledge.length > 0
  );
}

function QuestionEditor({
  item,
  index,
  knowledge,
  editable,
  onChange,
  onInsert,
  onRemove,
  canInsert,
  canRemove,
  suggestion,
}: {
  item: Item;
  index: number;
  knowledge: KnowledgePoint[];
  editable: boolean;
  onChange: (patch: Partial<Item>) => void;
  onInsert: () => void;
  onRemove: () => void;
  canInsert: boolean;
  canRemove: boolean;
  suggestion?: ReactNode;
}) {
  return (
    <Card title={`题块 ${index + 1}`}>
      <div className="paper-question-meta">
        <label>
          题号
          <input
            required
            maxLength={30}
            value={item.number}
            onChange={(event) => onChange({ number: event.target.value })}
          />
        </label>
        <label>
          题型
          <select
            aria-label="题型"
            value={item.kind}
            onChange={(event) =>
              onChange({ kind: event.target.value as Item['kind'] })
            }
          >
            {Object.entries(kinds).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          分值
          <input
            type="number"
            min="0.01"
            max="9999.99"
            step="0.01"
            value={item.points ?? ''}
            onChange={(event) =>
              onChange({ points: event.target.value || null })
            }
          />
        </label>
      </div>
      <label>
        题干、选项与小问
        <textarea
          required
          rows={5}
          maxLength={40000}
          value={item.stem}
          onChange={(event) => onChange({ stem: event.target.value })}
        />
      </label>
      {suggestion}
      <fieldset className="paper-knowledge">
        <legend>知识点</legend>
        {knowledge.length === 0 && <p>当前没有可选知识点。</p>}
        {knowledge.map((tag) => (
          <label className="paper-check" key={tag.id}>
            <input
              type="checkbox"
              checked={item.knowledge.includes(tag.id)}
              onChange={(event) =>
                onChange({
                  knowledge: event.target.checked
                    ? [...item.knowledge, tag.id]
                    : item.knowledge.filter((id) => id !== tag.id),
                })
              }
            />
            {tag.name}
          </label>
        ))}
      </fieldset>
      <label className="paper-check">
        <input
          type="checkbox"
          disabled={!reviewable(item)}
          checked={!item.needs_review}
          onChange={(event) =>
            onChange({ needs_review: !event.target.checked })
          }
        />
        已核对本题
      </label>
      {editable && (
        <div className="paper-actions">
          <button
            type="button"
            className="button secondary"
            disabled={!canInsert}
            onClick={onInsert}
          >
            在下方插题
          </button>
          <button
            type="button"
            className="text-button"
            disabled={!canRemove}
            onClick={onRemove}
          >
            移除题块
          </button>
        </div>
      )}
    </Card>
  );
}
