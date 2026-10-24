/* Effet 3D au survol des cartes.
   À charger sur chaque page :  <script src="assets/js/tilt.js" defer></script>
   - cartes ciblées : voir SEL ci-dessous (ajoute data-tilt sur n'importe quel élément pour l'inclure)
   - data-no-tilt sur un élément : pas d'effet
   Le CSS correspondant est à la fin de assets/css/site-refresh.css. */
/* Cartes : inclinaison 3D au survol */
(()=>{
  if(matchMedia("(prefers-reduced-motion:reduce)").matches||!matchMedia("(hover:hover)").matches)return;
  const SEL=".val,.dir,.quick a,.request-card,.unit-card,.news-card,.av,.value-card,.command-card,[data-tilt]",MAX=9;
  let cur=null;
  /* toutes les cartes présentes au chargement passent en mode 3D tout de suite */
  document.querySelectorAll(SEL).forEach(c=>c.classList.add("tilt"));
  const reset=el=>{
    el.classList.remove("over");
    el.style.setProperty("--rx","0deg");
    el.style.setProperty("--ry","0deg");
  };
  document.addEventListener("pointermove",e=>{
    if(e.pointerType&&e.pointerType!=="mouse")return;
    const el=e.target.closest?e.target.closest(SEL):null;
    if(cur&&cur!==el){reset(cur);cur=null}
    if(!el||el.hasAttribute("data-no-tilt")){return}
    el.classList.add("tilt","over");
    const r=el.getBoundingClientRect();
    const x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
    el.style.setProperty("--ry",((x-.5)*2*MAX).toFixed(2)+"deg");
    el.style.setProperty("--rx",((.5-y)*2*MAX).toFixed(2)+"deg");
    el.style.setProperty("--gx",(x*100).toFixed(1)+"%");
    el.style.setProperty("--gy",(y*100).toFixed(1)+"%");
    cur=el;
  });
  document.documentElement.addEventListener("mouseleave",()=>{if(cur){reset(cur);cur=null}});
})();
