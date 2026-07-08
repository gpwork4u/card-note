import { load, dump } from 'js-yaml';

export interface ParsedDoc {
  data: Record<string, any>;
  body: string;
}

/** serialize a frontmatter object + markdown body into a `.md` file string */
export function stringifyDoc(data: Record<string, unknown>, body: string): string {
  const fm = dump(data, { lineWidth: -1, sortKeys: false, noRefs: true }).trimEnd();
  const trimmedBody = body.replace(/\s+$/, '');
  return `---\n${fm}\n---\n${trimmedBody ? trimmedBody + '\n' : ''}`;
}

/** parse a `.md` file string into { data, body } */
export function parseDoc(text: string): ParsedDoc {
  const normalized = text.replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(normalized);
  if (!m) return { data: {}, body: normalized };
  let data: Record<string, any> = {};
  try {
    data = (load(m[1]) as Record<string, any>) ?? {};
  } catch {
    data = {};
  }
  return { data, body: m[2].replace(/\n+$/, '') };
}
