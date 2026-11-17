/* АРХИВ 9.2 — одна история за раз, как в TikTok.
 * Страница по-прежнему содержит готовые архивные материалы, но в UI виден
 * ровно один рассказ. Переход не скроллит поток между рассказами.
 */
(() => {
'use strict';
const stream=document.getElementById('stream');
if(!stream)return;
document.documentElement.classList.add('archive-deck');
const RATING_KEY='archive_pages_ratings_v1';
const getRatings=()=>{try{return JSON.parse(localStorage.getItem(RATING_KEY)||'{}')||{}}catch(_){return {}}};
const saveRatings=data=>{try{localStorage.setItem(RATING_KEY,JSON.stringify(data));return true}catch(_){return false}};
const articles=()=>Array.from(stream.children).filter(el=>el.matches?.('article.story'));
const numericId=el=>Number(el?.id?.replace(/^story-/,''));
const tagList=el=>Array.from(el.querySelectorAll('.tags button.tag'))
  .map(e=>e.textContent.trim().replace(/^#/,'')).filter(Boolean);
const prefersReduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches||false;
const inMenu=()=>document.getElementById('menu')?.classList.contains('show');
let index=0, busy=false, drag=null, timer=0, frame=0, renderedX=0, targetX=0;
let sourceSignature='',sourceFirst=null;
const seen=new Set();
let suppressWheelUntil=0;
const dock=document.createElement('nav');
dock.id='deckControls';
dock.setAttribute('aria-label','Оценить историю или открыть следующую');
dock.innerHTML='<button type="button" id="deckDislike" aria-label="Не нравится, следующая история">👎 <span>Не моё</span></button>'+
  '<button type="button" id="deckLike" aria-label="Нравится, следующая история">❤️ <span>Нравится</span></button>'+
  '<button type="button" id="deckNext" aria-label="Следующая история без оценки">↑ <span>Далее</span></button>';
document.body.append(dock);
const overlay=document.createElement('div');overlay.id='deckTransition';overlay.setAttribute('aria-hidden','true');
const nextScreen=document.createElement('div');nextScreen.className='deck-incoming';
const overlayLabel=document.createElement('div');overlayLabel.className='deck-transition-label';
overlayLabel.textContent='АРХИВ · СЛЕДУЮЩЕЕ ДЕЛО';
overlay.append(nextScreen,overlayLabel);document.body.append(overlay);
function active(){
 const all=articles();
 return {all,el:all[index]||null};
}
function updateHeader(){
 const all=articles();
 const pos=document.getElementById('position');
 if(pos)pos.textContent=all.length?String(index+1)+' / '+String(all.length):'0 / 0';
 try{selectedIndex=index;scrollScheduled=false;}catch(_){}
 const a=all[index];
 if(a){
   const vote=Number(getRatings()[numericId(a)]||0);
   for(const [id,active] of [['deckLike',vote===1],['deckDislike',vote===-1]]){
     const btn=document.getElementById(id);
     btn?.classList.toggle('selected',active);
     btn?.setAttribute('aria-pressed',String(active));
   }
 }
 dock.classList.toggle('hidden',!all.length);
}
window.updateCurrent=updateHeader; // Overrides the obsolete multi-article scroll counter.
function pauseInactive(){
 for(const [i,a] of articles().entries()){
  const visible=i===index;
  a.classList.toggle('deck-active',visible);
  a.inert=!visible;
  a.setAttribute('aria-hidden',String(!visible));
  if(!visible)a.querySelectorAll('video').forEach(v=>{try{v.pause()}catch(_){}});
 }
 const a=articles()[index];
 a?.querySelectorAll('video').forEach(v=>{if(v.autoplay)try{v.play().catch(()=>{})}catch(_){}});
}
function install(){
 const all=articles();
 if(!all.length){dock.classList.add('hidden');return;}
 const signature=all.map(a=>a.id).join('|');
 const changed=all[0]!==sourceFirst||signature!==sourceSignature;
 if(changed){
  sourceFirst=all[0];sourceSignature=signature;seen.clear();
  const requested=Number(new URLSearchParams(location.search).get('story'));
  index=Math.max(0,all.findIndex(a=>numericId(a)===requested));
  stream.scrollTop=0;
 }
 for(const a of all){
  const deck=a.querySelector('.deck');
  if(deck&&!deck.dataset.edited){deck.textContent='Прокручивай текст этой истории. Свайп вверх в конце — следующее дело.';deck.dataset.edited='1';}
 }
 pauseInactive();updateHeader();
}
const observer=new MutationObserver(mutations=>{
 if(mutations.some(m=>m.type==='childList'&&m.target===stream))queueMicrotask(install);
});
observer.observe(stream,{childList:true});
install();
function chooseNext(all,oldIndex){
 const current=all[oldIndex];if(!current)return oldIndex;
 seen.add(numericId(current));
 let pool=all.map((a,i)=>({a,i})).filter(({a})=>a!==current&&!seen.has(numericId(a)));
 if(!pool.length){seen.clear();seen.add(numericId(current));pool=all.map((a,i)=>({a,i})).filter(({a})=>a!==current)}
 if(!pool.length)return oldIndex;
 const ratings=getRatings();
 let voteCount=0;const weights={};
 for(const a of all){
  const vote=Number(ratings[numericId(a)]||0);
  if(vote!==1&&vote!==-1)continue;
  voteCount++;
  for(const t of tagList(a))weights[t]=(weights[t]||0)+(vote===1?5:-6);
 }
 if(!voteCount)return (pool.find(p=>p.i>oldIndex)||pool[0]).i;
 const ranked=pool.map(p=>{
  const vote=Number(ratings[numericId(p.a)]||0);
  const score=tagList(p.a).reduce((v,t)=>v+(weights[t]||0),0)+
    (vote===-1?-40:vote===1?0:2);
  return {...p,score};
 }).sort((a,b)=>b.score-a.score||a.i-b.i);
 const explore=ranked.length>3&&Math.random()<.16;
 return ranked[explore?Math.floor(1+Math.random()*Math.min(4,ranked.length-1)):0].i;
}
function updateVote(article,rating){
 if(!article||![-1,1].includes(rating))return;
 const id=numericId(article);if(!Number.isSafeInteger(id)||id<=0)return;
 const votes=getRatings();votes[id]=rating;
 if(!saveRatings(votes)){console.warn('АРХИВ: localStorage недоступен');return;}
 for(const [i,b] of article.querySelectorAll('.actionrow button.action:not(.archive-bookmark)').entries()){
  b.classList.toggle('selected',i===(rating===1?0:1));
  b.setAttribute('aria-pressed',String(i===(rating===1?0:1)));
 }
 try{window.ArchiveCloud?.rate?.(id,rating)}catch(e){console.warn('Облачная оценка ожидает синхронизации',e)}
 try{window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light')}catch(_){}
}
function prepareNext(target){
 nextScreen.replaceChildren();
 if(!target)return;
 const clone=target.cloneNode(true);
 clone.removeAttribute('id');clone.inert=false;clone.removeAttribute('aria-hidden');
 clone.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));
 clone.querySelectorAll('video').forEach(v=>{
  const replacement=document.createElement('div');
  replacement.className='deck-video-placeholder';
  if(v.poster){
   const pic=document.createElement('img');pic.src=v.poster;pic.alt='Кадр из видео';
   replacement.append(pic);
  }else{replacement.textContent='АРХИВ · ВИДЕОМАТЕРИАЛ'}
  v.replaceWith(replacement);
 });
 clone.querySelectorAll('img').forEach(i=>i.loading='eager');
 clone.classList.add('deck-active');
 nextScreen.append(clone);
}
function clearTransition(){
 overlay.className='';
 nextScreen.replaceChildren();
 document.documentElement.classList.remove('deck-moving');
 const a=articles()[index];
 if(a){a.style.transition='';a.style.transform='';a.style.opacity='';a.style.filter='';}
}
function switchTo(nextIndex,direction=0){
 const all=articles(),old=all[index];
 const target=all[nextIndex];if(!target){busy=false;return}
 if(target===old){stream.scrollTo({top:0,behavior:'smooth'});busy=false;return}
 prepareNext(target);
 busy=true;
 clearTimeout(timer);
 overlayLabel.textContent=direction===1?'❤️ ПОНРАВИЛОСЬ · СЛЕДУЮЩАЯ ИСТОРИЯ':
   direction===-1?'👎 НЕ МОЁ · ДРУГАЯ ИСТОРИЯ':'↑ СЛЕДУЮЩЕЕ ДЕЛО';
 overlay.className='visible';
 const fast=prefersReduced();
 if(fast){
   index=nextIndex;pauseInactive();stream.scrollTop=0;updateHeader();clearTransition();busy=false;return;
 }
 document.documentElement.classList.add('deck-moving');
 requestAnimationFrame(()=>{
  overlay.classList.add('enter');
  if(old){
   old.style.transition='transform .58s cubic-bezier(.18,.8,.2,1),opacity .5s ease,filter .5s ease';
   old.style.transform=direction===0?'translate3d(0,-45px,0) scale(.978)':
     'translate3d('+(direction*Math.min(180,innerWidth*.42))+'px,-24px,0) rotate('+(direction*8)+'deg) scale(.955)';
   old.style.opacity='.28';old.style.filter='blur(2px) brightness(.65)';
  }
 });
 timer=setTimeout(()=>{
  // The next article is activated only after its full-screen clone covers
  // the old one. The underlying document NEVER scrolls past intermediate stories.
  if(old){old.style.transition='';old.style.transform='';old.style.opacity='';old.style.filter=''}
  index=nextIndex;
  pauseInactive();
  stream.scrollTop=0;
  updateHeader();
  overlay.classList.add('settled');
  timer=setTimeout(()=>{clearTransition();busy=false;suppressWheelUntil=performance.now()+500},190);
 },650);
}
function next(value=0){
 if(busy||inMenu())return;
 const {all,el}=active();
 if(!el)return;
 if(value!==0)updateVote(el,value);
 const targetIndex=chooseNext(all,index);
 switchTo(targetIndex,value);
}
function previous(){
 if(busy||inMenu()||index<=0)return;
 switchTo(index-1,0);
}
document.getElementById('deckLike').addEventListener('click',()=>next(1));
document.getElementById('deckDislike').addEventListener('click',()=>next(-1));
document.getElementById('deckNext').addEventListener('click',()=>next(0));
// Clicking the original rating buttons at the bottom should behave identically.
stream.addEventListener('click',e=>{
 const b=e.target.closest?.('.actionrow button.action:not(.archive-bookmark)');
 if(!b)return;
 const article=b.closest('article.story');if(!article)return;
 const buttons=[...b.parentNode.querySelectorAll('button.action:not(.archive-bookmark)')];
 const vote=buttons.indexOf(b)===0?1:-1;
 e.preventDefault();e.stopImmediatePropagation();
 if(!busy){index=Math.max(0,articles().indexOf(article));next(vote)}
},true);
function paintDrag(){
 frame=0;
 if(!drag?.active)return;
 renderedX+=(targetX-renderedX)*.42;
 if(Math.abs(targetX-renderedX)<.5)renderedX=targetX;
 const rotate=Math.max(-10,Math.min(10,renderedX/28));
 drag.article.style.transform='translate3d('+renderedX+'px,0,0) rotate('+rotate+'deg)';
 const strength=Math.min(1,Math.abs(renderedX)/120);
 drag.article.style.opacity=String(1-strength*.28);
 dock.dataset.swipe=renderedX>30?'like':renderedX< -30?'dislike':'';
 if(Math.abs(targetX-renderedX)>.5)frame=requestAnimationFrame(paintDrag);
}
function begin(e){
 if(busy||inMenu()||!e.isPrimary||!e.target.closest?.('article.story'))return;
 if(e.target.closest('button,a,input,textarea,select,video,[contenteditable="true"]'))return;
 if(e.pointerType==='mouse'&&e.button!==0)return;
 const a=active().el;if(!a)return;
 drag={id:e.pointerId,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,
  since:performance.now(),active:false,vertical:false,article:a};
 renderedX=0;targetX=0;
}
function moved(e){
 if(!drag||drag.id!==e.pointerId||busy)return;
 const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;
 if(!drag.active){
  if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)*1.1){drag.vertical=true;return;}
  if(drag.vertical||Math.abs(dx)<15||Math.abs(dx)<Math.abs(dy)*1.2)return;
  drag.active=true;
  document.documentElement.classList.add('deck-dragging');
  try{stream.setPointerCapture(e.pointerId)}catch(_){}
 }
 drag.x=e.clientX;drag.y=e.clientY;targetX=dx;
 if(!frame)frame=requestAnimationFrame(paintDrag);
 if(e.cancelable)e.preventDefault();
}
function ended(e,cancelled=false){
 if(!drag||drag.id!==e.pointerId)return;
 const g=drag;drag=null;
 if(frame)cancelAnimationFrame(frame);frame=0;
 dock.dataset.swipe='';
 document.documentElement.classList.remove('deck-dragging');
 if(g.active){
  try{if(stream.hasPointerCapture(g.id))stream.releasePointerCapture(g.id)}catch(_){}
  const dx=g.x-g.startX,elapsed=Math.max(1,performance.now()-g.since);
  if(!cancelled&&(Math.abs(dx)>Math.min(115,innerWidth*.29)||(Math.abs(dx)>70&&Math.abs(dx)/elapsed>.7))){
   g.article.style.transform='';g.article.style.opacity='';
   next(dx>0?1:-1);
  }else{
   g.article.style.transition='transform .26s cubic-bezier(.2,.9,.2,1),opacity .24s';
   g.article.style.transform='';g.article.style.opacity='';
   timer=setTimeout(()=>{g.article.style.transition=''},300);
  }
 }
}
stream.addEventListener('pointerdown',begin,{passive:true});
stream.addEventListener('pointermove',moved,{passive:false});
stream.addEventListener('pointerup',ended,{passive:true});
stream.addEventListener('pointercancel',e=>ended(e,true),{passive:true});
window.addEventListener('pointerup',e=>{if(drag&&drag.id===e.pointerId)ended(e)},{passive:true});
// Keep vertical scrolling *inside* the active story. A second swipe
// at the very bottom opens the next story, like an e-reader/tiktok hybrid.
let verticalStart=null;
stream.addEventListener('touchstart',e=>{
 if(e.touches.length!==1||busy||inMenu())return;
 verticalStart={y:e.touches[0].clientY,x:e.touches[0].clientX,
   atBottom:stream.scrollTop+stream.clientHeight>=stream.scrollHeight-14,
   atTop:stream.scrollTop<=3};
},{passive:true});
stream.addEventListener('touchend',e=>{
 if(!verticalStart||busy){verticalStart=null;return;}
 const v=verticalStart;verticalStart=null;
 const t=e.changedTouches[0];if(!t)return;
 const dy=t.clientY-v.y,dx=t.clientX-v.x;
 if(Math.abs(dy)<80||Math.abs(dy)<Math.abs(dx)*1.25)return;
 if(dy<0&&v.atBottom)next(0);
 else if(dy>0&&v.atTop)previous();
},{passive:true});
stream.addEventListener('wheel',e=>{
 if(busy||inMenu()||performance.now()<suppressWheelUntil)return;
 if(Math.abs(e.deltaY)<45)return;
 if(e.deltaY>0&&stream.scrollTop+stream.clientHeight>=stream.scrollHeight-3){
  e.preventDefault();suppressWheelUntil=performance.now()+800;next(0);
 }
},{passive:false});
stream.addEventListener('scroll',()=>requestAnimationFrame(updateHeader),{passive:true});
document.addEventListener('keydown',e=>{
 if(inMenu()||busy||e.altKey||e.ctrlKey||e.metaKey||
  /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||''))return;
 if(e.key==='ArrowRight'){e.preventDefault();next(1)}
 if(e.key==='ArrowLeft'){e.preventDefault();next(-1)}
 if(e.key==='PageDown'&&stream.scrollTop+stream.clientHeight>=stream.scrollHeight-5){e.preventDefault();next(0)}
});
// The original related-story buttons tried to scroll the multi-story feed.
// Capture those clicks and switch a single visible story instead.
stream.addEventListener('click',async e=>{
 const b=e.target.closest?.('button.related-link');if(!b)return;
 e.preventDefault();e.stopImmediatePropagation();
 const name=(b.textContent||'').replace(/^↳\s*/,'').trim();
 const all=articles();
 let target=all.find(a=>a.querySelector('h1')?.textContent?.trim()===name);
 if(!target&&typeof window.load==='function'){
  await window.load('stories');
  target=articles().find(a=>a.querySelector('h1')?.textContent?.trim()===name);
 }
 if(target){switchTo(articles().indexOf(target))}
},true);
window.ArchiveDeck={version:'9.2',get activeStory(){return active().el?.id||null},next,previous,
 get count(){return articles().length},get index(){return index},refresh:install};
console.info('АРХИВ 9.2: одна история на экран, без ленты');
})();
