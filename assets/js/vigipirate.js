/* Plan Vigipirate : niveaux, lecture du niveau en vigueur et actualités générées automatiquement.
   Chargé par vigipirate.html, actus.html, index.html et panel-prefectoral.html. */
(function(){
const LEVELS={
 1:{n:"Vigilance",icon:"i",img:"assets/img/logo-vigipirate.png",color:"#1d5fbf",
  sub:"Posture permanente de sécurité. Consultez les informations et consignes publiées par l’administration.",
  desc:"Posture permanente de sécurité. Les services restent attentifs et appliquent les mesures de protection habituelles sur l'ensemble du territoire.",
  mesures:["Surveillance régulière des sites et lieux sensibles.","Patrouilles et contrôles ponctuels des forces de l'ordre.","Information du public et signalement des comportements suspects."],
  sit:"Le niveau Vigipirate est actuellement fixé au niveau Vigilance dans le cadre de la Préfecture de Paris.\n\nIl s’agit de la posture permanente de sécurité : aucune mesure exceptionnelle n’est en vigueur. Les services de police, de gendarmerie et de secours assurent leurs missions habituelles de protection de la population et de maintien de l’ordre public.\n\nLes lieux accueillant du public et les bâtiments institutionnels font l’objet d’une surveillance régulière. Le niveau pourra être relevé à tout moment en fonction de l’évolution de la situation.",
  forces:"Consignes opérationnelles :\n\nMaintenir les patrouilles et les contrôles habituels.\nAssurer une surveillance régulière des sites et des bâtiments sensibles.\nRester attentif aux comportements ou situations inhabituels, sans procéder à des contrôles discriminatoires.\nTransmettre les informations utiles à la chaîne hiérarchique.\nAppliquer les procédures habituelles prévues par le serveur.",
  pub:"Aucune mesure exceptionnelle n’est demandée à la population.\n\nLes bons réflexes :\n\nRestez attentifs à votre environnement lors de vos déplacements.\nSignalez toute situation suspecte aux autorités compétentes.\nNe relayez pas de rumeurs et privilégiez les annonces publiées sur les canaux officiels du serveur."},
 2:{n:"Sécurité renforcée – Risque attentat",icon:"!",img:"assets/img/vigipirate-securite-renforcee.png",color:"#d35400",
  sub:"Mesures de sécurité renforcées. Consultez les informations et consignes publiées par l’administration.",
  desc:"Le niveau de menace est élevé. Les mesures de protection sont renforcées, en particulier aux abords des lieux sensibles et lors des rassemblements.",
  mesures:["Présence accrue des forces de l'ordre aux abords des écoles, lieux de culte et transports.","Contrôles renforcés lors des événements et des rassemblements.","Coordination permanente entre les services de la Préfecture."],
  sit:"Le niveau Vigipirate est actuellement fixé au niveau orange (Sécurité renforcée – Risque attentat) dans le cadre de la Préfecture de Paris.\n\nLe niveau de menace est élevé. Les mesures de protection sont renforcées, en particulier aux abords des lieux sensibles (établissements scolaires, lieux de culte, transports) et lors des rassemblements.\n\nLes services de police, de gendarmerie et de secours coordonnent leur action afin d’adapter le dispositif à l’évolution de la situation.",
  forces:"Consignes opérationnelles :\n\nRenforcer la présence visible aux abords des lieux sensibles et des transports.\nContrôler les accès lors des événements et des rassemblements, dans le respect du cadre prévu par le serveur.\nPorter une attention particulière aux comportements ou situations inhabituels, sans procéder à des contrôles discriminatoires.\nMaintenir une coordination permanente entre les services concernés.\nSignaler sans délai tout incident sérieux à la hiérarchie.",
  pub:"La Préfecture de Paris invite la population à rester vigilante et à respecter les consignes communiquées par les autorités.\n\nLes bons réflexes :\n\nRestez attentifs à votre environnement lors de vos déplacements.\nRespectez les consignes des forces de l’ordre lors des événements et des rassemblements.\nSignalez toute situation suspecte aux autorités compétentes.\nNe relayez pas de rumeurs et privilégiez les annonces publiées sur les canaux officiels du serveur."},
 3:{n:"Urgence attentat",icon:"!",img:"assets/img/vigipirate-urgence-attentat.png",color:"#c9190b",
  sub:"Mesures exceptionnelles de sécurité. Consultez les informations et consignes publiées par l’administration.",
  desc:"Niveau exceptionnel activé face à une menace imminente ou après un attentat. L'ensemble des services est mobilisé.",
  mesures:["Mobilisation de l'ensemble des forces de sécurité.","Périmètres de sécurité et restrictions de circulation ou de rassemblement possibles.","Cellule de crise activée et consignes diffusées en continu."],
  sit:"Le niveau Vigipirate est actuellement fixé au niveau rouge dans le cadre de la Préfecture de Paris.\n\nLa situation fait l’objet d’une vigilance accrue sur l’ensemble du territoire parisien. Les services de police, de gendarmerie et de secours restent mobilisables afin d’assurer la sécurité de la population et le maintien de l’ordre public.\n\nLes rassemblements publics, les lieux accueillant du public et les bâtiments institutionnels font l’objet d’une attention particulière. Les autorités peuvent décider de mesures de sécurité supplémentaires en fonction de l’évolution de la situation.",
  forces:"Consignes opérationnelles :\n\nRenforcer les patrouilles préventives dans les secteurs fréquentés et aux abords des bâtiments institutionnels.\nAssurer une présence visible et rassurante auprès de la population.\nPorter une attention particulière aux comportements ou situations inhabituels, sans procéder à des contrôles discriminatoires.\nCoordonner les interventions entre les services concernés et transmettre les informations utiles à la chaîne hiérarchique.\nFaciliter l’accès des secours et maintenir la fluidité des interventions.\nSignaler sans délai tout incident sérieux à la hiérarchie et appliquer les procédures prévues par le serveur.",
  pub:"La Préfecture de Paris invite la population à faire preuve de vigilance et à respecter les consignes communiquées par les autorités.\n\nLes bons réflexes :\n\nRestez attentifs à votre environnement lors de vos déplacements.\nRespectez les consignes des forces de l’ordre et des services de secours.\nÉvitez de gêner les interventions ou de franchir un périmètre de sécurité établi.\nEn cas de découverte d’un objet ou d’une situation suspecte, ne prenez aucun risque et signalez-la aux autorités compétentes.\nNe relayez pas de rumeurs et privilégiez les annonces publiées sur les canaux officiels du serveur.\nEn cas d’incident, gardez votre calme et suivez les instructions des intervenants.\nLa coopération de chacun contribue au bon déroulement des opérations et à la sécurité collective."}
};
const lvl=x=>{x=Number(x);return x===1||x===2||x===3?x:0};
const pad=n=>String(n).padStart(2,"0");
/* AAAA-MM-JJTHH:MM en heure locale, au format lu par les pages d'actualités */
const stamp=iso=>{const d=new Date(iso);return isNaN(d)?"":d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())+"T"+pad(d.getHours())+":"+pad(d.getMinutes())};

/* État courant : { level, updated_at, updated_by, message, history:[{level,previous,at,by,message}] } */
async function getState(){
 const r=await fetch("/api/prefecture?module=vigipirate",{cache:"no-store"});
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