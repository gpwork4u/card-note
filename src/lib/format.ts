const WD = ['日', '一', '二', '三', '四', '五', '六'];

function parseISODate(isoDate: string): Date {
  // accept 'YYYY-MM-DD' or full ISO; normalise to local midnight for weekday calc
  const datePart = isoDate.slice(0, 10);
  return new Date(datePart + 'T00:00:00');
}

export function weekdayLabel(isoDate: string): string {
  const d = parseISODate(isoDate);
  if (Number.isNaN(d.getTime())) return '';
  return `（${WD[d.getDay()]}）`;
}

export function mdDisplay(isoDate: string): string {
  const datePart = isoDate.slice(0, 10);
  const [, m, d] = datePart.split('-');
  if (!m || !d) return isoDate;
  return `${Number(m)}/${Number(d)}`;
}

export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

/** "2 分鐘前" style relative time from an ISO timestamp */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '剛剛';
  if (min < 60) return `${min} 分鐘前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小時前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  return new Date(iso).toLocaleDateString('zh-TW');
}
