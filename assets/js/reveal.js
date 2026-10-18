(function(){
  document.documentElement.classList.add("js");
  const io=new IntersectionObserver(es=>{
    es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("visible");io.unobserve(e.target)}});
  },{threshold:.15,rootMargin:"0px 0px -60px 0px"});
  window.revealObserve=function(root){
    (root||document).querySelectorAll("main .w > *, main .w > div > *, .rv-auto").forEach(el=>{
      if(el.classList.contains("rv"))return;
      const i=[...el.parentElement.children].indexOf(el);
      el.style.setProperty("--d",(i%4)*100+"ms");
      el.classList.add("rv");io.observe(el);
    });
  };
  revealObserve();
})();