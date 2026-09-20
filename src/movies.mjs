// KOBIS 전일 박스오피스 + 장르. 일자 비어있으면 최대 3일 역행.
import { getJson } from "./http.mjs";
import { kstParts } from "./dates.mjs";
function dtStr(off) {
  const { y, m, d } = kstParts(off);
  return `${y}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}`;
}
export function naverMovie(q) {
  return "https://search.naver.com/search.naver?query=" + encodeURIComponent("영화 " + q);
}
export async function collectMovies(key) {
  let list = [], dt = "";
  for (let back = 1; back <= 3; back++) {
    const t = dtStr(-back);
    try {
      const j = await getJson(
        `https://www.kobis.or.kr/kobisopenapi/webservice/rest/boxoffice/searchDailyBoxOfficeList.json?key=${encodeURIComponent(key)}&targetDt=${t}`
      );
      const cap = Math.min(10, Math.max(1, Math.trunc(+limit) || 10));
      const l = (j.boxOfficeResult?.dailyBoxOfficeList || []).slice(0, cap);
      if (l.length) {
        list = l;
        dt = t;
        break;
      }
    } catch { /* next day back */ }
  }
  const out = [];
  for (const m of list) {
    let genre = "-";
    try {
      const ij = await getJson(
        `https://www.kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieInfo.json?key=${encodeURIComponent(key)}&movieCd=${m.movieCd}`
      );
      const gs = ij.movieInfoResult?.movieInfo?.genres || [];
      if (gs.length) genre = gs.map((g) => g.genreNm).join("/");
    } catch { /* keep "-" */ }
    out.push({ rank: m.rank, name: m.movieNm, open: m.openDt, audi: m.audiCnt, genre });
  }
  return { dt, items: out };
}
