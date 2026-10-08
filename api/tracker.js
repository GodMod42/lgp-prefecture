/* À inclure sur chaque page : <script src="/tracker.js" defer></script>
   Rien n'est collecté avant le clic sur « Accepter ». */
(() => {
  const K = 'cs_consent', V = 'cs_vid';
  const ls = {
    get: k => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
    del: k => { try { localStorage.removeItem(k); } catch {} }
  };
  const FONTS = ['Arial','Helvetica Neue','Times New Roman','Roboto','SF Pro Display','Menlo','Comic Sans MS','Impact','Futura','Gill Sans','Avenir','Lato','Open Sans','Calibri','Cambria','Segoe UI','Consolas','Verdana','Georgia','Tahoma','Trebuchet MS','Courier New','Garamond','Ubuntu'];

  function banner() {
    const d = document.createElement('div');
    d.setAttribute('role', 'dialog');
    d.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;max-width:560px;margin:auto;background:#161920;color:#c9ced8;border:1px solid #262a33;border-radius:12px;padding:16px;font:14px/1.5 system-ui,sans-serif;z-index:99999';
    d.innerHTML = '<p style="margin:0 0 12px">Ce site mesure votre visite (appareil, navigateur, localisation approximative, interactions) à des fins statistiques. Cela nécessite votre accord. <a href="/confidentialite.html" style="color:#3ddc97">En savoir plus</a></p><div style="display:flex;gap:8px"><button data-v="no">Refuser</button><button data-v="yes">Accepter</button></div>';
    d.querySelectorAll('button').forEach(b => {
      b.style.cssText = 'flex:1;padding:10px;border-radius:8px;border:1px solid #3a3f4b;background:#262a33;color:#fff;font:inherit;cursor:pointer';
      b.onclick = () => { ls.set(K, b.dataset.v); d.remove(); if (b.dataset.v === 'yes') start(); };
    });
    document.body.appendChild(d);
  }

  const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))]
    .map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);

  function fonts() {
    const base = ['monospace', 'serif', 'sans-serif'], s = document.createElement('span');
    s.style.cssText = 'position:absolute;left:-9999px;font-size:72px;visibility:hidden';
    s.textContent = 'mmmmmmmmmmlli'; document.body.appendChild(s);
    const w = {}; base.forEach(b => { s.style.fontFamily = b; w[b] = s.offsetWidth; });
    const found = FONTS.filter(f => base.some(b => { s.style.fontFamily = `'${f}',${b}`; return s.offsetWidth !== w[b]; }));
    s.remove(); return found;
  }
  function gpu() {
    try { const g = document.createElement('canvas').getContext('webgl'), e = g.getExtension('WEBGL_debug_renderer_info');
      return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); } catch { return null; }
  }
  function canvasPrint() {
    try { const c = document.createElement('canvas'); c.width = 240; c.height = 60; const x = c.getContext('2d');
      x.textBaseline = 'top'; x.font = '16px Arial'; x.fillStyle = '#f60'; x.fillRect(10, 5, 100, 30);
      x.fillStyle = '#069'; x.fillText('Cwm fjordbank glyphs vext quiz', 4, 20); return c.toDataURL(); } catch { return ''; }
  }
  function browser() {
    const u = navigator.userAgent;
    return /Edg\//.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /Firefox\//.test(u) ? 'Firefox' : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : 'Inconnu';
  }
  function os() {
    const u = navigator.userAgent;
    return /Windows/.test(u) ? 'Windows' : /Android/.test(u) ? 'Android' : /iPhone|iPad/.test(u) ? 'iOS' : /Mac OS X/.test(u) ? 'macOS' : /Linux/.test(u) ? 'Linux' : 'Inconnu';
  }

  async function start() {
    let vid = ls.get(V);
    if (!vid) { vid = crypto.randomUUID(); ls.set(V, vid); }
    const id = crypto.randomUUID(), n = navigator, s = screen, fl = fonts(), g = gpu();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const mq = q => matchMedia(q).matches;
    const fp = await sha(JSON.stringify([n.userAgent, n.languages, tz, s.width, s.height, devicePixelRatio, g, n.hardwareConcurrency, fl, canvasPrint()]));
    const device = {
      browser: browser(), os: os(), ua: n.userAgent, langs: n.languages, tz, gpu: g,
      cpu: n.hardwareConcurrency, ram: n.deviceMemory, screen: `${s.width}x${s.height}`, dpr: devicePixelRatio,
      depth: s.colorDepth, touch: n.maxTouchPoints, win: `${innerWidth}x${innerHeight}`, fonts: fl,
      dark: mq('(prefers-color-scheme: dark)'), reduced_motion: mq('(prefers-reduced-motion: reduce)'),
      adblock: false, dnt: n.doNotTrack === '1', webdriver: n.webdriver,
      conn: n.connection ? { type: n.connection.effectiveType, downlink: n.connection.downlink, rtt: n.connection.rtt } : null
    };
    const bait = document.createElement('div');
    bait.className = 'adsbox ad-banner'; bait.style.cssText = 'position:absolute;left:-9999px;height:10px;width:10px';
    document.body.appendChild(bait); await new Promise(r => setTimeout(r, 150));
    device.adblock = bait.offsetHeight === 0; bait.remove();

    const t0 = Date.now(); let moves = 0, clicks = 0, keys = 0, scroll = 0, hidden = 0;
    addEventListener('mousemove', () => moves++, { passive: true });
    addEventListener('click', () => clicks++);
    addEventListener('keydown', () => keys++);   // seul le nombre est compté, jamais le contenu
    addEventListener('scroll', () => { const h = document.documentElement.scrollHeight - innerHeight;
      scroll = Math.max(scroll, h > 0 ? Math.round(scrollY / h * 100) : 100); }, { passive: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { hidden++; send(); } });

    const payload = first => JSON.stringify({ id, vid, fp, path: location.pathname, referrer: document.referrer,
      device: first ? device : undefined,
      live: { seconds: Math.round((Date.now() - t0) / 1000), moves, clicks, keys, scroll, hidden } });
    const send = (first = false) => {
      const body = payload(first);
      if (!first && navigator.sendBeacon) navigator.sendBeacon('/api/collect', new Blob([body], { type: 'application/json' }));
      else fetch('/api/collect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
    };
    send(true);
    setInterval(() => { if (!document.hidden) send(); }, 15000);
    addEventListener('pagehide', () => send());
  }

  window.csConsentReset = () => { ls.del(K); ls.del(V); location.reload(); };  // lien « Gérer mes cookies »
  const c = ls.get(K);
  const go = () => c === 'yes' ? start() : c === 'no' ? 0 : banner();
  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', go) : go();
})();
