// 전시: 아트큐(메인, 지역별 x 진행중/예정) + MMCA + SeMA. 전시별 상세 URL 사용.
import { getText } from "./http.mjs";
import { regionOf } from "./festivals.mjs";
const AREAS = ["서울", "서울시", "인천", "경기", "강원", "대전", "충북", "충남", "광주", "전북", "전북특별자치도", "전남", "대구", "경북", "부산", "울산", "경남", "제주"];
function strip(s) {
  return String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function nearDate(seg) {
  const t = String(seg || "").replace(/<[^>]+>/g, " ");
  const m = t.match(/(\d{4}\.\d{2}\.\d{2})\s*\D\s*(\d{4}\.\d{2}\.\d{2}|\d{2}\.\d{2})/);
  if (!m) return null;
  const end = m[2].indexOf(".") >= 0 ? m[2] : m[1].slice(0, 4) + "." + m[2];
  return { start: m[1], end: end };
}
// 아트큐 카드: 전시 링크 + card-title + museums 장소 + 날짜줄
export async function collectArtcue() {
  const seen = new Map();
  for (const status of ["ongoing", "upcoming"]) {
    for (const area of AREAS) {
      for (let pg = 1; pg <= 6; pg++) {
        const u = "https://artcue.kr/?status=" + status + "&sort=ending_soon&area=" + encodeURIComponent(area) + (pg > 1 ? "&page=" + pg : "");
        let h = "";
        try {
          h = await getText(u, 2);
        } catch (e) {
          break;
        }
        let found = 0;
        const parts = h.split('<a href="/exhibitions/').slice(1);
        for (const c of parts) {
          const slugM = c.match(/^([a-z0-9\-\/]+)" class="block">/);
          if (!slugM) continue;
          const slug = slugM[1].replace(/\/$/, "");
          if (seen.has(slug)) continue;
          const seg = c.slice(0, 4000);
          const tM = seg.match(/card-title[^>]*>([\s\S]+?)<\/h3>/);
          const title = strip((tM || [])[1] || "").slice(0, 80);
          if (!title) continue;
          const vM = seg.match(/\/museums\/[^"]*"[^>]*>([^<>]{2,40})</);
          const venue = strip((vM || [])[1] || "");
          const dm = seg.replace(/<[^>]+>/g, " ").match(/(\d{4}\.\d{2}\.\d{2})\s*\D\s*(\d{4}\.\d{2}\.\d{2})/);
          seen.set(slug, {
            title: title, venue: venue,
            start: dm ? dm[1] : "", end: dm ? dm[2] : "",
            url: "https://artcue.kr/exhibitions/" + slug,
            region: regionOf(area),
          });
          found++;
        }
        if (!found) break;
      }
    }
  }
  return [...seen.values()];
}
// MMCA 현재전시
export async function collectMmca() {
  const h = await getText("https://www.mmca.go.kr/exhibitions/progressList.do", 2).catch(() => "");
  if (!h) return [];
  const out = [];
  const re = /exhibitionsDetail\.do\?exhId=([0-9]+)/g;
  const ids = [...new Set([...h.matchAll(re)].map((m) => m[1]))];
  for (const id of ids.slice(0, 30)) {
    const i = h.indexOf(id);
    const seg = h.slice(Math.max(0, i - 1500), i + 500).replace(/<[^>]+>/g, " ");
    const md = nearDate(seg);
    const tm = seg.match(/([가-힣A-Za-z0-9:()!?.\s-]{4,60})/);
    out.push({ title: ((tm || [])[1] || "").trim().slice(0, 60), venue: "MMCA", start: md ? md.start : "", end: md ? md.end : "", url: "https://www.mmca.go.kr/exhibitions/exhibitionsDetail.do?exhId=" + id });
  }
  return out;
}
// SeMA 전시목록 (실패해도 전체가 멈추지 않음)
export async function collectSema() {
  try {
    const h = await getText("https://sema.seoul.go.kr/kr/whatson/exhibition/exhList", 2);
    const out = [];
    for (const m of h.matchAll(/exNo=(\d+)/g)) {
      const id = m[1];
      if (out.some((x) => x.id === id)) continue;
      const i = m.index;
      const seg = h.slice(Math.max(0, i - 1200), i + 300).replace(/<[^>]+>/g, " ");
      const md = nearDate(seg);
      out.push({ id: id, title: "", venue: "SeMA", start: md ? md.start : "", end: md ? md.end : "", url: "https://sema.seoul.go.kr/kr/whatson/exhibition/detail?exNo=" + id });
      if (out.length >= 30) break;
    }
    return out;
  } catch (e) {
    return [];
  }
}
