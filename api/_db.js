import { neon } from '@neondatabase/serverless';
import { timingSafeEqual } from 'node:crypto';

export const sql = neon(process.env.DATABASE_URL);

let ready;
export function init() {
  ready ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS visits (
      id text PRIMARY KEY, vid text NOT NULL, fp text,
      ts timestamptz DEFAULT now(), updated timestamptz DEFAULT now(),
      path text, referrer text, ip text, city text, region text, country text,
      lat real, lon real, ip_tz text, device jsonb, live jsonb)`;
    await sql`CREATE INDEX IF NOT EXISTS visits_vid ON visits (vid)`;
  })();
  return ready;
}

export function safeEq(a = '', b = '') {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function isAdmin(req) {
  const t = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return !!process.env.ADMIN_TOKEN && safeEq(t, process.env.ADMIN_TOKEN);
}
