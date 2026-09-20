// 예스24 국내도서 일간 베스트. 분류는 상품 장르로 필터한다.
import { getText } from "./http.mjs";

export const BOOK_CATS = [
  { id: "001", label: "종합" },
  { id: "001001", label: "소설/시/희곡" },
  { id: "001002", label: "에세이" },
  { id: "001007", label: "경제경영" },
  { id: "001010", label: "자기계발" },
  { id: "001011", label: "인문" },
  { id: "001013", label: "역사" },
  { id: "001003", label: "여행" },
  { id: "001019", label: "자연과학" },
  { id: "001020", label: "사회정치" },
  { id: "001023", label: "만화" },
  { id: "001024", label: "수험서 자격증" },
  { id: "001025", label: "어린이" },
  { id: "001027", label: "유아" },
  { id: "001028", label: "청소년" },
  { id: "001029", label: "IT모바일" },
  { id: "001006", label: "건강취미" },
];

function norm(s) {
  return String(s || "").replace(/\s+/g, "");
}

export function bookMatches(genre, cat) {
  const g = norm(genre);
  if (!g || g === "-") return false;
  const full = norm(cat.label);
  if (full && g.indexOf(full) >= 0) return true;
  const keys = cat.label.split(/[\/·]/).map((x) => norm(x)).filter((x) => x.length >= 2);
  return keys.some((k) => g.indexOf(k) >= 0);
}

async function listGoods(url, limit, ranked) {
  const h = await getText(url);
  const blocks = h.split(/<li[^>]*data-goods-no="/).slice(1);
  const items = [];
  let n = 0;
  for (const b of blocks) {
    const id = (b.slice(0, 12).match(/^\d+/) || [])[0];
    if (!id) continue;
    const rk = (b.match(/ico rank">(\d+)/) || [])[1];
    if (!rk && ranked) continue;
    n++;
    const title = (b.match(/alt="([^"]+)"/) || [])[1] || "";
    items.push({ rank: rk ? +rk : n, id: id, title: title });
    if (items.length >= limit) break;
  }
  return items;
}

async function enrich(it) {
  try {
    const h = await getText("https://www.yes24.com/product/goods/" + it.id, 2);
    const tt = ((h.match(/<title>([^<]+)<\/title>/) || [])[1] || "").split("|").map((s) => s.trim());
    it.author = tpAuthor(tt);
    it.rating = (h.match(/리뷰 총점[^0-9]{0,80}([\d.]+)/) || [])[1] || "-";
    const gm = h.match(/"genre":\s*\["([^"\]]+)/);
    it.category = (((gm || [])[1] || "-").trim()) || "-";
  } catch (e) {
    it.author = "-";
    it.rating = "-";
    it.category = "-";
  }
  it.url = "https://www.yes24.com/product/goods/" + it.id;
  return it;
}

function tpAuthor(tp) {
  return tp[1] || "-";
}

export async function collectBooks(pool = 60) {
  const want = Math.min(120, Math.max(20, Math.trunc(+pool) || 60));
  const seen = new Set();
  const items = [];
  for (let page = 1; page <= 6 && items.length < want; page++) {
    const url = "https://www.yes24.com/Product/Category/DayBestSeller?CategoryNumber=001&pageNumber=" + page + "&pageSize=24";
    const chunk = await listGoods(url, 24, true);
    if (!chunk.length) break;
    for (const it of chunk) {
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      items.push(it);
      if (items.length >= want) break;
    }
  }
  items.sort((a, b) => a.rank - b.rank);
  for (const it of items) await enrich(it);
  return items;
}

export async function collectNewBooks() {
  let items = [];
  try {
    items = await listGoods("https://www.yes24.com/product/category/newproduct?categoryNumber=001", 6, false);
  } catch (e) {
    items = [];
  }
  for (const it of items) await enrich(it);
  return items;
}
