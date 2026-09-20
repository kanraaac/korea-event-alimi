import http from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { loadSettings, saveSettings, writeCrontab } from "./src/settings.mjs";
import { REGIONS, REGION_HINT } from "./src/regions.mjs";
import { BOOK_CATS } from "./src/books.mjs";

const PORT = Number(process.env.DASHBOARD_PORT || 8080);
const PASS = process.env.DASHBOARD_PASSWORD || "";

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function ok(res, obj, extra = {}) {
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", ...extra });
  res.end(JSON.stringify(obj));
}

async function applyCron(s) {
  try {
    await writeFile("/etc/crontabs/root", writeCrontab(s));
  } catch (e) {
    console.log("crontab skip:", e.message);
  }
}

const html = await readFile(new URL("./public/index.html", import.meta.url));

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  try {
    if (req.method === "GET" && (u.pathname === "/" || u.pathname === "/index.html")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }
    if (req.method === "GET" && u.pathname === "/api/settings") {
      const s = await loadSettings();
      ok(res, { settings: s, regions: REGIONS, hints: REGION_HINT, hasPass: !!PASS });
      return;
    }
    if (req.method === "POST" && u.pathname === "/api/settings") {
      const body = await parseBody(req);
      if (PASS && body.password !== PASS) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "비밀번호가 다릅니다" }));
        return;
      }
      const s = await saveSettings(body);
      await applyCron(s);
      ok(res, { ok: true, settings: s });
      return;
    }
    if (req.method === "POST" && u.pathname === "/api/run") {
      const body = await parseBody(req).catch(() => ({}));
      if (PASS && body.password !== PASS) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "비밀번호가 다릅니다" }));
        return;
      }
      const child = spawn("/usr/local/bin/node", ["/app/run.mjs"], { detached: true, stdio: "ignore" });
      child.unref();
      ok(res, { ok: true, started: true });
      return;
    }
    res.writeHead(404);
    res.end("not found");
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: String(e.message || e) }));
  }
});

const boot = await loadSettings();
await applyCron(boot);
server.listen(PORT, "0.0.0.0", () => console.log("dashboard on :" + PORT));
