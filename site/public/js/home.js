document.documentElement.classList.add("js");
const RM=matchMedia("(prefers-reduced-motion: reduce)").matches;
const ar=document.documentElement.lang==="ar";
// The service lists and menus are rendered into the HTML at build time (src/lib/home.js).

/* reveal on scroll */
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}}),{threshold:.14,rootMargin:"0px 0px -6% 0px"});
document.querySelectorAll(".rv,.w").forEach(el=>io.observe(el));

/* count-up */
const cio=new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting)return;cio.unobserve(e.target);const el=e.target,to=+el.dataset.to;if(RM)return;const t0=performance.now();
  (function f(t){const k=Math.min(1,(t-t0)/1400),v=Math.round(to*(1-Math.pow(1-k,3)));el.textContent=v;if(k<1)requestAnimationFrame(f)})(t0);}),{threshold:.6});
document.querySelectorAll(".count").forEach(el=>{if(!RM)el.textContent="0";cio.observe(el)});

/* scroll: marquee velocity, parallax, nav hide */
const track=document.getElementById("track"), nav=document.querySelector(".nav");
let x=0,lastY=scrollY,vel=0;
function tick(){
  const y=scrollY,d=y-lastY;lastY=y;vel+= (Math.abs(d)-vel)*.1;
  if(!RM){x-= (0.6+vel*.25)*(ar?-1:1);const half=track.scrollWidth/2;if(ar){if(x>half)x-=half}else if(-x>half)x+=half;track.style.transform=`translate3d(${x}px,0,0)`;}
  nav.classList.toggle("hide",d>4&&y>400);if(d<-4)nav.classList.remove("hide");
  if(!RM)document.querySelectorAll(".w img,.px").forEach(im=>{const r=im.parentElement.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight)return;const p=(r.top+r.height/2-innerHeight/2)/innerHeight;im.style.setProperty("--py",(p*-6).toFixed(2)+"%")});
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/* custom cursor + magnetic buttons + service peek */
const fine=matchMedia("(hover:hover) and (pointer:fine)").matches;
const cur=document.querySelector(".cur"),ring=cur.querySelector(".r"),dotEl=cur.querySelector(".d"),label=ring.querySelector("em"),peek=document.querySelector(".peek"),peekImg=peek.querySelector("img");
let mx=innerWidth/2,my=innerHeight/2,rx=mx,ry=my,px=mx,py=my;
if(fine&&!RM){
  addEventListener("pointermove",e=>{mx=e.clientX;my=e.clientY;dotEl.style.transform=`translate(${mx}px,${my}px)`;});
  (function loop(){rx+=(mx-rx)*.18;ry+=(my-ry)*.18;ring.style.transform=`translate(${rx}px,${ry}px)`;px+=(mx-px)*.12;py+=(my-py)*.12;peek.style.transform=`translate(${px+24}px,${py-120}px)`;requestAnimationFrame(loop)})();
  document.addEventListener("pointerover",e=>{const t=e.target.closest("[data-cursor]");cur.classList.toggle("big",!!t);if(t)label.textContent=ar?({View:"شوف",Talk:"كلمنا",Boom:"بوم",Play:"شغّل"}[t.dataset.cursor]||t.dataset.cursor):t.dataset.cursor;});
  document.querySelectorAll(".mag").forEach(b=>{b.addEventListener("pointermove",e=>{const r=b.getBoundingClientRect();b.style.transform=`translate(${(e.clientX-r.left-r.width/2)*.25}px,${(e.clientY-r.top-r.height/2)*.35}px)`});b.addEventListener("pointerleave",()=>{b.style.transform="";b.style.transition="transform .5s cubic-bezier(.2,.8,.2,1)";setTimeout(()=>b.style.transition="",500)})});
}
function bindPeek(){
  if(!fine||RM)return;
  document.querySelectorAll(".row[data-img]").forEach(r=>{r.addEventListener("pointerenter",()=>{peekImg.src=r.dataset.img;peek.classList.add("on")});r.addEventListener("pointerleave",()=>peek.classList.remove("on"))});
}

/* Let's talk splash: burst star + paint splats + tilted pop */
const star=document.getElementById("star"),splash=document.getElementById("splash"),say=document.getElementById("say");
function starPath(n,r1,r2){let d="";for(let i=0;i<n*2;i++){const a=i*Math.PI/n+(Math.random()-.5)*.25,r=(i%2?r2:r1)*(0.8+Math.random()*.4);d+=(i?"L":"M")+(Math.cos(a)*r*1.35).toFixed(1)+" "+(Math.sin(a)*r).toFixed(1)}return d+"Z"}
function burst(){
  if(RM){star.setAttribute("d","");return}
  star.setAttribute("d",starPath(11,190,95));
  star.animate([{transform:"scale(0) rotate(-20deg)",opacity:1},{transform:"scale(1.12) rotate(4deg)",opacity:1,offset:.35},{transform:"scale(1) rotate(0)",opacity:1,offset:.6},{transform:"scale(1.25)",opacity:0}],{duration:1500,easing:"cubic-bezier(.2,.8,.2,1)",fill:"forwards"});
  splash.innerHTML="";
  for(let i=0;i<16;i++){
    const a=Math.random()*Math.PI*2,dist=170+Math.random()*120,r=6+Math.random()*16,c=Math.random()<.6?"#FFC83A":"#F7A21B";
    const e=document.createElementNS("http://www.w3.org/2000/svg","ellipse");
    e.setAttribute("rx",r*1.6);e.setAttribute("ry",r);e.setAttribute("fill",c);e.setAttribute("transform",`rotate(${a*57.3})`);splash.appendChild(e);
    e.animate([{transform:`rotate(${a*57.3}deg) translate(0,0) scale(.2)`,opacity:1},{transform:`rotate(${a*57.3}deg) translate(${dist}px,0) scale(1)`,opacity:1,offset:.55},{transform:`rotate(${a*57.3}deg) translate(${dist*1.15}px,${20+Math.random()*30}px) scale(.8)`,opacity:0}],{duration:1300+Math.random()*500,easing:"cubic-bezier(.15,.8,.25,1)",fill:"forwards"});
  }
  say.animate([{transform:"rotate(-14deg) skewX(-6deg) scale(.2)",opacity:0},{transform:"rotate(-18deg) skewX(-6deg) scale(1.18)",opacity:1,offset:.45},{transform:"rotate(-12deg) skewX(-6deg) scale(.96)",offset:.7},{transform:"rotate(-14deg) skewX(-6deg) scale(1)",opacity:1}],{duration:900,delay:120,easing:"cubic-bezier(.2,.8,.2,1)",fill:"both"});
}
const stage=document.getElementById("stage");
new IntersectionObserver((es,o)=>es.forEach(e=>{if(e.isIntersecting){burst();o.disconnect()}}),{threshold:.5}).observe(stage);
let lastB=0;stage.addEventListener("pointerenter",()=>{if(performance.now()-lastB>1200){lastB=performance.now();burst()}});
stage.addEventListener("click",()=>{burst();setTimeout(()=>location.href="https://doersadv.com/contact-us/",650)});

/* video lightbox (Vimeo) */
const vlb=document.getElementById("vlb"),vbox=vlb.querySelector(".box");
document.addEventListener("click",e=>{const b=e.target.closest("[data-vid]");if(!b)return;const id=b.dataset.vid;
  vlb.classList.toggle("tall",!!b.dataset.tall);
  vbox.innerHTML=`<iframe src="https://player.vimeo.com/video/${id}?autoplay=1&title=0&byline=0&portrait=0&color=F7A21B" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="Doers film"></iframe>`;
  document.getElementById("vtitle").textContent=(b.querySelector("img")||{}).alt||"";
  document.getElementById("vlink").href="https://vimeo.com/"+id; vlb.showModal();});
function closeV(){vlb.close()}
vlb.addEventListener("close",()=>{vbox.innerHTML=""});
vlb.addEventListener("click",e=>{if(e.target===vlb||e.target.classList.contains("x"))closeV()});
/* reels auto-scroll, pauses on hover, reacts to scroll speed */
const rt=document.getElementById("reeltrack");let reelX=0,rpause=false;
rt.addEventListener("pointerenter",()=>rpause=true);rt.addEventListener("pointerleave",()=>rpause=false);
(function rl(){if(!RM&&!rpause){reelX-=(0.5+vel*.15)*(ar?-1:1);const half=rt.scrollWidth/2;if(ar){if(reelX>half)reelX-=half}else if(-reelX>half)reelX+=half;rt.style.transform=`translate3d(${reelX}px,0,0)`}requestAnimationFrame(rl)})();

bindPeek();
