/* Plan Vigipirate : niveaux, lecture du niveau en vigueur et actualités générées automatiquement.
   Chargé par vigipirate.html, actus.html, index.html et panel-prefectoral.html. */
(function(){
const LEVELS={
 1:{n:"Vigilance",img:"assets/img/logo-vigipirate.png",color:"#1d5fbf",
  desc:"Posture permanente de sécurité. Les services restent attentifs et appliquent les mesures de protection habituelles sur l'ensemble du territoire.",
  mesures:["Surveillance régulière des sites et lieux sensibles.","Patrouilles et contrôles ponctuels des forces de l'ordre.","Information du public et signalement des comportements suspects."]},
 2:{n:"Sécurité renforcée – Risque attentat",img:"assets/img/vigipirate-securite-renforcee.png",color:"#d35400",
  desc:"Le niveau de menace est élevé. Les mesures de protection sont renforcées, en particulier aux abords des lieux sensibles et lors des rassemblements.",
  mesures:["Présence accrue des forces de l'ordre aux abords des écoles, lieux de culte et transports.","Contrôles renforcés lors des événements et des rassemblements.","Coordination permanente entre les services de la Préfecture."]},
 3:{n:"Urgence attentat",img:"assets/img/vigipirate-urgence-attentat.png",color:"#c9190b",
  desc:"Niveau exceptionnel activé face à une menace imminente ou après un attentat. L'ensemble des services est mobilisé.",
  mesures:["Mobilisation de l'ensemble des forces de sécurité.","Périmètres de sécurité et restrictions de circulation ou de rassemblement possibles.","Cellule de crise activée et consignes diffusées en continu."]}
};
const lvl=x=>{x=Number(x);return x===1||x===2||x===3?x:0};
const pad=n=>String(n).padStart(2,"0");
/* AAAA-MM-JJTHH:MM en heure locale, au format lu par les pages d'actualités */
const stamp=iso=>{const d=new Date(iso);return isNaN(d)?"":d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())+"T"+pad(d.getHours())+":"+pad(d.getMinutes())};

/* État courant : { level, updated_at, updated_by, message, history:[{level,previous,at,by,message}] } */
async function getState(){
 const r=await fetch("/api/vigipirate",{cache:"no-store"});
 if(!r.ok)throw new Error(String(r.status));
 const d=await r.json();
 if(!lvl(d&&d.level))throw new Error("invalid");
 d.level=lvl(d.level);d.history=Array.isArray(d.history)?d.history:[];
 return d;
}

/* Une actualité par changement de niveau, construite à partir de l'historique enregistré par le serveur */
function actusFrom(state){
 const out=[];
 (Array.isArray(state&&state.history)?state.history:[]).forEach(h=>{
  const l=lvl(h&&h.level);if(!l||!h.at)return;
  const L=LEVELS[l],p=lvl(h.previous),msg=String(h.message||"").trim().slice(0,500);
  const head=p&&p!==l?"Le plan Vigipirate passe du niveau "+p+" ("+LEVELS[p].n+") au niveau "+l+" ("+L.n+").":"Le plan Vigipirate est positionné au niveau "+l+" ("+L.n+").";
  out.push({
   date:stamp(h.at),
   titre:"Plan Vigipirate : niveau "+l+" — "+L.n,
   categorie:"Vigipirate",
   resume:head+(msg?"\n\n"+msg:""),
   texte:L.desc+"\n\nPrincipales mesures :\n"+L.mesures.map(m=>"• "+m).join("\n")+"\n\nLe niveau en vigueur et l'historique des changements sont consultables sur la page Vigipirate.",
   photos:[{name:"Plan Vigipirate — niveau "+l,data:L.img}],
   documents:[],
   vigipirate:true
  });
 });
 return out;
}
async function fetchActus(){try{return actusFrom(await getState())}catch(e){return[]}}

window.VIGIPIRATE={LEVELS,lvl,stamp,getState,actusFrom,fetchActus};
})();
