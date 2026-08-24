import { describe, expect, it } from 'vitest';
import { parseDoc } from '@/serialization/frontmatter';

/**
 * 收件匣草稿是 iPhone 捷徑產生的（見 docs/INBOX.md），app 本身不寫它們，
 * 所以沒有序列化程式可以保證格式正確——能保證的只有「文件裡教的樣板，
 * 用專案自己的 frontmatter 解析器解得開」。這組測試就是釘住那份樣板，
 * 特別是網頁標題與備註這種完全不受控的文字。
 */

/** docs/INBOX.md 教捷徑組出來的連結草稿樣板 */
function linkDraft(url: string, title: string, note: string): string {
  return [
    '---',
    'created: 2026-08-25T10:15:30+08:00',
    'source: link',
    `url: '${url.replace(/'/g, "''")}'`,
    'processed: false',
    'tags: []',
    '---',
    `# ${title}`,
    '',
    note,
  ].join('\n');
}

function voiceDraft(text: string): string {
  return ['---', 'created: 2026-08-25T10:15:30+08:00', 'source: voice', 'processed: false', 'tags: []', '---', text].join('\n');
}

describe('收件匣草稿格式', () => {
  it('連結草稿的 frontmatter 解得開，網址原樣保留', () => {
    const { data, body } = parseDoc(linkDraft('https://example.com/a?b=1&c=2#frag', '標題', '備註'));
    expect(data.source).toBe('link');
    expect(data.processed).toBe(false);
    expect(data.tags).toEqual([]);
    expect(data.url).toBe('https://example.com/a?b=1&c=2#frag');
    expect(body).toContain('# 標題');
    expect(body).toContain('備註');
  });

  it('標題含冒號、引號、井字號、emoji 都不會撐破 frontmatter', () => {
    // 這正是把標題放內文而不是 frontmatter 的原因
    const nasty = `Apple's "M5": 為什麼 #1 —— 深入解析 🚀`;
    const { data, body } = parseDoc(linkDraft('https://example.com/x', nasty, ''));
    expect(data.source).toBe('link');
    expect(data.url).toBe('https://example.com/x');
    expect(body).toContain(nasty);
  });

  it('備註寫成多行、含 --- 分隔線也不會被誤判成 frontmatter 結尾', () => {
    const note = ['第一行', '---', '第三行'].join('\n');
    const { data, body } = parseDoc(linkDraft('https://example.com/x', '標題', note));
    // frontmatter 只取第一組 ---…---，內文裡的 --- 屬於內文
    expect(data.source).toBe('link');
    expect(body).toContain('第一行');
    expect(body).toContain('第三行');
  });

  it('網址含單引號時，捷徑的跳脫規則（\' → \'\'）仍解得回原值', () => {
    const url = "https://example.com/it's-fine";
    const { data } = parseDoc(linkDraft(url, '標題', ''));
    expect(data.url).toBe(url);
  });

  it('備註留空仍是合法草稿', () => {
    const { data, body } = parseDoc(linkDraft('https://example.com/x', '標題', ''));
    expect(data.processed).toBe(false);
    expect(body.trim()).toBe('# 標題');
  });

  it('語音草稿：逐字稿原樣保留，不因標點被改寫', () => {
    const text = '想到一個做法：白板上「直接拉線」比開面板快，之後再說。';
    const { data, body } = parseDoc(voiceDraft(text));
    expect(data.source).toBe('voice');
    expect(data.processed).toBe(false);
    expect(body).toBe(text);
  });

  it('agent 整理過的草稿（補了 tags/summary）一樣解得開', () => {
    const processed = [
      '---',
      'created: 2026-08-25T10:15:30+08:00',
      'source: link',
      "url: 'https://example.com/x'",
      'processed: true',
      'tags: [AI, 互動]',
      "summary: '一篇談互動設計的文章。'",
      '---',
      '# 正確的標題',
    ].join('\n');
    const { data } = parseDoc(processed);
    expect(data.processed).toBe(true);
    expect(data.tags).toEqual(['AI', '互動']);
    expect(data.summary).toBe('一篇談互動設計的文章。');
  });
});
