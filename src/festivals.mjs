// 구석구석 축제 달력 JSON. 키不要. 오늘~+30일 전국 전량.
import { getJson } from "./http.mjs";
export const REGION_ORDER = [
  "서울", "인천", "경기", "강원", "대전", "세종", "충북", "충남",
  "광주", "전북", "전남", "대구", "경북", "부산", "울산", "경남", "제주", "기타",
];
export const REGION_LABEL = {
  서울: "서울", 인천: "인천", 경기: "경기도", 강원: "강원", 대전: "대전", 세종: "세종",
  충북: "충청북도", 충남: "충청남도", 광주: "광주", 전북: "전북", 전남: "전라남도",
  대구: "대구", 경북: "경상북도", 부산: "부산", 울산: "울산", 경남: "경상남도",
  제주: "제주", 기타: "기타",
};
export function regionOf(a) {
  a = a || "";
  if (/서울/.test(a)) return "서울";
  if (/인천/.test(a)) return "인천";
  if (/대전/.test(a)) return "대전";
  if (/세종/.test(a)) return "세종";
  if (/대구/.test(a)) return "대구";
  if (/부산/.test(a)) return "부산";
  if (/울산/.test(a)) return "울산";
  if (/제주/.test(a)) return "제주";
  if (/경기/.test(a)) return "경기";
  if (/강원/.test(a)) return "강원";
  if (/충청북|충북/.test(a)) return "충북";
  if (/충청남|충남/.test(a)) return "충남";
  if (/전북/.test(a)) return "전북";
  if (/경상북|경북/.test(a)) return "경북";
  if (/경상남|경남/.test(a)) return "경남";
  if (/광주/.test(a) && !/경기/.test(a)) return "광주";
  if (/전라남|전남/.test(a)) return "전남";
  return "기타";
}
export function shortArea(a) {
  return (a || "")
    .replace("특별자치도", "").replace("광역시", "").replace("특별시", "")
    .replace("통합특별시", "").replace(/\s+/g, " ").trim();
}
function skey(s) {
  const m = String(s).match(/(\d{4})\.(\d{2})\.(\d{2})/);
  return m ? m[1] + m[2] + m[3] : "99999999";
}
export function periodOf(it) {
  if (it.start && it.end) return `${it.start}~${String(it.end).replace(/^\d{4}\./, "")}`;
  return it.start || "";
}
export async function collectFestivals(y, m, d) {
  const base = Date.UTC(y, m - 1, d);
  const uniq = new Map();
  for (let o = 0; o <= 30; o++) {
    const dt = new Date(base + o * 86400000);
    const yy = dt.getUTCFullYear(), mm = dt.getUTCMonth() + 1, dd = dt.getUTCDate();
    let pg = 0;
    while (pg < 10) {
      const u = `https://korean.visitkorea.or.kr/kfes/list/festivalCalendarList.do?year=${yy}&month=${mm}&day=${dd}&page=${pg}&offset=20`;
      const j = await getJson(u);
      const it = j?.dataList?.items || [];
      const tot = j?.dataList?.total || it.length;
      for (const x of it) {
        const id = x.fstvlCntntsId;
        if (!id || uniq.has(id)) continue;
        uniq.set(id, {
          id, name: x.cntntsNm, area: x.areaNm || "",
          start: x.fstvlBgngDe || "", end: x.fstvlEndDe || "",
        });
      }
      if ((pg + 1) * 20 >= tot || !it.length) break;
      pg++;
    }
  }
  const groups = {};
  for (const it of uniq.values()) {
    const r = regionOf(it.area);
    (groups[r] ||= []).push(it);
  }
  for (const r of Object.keys(groups)) {
    groups[r].sort(
      (a, b) => skey(a.start).localeCompare(skey(b.start)) || a.name.localeCompare(b.name, "ko")
    );
  }
  return { total: uniq.size, groups };
}
export const festUrl = (id) =>
  `https://korean.visitkorea.or.kr/kfes/detail/fstvlDetail.do?fstvlCntntsId=${id}`;
