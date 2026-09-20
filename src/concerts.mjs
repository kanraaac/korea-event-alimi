// KOPIS Open API (키 필요). 1회 최대 31일, 페이지당 최대 100건.
// 60일 창은 run.mjs에서 31일씩 2구간으로 나눠 호출한다.
import { getText } from "./http.mjs";
export { clusterOf, REGIONS as CLUSTERS } from "./regions.mjs";
function tag(db, f) {
  const m = db.match(new RegExp("<" + f + ">([\\s\\S]*?)</" + f + ">"));
  if (!m) return "";
  return m[1].trim()
    .split("&amp;").join("&").split("&lt;").join("<").split("&gt;").join(">")
    .split("&quot;").join('"').split("&#39;").join("'").split("&apos;").join("'");
}
const CITY_RE = /서울|인천|수원|고양|성남|용인|부천|안양|과천|하남|김포|파주|의정부|남양주|시흥|안산|화성|평택|광명|연천|다산|대전|세종|청주|천안|전주|군산|여수|순천|목포|광주|강릉|속초|춘천|원주|대구|경주|포항|안동|창원|진주|김해|울산|부산|해운대|제주|서귀포/;
export function cityOf(hay) {
  hay = hay || "";
  return ((hay.match(/\[([가-힣]+)\]/) || [])[1]) || ((hay.match(CITY_RE) || [])[0]) || "";
}
export const kopisUrl = (id) => "https://www.kopis.or.kr/por/db/pblprfr/pblprfrView.do?mt20Id=" + id;
export async function collectConcerts(key, stdate, eddate, kinds) {
  const out = new Map();
  const cates = (kinds && kinds.length) ? kinds : ["CCCD", "CCCA"];
  for (const shcate of cates) {
    let cpage = 1;
    while (cpage <= 12) {
      const u = "http://www.kopis.or.kr/openApi/restful/pblprfr?service=" + encodeURIComponent(key) + "&stdate=" + stdate + "&eddate=" + eddate + "&cpage=" + cpage + "&rows=100&shcate=" + shcate;
      let t = "";
      try {
        t = await getText(u);
      } catch (e) {
        break;
      }
      const blocks = t.split("<db>").slice(1);
      if (!blocks.length) break;
      for (const b of blocks) {
        const id = tag(b, "mt20id");
        if (!id || out.has(id)) continue;
        out.set(id, {
          id: id, name: tag(b, "prfnm"), from: tag(b, "prfpdfrom"), to: tag(b, "prfpdto"),
          place: tag(b, "fcltynm"), area: tag(b, "area"), genre: tag(b, "genrenm"), cate: shcate,
        });
      }
      if (blocks.length < 100) break;
      cpage++;
    }
  }
  return [...out.values()];
}
