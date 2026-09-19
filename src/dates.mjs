// KST date helpers. Server TZ does not matter (always +09:00).
export function kstParts(off = 0) {
  const d = new Date(Date.now() + 9 * 3600 * 1000 + off * 86400000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}
const WD = ["일", "월", "화", "수", "목", "금", "토"];
export function kstLabel(off = 0) {
  const { y, m, d } = kstParts(off);
  return `${m}/${d} ${WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}`;
}
export function ymd8(off = 0) {
  const { y, m, d } = kstParts(off);
  return `${y}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}`;
}
// "2026.09.21" / "2026-09-21" / "20260921" -> 20260921
export function num8(s) {
  const m = String(s || "").match(/(\d{4})[.-]?(\d{2})[.-]?(\d{2})/);
  return m ? +(m[1] + m[2] + m[3]) : 0;
}
