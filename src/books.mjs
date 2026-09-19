// 예스24 베스트셀러 20 + 신간. 상세페이지에서 저자·평점·분류 보강.
import { getText } from "./http.mjs";
const UA_LIST = "https://www.yes24.com/Product/Category/DayBestSeller?categoryNumber=001";
const UA_NEW = "https://www.yes24.com/product/category/newproduct?categoryNumber=001";
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
  return items.sort((a, b) => a.rank - b.rank);
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
export async function collectBooks() {
  const items = await listGoods(UA_LIST, 20, true);
  for (const it of items) await enrich(it);
  return items;
}
export async function collectNewBooks() {
  let items = [];
  try {
    items = await listGoods(UA_NEW, 6, false);
  } catch (e) {
    items = [];
  }
  for (const it of items) await enrich(it);
  return items;
}
