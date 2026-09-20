// 공공 예약: 숲나들e/KNPS 오픈 규칙 + KNPS 7일 공지. 로그인 불필요.
import { getText } from "./http.mjs";
import { num8 } from "./dates.mjs";
export const STAY_LINKS = {
  forestApply: "https://www.foresttrip.go.kr/rep/drlts/drltsUseGdnc.do?hmpgId=FRIP&menuId=001003004",
  knpsLottery: "https://res.knps.or.kr/reservation/selectCampLottery.do",
};
function shiftNum(baseNum, off) {
  const y = Math.floor(baseNum / 10000), m = Math.floor(baseNum / 100) % 100, d = baseNum % 100;
  const t = new Date(Date.UTC(y, m - 1, d) + off * 86400000);
  return t.getUTCFullYear() * 10000 + (t.getUTCMonth() + 1) * 100 + t.getUTCDate();
}
function mdOf(n) {
  return Math.floor(n / 100) % 100 + "/" + String(n % 100).padStart(2, "0");
}
// 고정 월간 리듬에서 7일 안에 오는 예약오픈만
export function ruleAlerts(todayNum, days = 7) {
  const y = Math.floor(todayNum / 10000), m = Math.floor(todayNum / 100) % 100;
  const mm = String(m).padStart(2, "0");
  const inWin = (ev) => ev >= todayNum && ev <= shiftNum(todayNum, days);
  const out = [];
  const nm = m === 12 ? 1 : m + 1;
  const ap = y * 10000 + m * 100 + 4;
  if (inWin(ap)) out.push({ name: "숲나들e " + nm + "월 주말추첨 접수", period: mm + "/04 09:00~" + mm + "/09 18:00", url: STAY_LINKS.forestApply, openNum: ap });
  const fc = y * 10000 + m * 100 + 15;
  if (inWin(fc)) out.push({ name: "숲나들e 미당첨·미결제 선착순 오픈", period: mm + "/15 09:00", url: STAY_LINKS.forestApply, openNum: fc });
  let ey = y, em = m;
  if (em % 2 === 1) {
    em += 1;
    if (em > 12) { em = 2; ey += 1; }
  }
  let target = ey * 10000 + em * 100 + 1;
  if (todayNum > ey * 10000 + em * 100 + 5) {
    em += 2;
    if (em > 12) { em -= 12; ey += 1; }
    target = ey * 10000 + em * 100 + 1;
  }
  if (inWin(target)) {
    const tm = Math.floor(target / 100) % 100;
    let vm = tm + 2, vy = Math.floor(target / 10000);
    if (vm > 12) { vm -= 12; vy += 1; }
    out.push({ name: "국립공원 야영장 추첨접수 (" + vm + "월분)", period: tm + "/01 10:00~" + tm + "/05 10:00", url: STAY_LINKS.knpsLottery, openNum: target });
  }
  return out;
}
const PARK_REGION = [
  ["북한산", "서울"], ["설악산", "강원"], ["오대산", "강원"], ["태백산", "강원"], ["치악산", "강원"],
  ["속리산", "충북"], ["월악산", "충북"], ["소백산", "충북"],
  ["계룡산", "충남"], ["태안해안", "충남"],
  ["내장산", "전북"], ["덕유산", "전북"], ["변산반도", "전북"], ["지리산북부", "전북"],
  ["지리산전남", "전남"], ["다도해", "전남"], ["월출산", "전남"], ["무등산", "광주"],
  ["주왕산", "경북"], ["경주", "경북"],
  ["가야산", "경남"], ["한려해상", "경남"], ["지리산경남", "경남"],
  ["팔공산", "대구"],
];
function parkRegion(title) {
  for (const pr of PARK_REGION) {
    if (title.indexOf(pr[0]) >= 0) return pr[1];
  }
  if (title.indexOf("지리산") >= 0) return "전남";
  return "기타";
}
// KNPS 메인 공지 슬라이드에서 최근 7일만
export async function knpsNotices(todayNum) {
  const h = await getText("https://reservation.knps.or.kr/", 2);
  const seen = new Set();
  const out = [];
  const slides = h.split("swiper-slide slide").slice(1);
  for (const s of slides) {
    const m = s.match(/boardDetail\.do\?seq=(\d+)/);
    if (!m || seen.has(m[1])) continue;
    seen.add(m[1]);
    const txt = s.slice(0, 1200).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const dm = txt.match(/(\d{4}-\d{2}-\d{2})/);
    if (!dm) continue;
    const dn = +dm[1].replace(/-/g, "");
    if (dn < todayNum - 6 || dn > todayNum) continue;
    const title = txt.slice(0, txt.indexOf(dm[1])).replace(/^[^가-힣A-Za-z0-9(]+/, "").trim().slice(0, 80);
    if (!title) continue;
    out.push({ title: title, date: dm[1].replace(/-/g, "."), region: parkRegion(title), url: "https://reservation.knps.or.kr/community/board/notice/boardDetail.do?seq=" + m[1] });
  }
  return out;
}
