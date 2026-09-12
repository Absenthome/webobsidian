import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { agentApi, AgentApiError } from './client.js';

const server = new McpServer({ name: 'webobsidian', version: '0.1.0' });

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function fail(err: unknown) {
  const text = err instanceof AgentApiError ? err.message : err instanceof Error ? err.message : String(err);
  return { content: [{ type: 'text' as const, text }], isError: true };
}

server.registerTool(
  'list_notes',
  {
    title: 'List notes',
    description: 'List markdown notes in the vault (paginated).',
    inputSchema: {
      offset: z.number().int().min(0).optional().describe('Pagination offset (default 0)'),
      limit: z.number().int().min(1).max(500).optional().describe('Max notes to return (default 100, max 500)'),
    },
  },
  async ({ offset, limit }) => {
    try {
      return ok(await agentApi.listNotes(offset, limit));
    } catch (err) {
      return fail(err);
    }
  },
);

server.registerTool(
  'read_note',
  {
    title: 'Read note',
    description: 'Read a note by vault-relative path, including parsed frontmatter, tags, and links.',
    inputSchema: {
      path: z.string().min(1).describe('Vault-relative path, e.g. "Notes/Ideas.md"'),
    },
  },
  async ({ path }) => {
    try {
      return ok(await agentApi.readNote(path));
    } catch (err) {
      return fail(err);
    }
  },
);

server.registerTool(
  'write_note',
  {
    title: 'Write note',
    description: 'Create or overwrite a note at the given vault-relative path.',
    inputSchema: {
      path: z.string().min(1).describe('Vault-relative path, e.g. "Notes/Ideas.md"'),
      content: z.string().describe('Full markdown content to write'),
    },
  },
  async ({ path, content }) => {
    try {
      return ok(await agentApi.writeNote(path, content));
    } catch (err) {
      return fail(err);
    }
  },
);

server.registerTool(
  'append_note',
  {
    title: 'Append to note',
    description: 'Append text to a note, creating it first if it does not exist.',
    inputSchema: {
      path: z.string().min(1).describe('Vault-relative path, e.g. "Notes/Ideas.md"'),
      content: z.string().describe('Text to append'),
    },
  },
  async ({ path, content }) => {
    try {
      return ok(await agentApi.appendNote(path, content));
    } catch (err) {
      return fail(err);
    }
  },
);

server.registerTool(
  'delete_note',
  {
    title: 'Delete note',
    description: 'Move a note to trash (per vault deleteMode).',
    inputSchema: {
      path: z.string().min(1).describe('Vault-relative path, e.g. "Notes/Ideas.md"'),
    },
  },
  async ({ path }) => {
    try {
      return ok(await agentApi.deleteNote(path));
    } catch (err) {
      return fail(err);
    }
  },
);

server.registerTool(
  'search_notes',
  {
    title: 'Search notes',
    description:
      'Full-text search across the vault (QMD engine). Supports fielded queries like "tag:idea", "path:Notes/", "title:Foo".',
    inputSchema: {
      query: z.string().min(1).describe('Search query'),
      limit: z.number().int().min(1).max(100).optional().describe('Max results (default 20, max 100)'),
    },
  },
  async ({ query, limit }) => {
    try {
      return ok(await agentApi.search(query, limit));
    } catch (err) {
      return fail(err);
    }
  },
);

server.registerTool(
  'get_backlinks',
  {
    title: 'Get backlinks',
    description: 'List notes that link to the given vault-relative path.',
    inputSchema: {
      path: z.string().min(1).describe('Vault-relative path, e.g. "Notes/Ideas.md"'),
    },
  },
  async ({ path }) => {
    try {
      return ok(await agentApi.backlinks(path));
    } catch (err) {
      return fail(err);
    }
  },
);

server.registerTool(
  'list_tags',
  {
    title: 'List tags',
    description: 'List all tags used across the vault, with note counts.',
    inputSchema: {},
  },
  async () => {
    try {
      return ok(await agentApi.tags());
    } catch (err) {
      return fail(err);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
