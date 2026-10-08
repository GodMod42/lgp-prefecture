import { sql, init, isAdmin } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!isAdmin(req)) return res.status(401).json({ error: 'unauthorized' });
  await init();
  const vid = req.query.vid;

  if (req.method === 'DELETE') {            // droit à l'effacement
    if (!vid) return res.status(400).end();
    await sql`DELETE FROM visits WHERE vid = ${vid}`;
    return res.status(204).end();
  }
  if (vid) {
    const rows = await sql`SELECT * FROM visits WHERE vid = ${vid} ORDER BY ts DESC LIMIT 500`;
    return res.json(rows);
  }
  const rows = await sql`
    SELECT vid, count(*)::int AS visits, min(ts) AS first_seen, max(updated) AS last_seen,
      (array_agg(ip ORDER BY ts DESC))[1] AS ip, (array_agg(city ORDER BY ts DESC))[1] AS city,
      (array_agg(country ORDER BY ts DESC))[1] AS country,
      (array_agg(device->>'browser' ORDER BY ts DESC))[1] AS browser,
      (array_agg(device->>'os' ORDER BY ts DESC))[1] AS os
    FROM visits GROUP BY vid ORDER BY last_seen DESC LIMIT 300`;
  res.json(rows);
}
