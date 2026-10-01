/* Session Discord partagée par toutes les pages.
   À inclure AVANT le script de la page :  <script src="assets/js/auth.js"></script> */
const AUTH_KEY = "lgp_user";
const SITE_ADMIN_ROLE_ID = "1554580932411789402";
function isSiteAdmin(user){return !!user&&((Array.isArray(user.roles)&&user.roles.includes(SITE_ADMIN_ROLE_ID))||user.role==="Staff")}
function getUser(){
  try{const u=JSON.parse(localStorage.getItem(AUTH_KEY)||"null");if(u&&u.exp>Date.now())return u}catch(e){}
  return null;
}
function logout(){
  try{localStorage.removeItem(AUTH_KEY)}catch(e){}
  location.href="connexion.html";
}

(function(){
  const css=`
.lgp-user{position:relative}
.lgp-pill{display:flex;align-items:center;gap:10px;height:54px;padding:0 16px 0 8px;border:1px solid var(--ligne);border-radius:999px;background:var(--carte);color:var(--texte);font:700 1rem var(--sans);cursor:pointer}
.lgp-pill:hover{background:var(--fond)}
.lgp-av{width:38px;height:38px;border-radius:50%;object-fit:cover;flex:none;background:var(--bleu);color:#fff;display:grid;place-items:center;font-weight:800;font-size:.85rem}
:root[data-theme=dark] .lgp-av{color:#000}
.lgp-name{max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lgp-pill svg{width:14px;height:14px;transition:transform .2s;opacity:.7}
.lgp-pill[aria-expanded=true] svg{transform:rotate(180deg)}
.lgp-menu{position:absolute;right:0;top:calc(100% + 8px);min-width:270px;background:var(--carte);border:1px solid var(--ligne);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.18);padding:6px;z-index:40}
.lgp-menu[hidden]{display:none}
.lgp-menu a,.lgp-menu button{display:block;width:100%;text-align:left;padding:10px 12px;border:0;border-radius:6px;background:none;color:var(--texte);font:500 .9rem var(--sans);cursor:pointer}
.lgp-menu a:hover,.lgp-menu button:hover{background:var(--lav)}
.lgp-hd{padding:10px 12px 12px;display:flex;flex-direction:column;gap:4px}
.lgp-hd small{color:var(--gris);font-size:.82rem}.lgp-hd b{font-size:1rem}
.lgp-role{align-self:flex-start;background:var(--lav);color:var(--bleu);border-radius:12px;padding:2px 10px;font-size:.68rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;margin-top:2px}
.lgp-menu hr{border:0;border-top:1px solid var(--ligne);margin:6px 4px}
.lgp-menu .out{color:#c9191e}
:root[data-theme=dark] .lgp-hd{padding:10px 12px 12px;display:flex;flex-direction:column;gap:4px}
.lgp-hd small{color:var(--gris);font-size:.82rem}.lgp-hd b{font-size:1rem}
.lgp-role{align-self:flex-start;background:var(--lav);color:var(--bleu);border-radius:12px;padding:2px 10px;font-size:.68rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;margin-top:2px}
.lgp-menu hr{border:0;border-top:1px solid var(--ligne);margin:6px 4px}
.lgp-menu .out{color:#ff8a8a}`;
  const st=document.createElement("style");st.textContent=css;document.head.append(st);

  const u=getUser(), btn=document.querySelector(".btn-co");
  if(!u||!btn) return;

  const wrap=document.createElement("div");wrap.className="lgp-user";

  const pill=document.createElement("button");
  pill.type="button";pill.className="lgp-pill";
  pill.setAttribute("aria-haspopup","true");pill.setAttribute("aria-expanded","false");

  const initiale=()=>{const d=document.createElement("span");d.className="lgp-av";d.textContent=(u.name||"?").trim().charAt(0).toUpperCase();return d};
  let av;
  if(u.avatar){
    av=document.createElement("img");av.className="lgp-av";av.alt="";av.src=u.avatar;av.referrerPolicy="no-referrer";
    av.onerror=()=>av.replaceWith(initiale());
  }else av=initiale();

  const nom=document.createElement("span");nom.className="lgp-name";nom.textContent=u.name;
  const chev=document.createElementNS("http://www.w3.org/2000/svg","svg");
  chev.setAttribute("viewBox","0 0 24 24");chev.setAttribute("fill","none");chev.setAttribute("stroke","currentColor");
  chev.setAttribute("stroke-width","2.5");chev.setAttribute("stroke-linecap","round");chev.setAttribute("stroke-linejoin","round");
  chev.innerHTML='<path d="M6 9l6 6 6-6"/>';
  pill.append(av,nom,chev);

  const menu=document.createElement("div");menu.className="lgp-menu";menu.hidden=true;
  const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x)e.textContent=x;return e};
  const hd=el("div","lgp-hd");hd.append(el("small","","Connecté en tant que"),el("b","",u.name));
  if(u.role)hd.append(el("span","lgp-role",u.role));
  const lk=(t,h)=>{const a=el("a","",t);a.href=h;return a};
  const l2=el("button","out","Se déconnecter");l2.type="button";l2.onclick=logout;
  menu.append(hd,el("hr"),lk("Mon espace","dashboard.html"),lk("Mes démarches","mes-demarches.html"));
  if(isSiteAdmin(u))menu.append(lk("Administration","admin.html"));
  menu.append(el("hr"),l2);

  const fermer=()=>{menu.hidden=true;pill.setAttribute("aria-expanded","false")};
  pill.onclick=e=>{e.stopPropagation();const o=menu.hidden;menu.hidden=!o;pill.setAttribute("aria-expanded",String(o))};
  document.addEventListener("click",e=>{if(!wrap.contains(e.target))fermer()});
  document.addEventListener("keydown",e=>{if(e.key==="Escape")fermer()});

  wrap.append(pill,menu);
  btn.replaceWith(wrap);
})();

