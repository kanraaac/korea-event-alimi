// Shared HTTP helpers (browser UA + retry). Zero dependencies.
const UA = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Accept-Language": "ko-KR,ko;q=0.9",
};
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function getText(url, tries = 3) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (!r.ok) throw new Error("http " + r.status);
      return await r.text();
    } catch (e) {
      last = e;
      await sleep(1200);
    }
  }
  throw last;
}
export async function getJson(url, tries = 3) {
  return JSON.parse(await getText(url, tries));
}
