// 매일 08:00 KST 다이제스트. 순서: 예매 → 축제 → 전시 → 콘서트 → 영화 → 책.
// 한 섹션이 죽어도 나머지는 간다.
import { sendMessage, pace, esc, link, chunkLines } from "./src/tg.mjs";
import { kstLabel, ymd8, num8 } from "./src/dates.mjs";
import { collectTickets } from "./src/tickets.mjs";
import { ruleAlerts, knpsNotices } from "./src/stays.mjs";
import { collectFestivals, REGION_ORDER, REGION_LABEL, shortArea, periodOf, festUrl } from "./src/festivals.mjs";
import { collectConcerts, clusterOf, cityOf, kopisUrl, CLUSTERS } from "./src/concerts.mjs";
import { collectArtcue, collectMmca, collectSema, collectLeeum, collectHoam, collectArko } from "./src/exhibitions.mjs";
import { collectMovies, naverMovie } from "./src/movies.mjs";
import { collectBooks, collectNewBooks } from "./src/books.mjs";

const DRY = process.env.DRY_RUN === "1";
const TOK = process.env.TELEGRAM_BOT_TOKEN || "";
const CHAT = process.env.TELEGRAM_CHAT_ID || "@korea_event_news";
const KOPIS = process.env.KOPIS_KEY || "";
const KOBIS = process.env.KOBIS_KEY || "";
if (!DRY && !TOK) throw new Error("missing TELEGRAM_BOT_TOKEN");
if (!KOPIS) throw new Error("missing KOPIS_KEY");
if (!KOBIS) throw new Error("missing KOBIS_KEY");

const today = num8(ymd8(0));
const dateLabel = kstLabel(0);
const sent = [];
async function say(text) {
  const id = await sendMessage(TOK, CHAT, text, DRY);
  sent.push(id);
  await pace();
}
async function safe(name, fn) {
  try {
    await fn();
  } catch (e) {
    console.log(name + " FAILED: " + ((e && e.message) || e));
  }
}
// 오늘 진행중이면 빨간점+굵게 (축제·콘서트·전시만)
function itemLine(inner, url, active) {
  return active ? "• 🔴 <b>" + inner + "</b> " + link(url) : "• " + inner + " " + link(url);
}
const isToday = (from, to) => num8(from) <= today && today <= num8(to);
const knex = (s) => String(s || "").replace(/^\d{4}\./, "");

console.log("date:", dateLabel, "today:", today);

await safe("tickets", async () => {
  const tk = await collectTickets(today, num8(ymd8(7)));
  console.log("tickets:", tk.length);
  const tmr = num8(ymd8(1));
  const tline = (t) => {
    const hhmm = t.open.slice(11, 16);
    const md = t.open.slice(5, 10).replace("-", "/");
    return "• " + esc(t.title) + " (" + esc(t.region) + ") | 예매 " + md + " " + hhmm + " " + link(t.url);
  };
  const now = tk.filter((t) => {
    const d = num8(t.open.slice(0, 10));
    return d === today || d === tmr;
  });
  const week = tk.filter((t) => {
    const d = num8(t.open.slice(0, 10));
    return d !== today && d !== tmr;
  });
  if (now.length) {
    await say("[공연·전시 티켓 오늘·내일 예매 오픈 | " + dateLabel + "]\n" + now.map(tline).join("\n"));
  }
  if (week.length) {
    const parts = chunkLines(week.map(tline));
    for (let i = 0; i < parts.length; i++) {
      await say("[공연·전시 티켓 1주일내 예매 오픈 | " + dateLabel + "]" + (parts.length > 1 ? " | " + (i + 1) : "") + "\n" + parts[i].join("\n"));
    }
  }
});
await safe("festivals", async () => {
  const s = ymd8(0);
  const y = +s.slice(0, 4), m = +s.slice(4, 6), d = +s.slice(6, 8);
  const res = await collectFestivals(y, m, d);
  console.log("festivals:", res.total);
  for (const key of REGION_ORDER) {
    const list = res.groups[key] || [];
    if (!list.length) continue;
    const lines = list.map((it) =>
      itemLine(esc(it.name) + " (" + esc(shortArea(it.area)) + ") | " + esc(periodOf(it)), festUrl(it.id), isToday(it.start, it.end))
    );
    const parts = chunkLines(lines);
    for (let i = 0; i < parts.length; i++) {
      const head = parts.length > 1
        ? "[지역축제·지역행사 | " + dateLabel + " | " + REGION_LABEL[key] + " " + list.length + "건 | " + (i + 1) + "/" + parts.length + "]"
        : "[지역축제·지역행사 | " + dateLabel + " | " + REGION_LABEL[key] + " " + list.length + "건]";
      await say(head + "\n" + parts[i].join("\n"));
    }
  }
});
await safe("exhibitions", async () => {
  const endWin = num8(ymd8(30));
  const art = await collectArtcue();
  const seenT = new Set(art.map((x) => x.title));
  const extra = [...(await collectMmca()), ...(await collectSema()), ...(await collectLeeum()), ...(await collectHoam()), ...(await collectArko())].filter((x) => x.title && !seenT.has(x.title));
  const all = [...art, ...extra];
  console.log("exhibitions raw:", all.length);
  const inWin = all.filter((x) => x.start && num8(x.start) <= endWin && (!x.end || num8(x.end) >= today));
  inWin.sort((a, b) => num8(a.end || "9999") - num8(b.end || "9999"));
  console.log("exhibitions inWin:", inWin.length);
  const EG = ["수도권", "서부권", "동부권", "경주/대구", "울산/부산"];
  function exGroup(x) {
    const r = x.region || "";
    const hay = (x.title || "") + " " + (x.venue || "");
    if (r === "대구") return "경주/대구";
    if (r === "울산" || r === "부산") return "울산/부산";
    if (r === "경북" && /경주/.test(hay)) return "경주/대구";
    if (r === "서울" || r === "인천" || r === "경기") return "수도권";
    if (r === "강원" || r === "경북" || r === "경남") return "동부권";
    if (r === "충북" || r === "충남" || r === "대전" || r === "세종" || r === "전북" || r === "전남" || r === "광주" || r === "제주") return "서부권";
    if (/서울|경기|인천|종로|용산|과천|덕수궁|SeMA|MMCA/.test(hay)) return "수도권";
    return "수도권";
  }
  const egroups = {};
  for (const x of inWin) {
    const g = exGroup(x);
    (egroups[g] = egroups[g] || []).push(x);
  }
  for (const g of EG) {
    const list = (egroups[g] || []).sort((a, b) => num8(a.end || "9999") - num8(b.end || "9999"));
    if (!list.length) continue;
    const lines = list.map((x) => {
      const where = ((x.region ? x.region + " " : "") + (x.venue || "")).trim().slice(0, 16) || "전국";
      return itemLine(
        esc(x.title || "(제목 미상)") + " (" + esc(where) + ") | " + esc(x.start) + "~" + esc(knex(x.end)),
        x.url, isToday(x.start, x.end || "9999.12.31")
      );
    });
    const parts = chunkLines(lines);
    for (let i = 0; i < parts.length; i++) {
      const head = parts.length > 1
        ? "[전시·미술관·박물관 | " + dateLabel + " | " + g + " " + list.length + "건 | " + (i + 1) + "/" + parts.length + "]"
        : "[전시·미술관·박물관 | " + dateLabel + " | " + g + " " + list.length + "건]";
      await say(head + "\n" + parts[i].join("\n"));
    }
  }
 });
await safe("concerts", async () => {
  const raw = await collectConcerts(KOPIS, ymd8(0), ymd8(30));
  console.log("concerts raw:", raw.length);
  const groups = Object.fromEntries(CLUSTERS.map((c) => [c, []]));
  let skip = 0;
  for (const r of raw) {
    if (!(num8(r.from) <= num8(ymd8(30)) && num8(r.to) >= today)) {
      skip++;
      continue;
    }
    const hay = r.name + " " + r.place + " " + r.area;
    const c = clusterOf(hay);
    if (!c) {
      skip++;
      continue;
    }
    r._city = cityOf(hay);
    groups[c].push(r);
  }
  console.log("concerts skipped:", skip);
  for (const k of CLUSTERS) {
    const list = groups[k].sort((a, b) => num8(a.from) - num8(b.from));
    if (!list.length) continue;
    const lines = list.map((r) => {
      const per = r.from === r.to ? r.from : r.from + "~" + knex(r.to);
      return itemLine(
        esc(r.name) + " (" + esc(r._city || k) + ") | 공연 " + esc(per) + " | " + esc((r.place || "").replace(/\s*\(.*$/, "").slice(0, 14)),
        kopisUrl(r.id), isToday(r.from, r.to)
      );
    });
    const parts = chunkLines(lines);
    for (let i = 0; i < parts.length; i++) {
      const head = parts.length > 1
        ? "[콘서트·음악 | " + dateLabel + " | " + k + " " + list.length + "건 | " + (i + 1) + "/" + parts.length + "]"
        : "[콘서트·음악 | " + dateLabel + " | " + k + " " + list.length + "건]";
      await say(head + "\n" + parts[i].join("\n"));
    }
  }
});
await safe("stays", async () => {
  const alerts = ruleAlerts(today);
  console.log("stays alerts:", alerts.length);
  if (alerts.length) {
    await say("[공공예약 오픈 임박 | " + dateLabel + "]\n" + alerts.map((a) =>
      itemLine(esc(a.name) + " (전국) | " + esc(a.period), a.url, a.openNum === today)
    ).join("\n"));
  }
  const kn = await knpsNotices(today);
  console.log("knps notices:", kn.length);
  const KG = ["서울", "인천", "경기", "강원", "대전", "세종", "충북", "충남", "광주", "전북", "전남", "대구", "경북", "부산", "울산", "경남", "제주", "기타"];
  for (const key of KG) {
    const list = kn.filter((x) => x.region === key);
    if (!list.length) continue;
    await say("[국립공원 공지 7일 | " + dateLabel + " | " + REGION_LABEL[key] + " " + list.length + "건]\n" +
      list.map((x) => "• " + esc(x.title) + " (" + esc(x.region) + ") | " + esc(x.date) + " " + link(x.url)).join("\n"));
  }
});
await safe("movies", async () => {
  const res = await collectMovies(KOBIS);
  console.log("movies:", res.dt, res.items.length);
  const lines = res.items.map((x) => {
    const audi = Number(x.audi).toLocaleString("ko-KR");
    const open = x.open ? "개봉 " + String(x.open).replace(/-/g, ".") + " | " : "";
    return x.rank + ". " + esc(x.name) + " (전국) | " + esc(x.genre) + " | " + open + "전일 " + audi + " " + link(naverMovie(x.name));
  });
  await say("[영화 상영 | " + dateLabel + "]\n" + lines.join("\n"));
});
await safe("books", async () => {
  const best = await collectBooks();
  console.log("books best:", best.length);
  const bl = (x) => x.rank + ". " + esc(x.title) + " | " + esc(x.author) + " | " + esc(x.category) + " | 평점 " + x.rating + " " + link(x.url);
  const parts = chunkLines(best.map(bl));
  for (let i = 0; i < parts.length; i++) {
    await say("[도서 베스트셀러 | " + dateLabel + "]" + (parts.length > 1 ? " | " + (i + 1) : "") + "\n" + parts[i].join("\n"));
  }
  const news = await collectNewBooks();
  console.log("books new:", news.length);
  if (news.length) {
    await say("[도서 신간 | " + dateLabel + "]\n" + news.map(bl).join("\n"));
  }
});
console.log("sent messages:", sent.length);
