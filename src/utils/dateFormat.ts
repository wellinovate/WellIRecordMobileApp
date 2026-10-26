export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const pad = (n: number) => String(n).padStart(2, '0');
export const toYmd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
export const todayYmd = () => { const n = new Date(); return toYmd(n.getFullYear(), n.getMonth(), n.getDate()); };
export const formatYmd = (v: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1].slice(0, 3)} ${m[1]}` : '';
};
export const formatClock = (v: string) => {
  const m = /^(\d{2}):(\d{2})$/.exec(v);
  if (!m) return '';
  const h = Number(m[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
};

