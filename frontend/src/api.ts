export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function errorDetails(value: unknown, path = ''): string[] {
  if (typeof value === 'string') return [path ? `${path}：${value}` : value];
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      errorDetails(
        entry,
        typeof entry === 'string' ? path : `${path} 第 ${index + 1} 项`,
      ),
    );
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, entry]) =>
      errorDetails(entry, path ? `${path} / ${key}` : key),
    );
  }
  return [];
}

export async function api<T>(
  path: string,
  body?: unknown,
  method = 'POST',
): Promise<T> {
  const headers: Record<string, string> = {};
  const multipart = body instanceof FormData;
  if (body !== undefined) {
    if (!multipart) headers['Content-Type'] = 'application/json';
    headers['X-CSRFToken'] = decodeURIComponent(
      document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '',
    );
  }

  let response: Response;
  try {
    response = await fetch('/api/v1/' + path, {
      method: body === undefined ? 'GET' : method,
      headers,
      body: multipart ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('无法连接本地服务，请确认后端已启动后重试。', 0);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = errorDetails(data?.detail ?? data).join('；');
    throw new ApiError(
      message || '服务暂不可用，请稍后重试。',
      response.status,
    );
  }
  return data as T;
}
