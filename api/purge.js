import { sql, init, safeEq } from './_db.js';

export default async function handler(req, res) {
  const t = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!process.env.CRON_SECRET || !safeEq(t, process.env.CRON_SECRET)) return res.status(401).end();
  await init();
  await sql`DELETE FROM visits WHERE ts < now() - interval '13 months'`;
  res.status(204).end();
}
