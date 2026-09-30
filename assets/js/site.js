/* Site LGP — en-tête, bandeau Urgent et textes modifiables (content.json).
   À inclure dans le <head> de CHAQUE page :  <script src="assets/js/site.js"></script> */
(function(){
const S=window.SITE={data:{},defaults:{"urgent": {"enabled": true, "theme": "red", "tag": "URGENT", "text": "Toute belle chose a une fin... Mais c'est le début d'une nouvelle aventure !", "linkText": "→ Discord Préfecture", "linkUrl": "https://discord.gg/8RAFH7KfDj", "closable": true}, "jobs": [{"titre": "Directeur de cabinet", "salaire": "6 000 – 9 000 €+", "texte": "Bras droit du Préfet. Il pilote le cabinet, coordonne les actions prioritaires, gère les affaires sensibles, les relations avec les autorités (Élysée, ministère, Ville de Paris) et prépare les décisions du Préfet."}, {"titre": "Secrétaire Général", "salaire": "5 500 – 8 000 €", "texte": "Assure la direction administrative de la Préfecture, supervise l'ensemble des services et veille au bon fonctionnement quotidien de l'institution."}, {"titre": "Attaché d'administration", "salaire": "3 500 – 5 000 €", "texte": "Encadre un service, instruit les dossiers complexes et prépare les actes administratifs soumis à la signature de la hiérarchie."}, {"titre": "Secrétaire administratif", "salaire": "2 500 – 3 500 €", "texte": "Assure le suivi des dossiers, l'accueil des usagers, la rédaction des courriers et la gestion des démarches en ligne."}, {"titre": "Inspecteur IGPN", "salaire": "4 500 – 6 500 €", "texte": "Inspection Générale de la Police Nationale : mène les enquêtes internes, contrôle le respect de la déontologie et traite les signalements visant les agents."}, {"titre": "Huissier de Justice (à la PP)", "salaire": "4 000 – 6 000 €", "texte": "Signifie les actes officiels, constate les faits et exécute les décisions de justice pour le compte de la Préfecture de Police."}, {"titre": "Inspecteur", "salaire": "3 500 – 5 000 €", "texte": "Contrôle le respect de la réglementation, réalise des inspections sur le terrain et rédige les rapports remis à la direction."}], "salaryLabel": "Salaire moyen :"},page:()=>location.pathname.split('/').pop().replace(/\.html?$/,'')||'index'};
S.defaults.ticketMotifs=["Renseignement","Démarche administrative","Signalement / plainte","Recrutement","Autre"];
const admin=!!window.LGP_ADMIN;
const css=`
header{border-top:0!important;border-image:none!important}
header::before{content:"";position:absolute;left:0;right:0;top:0;height:6px;background:linear-gradient(90deg,#000091 33.333%,#fff 33.333% 66.666%,#e1000f 66.666%);box-shadow:inset 0 -1px 0 rgba(0,0,0,.14)}
header .w{min-height:126px!important;padding-top:6px}
.logo img{height:100px!important}
nav{gap:8px!important}
nav a{padding:14px 22px!important;font-size:1.1rem!important}
#theme{width:48px!important;height:48px!important}
.btn-co{padding:15px 32px!important;font-size:1.05rem!important}
@media(max-width:960px){.logo img{height:76px!important}header .w{min-height:0!important}}
.lgp-urgent{border-left:4px solid var(--b);background:var(--bg);color:var(--c);font:.95rem/1.5 Marianne,"Public Sans","Segoe UI",system-ui,sans-serif}
.lgp-urgent.red{--b:#e1000f;--bg:#fbe9e9;--c:#7a0a0a}.lgp-urgent.blue{--b:#000091;--bg:#e8edff;--c:#00006d}.lgp-urgent.yellow{--b:#d68a00;--bg:#fff4d6;--c:#6b4500}
:root[data-theme=dark] .lgp-urgent.red{--bg:#3a1f21;--c:#ffb4b4}:root[data-theme=dark] .lgp-urgent.blue{--b:#8b8bff;--bg:#1c1f3d;--c:#c9ccff}:root[data-theme=dark] .lgp-urgent.yellow{--bg:#3a2e12;--c:#ffd98a}
.lgp-urgent .in{display:flex;align-items:center;gap:14px;flex-wrap:wrap;max-width:1200px;margin:0 auto;padding:14px 24px}
.lgp-urgent button{width:32px;height:32px;border-radius:50%;border:0;background:rgba(0,0,0,.08);color:inherit;display:grid;place-items:center;cursor:pointer;flex:none}
.lgp-urgent .t{background:rgba(0,0,0,.08);border-radius:14px;padding:3px 12px;font-size:.8rem;font-weight:800;letter-spacing:.04em}
.lgp-urgent a{text-decoration:underline;font-weight:600}
.lgp-prev{position:fixed;left:16px;bottom:50px;z-index:50;background:#000091;color:#fff;border-radius:20px;padding:8px 16px;font:600 .85rem system-ui,sans-serif}
.lgp-prev a{margin-left:10px;text-decoration:underline}`;
const st=document.createElement('style');st.textContent=css;document.head.append(st);

/* ---- Textes modifiables ---- */
const L=/[\p{L}\p{N}]/u,hash=s=>{let x=5381;for(const c of s)x=(x*33^c.codePointAt(0))>>>0;return x.toString(36)};
S.toMarkup=el=>[...el.childNodes].map(n=>n.nodeType===3?n.nodeValue.replace(/\s+/g,' '):n.tagName==='BR'?'\n':/^(B|STRONG)$/.test(n.tagName)?'**'+n.textContent+'**':n.tagName==='A'?'['+n.textContent+']('+(n.getAttribute('href')||'#')+')':'').join('').split('\n').map(s=>s.trim()).join('\n').trim();
S.setMarkup=(el,v)=>{const nl=el.closest('a,button');el.textContent='';
 v.split('\n').forEach((line,i)=>{if(i)el.append(document.createElement('br'));let last=0;
  line.replace(/\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g,(m,b,t,u,x)=>{if(x>last)el.append(line.slice(last,x));last=x+m.length;
   if(b){const e=document.createElement('b');e.textContent=b;el.append(e)}
   else if(nl||/^\s*(javascript|data|vbscript):/i.test(u))el.append(t);
   else{const a=document.createElement('a');a.href=u;a.textContent=t;if(/^https?:/i.test(u)){a.target='_blank';a.rel='noopener'}el.append(a)}return m});
  if(last<line.length)el.append(line.slice(last))})};
S.scan=(doc,page)=>{const out=[],cnt={};
 const add=(el,o)=>{const scope=el.closest('header,footer,.fictif,.aide')?'shared':page,k=scope+':'+hash(o.def),n=cnt[k]=(cnt[k]||0)+1;
  out.push(Object.assign(o,{el,scope,tag:el.tagName,key:n>1?k+'.'+(n-1):k}))};
 const walk=el=>{
  if(/^(script|style|svg|symbol|noscript|select|textarea|option|iframe)$/i.test(el.tagName)||el.hasAttribute('data-notx')||el.matches('.actions,.urgent,.lgp-urgent,.lgp-prev'))return;
  const kids=[...el.children],tn=[...el.childNodes].filter(n=>n.nodeType===3&&n.nodeValue.trim());
  if(tn.length&&kids.every(k=>/^(BR|B|STRONG|A)$/i.test(k.tagName)&&!k.children.length)){const v=S.toMarkup(el);if(L.test(v))add(el,{mode:'rich',def:v});return}
  if(tn.length===1){const raw=tn[0].nodeValue,v=raw.replace(/\s+/g,' ').trim();if(L.test(v))add(el,{mode:'node',node:tn[0],def:v,trail:/\s$/.test(raw)})}
  kids.forEach(walk)};
 walk(doc.body);return out};
S.apply=(doc,data)=>{const t=data.texts||{};S.scan(doc,S.page()).forEach(f=>{const v=t[f.key];if(v==null||v===f.def)return;
 if(f.mode==='rich')S.setMarkup(f.el,v);else f.node.nodeValue=v+(f.trail?' ':'')})};

/* ---- Bandeau Urgent ---- */
S.uid=c=>hash(JSON.stringify(c));
S.urgentEl=c=>{const d=document.createElement('div'),i=document.createElement('div');d.className='lgp-urgent '+(c.theme||'red');d.setAttribute('role','status');i.className='in';
 if(c.closable){const b=document.createElement('button');b.type='button';b.setAttribute('aria-label','Fermer le message');
  b.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  b.onclick=()=>{try{sessionStorage.setItem('lgp_u',S.uid(c))}catch(e){}d.remove()};i.append(b)}
 const sp=(cl,t)=>{const e=document.createElement('span');if(cl)e.className=cl;e.textContent=t;return e};
 if(c.tag)i.append(sp('t',c.tag));i.append(sp('',c.text||''));
 if(c.linkText&&c.linkUrl&&!/^\s*(javascript|data|vbscript):/i.test(c.linkUrl)){const a=document.createElement('a');a.href=c.linkUrl;a.textContent=c.linkText;if(/^https?:/i.test(c.linkUrl)){a.target='_blank';a.rel='noopener'}i.append(a)}
 d.append(i);return d};

if(admin)return;
/* ---- Chargement (avec aperçu du brouillon) ---- */
const hide=document.createElement('style');hide.textContent='html{visibility:hidden}';document.head.append(hide);
const show=()=>hide.remove();setTimeout(show,1500);
const q=new URLSearchParams(location.search).get('preview');
try{if(q==='1')sessionStorage.setItem('lgp_preview','1');if(q==='0')sessionStorage.removeItem('lgp_preview')}catch(e){}
let prev=false;try{prev=sessionStorage.getItem('lgp_preview')==='1'}catch(e){}
S.ready=(prev?Promise.resolve(JSON.parse(localStorage.getItem('lgp_admin_draft')||'{}')):fetch('content.json',{cache:'no-cache'}).then(r=>r.ok?r.json():{})).catch(()=>({})).then(d=>S.data=d||{});
const go=()=>S.ready.then(d=>{try{
 document.querySelectorAll('.urgent').forEach(e=>e.remove());
 const c=Object.assign({},S.defaults.urgent,d.urgent||{});let off=false;try{off=sessionStorage.getItem('lgp_u')===S.uid(c)}catch(e){}
 if(c.enabled&&!off){const h=document.querySelector('header'),b=S.urgentEl(c);h?h.after(b):document.body.prepend(b)}
 S.apply(document,d);
 if(prev){const p=document.createElement('div');p.className='lgp-prev';p.innerHTML='Aperçu du brouillon <a href="?preview=0">Quitter</a>';document.body.append(p)}
}catch(e){console.error(e)}finally{show()}});
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',go):go();
})();
