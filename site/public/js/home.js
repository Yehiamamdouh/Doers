document.documentElement.classList.add("js");
const RM=matchMedia("(prefers-reduced-motion: reduce)").matches;
const SVC=[
 {n:"Branding",a:"الهوية والبراندنج",eg:"/branding-agency-egypt/",ksa:"/ksa/branding-agency-in-jeddah/",img:"img/signage/mash-vision.jpg",d:"Award-winning brand strategy, identity and guidelines. TechBehemoths award winner for branding in Egypt.",da:"استراتيجية وهوية بصرية حاصلة على جايزة TechBehemoths للبراندنج في مصر."},
 {n:"Event Management",a:"تنظيم الفعاليات",eg:"/event-management-cairo-egypt/",ksa:"/ksa/event-management-agency-in-jeddah/",img:"img/work/isys-arch.jpg",d:"Events, launches and BTL activations that engage customers and generate leads.",da:"فعاليات وإطلاقات وتفعيلات بتبني علاقة حقيقية مع جمهورك."},
 {n:"Booth Production",a:"تصميم وتنفيذ البوثات",eg:"/booth-production-egypt/",ksa:"/ksa/booth-production-in-jeddah/",img:"img/work/asfour-crystal.jpg",d:"Exhibition stands designed, built and installed by our own team.",da:"بوثات معارض بنصممها وننفذها ونركبها بفريقنا."},
 {n:"Signage & Internal Branding",a:"اللافتات والهوية الداخلية",eg:"*signage-internal-branding-egypt/",ksa:"*ksa/signage-internal-branding-in-jeddah/",img:"img/signage/arab-bank-night.jpg",d:"Building signs, office branding and wayfinding, designed, made and installed by us.",da:"لافتات المباني وهوية المكاتب، تصميم وتنفيذ وتركيب."},
 {n:"Digital Marketing",a:"التسويق الرقمي",eg:"/digital-marketing-egypt-cairo/",ksa:"/ksa/digital-marketing-agency-in-jeddah/",d:"Social, search, email and mobile campaigns driven by data and ROI.",da:"سوشيال وسيرش وحملات مبنية على البيانات والعائد."},
 {n:"SEO",a:"تحسين محركات البحث",eg:"/seo/",ksa:"/ksa/seo-agency-in-jeddah/",d:"Rank higher, attract relevant traffic and convert it.",da:"ترتيب أعلى وزيارات مهتمة فعلاً بخدماتك."},
 {n:"Web & App Development",a:"تطوير المواقع والتطبيقات",eg:"*website-development-company-egypt/",ksa:"/ksa/website-development-company-in-jeddah/",d:"Websites, apps, online stores and AI agents, Arabic-first and built to convert.",da:"مواقع وتطبيقات ومتاجر ووكلاء ذكاء اصطناعي، بالعربي أولاً."},
 {n:"Media Production",a:"الإنتاج الإعلامي",eg:"/media-production-egypt/",ksa:null,d:"Ads, corporate films, motion graphics and animation.",da:"إعلانات وأفلام مؤسسية وموشن جرافيك."},
 {n:"Outdoor (OOH)",a:"إعلانات الطرق",eg:"/outdoor-advertising-egypt/",ksa:"/ksa/ooh-outdoor-agency-in-jeddah/",img:"img/signage/trivium-pylon.jpg",d:"The right message, place and time for maximum reach.",da:"الرسالة الصح في المكان والوقت الصح."},
 {n:"TV Advertising",a:"إعلانات التلفزيون",eg:"/tv-advertising/",ksa:"/ksa/tv-advertising-in-jeddah/",d:"Broadcast TV campaigns across Egypt and KSA.",da:"حملات تلفزيون في مصر والسعودية."},
 {n:"Radio Advertising",a:"إعلانات الراديو",eg:"/radio-advertising-egypt/",ksa:"/ksa/radio-advertising-agencies-in-jeddah/",d:"Radio spots that reach audiences on the move.",da:"إعلانات راديو بتوصل لجمهورك وهو في الطريق."},
 {n:"Reputation Management",a:"إدارة السمعة",eg:"/listening-and-reputation-management/",ksa:"/ksa/listening-and-reputation-management-in-jeddah/",d:"Social listening and reputation management that protects your brand.",da:"رصد ومتابعة وإدارة سمعة البراند أونلاين."}
];

const CITIES=[["Cairo","القاهرة"],["Jeddah","جدة"],["Riyadh","الرياض"],["Dubai","دبي"],["Abu Dhabi","أبوظبي"],["Kuwait","الكويت"],["Berlin","برلين"],["London","لندن"]];

const ar=document.documentElement.lang==="ar";
// Service links: Arabic service pages arrive in phase 2, so both languages link to the English pages for now.
const U=p=>p.startsWith("*")?"/"+p.slice(1):p;

function render(){
  const nm=s=>ar?s.a:s.n, city=c=>ar?(c?"القاهرة":"جدة"):(c?"Cairo":"Jeddah");
  document.getElementById("svc").innerHTML=SVC.map((s,i)=>`<div class="row"${s.img?` data-img="${s.img}"`:""}><span class="n">${String(i+1).padStart(2,"0")}</span><h3><a href="${U(s.eg||s.ksa)}">${nm(s)}</a></h3><p>${ar?s.da:s.d}</p><span class="cities">${s.eg?`<a href="${U(s.eg)}">${city(1)}</a>`:""}${s.ksa?`<a href="${U(s.ksa)}">${city(0)}</a>`:""}</span></div>`).join("");
  document.getElementById("menu-eg").innerHTML=SVC.filter(s=>s.eg).map(s=>`<a href="${U(s.eg)}">${nm(s)}</a>`).join("");
  document.getElementById("menu-ksa").innerHTML=SVC.filter(s=>s.ksa).map(s=>`<a href="${U(s.ksa)}">${nm(s)}</a>`).join("");
  document.getElementById("fsvc").innerHTML=SVC.map(s=>`<li><a href="${U(s.eg||s.ksa)}">${nm(s)}</a></li>`).join("");
  const items=SVC.map(s=>`<span>${nm(s)}</span>`).join("");
  document.getElementById("track").innerHTML=items+items;
  document.getElementById("citylist").innerHTML=CITIES.map(c=>`<span>${ar?c[1]:c[0]}</span>`).join("<i>·</i>");
  bindPeek();
}


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

render();
