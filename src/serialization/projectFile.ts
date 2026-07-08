import type { KanbanColumn, Project } from '@/types';

export function projectPath(id: string): string {
  return `projects/${id}.json`;
}

export function projectIdFromPath(path: string): string {
  return path.replace(/^projects\//, '').replace(/\.json$/, '');
}

function asIds(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
}

export function serializeProject(p: Project): string {
  // stable key order keeps diffs clean
  const obj = {
    id: p.id,
    name: p.name,
    color: p.color,
    cols: {
      todo: p.cols.todo,
      doing: p.cols.doing,
      done: p.cols.done,
    },
  };
  return JSON.stringify(obj, null, 2) + '\n';
}

export function parseProject(text: string, fallbackId: string): Project {
  let raw: any = {};
  try {
    raw = JSON.parse(text);
  } catch {
    raw = {};
  }
  const cols = raw.cols ?? {};
  const safeCols: Record<KanbanColumn, string[]> = {
    todo: asIds(cols.todo),
    doing: asIds(cols.doing),
    done: asIds(cols.done),
  };
  return {
    id: String(raw.id ?? fallbackId),
    name: String(raw.name ?? '未命名專案'),
    color: String(raw.color ?? '#4263EB'),
    cols: safeCols,
  };
}
