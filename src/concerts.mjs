// KOPIS Open API (키 필요). 1회 최대 31일, 페이지당 최대 100건.
// 60일 창은 run.mjs에서 31일씩 2구간으로 나눠 호출한다.
import { getText } from "./http.mjs";
function tag(db, f) {
  const m = db.match(new RegExp(`<${f}>([\\s\\S]*?)<\\/${f}>`));
  return m ? m[1].trim() : "";
}
export const CLUSTERS = ["수도권", "충청전라", "강원", "영남", "부산", "제주"];
export function clusterOf(hay) {
  hay = hay || "";
  if (/남한산성|경기 광주/.test(hay)) return "수도권";
  const br = (hay.match(/\[([가-힣]+)\]/) || [])[1] || "";
  const H = br + " " + hay;
  if (/제주|서귀포|한라/.test(H)) return "제주";
  if (/부산|해운대|벡스코|수영|동래|기장|낙동/.test(H)) return "부산";
  if (/대구|경북|경주|포항|안동|영주|문경|상주|구미|경산|영천|울산|경남|창원|진주|김해|양산|거제|통영|사천|밀양|문씨어터|F1963|진해/.test(H)) return "영남";
  if (/강원|강릉|속초|춘천|원주|평창|동해|삼척|정선|영월|인제|양양/.test(H)) return "강원";
  if (/충북|충남|청주|대전|세종(?!문화)|천안|아산|공주|논산|전북|전주|군산|익산|전남|여수|예울마루|순천|목포|광주|나주|담양|곡성|고창|임실|정읍|남원|김제|완주|소리문화|한국소리/.test(H)) return "충청전라";
  if (/다산|남양주|온맘|연천|수레울|오류|파라다이스시티|파라다이스|영종|연세대|연세|서울|경기|인천|올림픽|예술의전당|세종문화|롯데콘서트|KSPO|고척|잠실|홍대|마포|서교|연남|합정|고양|아람누리|성남|용인|수원|인스파이어|송도|부천|안양|과천|하남|킨텍스|무신사|개러지|상상마당|롤링홀|명화|원더로크|웨스트브릿지|구름아래|거암|스카이아트|아스트라|재즈클럽|베리어스|살롱|문보우|생기|우무지|이들스|EDLS|세티|SETI|로데|나누|클럽|라이브홀|라이브클럽|소극장|언더스테이지|이태원|성수|건대|대학로|코엑스|금호아트홀|영산아트홀|정동|JS아트홀|XIMXIM|심심|제물포|시흥아트센터|송해아트홀|고려대|일신홀|평택|쌀롱|반포심산|안성맞춤|숲세권|솔가람|케이크샵|꿈의숲|신영/.test(H)) return "수도권";
  return "";
}
const CITY_RE =
  /서울|인천|수원|고양|성남|용인|부천|안양|과천|하남|김포|파주|의정부|남양주|시흥|안산|화성|평택|광명|연천|다산|대전|세종|청주|천안|전주|군산|여수|순천|목포|광주|강릉|속초|춘천|원주|대구|경주|포항|안동|창원|진주|김해|울산|부산|해운대|제주|서귀포/;
export function cityOf(hay) {
  hay = hay || "";
  return ((hay.match(/\[([가-힣]+)\]/) || [])[1]) || ((hay.match(CITY_RE) || [])[0]) || "";
}
export const kopisUrl = (id) =>
  `https://www.kopis.or.kr/por/db/pblprfr/pblprfrView.do?mt20Id=${id}`;
export async function collectConcerts(key, stdate, eddate) {
  // stdate/eddate: yyyymmdd, 반드시 31일 이내
  const out = new Map();
  for (const shcate of ["CCCD", "CCCA"]) {
    let cpage = 1;
    while (true) {
      const u = `http://www.kopis.or.kr/openApi/restful/pblprfr?service=${encodeURIComponent(key)}&stdate=${stdate}&eddate=${eddate}&cpage=${cpage}&rows=100&shcate=${shcate}`;
      const t = await getText(u);
      const blocks = t.split("<db>").slice(1);
      if (!blocks.length) break;
      for (const b of blocks) {
        const id = tag(b, "mt20id");
        if (!id || out.has(id)) continue;
        out.set(id, {
          id,
          name: tag(b, "prfnm"),
          from: tag(b, "prfpdfrom"),
          to: tag(b, "prfpdto"),
          place: tag(b, "fcltynm"),
          area: tag(b, "area"),
          genre: tag(b, "genrenm"),
        });
      }
      if (blocks.length < 100 || ++cpage > 50) break;
    }
  }
  return [...out.values()];
}
