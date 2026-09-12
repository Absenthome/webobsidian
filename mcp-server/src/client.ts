const BASE_URL = (process.env.WEBOBSIDIAN_BASE_URL ?? 'http://localhost:8787').replace(/\/+$/, '');
const API_KEY = process.env.WEBOBSIDIAN_API_KEY;

if (!API_KEY) {
  // Never print to stdout: the stdio transport reserves it for JSON-RPC framing.
  process.stderr.write(
    'webobsidian-mcp: WEBOBSIDIAN_API_KEY is required (create one in WebObsidian → Settings → API Keys).\n',
  );
  process.exit(1);
}

export class AgentApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AgentApiError';
  }
}

/** Vault-relative note path -> URL path segment, preserving `/` (matches server's `/notes/*`). */
export function encodeNotePath(path: string): string {
  return path
    .split('/')
    .filter((s) => s.length > 0)
    .map(encodeURIComponent)
    .join('/');
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}/api/v1${path}`, {
    method,
    headers: {
      'X-API-Key': API_KEY!,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const json = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const msg = (json && (json.error || json.message)) || res.statusText;
    throw new AgentApiError(res.status, `Agent API ${method} ${path} -> ${res.status}: ${msg}`);
  }
  return json as T;
}

export const agentApi = {
  listNotes: (offset?: number, limit?: number) => {
    const qs = new URLSearchParams();
    if (offset !== undefined) qs.set('offset', String(offset));
    if (limit !== undefined) qs.set('limit', String(limit));
    const query = qs.toString();
    return request<{ total: number; offset: number; limit: number; notes: string[] }>(
      'GET',
      `/notes${query ? `?${query}` : ''}`,
    );
  },

  readNote: (path: string) =>
    request<{
      path: string;
      content: string;
      title: string;
      frontmatter: Record<string, unknown>;
      tags: string[];
      links: string[];
    }>('GET', `/notes/${encodeNotePath(path)}`),

  writeNote: (path: string, content: string) =>
    request<{ ok: true; path: string }>('PUT', `/notes/${encodeNotePath(path)}`, { content }),

  appendNote: (path: string, append: string) =>
    request<{ ok: true; path: string; size: number }>('PATCH', `/notes/${encodeNotePath(path)}`, {
      append,
    }),

  deleteNote: (path: string) =>
    request<{ ok: true; trashed: string }>('DELETE', `/notes/${encodeNotePath(path)}`),

  search: (q: string, limit?: number) => {
    const qs = new URLSearchParams({ q });
    if (limit !== undefined) qs.set('limit', String(limit));
    return request<{
      query: string;
      hits: { path: string; title: string; score: number; tags: string[]; snippet: string }[];
    }>('GET', `/search?${qs.toString()}`);
  },

  backlinks: (path: string) =>
    request<{ path: string; backlinks: string[] }>(
      'GET',
      `/backlinks?path=${encodeURIComponent(path)}`,
    ),

  tags: () => request<{ tags: { tag: string; count: number }[] }>('GET', '/tags'),
};
