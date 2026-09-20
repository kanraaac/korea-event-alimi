import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { REGIONS } from "./regions.mjs";
import { BOOK_CATS } from "./books.mjs";

const PATH = process.env.SETTINGS_PATH || join(process.cwd(), "data", "settings.json");
const DEFAULT_BOOK = ["001001", "001002", "001007", "001010", "001025"];

export const DEFAULTS = {
  hour: 8,
  minute: 0,
  topics: {
    tickets: true,
    festivals: true,
    exhibitions: true,
    concerts: true,
    pop: true,
    classic: true,
    movies: true,
    books: true,
    stays: true,
  },
  days: {
    tickets: 7,
    festivals: 30,
    exhibitions: 15,
    concerts: 15,
    pop: 15,
    classic: 15,
    stays: 7,
  },
  counts: {
    movies: 10,
    books: 10,
  },
  bookCats: Object.fromEntries(BOOK_CATS.map((c) => [c.id, DEFAULT_BOOK.includes(c.id)])),
  regions: Object.fromEntries(REGIONS.map((r) => [r, true])),
};

export function merge(raw) {
  const s = structuredClone(DEFAULTS);
  if (!raw || typeof raw !== "object") return s;
  if (Number.isFinite(+raw.hour)) s.hour = Math.min(23, Math.max(0, Math.trunc(+raw.hour)));
  if (Number.isFinite(+raw.minute)) s.minute = Math.min(59, Math.max(0, Math.trunc(+raw.minute)));
  if (raw.topics && typeof raw.topics === "object") {
    for (const k of Object.keys(s.topics)) {
      if (raw.topics[k] !== undefined) s.topics[k] = !!raw.topics[k];
    }
    if (raw.topics.pop === undefined && raw.topics.classic === undefined && raw.topics.concerts !== undefined) {
      s.topics.pop = !!raw.topics.concerts;
      s.topics.classic = !!raw.topics.concerts;
    }
  }
  if (raw.days && typeof raw.days === "object") {
    for (const k of Object.keys(s.days)) {
      const n = Math.trunc(+raw.days[k]);
      if (Number.isFinite(n)) s.days[k] = Math.min(90, Math.max(1, n));
    }
    if (raw.days.pop === undefined && raw.days.concerts) s.days.pop = s.days.concerts;
    if (raw.days.classic === undefined && raw.days.concerts) s.days.classic = s.days.concerts;
  }
  if (raw.counts && typeof raw.counts === "object") {
    if (Number.isFinite(+raw.counts.movies)) s.counts.movies = Math.min(10, Math.max(1, Math.trunc(+raw.counts.movies)));
    if (Number.isFinite(+raw.counts.books)) s.counts.books = Math.min(20, Math.max(1, Math.trunc(+raw.counts.books)));
  }
  if (raw.bookCats && typeof raw.bookCats === "object") {
    for (const c of BOOK_CATS) s.bookCats[c.id] = !!raw.bookCats[c.id];
  }
  if (raw.regions && typeof raw.regions === "object") {
    for (const k of REGIONS) {
      if (raw.regions[k] !== undefined) s.regions[k] = !!raw.regions[k];
    }
  }
  return s;
}

export async function loadSettings() {
  try {
    return merge(JSON.parse(await readFile(PATH, "utf8")));
  } catch {
    return merge(null);
  }
}

export async function saveSettings(raw) {
  const s = merge(raw);
  await mkdir(dirname(PATH), { recursive: true }).catch(() => {});
  await writeFile(PATH, JSON.stringify(s, null, 2));
  return s;
}

export function writeCrontab(s) {
  return s.minute + " " + s.hour + " * * * cd /app && /usr/local/bin/node /app/run.mjs >> /var/log/digest.log 2>&1\n";
}
