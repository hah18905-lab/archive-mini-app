(() => {
'use strict';
const stream=document.getElementById('stream');
if(!stream)return;
const KEY='archive_pages_ratings_v1';
const safeText=s=>String(s??'');
const getArticles=()=>Array.from(stream.querySelectorAll('article.story'));
const getId=a=>a?.id?.replace(/^story-/,'')||'';
const getRatings=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(_){return {}}};
const saveRatings=data=>{try{localStorage.setItem(KEY,JSON.stringify(data));return true}catch(_){return false}};
const tagsFor=a=>Array.from(a.querySelectorAll('.story-top .tag')).map(el=>el.textContent.trim()).filter(x=>x.startsWith('#')).map(x=>x.slice(1));
const reduce=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches||false;
const blocked=()=>document.getElementById('menu')?.classList.contains('show');
const stage=document.createElement('div');stage.id='tinderStage';stage.setAttribute('aria-hidden','true');
const incoming=document.createElement('div');incoming.className='tinder-next-screen';
const card=document.createElement('div');card.className='tinder-card';
const photo=document.createElement('div');photo.className='tinder-photo';
const img=document.createElement('img');img.alt='Архивный кадр';img.loading='eager';photo.append(img);
const details=document.createElement('div');details.className='tinder-details';
const kicker=document.createElement('div');kicker.className='tinder-kicker';
const title=document.createElement('div');title.className='tinder-title';
const note=document.createElement('div');note.className='tinder-note';note.textContent='Истории подбираются с учётом твоих оценок';
details.append(kicker,title,note);
const stampYes=document.createElement('div');stampYes.className='tinder-stamp positive';stampYes.textContent='НРАВИТСЯ';
const stampNo=document.createElement('div');stampNo.className='tinder-stamp negative';stampNo.textContent='НЕ МОЁ';
const burn=document.createElement('div');burn.className='tinder-burn';
card.append(photo,details,stampYes,stampNo,burn);
const hint=document.createElement('div');hint.className='tinder-hint';
stage.append(incoming,card,hint);document.body.append(stage);
const dock=document.createElement('div');dock.id='tinderDock';
dock.innerHTML='<button type="button" id="tinderDislike">✕ НЕ МОЁ</button><span class="dock-meta">← ВЛЕВО<br>ВПРАВО →</span><button type="button" id="tinderLike">♥ НРАВИТСЯ</button>';
document.body.append(dock);
let dragging=null,busy=false,timer=0;
const seen=new Set();
let articlesSignature='';
function current(){
  const all=getArticles();
  if(!all.length)return {article:null,index:0,all};
  // The article that occupies the reading position, not a fragile external variable.
  const position=stream.scrollTop+Math.min(250,window.innerHeight*.28);
  let index=0;
  for(let i=0;i<all.length;i++){if(all[i].offsetTop<=position+5)index=i;else break;}
  return {article:all[index],index,all};
}
function resetStage(){
  stage.className='';incoming.replaceChildren();
  stage.style.opacity='';card.style.transform='';card.style.opacity='';
  card.style.filter='';card.style.transition='none';
  document.body.classList.remove('tinder-tracking','tinder-armed');
  stage.querySelectorAll('.tinder-ember').forEach(e=>e.remove());
}
function startStage(article,index,total){
  if(!article||busy||blocked())return false;
  clearTimeout(timer);
  const visual=article.querySelector('.mediaframe img, .mediaframe video');
  const src=visual?.tagName==='IMG'?visual.currentSrc||visual.src:(visual?.poster||'');
  img.style.display=src?'block':'none';if(src)img.src=src;
  title.textContent=article.querySelector('h1')?.textContent||'Неизвестное дело';
  kicker.textContent='АРХИВ · ИСТОРИЯ '+(index+1)+' / '+total;
  hint.textContent='← НЕ МОЁ · НРАВИТСЯ →';
  stage.className='visible';stage.style.opacity='1';
  card.style.transition='none';card.style.transform='translate3d(0,0,0) rotate(0deg)';
  card.style.opacity='1';card.style.filter='';
  stampYes.style.opacity='0';stampNo.style.opacity='0';
  incoming.replaceChildren();
  return true;
}
function move(dx){
  const d=Math.max(-innerWidth,Math.min(innerWidth,dx));
  card.style.transform='translate3d('+d+'px,0,0) rotate('+(d/24)+'deg)';
  stampYes.style.opacity=String(Math.max(0,Math.min(1,d/95)));
  stampNo.style.opacity=String(Math.max(0,Math.min(1,-d/95)));
}
function cancel(){
  card.style.transition='transform .22s ease-out';move(0);
  timer=setTimeout(resetStage,235);
}
function recommendation(all,active){
  const signature=all.map(a=>a.id).join('|');
  if(signature!==articlesSignature){articlesSignature=signature;seen.clear();}
  seen.add(getId(active));
  let pool=all.filter(a=>a!==active&&!seen.has(getId(a)));
  if(!pool.length){seen.clear();seen.add(getId(active));pool=all.filter(a=>a!==active);}
  if(!pool.length)return null;
  const ratings=getRatings(),weights={};let count=0;
  for(const a of all){
    const v=Number(ratings[getId(a)]||0);
    if(v!==1&&v!==-1)continue;
    count++;
    for(const tag of tagsFor(a))weights[tag]=(weights[tag]||0)+(v>0?4:-5);
  }
  if(!count){return pool[0];}
  const scored=pool.map((a,i)=>{
    const tags=tagsFor(a),vote=Number(ratings[getId(a)]||0);
    const score=tags.reduce((s,t)=>s+(weights[t]||0),0)+(vote===-1?-30:vote===1?0:2);
    return {a,score,index:i};
  }).sort((a,b)=>b.score-a.score||a.index-b.index);
  // 20% of recommendations explore a different theme.
  const choice=scored.length>3&&Math.random()<.2?
    1+Math.floor(Math.random()*Math.min(3,scored.length-1)):0;
  return scored[choice].a;
}
function save(article,v){
  const id=getId(article),ratings=getRatings();ratings[id]=v;
  const ok=saveRatings(ratings);
  article.querySelectorAll('.actionrow button.action').forEach((b,i)=>{
    b.classList.toggle('selected',i===(v===1?0:1));
    b.setAttribute('aria-pressed',String(i===(v===1?0:1)));
  });
  if(!ok)note.textContent='Браузер не сохранил оценку';else note.textContent='Оценка сохранена на этом устройстве';
  try{window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light')}catch(_){}
}
function nextVisual(article){
  incoming.replaceChildren();
  if(!article){
    const end=document.createElement('div');end.className='tinder-end-screen';
    end.innerHTML='<div class="tinder-end-symbol">✦</div><h2>Дела просмотрены</h2><p>Начни новую подборку или пересмотри любимые истории.</p>';
    incoming.append(end);return;
  }
  const wrapper=document.createElement('div');wrapper.className='tinder-next-hero';
  const visual=article.querySelector('.mediaframe img, .mediaframe video');
  const src=visual?.tagName==='IMG'?visual.currentSrc||visual.src:(visual?.poster||'');
  if(src){
    const image=document.createElement('img');image.src=src;image.alt='';image.loading='eager';wrapper.append(image);
  }
  const text=document.createElement('div');text.className='tinder-next-copy';
  const label=document.createElement('div');label.className='tinder-next-kicker';label.textContent='АРХИВ · РЕКОМЕНДАЦИЯ ДЛЯ ТЕБЯ';
  const heading=document.createElement('h2');heading.textContent=article.querySelector('h1')?.textContent||'Другое дело';
  const p=document.createElement('p');p.textContent=(article.querySelector('.articletext p')?.textContent||'Новая история').slice(0,210);
  text.append(label,heading,p);wrapper.append(text);incoming.append(wrapper);
}
function sparks(dir){
  for(let i=0;i<16;i++){
    const ember=document.createElement('i');ember.className='tinder-ember';
    ember.style.setProperty('--size',(3+i%4*2)+'px');ember.style.setProperty('--delay',((i%4)*27)+'ms');
    ember.style.setProperty('--dx',(dir*(60+Math.random()*180))+'px');
    ember.style.setProperty('--dy',((Math.random()-.5)*360)+'px');
    ember.style.left=(dir===1?'80%':'20%');ember.style.top=(12+Math.random()*75)+'%';
    stage.append(ember);
  }
}
function finish(article,v){
  if(!article||busy||blocked())return;
  busy=true;
  try{
    const {all}=current();
    save(article,v);
    const next=recommendation(all,article);
    nextVisual(next);
    const dir=v===1?1:-1;
    stampYes.style.opacity=String(v===1?1:0);stampNo.style.opacity=String(v===-1?1:0);
    stage.classList.add('flare',v===1?'like':'dislike','transitioning');
    hint.textContent=v===1?'♥ ПОНРАВИЛОСЬ · СЛЕДУЮЩЕЕ ДЕЛО':'✕ НЕ МОЁ · ДРУГАЯ ИСТОРИЯ';
    if(reduce()){
      if(next)stream.scrollTop=next.offsetTop;else document.getElementById('menu')?.classList.add('show');
      resetStage();busy=false;return;
    }
    sparks(dir);
    card.style.transition='transform .69s cubic-bezier(.19,.94,.2,1),opacity .61s ease';
    card.style.transform='translate3d('+(dir*(innerWidth+450))+'px,-40px,0) rotate('+(dir*22)+'deg)';
    card.style.opacity='0';
    timer=setTimeout(()=>{
      // Jump under an opaque overlay, never scroll through unrelated stories.
      if(next)stream.scrollTop=next.offsetTop;
      stage.classList.add('dissolve');
      timer=setTimeout(()=>{
        resetStage();busy=false;
        if(!next)document.getElementById('menu')?.classList.add('show');
      },220);
    },850);
  }catch(error){
    console.error('Swipe error',error);resetStage();busy=false;
  }
}
function vote(v){
  if(busy||blocked())return;
  const {article,index,all}=current();
  if(startStage(article,index,all.length))finish(article,v);
}
document.getElementById('tinderDislike').addEventListener('click',()=>vote(-1));
document.getElementById('tinderLike').addEventListener('click',()=>vote(1));
// Existing 👍/👎 buttons also run the same transition (no duplicate ratings).
stream.addEventListener('click',e=>{
  const b=e.target.closest?.('.actionrow button.action');
  if(!b)return;
  const article=b.closest('article.story');if(!article)return;
  const buttons=Array.from(b.parentNode.querySelectorAll('button.action'));
  const index=buttons.indexOf(b);
  if(index!==0&&index!==1)return;
  e.preventDefault();e.stopImmediatePropagation();
  if(!busy){const all=getArticles();if(startStage(article,all.indexOf(article),all.length))finish(article,index===0?1:-1);}
},true);
// ARHIV 9.0: pointer gestures are handled as one smooth, deliberate motion.
const swipeDebug={accepted:0,cancelled:0,vertical:0};
const gestureLimit=()=>Math.max(85,Math.min(135,window.innerWidth*.28));
const actionTargets='button,a,input,textarea,select,video,.overlay,[contenteditable="true"]';
function shouldIgnore(target){
  return busy||blocked()||!!target?.closest?.(actionTargets);
}
let dragPointer=null;
let renderedX=0,desiredX=0,animationFrame=0;
function stopFrame(){
  if(animationFrame){cancelAnimationFrame(animationFrame);animationFrame=0;}
}
function renderFrame(){
  if(!dragPointer||!dragPointer.active){animationFrame=0;return;}
  const delta=desiredX-renderedX;
  renderedX+=delta*.44;
  if(Math.abs(delta)<.35)renderedX=desiredX;
  const dx=renderedX;
  const tilt=Math.max(-14,Math.min(14,dx/20));
  const lift=-Math.min(12,Math.abs(dx)*.055);
  const scale=1-Math.min(.035,Math.abs(dx)/6000);
  card.style.transform='translate3d('+dx+'px,'+lift+'px,0) rotate('+tilt+'deg) scale('+scale+')';
  stampYes.style.opacity=String(Math.max(0,Math.min(1,dx/gestureLimit())));
  stampNo.style.opacity=String(Math.max(0,Math.min(1,-dx/gestureLimit())));
  stage.style.setProperty('--swipe-progress',String(Math.min(1,Math.abs(dx)/gestureLimit())));
  animationFrame=requestAnimationFrame(renderFrame);
}
function armPointer(e){
  if(!e.isPrimary||shouldIgnore(e.target))return;
  if(e.pointerType==='mouse'&&e.button!==0)return;
  // Leave vertical reading and page controls untouched.
  const article=e.target.closest?.('article.story')||current().article;
  if(!article)return;
  dragPointer={id:e.pointerId,kind:e.pointerType,article,startX:e.clientX,startY:e.clientY,
     x:e.clientX,y:e.clientY,started:performance.now(),active:false,blocked:false,
     lastX:e.clientX,lastT:performance.now(),velocityX:0};
  document.body.classList.add('tinder-armed');
}
function updatePointer(e){
  const g=dragPointer;
  if(!g||g.id!==e.pointerId||g.blocked)return;
  const dx=e.clientX-g.startX,dy=e.clientY-g.startY;
  if(!g.active){
    if(Math.abs(dy)>11&&Math.abs(dy)>Math.abs(dx)*1.15){
      g.blocked=true;
      document.body.classList.remove('tinder-armed');
      swipeDebug.vertical++;
      return;
    }
    if(Math.abs(dx)<11||Math.abs(dx)<Math.abs(dy)*1.18)return;
    const all=getArticles();
    const index=all.indexOf(g.article);
    if(index<0||!startStage(g.article,index,all.length)){
      g.blocked=true;
      document.body.classList.remove('tinder-armed');
      return;
    }
    g.active=true;
    document.body.classList.add('tinder-tracking');
    // Capturing the pointer avoids drops when the finger passes over images.
    try{stream.setPointerCapture(e.pointerId)}catch(_){}
    renderedX=0;desiredX=0;
    stage.classList.add('dragging');
    stopFrame();animationFrame=requestAnimationFrame(renderFrame);
  }
  const now=performance.now();
  const elapsed=Math.max(1,now-g.lastT);
  const instant=(e.clientX-g.lastX)/elapsed;
  g.velocityX=g.velocityX*.68+instant*.32;
  g.lastT=now;g.lastX=e.clientX;g.x=e.clientX;g.y=e.clientY;
  desiredX=dx;
  if(e.cancelable)e.preventDefault();
}
function releasePointer(e,cancelled=false){
  const g=dragPointer;
  if(!g||g.id!==e.pointerId)return;
  dragPointer=null;
  stopFrame();
  document.body.classList.remove('tinder-armed','tinder-tracking');
  if(g.active){
    try{if(stream.hasPointerCapture(e.pointerId))stream.releasePointerCapture(e.pointerId)}catch(_){}
  }
  if(!g.active)return;
  const dx=g.x-g.startX,velocity=dx/Math.max(1,performance.now()-g.started);
  const closeEnough=Math.abs(dx)>=gestureLimit();
  const deliberateFlick=Math.abs(dx)>65&&Math.abs(velocity)>.55;
  if(!cancelled&&(closeEnough||deliberateFlick)){
    swipeDebug.accepted++;
    // First settle the following card under the finger before flying out.
    card.style.transition='none';
    move(dx);
    finish(g.article,dx>0?1:-1);
  }else{
    swipeDebug.cancelled++;
    cancel();
  }
}
stream.addEventListener('pointerdown',armPointer,{passive:true});
stream.addEventListener('pointermove',updatePointer,{passive:false});
stream.addEventListener('pointerup',releasePointer,{passive:true});
stream.addEventListener('pointercancel',e=>releasePointer(e,true),{passive:true});
stream.addEventListener('lostpointercapture',e=>releasePointer(e,true),{passive:true});
window.addEventListener('blur',()=>{
  if(dragPointer){
    const g=dragPointer;releasePointer({pointerId:g.id},true);
  }
});
stream.addEventListener('dragstart',e=>{
  if(e.target.closest?.('article.story'))e.preventDefault();
});
stream.addEventListener('contextmenu',e=>{
  // On mobile, a long press would open "Copy", interrupting a horizontal swipe.
  if(window.matchMedia('(pointer: coarse)').matches&&e.target.closest?.('article.story')&&!e.target.closest?.(actionTargets))
    e.preventDefault();
});
// Clear the armed state if an unrelated pointer gesture was interrupted.
document.addEventListener('pointerup',()=>{
  if(!dragPointer)document.body.classList.remove('tinder-armed');
},{passive:true});
document.addEventListener('keydown',e=>{
  if(blocked()||e.altKey||e.ctrlKey||e.metaKey||/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||''))return;
  if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();vote(e.key==='ArrowRight'?1:-1);}
});
window.ArchiveSwipe={version:'9.0',vote,resetStage,ready:true,debug:swipeDebug};
console.info('АРХИВ 9.0: плавные сенсорные свайпы активны');
})();