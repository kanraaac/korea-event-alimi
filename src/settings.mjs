import { readFile, writeFile, mkdir } from "node:fs/promises";
import { REGIONS } from "./regions.mjs";

const PATH = process.env.SETTINGS_PATH || "/data/settings.json";

export const DEFAULTS = {
  hour: 8,
  minute: 0,
  topics: {
    tickets: true,
    festivals: true,
    exhibitions: true,
    concerts: true,
    movies: true,
    books: true,
    stays: true,
  },
  days: {
    tickets: 7,
    festivals: 30,
    exhibitions: 15,
    concerts: 15,
  },
  regions: Object.fromEntries(REGIONS.map((r) => [r, true])),
};

export function merge(raw) {
  const s = structuredClone(DEFAULTS);
  if (!raw || typeof raw !== "object") return s;
  if (Number.isFinite(+raw.hour)) s.hour = Math.min(23, Math.max(0, Math.trunc(+raw.hour)));
  if (Number.isFinite(+raw.minute)) s.minute = Math.min(59, Math.max(0, Math.trunc(+raw.minute)));
  if (raw.topics && typeof raw.topics === "object") {
    for (const k of Object.keys(s.topics)) s.topics[k] = !!raw.topics[k];
  }
  if (raw.days && typeof raw.days === "object") {
    for (const k of Object.keys(s.days)) {
      const n = Math.trunc(+raw.days[k]);
      if (Number.isFinite(n)) s.days[k] = Math.min(60, Math.max(1, n));
    }
  }
  if (raw.regions && typeof raw.regions === "object") {
    for (const k of REGIONS) s.regions[k] = !!raw.regions[k];
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
