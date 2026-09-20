// Telegram Bot API helpers. Text only, HTML parse mode, paced sends.
const api = (tok) => `https://api.telegram.org/bot${tok}`;
export const esc = (s) => {
  let t = String(s ?? "");
  for (let i = 0; i < 3; i++) {
    const u = t.replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    const v = u.replace(/&quot;/g, String.fromCharCode(34)).replace(/&#39;/g, String.fromCharCode(39)).replace(/&apos;/g, String.fromCharCode(39)).replace(/&amp;/g, "&");
    if (v === t) break;
    t = v;
  }
  t = t.replace(/<([^<>]+)>/g, "〈$1〉");
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
};
export const link = (u) => `<a href="${u}">[ 보기 ]</a>`;
export const pace = () => new Promise((r) => setTimeout(r, 1100));
export function brackets(s) {
  return String(s ?? "").replace(/<([^<>]+)>/g, "〈$1〉");
}
export function heading(s) {
  return "▣ <b>" + s + "</b>";
}
export function gapEvery(lines, n = 5) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    out.push(lines[i]);
    if ((i + 1) % n === 0 && i + 1 < lines.length) out.push("");
  }
  return out;
}
export function chunkLines(lines, headLen = 90, max = 3500) {
  const parts = [];
  let buf = [],
    n = 0;
  for (const ln of lines) {
    if (n + ln.length + headLen > max) {
      parts.push(buf);
      buf = [ln];
      n = ln.length;
    } else {
      buf.push(ln);
      n += ln.length + 1;
    }
  }
  if (buf.length) parts.push(buf);
  return parts;
}
export async function sendMessage(tok, chatId, text, dry) {
  if (text.length > 4000) throw new Error("message too long: " + text.length);
  if (dry) {
    console.log("[DRY] " + text.slice(0, 140).replace(/\n/g, " | ") + " ...");
    return -1;
  }
  for (let a = 0; a < 5; a++) {
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 15000);
      const r = await fetch(api(tok) + "/sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
        signal: ac.signal,
      });
      clearTimeout(t);
      const j = await r.json();
      if (j.ok) return j.result.message_id;
      if (j.error_code === 429 && j.parameters && j.parameters.retry_after) {
        await new Promise((rr) => setTimeout(rr, (j.parameters.retry_after + 1) * 1000));
        continue;
      }
      throw new Error("telegram: " + (j.description || "unknown"));
    } catch (e) {
      if (a === 4) throw e;
      await new Promise((rr) => setTimeout(rr, 1200));
    }
  }
  throw new Error("telegram: rate limited");
}
