import { sql, init } from './_db.js';

const ID = /^[\w-]{8,64}$/;
const cut = (v, n = 300) => (v == null ? null : String(v).slice(0, n));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    if (!ID.test(b.id || '') || !ID.test(b.vid || '')) return res.status(400).end();
    const device = b.device && JSON.stringify(b.device).length < 8000 ? b.device : null;
    const live = b.live && JSON.stringify(b.live).length < 2000 ? b.live : null;
    const h = req.headers;
    const ip = (h['x-forwarded-for'] || '').split(',')[0].trim();
    const dec = v => { try { return decodeURIComponent(v || ''); } catch { return v || ''; } };
    await init();
    await sql`
      INSERT INTO visits (id, vid, fp, path, referrer, ip, city, region, country, lat, lon, ip_tz, device, live)
      VALUES (${b.id}, ${b.vid}, ${cut(b.fp, 64)}, ${cut(b.path)}, ${cut(b.referrer, 500)}, ${ip},
        ${dec(h['x-vercel-ip-city'])}, ${h['x-vercel-ip-country-region'] || null}, ${h['x-vercel-ip-country'] || null},
        ${parseFloat(h['x-vercel-ip-latitude']) || null}, ${parseFloat(h['x-vercel-ip-longitude']) || null},
        ${h['x-vercel-ip-timezone'] || null}, ${device ? JSON.stringify(device) : null}::jsonb,
        ${live ? JSON.stringify(live) : null}::jsonb)
      ON CONFLICT (id) DO UPDATE SET live = EXCLUDED.live, updated = now()`;
    res.status(204).end();
  } catch (e) {
    console.error(e);
    res.status(500).end();
  }
}
