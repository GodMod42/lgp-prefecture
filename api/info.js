// Fonction serverless Vercel : renvoie ce que Vercel sait de la requête (IP + géoloc d'edge).
module.exports = (req, res) => {
  const h = req.headers;
  const dec = v => { try { return decodeURIComponent(v || ''); } catch (e) { return v || ''; } };
  const ip = (h['x-forwarded-for'] || '').split(',')[0].trim() || h['x-real-ip'] || req.socket?.remoteAddress || '';

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.status(200).json({
    ip,
    city: dec(h['x-vercel-ip-city']),
    region: h['x-vercel-ip-country-region'] || '',
    country: h['x-vercel-ip-country'] || '',
    lat: h['x-vercel-ip-latitude'] || '',
    lon: h['x-vercel-ip-longitude'] || '',
    tz: h['x-vercel-ip-timezone'] || ''
  });
};
