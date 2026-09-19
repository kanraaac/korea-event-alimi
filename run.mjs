// 매일 08:00 KST 다이제스트. 순서: 예매 → 축제 → 전시 → 콘서트 → 영화 → 책.
// 한 섹션이 죽어도 나머지는 간다.
import { sendMessage, pace, esc, link, chunkLines, brackets } from "./src/tg.mjs";
import { kstLabel, ymd8, num8 } from "./src/dates.mjs";
import { collectTickets } from "./src/tickets.mjs";
import { ruleAlerts } from "./src/stays.mjs";
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
  return active ? "• 🟢 <b>" + inner + "</b> " + link(url) : "• " + inner + " " + link(url);
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
  const TKC = ["수도권", "충청전라", "강원", "영남", "대구", "울산", "부산", "제주", "기타"];
  async function tkSend(head, items) {
    if (!items.length) return;
    const chunks = [];
    let buf = [], n = head.length;
    for (const k of TKC) {
      const list = items.filter((t) => (clusterOf(t.title + " " + t.region) || "기타") === k);
      if (!list.length) continue;
      const lines = list.map(tline);
      let idx = 0, needHead = true;
      while (idx < lines.length) {
        const sub = "🔴 <b>" + k + "</b>";
        if (needHead) {
          if (buf.length && n + sub.length + 1 + lines[idx].length + 1 > 3500) {
            chunks.push(buf); buf = []; n = head.length;
          }
          buf.push(sub); n += sub.length + 1; needHead = false;
        }
        while (idx < lines.length && n + lines[idx].length + 1 <= 3500) {
          buf.push(lines[idx]); n += lines[idx].length + 1; idx++;
        }
        if (idx < lines.length) {
          chunks.push(buf); buf = []; n = head.length; needHead = true;
        }
      }
    }
    if (buf.length) chunks.push(buf);
    for (let i = 0; i < chunks.length; i++) {
      await say(head + (chunks.length > 1 ? " | " + (i + 1) : "") + "\n" + chunks[i].join("\n"));
    }
  }
  const isNow = (t) => {
    const d = num8(t.open.slice(0, 10));
    return d === today || d === tmr;
  };
  await tkSend("[공연·전시 티켓 오늘·내일 예매 오픈 | " + dateLabel + "]", tk.filter(isNow));
  await tkSend("[공연·전시 티켓 1주일내 예매 오픈 | " + dateLabel + "]", tk.filter((t) => !isNow(t)));
});
await safe("festivals", async () => {
  const s = ymd8(0);
  const y = +s.slice(0, 4), m = +s.slice(4, 6), d = +s.slice(6, 8);
  const res = await collectFestivals(y, m, d);
  console.log("festivals:", res.total);
  const fgroups = {};
  for (const key of ["서울", "대구", "경북", "경남", "울산", "부산"]) fgroups[key] = [];
  for (const key of ["서울", "대구", "경북", "경남", "울산", "부산"]) {
    for (const it of (res.groups[key] || [])) {
      if (key === "경북" && /경주/.test(it.name + " " + it.area)) {
        (fgroups["경주"] = fgroups["경주"] || []).push(it);
      } else {
        fgroups[key].push(it);
      }
    }
  }
  const FORDER = ["서울", "대구", "경북", "경주", "경남", "울산", "부산"];
  const FLABEL = { "서울": "서울", "대구": "대구", "경북": "경상북도", "경주": "경주", "경남": "경상남도", "울산": "울산", "부산": "부산" };
  for (const key of FORDER) {
    const list = fgroups[key] || [];
    if (!list.length) continue;
    const lines = list.map((it) =>
      itemLine(esc(it.name) + " (" + esc(shortArea(it.area)) + ") | " + esc(periodOf(it)), festUrl(it.id), isToday(it.start, it.end))
    );
    const parts = chunkLines(lines);
    for (let i = 0; i < parts.length; i++) {
      const head = parts.length > 1
        ? "[지역축제·지역행사 | " + dateLabel + " | " + FLABEL[key] + " " + list.length + "건 | " + (i + 1) + "/" + parts.length + "]"
        : "[지역축제·지역행사 | " + dateLabel + " | " + FLABEL[key] + " " + list.length + "건]";
      await say(head + "\n" + parts[i].join("\n"));
    }
  }
});
await safe("exhibitions", async () => {
  const endWin = num8(ymd8(15));
  const art = await collectArtcue();
  const seenT = new Set(art.map((x) => x.title));
  const extra = [...(await collectSema()), ...(await collectLeeum()), ...(await collectHoam()), ...(await collectArko())].filter((x) => x.title && !seenT.has(x.title));
  const all = [...art, ...extra];
  console.log("exhibitions raw:", all.length);
  const inWin = all.filter((x) => x.start && num8(x.start) <= endWin && (!x.end || num8(x.end) >= today));
  inWin.sort((a, b) => num8(a.end || "9999") - num8(b.end || "9999"));
  console.log("exhibitions inWin:", inWin.length);
  const EG = ["서울", "대구", "경주", "울산", "부산"];
  function exGroup(x) {
    const r = x.region || "";
    const hay = (x.title || "") + " " + (x.venue || "");
    if (r === "대구") return "대구";
    if (r === "울산") return "울산";
    if (r === "부산") return "부산";
    if (r === "서울") return "서울";
    if (r === "경북" && /경주/.test(hay)) return "경주";
    if (/대구/.test(hay)) return "대구";
    if (/울산/.test(hay)) return "울산";
    if (/부산|해운대|벡스코/.test(hay)) return "부산";
    if (/경주/.test(hay)) return "경주";
    if (r === "경북" || r === "경기" || r === "인천" || r === "강원" || r === "충북" || r === "충남" || r === "대전" || r === "세종" || r === "전북" || r === "전남" || r === "광주" || r === "제주" || r === "경남") return "";
    if (/용인|과천|청주|성남|고양|수원|부천|안양|하남|인천|경기|세종|대전|충북|충남|전북|전남|광주|강원|경남|제주|경북/.test(hay)) return "";
    if (/서울|용산|종로|덕수궁|SeMA|리움|아르코/.test(hay)) return "서울";
    return "";
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
  function concertCity(area, hay) {
    const a = area || "";
    if (/대구/.test(a)) return "대구";
    if (/울산/.test(a)) return "울산";
    if (/부산/.test(a)) return "부산";
    if (/서울/.test(a)) return "서울";
    if (/경북/.test(a) && /경주/.test(hay)) return "경주";
    if (/대구/.test(hay)) return "대구";
    if (/울산/.test(hay)) return "울산";
    if (/부산|해운대|벡스코/.test(hay)) return "부산";
    if (/경주/.test(hay)) return "경주";
    if (/서울|올림픽|예술의전당|세종문화|롯데콘서트|KSPO|고척|잠실|홍대|마포|서교|연남|합정|대학로|코엑스|금호아트홀|영산아트홀|무신사|개러지|롤링홀|명화|원더로크|상상마당|세티|SETI|클럽|라이브홀|라이브클럽|소극장|성수|건대|이태원/.test(hay)) return "서울";
    return "";
  }
await safe("concerts", async () => {
  const raw = await collectConcerts(KOPIS, ymd8(0), ymd8(15));
  console.log("concerts raw:", raw.length);
  const groups = Object.fromEntries(["서울", "대구", "경주", "울산", "부산"].map((c) => [c, []]));
  let skip = 0;
  for (const r of raw) {
    if (!(num8(r.from) <= num8(ymd8(15)) && num8(r.to) >= today)) {
      skip++;
      continue;
    }
    const hay = r.name + " " + r.place;
    const c = concertCity(r.area, hay);
    if (!c) {
      skip++;
      continue;
    }
    r._city = c;
    groups[c].push(r);
  }
  console.log("concerts skipped:", skip);
  for (const k of ["서울", "대구", "경주", "울산", "부산"]) {
    const list = groups[k].sort((a, b) => num8(a.from) - num8(b.from));
    if (!list.length) continue;
    const lines = list.map((r) => {
      const per = r.from === r.to ? r.from : r.from + "~" + knex(r.to);
      return itemLine(
        esc(brackets(r.name)) + " (" + esc(r._city || k) + ") | 공연 " + esc(per) + " | " + esc((r.place || "").replace(/\s*\(.*$/, "").slice(0, 14)),
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
    await say("[공공예약 오픈 임박 | " + dateLabel + "]" + "\n" + alerts.map((a) =>
      itemLine(esc(a.name) + " (전국) | " + esc(a.period), a.url, a.openNum === today)
    ).join("\n"));
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
});
console.log("sent messages:", sent.length);
