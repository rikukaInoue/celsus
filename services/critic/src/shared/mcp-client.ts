import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { ToolHandler } from './llm.js';

interface McpServer {
  client: Client;
  tools: Tool[];
}

const servers: McpServer[] = [];

async function resolveGitHubToken(): Promise<string | null> {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    const { execSync } = await import('node:child_process');
    const token = execSync('gh auth token', { encoding: 'utf-8' }).trim();
    if (token) return token;
  } catch {}
  return null;
}

export async function connectGitHubServer(): Promise<void> {
  const token = await resolveGitHubToken();
  if (!token) {
    console.log('⏭ Skipping GitHub MCP server (no GITHUB_TOKEN or gh CLI)');
    return;
  }

  try {
    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: { ...process.env, GITHUB_PERSONAL_ACCESS_TOKEN: token },
    });

    const client = new Client({ name: 'critic', version: '0.1.0' });
    await client.connect(transport);

    const { tools } = await client.listTools();
    const anthropicTools: Tool[] = tools.map(t => ({
      name: t.name,
      description: t.description ?? '',
      input_schema: t.inputSchema as Tool['input_schema'],
    }));

    servers.push({ client, tools: anthropicTools });
    console.log(`🔧 GitHub MCP: ${tools.length} tools available`);
  } catch (err) {
    console.error(`❌ GitHub MCP failed: ${(err as Error).message}`);
  }
}

const URL_WHITELIST = [
  /^https:\/\/github\.com\//,
  /^https:\/\/raw\.githubusercontent\.com\//,
];

function isAllowedUrl(url: string): boolean {
  return URL_WHITELIST.some(p => p.test(url));
}

export function getAllTools(): Tool[] {
  const fetchTool: Tool = {
    name: 'fetch_url',
    description: 'Fetch content from a whitelisted URL (GitHub only). Returns text content.',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'URL to fetch' },
      },
      required: ['url'],
    },
  };

  return [...servers.flatMap(s => s.tools), fetchTool];
}

export function createToolHandler(): ToolHandler {
  return async (name: string, input: Record<string, unknown>): Promise<string> => {
    if (name === 'fetch_url') {
      const url = input.url as string;
      if (!isAllowedUrl(url)) {
        return `Error: URL not allowed. Only GitHub URLs are permitted.`;
      }
      try {
        const res = await fetch(url);
        if (!res.ok) return `Error: ${res.status} ${res.statusText}`;
        const text = await res.text();
        return text.slice(0, 8000);
      } catch (err) {
        return `Error: ${(err as Error).message}`;
      }
    }

    for (const server of servers) {
      const tool = server.tools.find(t => t.name === name);
      if (tool) {
        const result = await server.client.callTool({ name, arguments: input });
        const content = result.content;
        if (Array.isArray(content)) {
          return content.map(c => (c as { text?: string }).text ?? JSON.stringify(c)).join('\n');
        }
        return String(content);
      }
    }

    return `Error: Unknown tool ${name}`;
  };
}
