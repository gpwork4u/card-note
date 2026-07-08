import { isRecord } from './schema';

/** mutable context threaded through the recursion to flag lossy conversions */
export interface ConvertCtx {
  lossy: boolean;
}

type PMNode = Record<string, unknown>;

function nodeArray(v: unknown): PMNode[] {
  return Array.isArray(v) ? v.filter(isRecord) : [];
}

function nodeType(node: PMNode): string {
  return typeof node.type === 'string' ? node.type : '';
}

function attrs(node: PMNode): Record<string, unknown> {
  return isRecord(node.attrs) ? node.attrs : {};
}

/** collect raw text from any subtree (used for code blocks + lossy fallback) */
function collectText(node: unknown): string {
  if (!isRecord(node)) return '';
  if (typeof node.text === 'string') return node.text;
  return nodeArray(node.content)
    .map((c) => collectText(c))
    .join('');
}

function renderImage(node: PMNode): string {
  const a = attrs(node);
  const src = typeof a.src === 'string' ? a.src : '';
  const alt = typeof a.alt === 'string' ? a.alt : '';
  return src ? `![${alt}](${src})` : '';
}

// ---- inline ----------------------------------------------------------------

function renderInlineNode(node: PMNode, ctx: ConvertCtx): string {
  const type = nodeType(node);
  if (type === 'text') {
    let text = typeof node.text === 'string' ? node.text : '';
    const marks = Array.isArray(node.marks) ? node.marks : [];
    for (const mark of marks) {
      if (!isRecord(mark)) continue;
      const mt = typeof mark.type === 'string' ? mark.type : '';
      if (mt === 'bold' || mt === 'strong') text = `**${text}**`;
      else if (mt === 'italic' || mt === 'em') text = `*${text}*`;
      else if (mt === 'code') text = `\`${text}\``;
      else if (mt === 'link') {
        const ma = isRecord(mark.attrs) ? mark.attrs : {};
        const href = typeof ma.href === 'string' ? ma.href : '';
        if (href) text = `[${text}](${href})`;
      }
    }
    return text;
  }
  if (type === 'hardBreak') return '\n';
  if (type === 'image') return renderImage(node);
  if (node.content) return renderInline(node.content, ctx);
  // unknown inline node — keep its plain text, flag lossy
  ctx.lossy = true;
  return collectText(node);
}

function renderInline(content: unknown, ctx: ConvertCtx): string {
  return nodeArray(content)
    .map((n) => renderInlineNode(n, ctx))
    .join('');
}

// ---- block -----------------------------------------------------------------

function renderListItem(item: PMNode, ctx: ConvertCtx): string {
  // a listItem usually wraps paragraphs / nested lists
  return renderBlocks(item.content, ctx);
}

function renderList(content: unknown, ctx: ConvertCtx, ordered: boolean): string {
  const items = nodeArray(content);
  const lines: string[] = [];
  items.forEach((item, i) => {
    const marker = ordered ? `${i + 1}. ` : '- ';
    const inner = renderListItem(item, ctx) || '';
    const innerLines = inner.length ? inner.split('\n') : [''];
    innerLines.forEach((line, j) => {
      if (j === 0) lines.push(marker + line);
      else lines.push('  ' + line); // indent continuation / nested content
    });
  });
  return lines.join('\n');
}

function renderBlock(node: PMNode, ctx: ConvertCtx): string {
  const type = nodeType(node);
  switch (type) {
    case 'paragraph':
      return renderInline(node.content, ctx);
    case 'heading': {
      const a = attrs(node);
      const rawLevel = typeof a.level === 'number' ? a.level : 1;
      const level = Math.min(6, Math.max(1, Math.floor(rawLevel)));
      return '#'.repeat(level) + ' ' + renderInline(node.content, ctx);
    }
    case 'bulletList':
      return renderList(node.content, ctx, false);
    case 'orderedList':
      return renderList(node.content, ctx, true);
    case 'listItem':
      // normally reached via renderList; handle defensively
      return renderListItem(node, ctx);
    case 'blockquote':
      return renderBlocks(node.content, ctx)
        .split('\n')
        .map((l) => (l ? `> ${l}` : '>'))
        .join('\n');
    case 'codeBlock': {
      const a = attrs(node);
      const lang =
        typeof a.language === 'string' ? a.language : typeof a.lang === 'string' ? a.lang : '';
      const code = collectText(node);
      return '```' + lang + '\n' + code + '\n```';
    }
    case 'image':
      return renderImage(node);
    case 'horizontalRule':
    case 'hr':
      return '---';
    case 'text':
      return renderInlineNode(node, ctx);
    default:
      // unknown block node — keep plain text, flag lossy
      ctx.lossy = true;
      return collectText(node);
  }
}

function renderBlocks(content: unknown, ctx: ConvertCtx): string {
  return nodeArray(content)
    .map((n) => renderBlock(n, ctx))
    .filter((s) => s.length > 0)
    .join('\n\n');
}

// ---- public ----------------------------------------------------------------

/**
 * Convert a Heptabase card `content` (JSON-string ProseMirror doc, an already
 * parsed object, or plain text) into Markdown. Never throws — returns '' on
 * failure. Pass a ConvertCtx to learn whether the conversion was lossy.
 */
export function contentToMarkdown(content: unknown, ctx: ConvertCtx = { lossy: false }): string {
  try {
    let doc: unknown = content;
    if (typeof content === 'string') {
      const trimmed = content.trim();
      if (!trimmed) return '';
      try {
        doc = JSON.parse(trimmed);
      } catch {
        return content; // not JSON → plain text
      }
    }
    if (Array.isArray(doc)) {
      return renderBlocks(doc, ctx).trim();
    }
    if (!isRecord(doc)) {
      return typeof doc === 'string' ? doc : '';
    }
    // ProseMirror-like doc: has a `type` and/or `content`
    if ('type' in doc || 'content' in doc) {
      if (doc.type === 'doc' || Array.isArray(doc.content)) {
        return renderBlocks(doc.content, ctx).trim();
      }
      return renderBlock(doc, ctx).trim();
    }
    // an object that is not ProseMirror-shaped → best-effort plain text
    ctx.lossy = true;
    return collectText(doc).trim();
  } catch {
    return '';
  }
}
