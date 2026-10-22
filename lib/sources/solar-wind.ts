const MAG_URL = "https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json";
const WIND_URL = "https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json";

export type SolarWind = {
  time: Date;
  source: string | null;    // which satellite (e.g. IMAP, ACE, DSCOVR)
  bz: number | null;        // latest Bz (nT), negative = good for aurora
  bzAvg30: number | null;   // average Bz over the last 30 min (less jumpy)
  bt: number | null;        // total field strength
  speed: number | null;     // km/s
  density: number | null;   // p/cm³
};

type Row = Record<string, unknown>;

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function time(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const iso = v.replace(" ", "T");
  const d = new Date(/Z$|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Files are > 2 MB (too big for Next's fetch cache), so keep them in memory for 60 s
const TTL_MS = 60 * 1000;
const memo = new Map<string, { at: number; rows: Row[] }>();

async function getRows(url: string): Promise<Row[]> {
  const hit = memo.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rows;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} failed: ${res.status}`);
  const json: unknown = await res.json();
  const all = Array.isArray(json)
    ? json.filter((r): r is Row => typeof r === "object" && r !== null)
    : [];

  // Several satellites are mixed in, so prefer the one NOAA marks as active
  const active = all.filter((r) => r.active === true);
  const rows = active.length > 0 ? active : all;

  memo.set(url, { at: Date.now(), rows });
  return rows;
}

const STALE_MS = 60 * 60 * 1000; // ignore data older than 1 hour (satellite gaps)

export async function fetchSolarWind(): Promise<SolarWind | null> {
  const [magRes, windRes] = await Promise.allSettled([
    getRows(MAG_URL),
    getRows(WIND_URL),
  ]);
  if (magRes.status === "rejected") throw magRes.reason;

  const mag = magRes.value
    .map((r) => ({
      time: time(r.time_tag),
      bz: num(r.bz_gsm),
      bt: num(r.bt),
      source: typeof r.source === "string" ? r.source : null,
    }))
    .filter(
      (r): r is { time: Date; bz: number; bt: number | null; source: string | null } =>
        r.time !== null && r.bz !== null,
    )
    .sort((a, b) => a.time.getTime() - b.time.getTime()); // oldest → newest

  const latest = mag.at(-1);
  if (!latest || Date.now() - latest.time.getTime() > STALE_MS) return null;

  const since = latest.time.getTime() - 30 * 60 * 1000;
  const recent = mag.filter((r) => r.time.getTime() >= since);
  const bzAvg30 = recent.reduce((sum, r) => sum + r.bz, 0) / recent.length;

  const wind =
    windRes.status === "fulfilled"
      ? windRes.value
          .map((r) => ({
            time: time(r.time_tag),
            speed: num(r.proton_speed),
            density: num(r.proton_density),
          }))
          .filter((r) => r.time !== null && r.speed !== null)
          .sort((a, b) => a.time!.getTime() - b.time!.getTime())
      : [];
  const lastWind = wind.at(-1);

  return {
    time: latest.time,
    source: latest.source,
    bz: latest.bz,
    bzAvg30: Math.round(bzAvg30 * 10) / 10,
    bt: latest.bt,
    speed: lastWind?.speed ?? null,
    density: lastWind?.density ?? null,
  };
}