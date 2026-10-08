/* Site LGP — en-tête, bandeau Urgent et textes modifiables (content.json).
   À inclure dans le <head> de CHAQUE page :  <script src="assets/js/site.js"></script> */
(function(){
const S=window.SITE={data:{},defaults:{"urgent": {"enabled": true, "theme": "red", "tag": "URGENT", "text": "Toute belle chose a une fin... Mais c'est le début d'une nouvelle aventure !", "linkText": "→ Discord Préfecture", "linkUrl": "https://discord.gg/8RAFH7KfDj", "closable": true}, "jobs": [{"titre": "Directeur de cabinet", "salaire": "6 000 – 9 000 €+", "texte": "Bras droit du Préfet. Il pilote le cabinet, coordonne les actions prioritaires, gère les affaires sensibles, les relations avec les autorités (Élysée, ministère, Ville de Paris) et prépare les décisions du Préfet."}, {"titre": "Secrétaire Général", "salaire": "5 500 – 8 000 €", "texte": "Assure la direction administrative de la Préfecture, supervise l'ensemble des services et veille au bon fonctionnement quotidien de l'institution."}, {"titre": "Attaché d'administration", "salaire": "3 500 – 5 000 €", "texte": "Encadre un service, instruit les dossiers complexes et prépare les actes administratifs soumis à la signature de la hiérarchie."}, {"titre": "Secrétaire administratif", "salaire": "2 500 – 3 500 €", "texte": "Assure le suivi des dossiers, l'accueil des usagers, la rédaction des courriers et la gestion des démarches en ligne."}, {"titre": "Inspecteur IGPN", "salaire": "4 500 – 6 500 €", "texte": "Inspection Générale de la Police Nationale : mène les enquêtes internes, contrôle le respect de la déontologie et traite les signalements visant les agents."}, {"titre": "Huissier de Justice (à la PP)", "salaire": "4 000 – 6 000 €", "texte": "Signifie les actes officiels, constate les faits et exécute les décisions de justice pour le compte de la Préfecture de Police."}, {"titre": "Inspecteur", "salaire": "3 500 – 5 000 €", "texte": "Contrôle le respect de la réglementation, réalise des inspections sur le terrain et rédige les rapports remis à la direction."}], "salaryLabel": "Salaire moyen :"},page:()=>location.pathname.split('/').pop().replace(/\.html?$/,'')||'index'};
S.defaults.ticketMotifs=["Renseignement","Démarche administrative","Signalement / plainte","Recrutement","Autre"];
S.defaults.actus=[];
S.defaults.presentation={
 introTitle:"La Préfecture",
 introParagraphs:["Depuis sa création, la Préfecture organise la sécurité et les services publics au cœur de Paris.","Placée sous l'autorité du ministère de l'Intérieur, elle coordonne les services et les forces mobilisés sur le territoire.","Elle prévient les risques, lutte contre les atteintes à l'ordre public et accompagne les habitants dans leurs démarches.","Ses équipes s'engagent chaque jour pour protéger les personnes, secourir celles qui en ont besoin et garantir les libertés de tous."],
 ministryLogo:"/assets/img/ministry-interieur.png",buildingPhoto:"/assets/img/presentation-prefecture.jpg",missionsTitle:"Les missions",
 missionItems:["Assurer la sécurité des citoyens dans l'agglomération parisienne","Les zones de sécurité prioritaires","Faciliter les démarches administratives","Encadrer le déroulement des grands événements","Fluidifier la circulation, renforcer la sécurité routière","Préserver le cadre de vie et lutter contre le risque urbain","Prévenir et gérer les crises","Secourir les personnes, lutter contre les incendies","Prévenir les besoins en effectifs et en matériels","Communiquer","Valoriser le patrimoine culturel","Informer et témoigner"],
 videoUrl:"",accordionTitle:"Ce que nous accomplissons",missionDetails:[{titre:"Protection des citoyens",texte:"Assurer la sécurité des personnes et des biens sur l'ensemble du territoire, de jour comme de nuit."},{titre:"Maintien de l'ordre public",texte:"Encadrer les rassemblements et les événements, prévenir les troubles et protéger les libertés de chacun."},{titre:"Service administratif de proximité",texte:"Accueillir les citoyens, traiter leurs demandes et faciliter leurs démarches administratives."},{titre:"Investigation et enquêtes",texte:"Conduire les investigations nécessaires et accompagner les procédures relevant des services compétents."}],
 valuesTitle:"Nos engagements",values:[{titre:"Intégrité",texte:"Un comportement exemplaire à chaque intervention."},{titre:"Proximité",texte:"Une écoute constante des besoins des citoyens."},{titre:"Réactivité",texte:"Une intervention rapide sur l'ensemble du territoire."},{titre:"Exemplarité",texte:"Le respect du cadre légal en toute circonstance."}],
 commandTitle:"Chaîne de commandement",command:[{fonction:"Préfet",nom:"MR X"},{fonction:"Sous-Préfet",nom:"MR X"},{fonction:"Commissaire Général",nom:"MR X"},{fonction:"Commissaire Divisionnaire",nom:"MR X"}]
};
const admin=!!window.LGP_ADMIN;
const css=`
header{border-top:0!important;border-image:none!important}
header::before{content:"";position:absolute;left:0;right:0;top:0;height:6px;background:linear-gradient(90deg,#000091 33.333%,#fff 33.333% 66.666%,#e1000f 66.666%);box-shadow:inset 0 -1px 0 rgba(0,0,0,.14)}
header .w{min-height:126px!important;padding-top:6px}
.logo img{height:100px!important}
nav{gap:8px!important}
header nav[aria-label="Navigation principale"]{display:flex!important;flex:1 1 auto;min-width:0;max-width:100%;flex-wrap:nowrap!important;white-space:nowrap;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;overscroll-behavior-x:contain}
header nav[aria-label="Navigation principale"]::-webkit-scrollbar{display:none}
header nav[aria-label="Navigation principale"]>a{flex:0 0 auto;padding:clamp(5px,.75vw,12px) clamp(5px,.9vw,16px)!important;font-size:clamp(.72rem,.95vw,1rem)!important}
#theme{width:48px!important;height:48px!important}
.btn-co{padding:15px 32px!important;font-size:1.05rem!important}
.aide{background:#000091!important;color:#fff!important;display:inline-flex!important;align-items:center;justify-content:center;gap:8px}
.lgp-assistant{position:fixed;right:20px;bottom:78px;z-index:1000;width:min(320px,calc(100vw - 24px));height:min(390px,calc(100dvh - 110px));display:none;flex-direction:column;overflow:hidden;margin:0!important;padding:0!important;border:1px solid #353744;border-radius:7px;background:var(--carte,#1e1e1e);color:var(--texte,#f0f0f0);box-shadow:0 10px 32px rgba(0,0,0,.28);font:13px/1.4 Marianne,"Public Sans","Segoe UI",system-ui,sans-serif}
.lgp-assistant.open{display:flex}
.lgp-assistant-head{min-height:54px;display:flex;align-items:center;gap:10px;padding:9px 12px;background:#000091;color:#fff}
.lgp-assistant-head .titles{min-width:0;flex:1}.lgp-assistant-head strong{display:block;font-size:13px}.lgp-assistant-head small{display:block;font-size:10px;opacity:.9}
.lgp-assistant-head button{width:28px;height:28px;border:0;border-radius:4px;background:transparent;color:#fff;font-size:20px;cursor:pointer}
.lgp-assistant-head button:hover{background:rgba(255,255,255,.14)}
.lgp-assistant-messages{flex:1;min-height:0;overflow:auto;padding:12px;background:var(--fond,#20212a);display:flex;flex-direction:column;gap:10px;overscroll-behavior:contain}
.lgp-assistant-message{max-width:88%;padding:8px 10px;border:1px solid #383a48;border-radius:6px;background:var(--carte,#1e1e1e);white-space:pre-line;overflow-wrap:anywhere}
.lgp-assistant-message.user{align-self:flex-end;background:#000091;color:#fff;border-color:#000091}
.lgp-assistant-links{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.lgp-assistant-links a{display:inline-block;padding:5px 8px;border-radius:4px;background:#000091;color:#fff;font-size:11px;font-weight:700;text-decoration:none}
.lgp-assistant-links a:hover{text-decoration:underline}
.lgp-assistant-form{display:flex;gap:7px;padding:10px 12px;border-top:1px solid #353744;background:var(--carte,#1e1e1e)}
.lgp-assistant-form input{flex:1;min-width:0;padding:9px;border:1px solid #383a48;border-radius:4px;background:var(--fond,#20212a);color:var(--texte,#f0f0f0);font:inherit}
.lgp-assistant-form button{width:38px;display:grid;place-items:center;border:0;border-radius:4px;background:#000091;color:#fff;cursor:pointer}
.lgp-assistant-form button:hover{background:#1717b8}.lgp-assistant-form svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
@media(max-width:560px){.aide{display:inline-flex!important;right:12px;bottom:12px}.lgp-assistant{right:12px;bottom:70px;width:min(320px,calc(100vw - 24px));height:min(390px,calc(100dvh - 86px))}}
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
 const add=(el,o)=>{const scope=el.closest('header,footer,.aide')?'shared':page,k=scope+':'+hash(o.def),n=cnt[k]=(cnt[k]||0)+1;
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

/* ---- Assistant d'orientation ---- */
const setupAssistant=()=>{
 const triggers=[...document.querySelectorAll('.aide')],trigger=triggers[0];if(!trigger||document.querySelector('.lgp-assistant'))return;triggers.slice(1).forEach(button=>button.remove());
 const bubble=document.createElementNS('http://www.w3.org/2000/svg','svg');bubble.setAttribute('viewBox','0 0 24 24');bubble.setAttribute('aria-hidden','true');bubble.style.cssText='width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round';bubble.innerHTML='<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/>';trigger.prepend(bubble);
 const panel=document.createElement('div');panel.className='lgp-assistant';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Assistant de la Préfecture');panel.setAttribute('aria-modal','false');
 const head=document.createElement('div');head.className='lgp-assistant-head';
 const titles=document.createElement('div');titles.className='titles';const title=document.createElement('strong');title.textContent='Assistant de la Préfecture';const subtitle=document.createElement('small');subtitle.textContent='Posez votre question, je vous oriente';titles.append(title,subtitle);
 const close=document.createElement('button');close.type='button';close.setAttribute('aria-label','Fermer l’assistant');close.textContent='×';head.append(titles,close);
 const messages=document.createElement('div');messages.className='lgp-assistant-messages';messages.setAttribute('aria-live','polite');messages.setAttribute('aria-relevant','additions');
 const form=document.createElement('form');form.className='lgp-assistant-form';const input=document.createElement('input');input.type='text';input.maxLength=500;input.placeholder='Écrivez votre message...';input.setAttribute('aria-label','Votre question');
 const send=document.createElement('button');send.type='submit';send.setAttribute('aria-label','Envoyer le message');send.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4zM22 2 11 13"/></svg>';form.append(input,send);panel.append(head,messages,form);document.body.append(panel);
 const addMessage=(text,who='assistant',links=[])=>{const bubble=document.createElement('div');bubble.className='lgp-assistant-message'+(who==='user'?' user':'');bubble.textContent=text;if(links.length){const list=document.createElement('div');list.className='lgp-assistant-links';links.forEach(([label,url])=>{const a=document.createElement('a');a.href=url;a.textContent=label;list.append(a)});bubble.append(list)}messages.append(bubble);messages.scrollTop=messages.scrollHeight};
 addMessage('Bonjour ! Je suis l’assistant de la Préfecture. Je peux vous orienter vers les démarches en ligne, le suivi de vos dossiers ou le contact d’un service. Comment puis-je vous aider ?');
 const toggle=show=>{panel.classList.toggle('open',show);trigger.setAttribute('aria-expanded',String(show));if(show)input.focus()};
 trigger.setAttribute('aria-controls','lgp-assistant');trigger.setAttribute('aria-expanded','false');panel.id='lgp-assistant';trigger.onclick=()=>toggle(!panel.classList.contains('open'));close.onclick=()=>toggle(false);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.classList.contains('open')){toggle(false);trigger.focus()}});
 const answerFor=message=>{
  const q=message.toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if(/recrut|emploi|poste|carriere|salaire/.test(q))return ['Pour les recrutements, consultez les postes et leurs informations sur la page Nos emplois.','Nos emplois',[['Voir les emplois','emplois.html']]];
  if(/contact|reclamation|signalement|plainte|parler a|contacter/.test(q))return ['Vous pouvez écrire à l’accueil depuis le formulaire de contact. Choisissez le motif qui correspond à votre demande.','Nous contacter',[['Ouvrir le formulaire','contact.html']]];
  if(/suivi|dossier|ticket|mes demarches|discussion/.test(q))return ['Connectez-vous pour retrouver vos démarches et échanges en cours.','Mes démarches',[['Se connecter','connexion.html'],['Mes démarches','mes-demarches.html']]];
  if(/actualite|information|annonce|nouveaute/.test(q))return ['Retrouvez les dernières informations publiées par les services sur la page Suivre l’actu.','Suivre l’actu',[['Voir les actualités','actus.html']]];
  if(/unite|direction|police|gendarmerie|pompier|hopital|tribunal/.test(q))return ['La page des démarches contient la liste des unités et leurs coordonnées.','Nos unités',[['Voir les unités','demarche.html#units']]];
  if(/demarche|entreprise|association|subvention|rendez vous|manifestation|nom/.test(q))return ['Les démarches en ligne sont regroupées sur cette page.','Démarches en ligne',[['Consulter les démarches','demarche.html']]];
  return ['Je peux vous orienter vers les démarches en ligne, le suivi de vos dossiers, les recrutements, les unités ou le formulaire de contact. Que recherchez-vous ?','Choisir un service',[['Démarches','demarche.html'],['Suivi','mes-demarches.html'],['Emplois','emplois.html'],['Contact','contact.html']]];
 };
 form.onsubmit=e=>{e.preventDefault();const value=input.value.trim();if(!value)return;addMessage(value,'user');input.value='';const [reply,label,links]=answerFor(value);setTimeout(()=>addMessage(reply,'assistant',links),180)};
};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',setupAssistant):setupAssistant();

/* Icône du mode clair/sombre : soleil en mode clair, lune en mode sombre. */
const syncThemeIcon=()=>{
 const dark=document.documentElement.dataset.theme==='dark';
 document.querySelectorAll('#theme').forEach(button=>{
  const svg=button.querySelector('svg');if(!svg)return;
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
  svg.innerHTML=dark?'<path d="M20.985 12.486A9 9 0 1 1 11.514 3.015a7 7 0 0 0 9.471 9.471z"/>':'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>';
  button.setAttribute('aria-label',dark?'Activer le mode clair':'Activer le mode sombre');
 });
};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',syncThemeIcon):syncThemeIcon();
new MutationObserver(syncThemeIcon).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
})();
