// 다이제스트. 순서: 예매 → 축제 → 전시 → 콘서트 → 공공예약 → 영화 → 책.
import { sendMessage, pace, esc, link, chunkLines, brackets, heading, gapEvery } from "./src/tg.mjs";
import { kstLabel, ymd8, num8 } from "./src/dates.mjs";
import { collectTickets } from "./src/tickets.mjs";
import { ruleAlerts } from "./src/stays.mjs";
import { collectFestivals, shortArea, periodOf, festUrl } from "./src/festivals.mjs";
import { collectConcerts, kopisUrl } from "./src/concerts.mjs";
import { collectArtcue, collectSema, collectLeeum, collectHoam, collectArko } from "./src/exhibitions.mjs";
import { collectMovies, naverMovie } from "./src/movies.mjs";
import { collectBooks } from "./src/books.mjs";
import { clusterOf, REGIONS } from "./src/regions.mjs";
import { loadSettings } from "./src/settings.mjs";

const DRY = process.env.DRY_RUN === "1";
const TOK = process.env.TELEGRAM_BOT_TOKEN || "";
const CHAT = process.env.TELEGRAM_CHAT_ID || "@korea_event_news";
const KOPIS = process.env.KOPIS_KEY || "";
const KOBIS = process.env.KOBIS_KEY || "";
if (!DRY && !TOK) throw new Error("missing TELEGRAM_BOT_TOKEN");
if (!KOPIS) throw new Error("missing KOPIS_KEY");
if (!KOBIS) throw new Error("missing KOBIS_KEY");

const cfg = await loadSettings();
const today = num8(ymd8(0));
const dateLabel = kstLabel(0);
const sent = [];
const enabled = REGIONS.filter((r) => cfg.regions[r]);

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
function itemLine(inner, url, active) {
  return active ? "• 🟢 <b>" + inner + "</b> " + link(url) : "• " + inner + " " + link(url);
}
const isToday = (from, to) => num8(from) <= today && today <= num8(to);
const knex = (s) => String(s || "").replace(/^\d{4}\./, "");
function want(r) {
  return enabled.includes(r);
}
async function sendPacked(title, blocks) {
  const chunks = [];
  let buf = [];
  let n = title.length + 4;
  for (const b of blocks) {
    const sub = "🔴 <b>" + b.k + "</b>";
    const lines = gapEvery(b.lines);
    let idx = 0;
    let needHead = true;
    while (idx < lines.length) {
      if (needHead) {
        if (buf.length && n + sub.length + 1 + lines[idx].length + 1 > 3500) {
          chunks.push(buf);
          buf = [];
          n = title.length + 4;
        }
        buf.push(sub);
        n += sub.length + 1;
        needHead = false;
      }
      while (idx < lines.length && n + lines[idx].length + 1 <= 3500) {
        buf.push(lines[idx]);
        n += lines[idx].length + 1;
        idx++;
      }
      if (idx < lines.length) {
        chunks.push(buf);
        buf = [];
        n = title.length + 4;
        needHead = true;
      }
    }
  }
  if (buf.length) chunks.push(buf);
  for (let i = 0; i < chunks.length; i++) {
    const h = heading(title + (chunks.length > 1 ? " | " + (i + 1) : ""));
    await say(h + "\n\n" + chunks[i].join("\n"));
  }
}
async function sendGrouped(titleBase, groups) {
  for (const k of enabled) {
    const list = groups[k] || [];
    if (!list.length) continue;
    const parts = chunkLines(gapEvery(list));
    for (let i = 0; i < parts.length; i++) {
      const t = titleBase + " | " + k + " " + list.length + "건" + (parts.length > 1 ? " | " + (i + 1) + "/" + parts.length : "");
      await say(heading(t) + "\n\n" + parts[i].join("\n"));
    }
  }
}

console.log("date:", dateLabel, "today:", today, "hour:", cfg.hour, "regions:", enabled.join(","));

if (cfg.topics.tickets) await safe("tickets", async () => {
  const tk = await collectTickets(today, num8(ymd8(cfg.days.tickets)));
  console.log("tickets:", tk.length);
  const tmr = num8(ymd8(1));
  const tline = (t) => {
    const hhmm = t.open.slice(11, 16);
    const md = t.open.slice(5, 10).replace("-", "/");
    return "• " + esc(t.title) + " (" + esc(t.region) + ") | 예매 " + md + " " + hhmm + " " + link(t.url);
  };
  const grouped = (items) => {
    const blocks = [];
    for (const k of enabled) {
      const list = items.filter((t) => clusterOf(t.title + " " + t.region) === k);
      if (list.length) blocks.push({ k, lines: list.map(tline) });
    }
    return blocks;
  };
  const isNow = (t) => {
    const d = num8(t.open.slice(0, 10));
    return d === today || d === tmr;
  };
  await sendPacked("공연·전시 티켓 오늘·내일 예매 오픈 | " + dateLabel, grouped(tk.filter(isNow)));
  await sendPacked("공연·전시 티켓 1주일내 예매 오픈 | " + dateLabel, grouped(tk.filter((t) => !isNow(t))));
});

if (cfg.topics.festivals) await safe("festivals", async () => {
  const s = ymd8(0);
  const y = +s.slice(0, 4), m = +s.slice(4, 6), d = +s.slice(6, 8);
  const res = await collectFestivals(y, m, d, cfg.days.festivals);
  console.log("festivals:", res.total);
  const groups = Object.fromEntries(enabled.map((k) => [k, []]));
  for (const list of Object.values(res.groups || {})) {
    for (const it of list) {
      const k = clusterOf(it.name + " " + it.area);
      if (!want(k)) continue;
      groups[k].push(itemLine(esc(it.name) + " (" + esc(shortArea(it.area)) + ") | " + esc(periodOf(it)), festUrl(it.id), isToday(it.start, it.end)));
    }
  }
  await sendGrouped("지역축제·지역행사 | " + dateLabel, groups);
});

if (cfg.topics.exhibitions) await safe("exhibitions", async () => {
  const endWin = num8(ymd8(cfg.days.exhibitions));
  const art = await collectArtcue();
  const seenT = new Set(art.map((x) => x.title));
  const extra = [...(await collectSema()), ...(await collectLeeum()), ...(await collectHoam()), ...(await collectArko())].filter((x) => x.title && !seenT.has(x.title));
  const all = [...art, ...extra];
  console.log("exhibitions raw:", all.length);
  const inWin = all.filter((x) => x.start && num8(x.start) <= endWin && (!x.end || num8(x.end) >= today));
  inWin.sort((a, b) => num8(a.end || "9999") - num8(b.end || "9999"));
  console.log("exhibitions inWin:", inWin.length);
  const groups = Object.fromEntries(enabled.map((k) => [k, []]));
  for (const x of inWin) {
    const k = clusterOf((x.region || "") + " " + (x.title || "") + " " + (x.venue || ""));
    if (!want(k)) continue;
    const where = ((x.region ? x.region + " " : "") + (x.venue || "")).trim().slice(0, 16) || "전국";
    groups[k].push(itemLine(
      esc(x.title || "(제목 미상)") + " (" + esc(where) + ") | " + esc(x.start) + "~" + esc(knex(x.end)),
      x.url, isToday(x.start, x.end || "9999.12.31")
    ));
  }
  await sendGrouped("전시·미술관·박물관 | " + dateLabel, groups);
});

const wantPop = cfg.topics.pop !== false && (cfg.topics.pop || cfg.topics.concerts);
const wantClassic = cfg.topics.classic !== false && (cfg.topics.classic || cfg.topics.concerts);
if (wantPop || wantClassic) await safe("concerts", async () => {
  const popDays = cfg.days.pop || cfg.days.concerts || 15;
  const classicDays = cfg.days.classic || cfg.days.concerts || 15;
  const maxDays = Math.max(wantPop ? popDays : 0, wantClassic ? classicDays : 0);
  const raw = await collectConcerts(KOPIS, ymd8(0), ymd8(maxDays));
  console.log("concerts raw:", raw.length);
  function kindOf(r) {
    if (r.cate === "CCCA" || /클래식|오페라|교향|실내악|합창/.test(r.genre || "")) return "classic";
    return "pop";
  }
  async function sendKind(label, kind, days) {
    const groups = Object.fromEntries(enabled.map((k) => [k, []]));
    let skip = 0;
    for (const r of raw) {
      if (kindOf(r) !== kind) continue;
      if (!(num8(r.from) <= num8(ymd8(days)) && num8(r.to) >= today)) {
        skip++;
        continue;
      }
      const k = clusterOf(r.area + " " + r.name + " " + r.place);
      if (!want(k)) {
        skip++;
        continue;
      }
      const per = r.from === r.to ? r.from : r.from + "~" + knex(r.to);
      groups[k].push(itemLine(
        esc(brackets(r.name)) + " (" + esc(k) + ") | 공연 " + esc(per) + " | " + esc((r.place || "").replace(/\s*\(.*$/, "").slice(0, 14)),
        kopisUrl(r.id), isToday(r.from, r.to)
      ));
    }
    console.log(kind + " skipped:", skip);
    await sendGrouped(label + " | " + dateLabel, groups);
  }
  if (wantPop) await sendKind("대중음악", "pop", popDays);
  if (wantClassic) await sendKind("클래식", "classic", classicDays);
});

if (cfg.topics.stays) await safe("stays", async () => {
  const alerts = ruleAlerts(today, cfg.days.stays);
  console.log("stays alerts:", alerts.length);
  if (alerts.length) {
    alerts.sort((a, b) => byTime(a.openNum || 0, b.openNum || 0, a.openNum === today, b.openNum === today));
    await say(heading("공공예약 오픈 임박 | " + dateLabel) + "\n\n" + gapEvery(alerts.map((a) =>
      itemLine(esc(a.name) + " (전국) | " + esc(a.period), a.url, a.openNum === today)
    )).join("\n"));
  }
});

if (cfg.topics.movies) await safe("movies", async () => {
  const res = await collectMovies(KOBIS);
  console.log("movies:", res.dt, res.items.length);
  const lines = gapEvery(res.items.map((x) => {
    const audi = Number(x.audi).toLocaleString("ko-KR");
    const open = x.open ? "개봉 " + String(x.open).replace(/-/g, ".") + " | " : "";
    return x.rank + ". " + esc(x.name) + " (전국) | " + esc(x.genre) + " | " + open + "전일 " + audi + " " + link(naverMovie(x.name));
  }));
  await say(heading("영화 상영 | " + dateLabel) + "\n\n" + lines.join("\n"));
});

if (cfg.topics.books) await safe("books", async () => {
  const best = await collectBooks();
  console.log("books best:", best.length);
  const bl = (x) => x.rank + ". " + esc(x.title) + " | " + esc(x.author) + " | " + esc(x.category) + " | 평점 " + x.rating + " " + link(x.url);
  const parts = chunkLines(gapEvery(best.map(bl)));
  for (let i = 0; i < parts.length; i++) {
    await say(heading("도서 베스트셀러 | " + dateLabel + (parts.length > 1 ? " | " + (i + 1) : "")) + "\n\n" + parts[i].join("\n"));
  }
});

console.log("sent messages:", sent.length);
