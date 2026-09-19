// 티켓오픈: 인터파크(1순위) + 예스24 swiper(폴백). 둘 다 죽으면 빈 배열(다이제스트는 계속).
import { getText, sleep } from "./http.mjs";
import { num8 } from "./dates.mjs";
import { cityOf } from "./concerts.mjs";
function ju(s) {
  try {
    return JSON.parse('"' + s + '"');
  } catch (e) {
    return s;
  }
}
async function interpark() {
  const URL = "https://tickets.interpark.com/contents/notice";
  let html = "";
  for (let t = 0; t < 6; t++) {
    try {
      html = await getText(URL, 1);
    } catch (e) {
      html = "";
    }
    if (html.indexOf('"notices":[') >= 0) break;
    await sleep(2000);
  }
  if (html.indexOf('"notices":[') < 0) {
    console.log("tickets: interpark skipped (no payload / blocked)");
    return [];
  }
  const out = [];
  const parts = html.split('{"ticket_dates":').slice(1);
  for (const seg0 of parts) {
    const seg = seg0.slice(0, 2500);
    const open = (seg.match(/"ticket_open_date":"([^"]+)"/) || [])[1];
    const title = (seg.match(/"title":"((?:[^"\\]|\\.)*)"/) || [])[1];
    const venue = (seg.match(/"venue_name":"((?:[^"\\]|\\.)*)"/) || [])[1];
    const poster = (seg.match(/"goods_poster_image_url":"([^"]+)"/) || [])[1];
    if (!open || !title) continue;
    const pid = ((poster || "").match(/\/(\d+)_p\./) || [])[1] || "";
    out.push({
      title: ju(title), venue: ju(venue || "").trim(), open: open, pid: pid,
      url: pid ? "https://tickets.interpark.com/ticket/products/" + pid : "https://tickets.interpark.com/contents/notice",
    });
  }
  console.log("tickets: interpark raw=" + out.length);
  return out;
}
async function yes24() {
  const out = [];
  try {
    const h = await getText("https://ticket.yes24.com/New/Notice/NoticeMain.aspx", 2);
    const slides = h.split("swiper-slide").slice(1);
    for (const s of slides) {
      const seg = s.slice(0, 2000);
      const href = (seg.match(/<a href='(\/Notice[^']*)'/) || [])[1];
      const date = (seg.match(/ticket-date'>([^<]+)</) || [])[1];
      const title = (seg.match(/ticket-tit'>([^<]+)</) || [])[1];
      if (!href || !date || !title) continue;
      const dm = date.match(/(\d{4})\.(\d{2})\.(\d{2}).*?(\d{2}):(\d{2})/);
      if (!dm) continue;
      const open = dm[1] + "-" + dm[2] + "-" + dm[3] + "T" + dm[4] + ":" + dm[5] + ":00";
      const clean = title.replace(/티켓\s*오픈\s*안내/g, "").replace(/티켓오픈/g, "").trim();
      let url = "https://ticket.yes24.com" + href;
      try {
        const dh = await getText(url, 1);
        const pm = dh.match(/\/New\/Perf\/[^'"\s]+/);
        if (pm) url = "https://ticket.yes24.com" + pm[0];
      } catch (e) {}
      out.push({ title: clean, venue: "", open: open, pid: "", url: url });
    }
  } catch (e) {
    console.log("tickets: yes24 failed");
  }
  console.log("tickets: yes24 raw=" + out.length);
  return out;
}
export async function collectTickets(todayNum, endNum) {
  const all = [...await interpark(), ...await yes24()];
  const seen = new Set();
  const out = [];
  for (const t of all) {
    const d = num8(t.open.slice(0, 10));
    if (d < todayNum || d > endNum) continue;
    const key = t.title + "|" + t.open;
    if (seen.has(key)) continue;
    seen.add(key);
    const hay = t.title + " " + t.venue;
    const region = cityOf(hay) || (t.venue ? t.venue.slice(0, 12) : "전국");
    out.push({ title: t.title, region: region, open: t.open, url: t.url });
  }
  return out;
}
