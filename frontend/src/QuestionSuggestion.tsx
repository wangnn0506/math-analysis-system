import { useState } from 'react';
import { api } from './api';

type Suggestion = {
  mode: 'local' | 'model';
  reason: string;
  knowledge: { id: number; name: string }[];
};

export function QuestionSuggestion({
  path,
  stem,
  revision,
  model,
  onApply,
}: {
  path: string;
  stem: string;
  revision: number;
  model: boolean;
  onApply: (ids: number[]) => void;
}) {
  const [result, setResult] = useState<{
    stem: string;
    revision: number;
    suggestion: Suggestion;
  }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const suggestion =
    result?.stem === stem && result.revision === revision
      ? result.suggestion
      : null;
  const canRequest =
    !busy && stem.trim().length > 0 && stem.trim().length <= 6000;

  async function request(external: boolean) {
    if (
      external &&
      !window.confirm(
        '确认这是自编题干，且不含学生信息？仅当前题干与知识点目录会发送给已配置的模型服务。',
      )
    )
      return;
    setBusy(true);
    setError('');
    setResult(undefined);
    try {
      await api('auth/csrf/');
      const suggestion = await api<Suggestion>(path, {
        stem,
        revision,
        allow_external: external,
      });
      setResult({ stem, revision, suggestion });
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="paper-suggestion">
      <div className="paper-actions">
        <button
          type="button"
          className="button secondary"
          disabled={!canRequest}
          onClick={() => void request(false)}
        >
          获取规则建议
        </button>
        {model && (
          <button
            type="button"
            className="button secondary"
            disabled={!canRequest}
            onClick={() => void request(true)}
          >
            获取模型建议
          </button>
        )}
      </div>
      {busy && <p role="status">正在生成知识点建议，可继续编辑题目。</p>}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {suggestion && (
        <div>
          <p>
            <strong>
              {suggestion.mode === 'local' ? '本地规则建议' : '模型建议'}
            </strong>{' '}
            ·{' '}
            {suggestion.knowledge.map(({ name }) => name).join('、') ||
              '未找到适用标签'}
          </p>
          <p>{suggestion.reason}</p>
          {suggestion.knowledge.length > 0 && (
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                onApply(suggestion.knowledge.map(({ id }) => id));
                setResult(undefined);
              }}
            >
              用建议替换标签
            </button>
          )}
          <button
            type="button"
            className="text-button"
            onClick={() => setResult(undefined)}
          >
            忽略建议
          </button>
          <p>应用后仍需逐题人工核对并保存。</p>
        </div>
      )}
    </div>
  );
}
