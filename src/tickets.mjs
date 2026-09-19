// 인터파크 티켓오픈 공지. 페이지 1(최신 20건)에서 7일 창만.
// notices JSON이 간헐적으로 빠지므로 재시도한다.
import { getText, sleep } from "./http.mjs";
import { num8 } from "./dates.mjs";
const URL = "https://tickets.interpark.com/contents/notice";
function ju(s) {
  try {
    return JSON.parse('"' + s + '"');
  } catch {
    return s;
  }
}
export async function collectTickets(todayNum, endNum) {
  let html = "";
  for (let t = 0; t < 4; t++) {
    html = await getText(URL, 1);
    if (html.includes('"notices":[')) break;
    await sleep(1500);
  }
  if (!html.includes('"notices":[')) throw new Error("interpark notice payload missing");
  const out = [];
  for (const seg0 of html.split('{"ticket_dates":').slice(1)) {
    const seg = seg0.slice(0, 2500);
    const open = (seg.match(/"ticket_open_date":"([^"]+)"/) || [])[1];
    const title = (seg.match(/"title":"((?:[^"\\]|\\.)*)"/) || [])[1];
    const venue = (seg.match(/"venue_name":"((?:[^"\\]|\\.)*)"/) || [])[1];
    const poster = (seg.match(/"goods_poster_image_url":"([^"]+)"/) || [])[1];
    if (!open || !title) continue;
    const pid = (poster?.match(/\/(\d+)_p\./) || [])[1] || "";
    const d = num8(open.slice(0, 10));
    if (d >= todayNum && d <= endNum) {
      out.push({
        title: ju(title),
        venue: ju(venue || "").trim(),
        open,
        pid,
        url: pid
          ? `https://tickets.interpark.com/ticket/products/${pid}`
          : "https://tickets.interpark.com/contents/notice",
      });
    }
  }
  return out;
}
