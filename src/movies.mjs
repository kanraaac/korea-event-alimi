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
export async function collectMovies(key, limit = 10) {
  const cap = Math.min(20, Math.max(1, Math.trunc(+limit) || 10));
  let list = [], dt = "";
  for (let back = 1; back <= 3; back++) {
    const t = dtStr(-back);
    try {
      const j = await getJson(
        "https://www.kobis.or.kr/kobisopenapi/webservice/rest/boxoffice/searchDailyBoxOfficeList.json?key=" + encodeURIComponent(key) + "&targetDt=" + t
      );
      const l = (j.boxOfficeResult && j.boxOfficeResult.dailyBoxOfficeList) || [];
      if (l.length) {
        list = l.slice(0, cap);
        dt = t;
        break;
      }
    } catch (e) { /* next day back */ }
  }
  const out = [];
  for (const m of list) {
    let genre = "-";
    try {
      const ij = await getJson(
        "https://www.kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieInfo.json?key=" + encodeURIComponent(key) + "&movieCd=" + m.movieCd
      );
      const gs = (ij.movieInfoResult && ij.movieInfoResult.movieInfo && ij.movieInfoResult.movieInfo.genres) || [];
      if (gs.length) genre = gs.map((g) => g.genreNm).join("/");
    } catch (e) { /* keep "-" */ }
    out.push({ rank: m.rank, name: m.movieNm, open: m.openDt, audi: m.audiCnt, genre: genre });
  }
  return { dt: dt, items: out };
}
