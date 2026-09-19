// 매일 08:00 KST 다이제스트. 순서: 예매 → 축제 → 전시 → 콘서트 → 영화 → 책.
import { sendMessage, pace, esc, link, chunkLines } from "./src/tg.mjs";
import { kstLabel, ymd8, num8 } from "./src/dates.mjs";
import { collectTickets } from "./src/tickets.mjs";
import { collectFestivals, REGION_ORDER, REGION_LABEL, shortArea, periodOf, festUrl } from "./src/festivals.mjs";
import { collectConcerts, clusterOf, cityOf, kopisUrl, CLUSTERS } from "./src/concerts.mjs";
import { collectArtcue, collectMmca, collectSema } from "./src/exhibitions.mjs";
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
// 오늘 진행중이면 🔴+굵게 (축제·콘서트·전시만)
function itemLine(inner, url, active) {
  return active ? `• 🔴 <b>${inner}</b> ${link(url)}` : `• ${inner} ${link(url)}`;
}
const isToday = (from, to) => num8(from) <= today && today <= num8(to);
const knex = (s) => String(s || "").replace(/^\d{4}\./, "");

console.log("date:", dateLabel, "today:", today);

// 1) 예매 오픈 (오늘~+7일)
{
  const tk = await collectTickets(today, num8(ymd8(7)));
  console.log("tickets:", tk.length);
  const lines = tk.map((t) => {
    const hhmm = t.open.slice(11, 16);
    const md = t.open.slice(5, 10).replace("-", "/");
    return `• ${esc(t.title)} (${esc(t.venue.slice(0, 12))}) | 예매 ${md} ${hhmm} ${link(t.url)}`;
  });
  for (const [i, part] of chunkLines(lines).entries()) {
    await say(`[공연·전시 티켓 예매 오픈 | ${dateLabel}]${chunkLines(lines).length > 1 ? ` | ${i + 1}` : ""}\n` + part.join("\n"));
  }
}
// 2) 축제 (오늘~+30일, 시·도 권역·일정순)
{
  const { y, m, d } = (() => {
    const s = ymd8(0);
    return { y: +s.slice(0, 4), m: +s.slice(4, 6), d: +s.slice(6, 8) };
  })();
  const { total, groups } = await collectFestivals(y, m, d);
  console.log("festivals:", total);
  for (const key of REGION_ORDER) {
    const list = groups[key] || [];
    if (!list.length) continue;
    const lines = list.map((it) =>
      itemLine(`${esc(it.name)} (${esc(shortArea(it.area))}) | ${esc(periodOf(it))}`, festUrl(it.id), isToday(it.start, it.end))
    );
    const parts = chunkLines(lines);
    for (const [i, part] of parts.entries()) {
      const head = parts.length > 1
        ? `[지역축제·지역행사 | ${dateLabel} | ${REGION_LABEL[key]} ${list.length}건 | ${i + 1}/${parts.length}]`
        : `[지역축제·지역행사 | ${dateLabel} | ${REGION_LABEL[key]} ${list.length}건]`;
      await say(head + "\n" + part.join("\n"));
    }
  }
}
// 3) 전시 (오늘~+60일, 종료임박순)
{
  const endWin = num8(ymd8(60));
  const art = await collectArtcue();
  const seenT = new Set(art.map((x) => x.title));
  const extra = [...(await collectMmca()), ...(await collectSema())].filter((x) => x.title && !seenT.has(x.title));
  const all = [...art, ...extra];
  console.log("exhibitions raw:", all.length);
  const inWin = all.filter((x) => x.start && num8(x.start) <= endWin && (!x.end || num8(x.end) >= today));
  inWin.sort((a, b) => num8(a.end || "9999") - num8(b.end || "9999"));
  console.log("exhibitions inWin:", inWin.length);
  const lines = inWin.map((x) => {
    const where = ((x.region ? x.region + " " : "") + (x.venue || "")).trim().slice(0, 16) || "전국";
    return itemLine(
      `${esc(x.title || "(제목 미상)")} (${esc(where)}) | ${esc(x.start)}~${esc(knex(x.end))}`,
      x.url, isToday(x.start, x.end || "9999.12.31")
    );
  });
  const parts = chunkLines(lines);
  for (const [i, part] of parts.entries()) {
    await say(`[전시·미술관·박물관 | ${dateLabel}${parts.length > 1 ? ` | ${i + 1}/${parts.length}` : ""}]\n` + part.join("\n"));
  }
}
// 4) 콘서트·음악 (오늘~+60일, 6묶음·공연일순)
{
  const w1 = [ymd8(0), ymd8(30)];
  const w2 = [ymd8(31), ymd8(60)];
  const raw = [...(await collectConcerts(KOPIS, ...w1)), ...(await collectConcerts(KOPIS, ...w2))];
  console.log("concerts raw:", raw.length);
  const groups = Object.fromEntries(CLUSTERS.map((c) => [c, []]));
  let skip = 0;
  for (const r of raw) {
    if (!(num8(r.from) <= num8(ymd8(60)) && num8(r.to) >= today)) {
      skip++;
      continue;
    }
    const hay = `${r.name} ${r.place} ${r.area}`;
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
      const per = r.from === r.to ? r.from : `${r.from}~${knex(r.to)}`;
      return itemLine(
        `${esc(r.name)} (${esc(r._city || k)}) | 공연 ${esc(per)} | ${esc((r.place || "").replace(/\s*\(.*$/, "").slice(0, 14))}`,
        kopisUrl(r.id), isToday(r.from, r.to)
      );
    });
    const parts = chunkLines(lines);
    for (const [i, part] of parts.entries()) {
      const head = parts.length > 1
        ? `[콘서트·음악 | ${dateLabel} | ${k} ${list.length}건 | ${i + 1}/${parts.length}]`
        : `[콘서트·음악 | ${dateLabel} | ${k} ${list.length}건]`;
      await say(head + "\n" + part.join("\n"));
    }
  }
}
// 5) 영화 (전일 박스 10 + 장르)
{
  const { dt, items } = await collectMovies(KOBIS);
  console.log("movies:", dt, items.length);
  const lines = items.map((x) => {
    const audi = Number(x.audi).toLocaleString("ko-KR");
    const open = x.open ? `개봉 ${String(x.open).replace(/-/g, ".")} | ` : "";
    return `${x.rank}. ${esc(x.name)} (전국) | ${esc(x.genre)} | ${open}전일 ${audi} ${link(naverMovie(x.name))}`;
  });
  await say(`[영화 상영 | ${dateLabel}]\n` + lines.join("\n"));
}
// 6) 책 (베스트20 + 신간)
{
  const best = await collectBooks();
  console.log("books best:", best.length);
  const bl = (x) => `${x.rank}. ${esc(x.title)} | ${esc(x.author)} | ${esc(x.category)} | 평점 ${x.rating} ${link(x.url)}`;
  const parts = chunkLines(best.map(bl));
  for (const [i, part] of parts.entries()) {
    await say(`[도서 베스트셀러 | ${dateLabel}]${parts.length > 1 ? ` | ${i + 1}` : ""}\n` + part.join("\n"));
  }
  const news = await collectNewBooks();
  console.log("books new:", news.length);
  if (news.length) {
    await say(`[도서 신간 | ${dateLabel}]\n` + news.map(bl).join("\n"));
  }
}
console.log("sent messages:", sent.length);
