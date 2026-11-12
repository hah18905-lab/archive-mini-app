(() => {
  'use strict';
  // Works with the static archive Mini App without any backend or user tracking.
  const appStream = document.getElementById('stream');
  if (!appStream || document.getElementById('tinderDock')) return;
  const dock = document.createElement('div');
  dock.id='tinderDock';
  dock.innerHTML='<button id="tinderDislike" type="button" aria-label="Не нравится — следующий рассказ">✕ НЕ МОЁ</button><span class="dock-meta" aria-hidden="true">← ВЛЕВО<br>ВПРАВО →</span><button id="tinderLike" type="button" aria-label="Нравится — следующий рассказ">♥ НРАВИТСЯ</button>';
  document.body.append(dock);
  const stage = document.createElement('div');
  stage.id='tinderStage';
  stage.setAttribute('aria-hidden','true');
  const card=document.createElement('div');card.className='tinder-card';
  const photo=document.createElement('div');photo.className='tinder-photo';
  const photoImg=document.createElement('img');photoImg.alt='Кадр из истории';
  photo.append(photoImg);
  const details=document.createElement('div');details.className='tinder-details';
  const kicker=document.createElement('div');kicker.className='tinder-kicker';kicker.textContent='АРХИВ · ЛИЧНОЕ ДЕЛО';
  const title=document.createElement('div');title.className='tinder-title';
  const note=document.createElement('div');note.className='tinder-note';note.textContent='Оценка сохранена только на устройстве';
  details.append(kicker,title,note);
  const stampYes=document.createElement('div');stampYes.className='tinder-stamp positive';stampYes.textContent='НРАВИТСЯ';
  const stampNo=document.createElement('div');stampNo.className='tinder-stamp negative';stampNo.textContent='НЕ МОЁ';
  const burn=document.createElement('div');burn.className='tinder-burn';
  card.append(photo,details,stampYes,stampNo,burn);
  const hint=document.createElement('div');hint.className='tinder-hint';
  stage.append(card,hint);document.body.append(stage);
  let track=null, busy=false, cleanupTimer=0;
  const modalOpen=()=>document.getElementById('menu')?.classList.contains('show');
  function activeStory(){
    // selectedIndex is maintained by the scrolling feed.
    const idx=Number.isInteger(selectedIndex)?selectedIndex:0;
    return {idx,item:stories[idx],element:stories[idx]&&document.getElementById('story-'+stories[idx].id)};
  }
  function openCard(){
    const {idx,item,element}=activeStory();
    if(!item || !element || busy || modalOpen())return false;
    window.clearTimeout(cleanupTimer);
    stage.className='visible';card.style.transition='none';card.style.opacity='1';card.style.transform='translateX(0px) rotate(0deg)';
    stampYes.style.opacity=stampNo.style.opacity='0';
    stage.querySelectorAll('.tinder-ember').forEach(n=>n.remove());
    const currentVisual=element.querySelector('.mediaframe img, .mediaframe video');
    photoImg.src=currentVisual?.tagName==='IMG'?currentVisual.src:(currentVisual?.poster||item.media_url||'');
    photoImg.style.display=photoImg.src?'block':'none';
    title.textContent=item.title||'Дело без названия';
    kicker.textContent='АРХИВ · ИСТОРИЯ '+(idx+1)+' / '+stories.length;
    hint.textContent='← НЕ МОЁ                    НРАВИТСЯ →';
    return true;
  }
  function draw(dx){
    const d=Math.max(-window.innerWidth,Math.min(window.innerWidth,dx));
    card.style.transform='translate3d('+d+'px,0,0) rotate('+(d/22)+'deg)';
    stampYes.style.opacity=String(Math.min(1,Math.max(0,d/95)));
    stampNo.style.opacity=String(Math.min(1,Math.max(0,-d/95)));
  }
  function hide(){
    stage.className='';stage.querySelectorAll('.tinder-ember').forEach(n=>n.remove());
    card.style.transition='none';card.style.transform='';card.style.opacity='1';
    document.body.classList.remove('tinder-tracking');
  }
  function cancel(){
    card.style.transition='transform .2s ease-out';
    draw(0);
    cleanupTimer=window.setTimeout(hide,215);
  }
  function sparks(direction){
    for(let i=0;i<22;i++){
      const ember=document.createElement('i');ember.className='tinder-ember';
      ember.style.setProperty('--size',(2+i%5*2)+'px');
      ember.style.setProperty('--delay',((i%6)*22)+'ms');
      ember.style.setProperty('--dx',(direction*(65+Math.random()*200))+'px');
      ember.style.setProperty('--dy',((Math.random()-.5)*420)+'px');
      ember.style.left=(direction>0?'79%':'21%');
      ember.style.top=(15+Math.random()*70)+'%';
      stage.append(ember);
    }
  }
  function rate(item, value, element){
    const votes=readRatings();
    votes[item.id]=value;
    if(!writeRatings(votes)){note.textContent='Не удалось сохранить оценку';return;}
    item.my_reaction=value;
    const row=element?.querySelector('.actionrow');
    if(row){
      const buttons=row.querySelectorAll('.action');
      buttons.forEach((b,i)=>b.classList.toggle('selected',i===(value===1?0:1)));
    }
    try{window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium')}catch(_){}
  }
  function finish(value){
    const {idx,item,element}=activeStory();
    if(!item || busy) {hide();return;}
    busy=true;rate(item,value,element);
    stage.classList.add('flare',value===1?'like':'dislike');
    hint.textContent=value===1?'♥ ИСТОРИЯ ПОНРАВИЛАСЬ':'✕ ИСТОРИЯ НЕ ИНТЕРЕСНА';
    stampYes.style.opacity=value===1?'1':'0';
    stampNo.style.opacity=value===-1?'1':'0';
    const direction=value===1?1:-1;
    sparks(direction);
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){
      hide();advance(idx);busy=false;return;
    }
    card.style.transition='transform .58s cubic-bezier(.26,.9,.4,1),opacity .56s ease-out,filter .56s';
    card.style.transform='translate3d('+(direction*(window.innerWidth+400))+'px,-60px,0) rotate('+(direction*25)+'deg)';
    card.style.opacity='0.12';
    card.style.filter='brightness(.7) sepia(.9)';
    cleanupTimer=window.setTimeout(()=>{hide();advance(idx);busy=false;card.style.filter='';},610);
  }
  function advance(previousIndex){
    if(previousIndex<stories.length-1){
      const next=document.getElementById('story-'+stories[previousIndex+1].id);
      if(next){
        appStream.scrollTo({top:next.offsetTop,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
        window.setTimeout(()=>{if(typeof updateCurrent==='function')updateCurrent();},650);
      }
    }else{
      document.getElementById('menu')?.classList.add('show');
      hint.textContent='Последняя история оценена · выбери новую подборку';
    }
  }
  function ignoreStart(t){
    return !!t.closest('button,a,input,textarea,select,video,.overlay') || modalOpen() || busy;
  }
  function onStart(x,y,kind){
    if(busy || modalOpen())return;
    track={x,y,time:performance.now(),dx:0,activated:false,blocked:false,kind};
  }
  function onMove(x,y,e){
    if(!track || track.blocked)return;
    const dx=x-track.x,dy=y-track.y;
    if(!track.activated){
      if(Math.abs(dy)>14 && Math.abs(dy)>Math.abs(dx)*1.1){track.blocked=true;return;}
      if(Math.abs(dx)>18 && Math.abs(dx)>Math.abs(dy)*1.25){
        if(!openCard()){track.blocked=true;return;}
        track.activated=true;document.body.classList.add('tinder-tracking');
      }else return;
    }
    track.dx=dx;draw(dx);
    if(e?.cancelable)e.preventDefault();
  }
  function onEnd(){
    if(!track)return;
    const t=track;track=null;
    if(!t.activated)return;
    document.body.classList.remove('tinder-tracking');
    const velocity=Math.abs(t.dx)/Math.max(1,performance.now()-t.time);
    const threshold=Math.min(105,window.innerWidth*.25);
    if(Math.abs(t.dx)>=threshold || (Math.abs(t.dx)>=55 && velocity>.6)){
      finish(t.dx>0?1:-1);
    }else cancel();
  }
  appStream.addEventListener('touchstart',e=>{
    if(e.touches.length!==1||ignoreStart(e.target))return;
    onStart(e.touches[0].clientX,e.touches[0].clientY,'touch');
  },{passive:true});
  appStream.addEventListener('touchmove',e=>{
    if(track?.kind==='touch'&&e.touches.length===1)onMove(e.touches[0].clientX,e.touches[0].clientY,e);
  },{passive:false});
  appStream.addEventListener('touchend',onEnd,{passive:true});
  appStream.addEventListener('touchcancel',()=>{track=null;if(!busy)hide()},{passive:true});
  appStream.addEventListener('pointerdown',e=>{
    if(e.pointerType!=='mouse'||e.button!==0||ignoreStart(e.target))return;
    onStart(e.clientX,e.clientY,'mouse');
  });
  window.addEventListener('pointermove',e=>{if(track?.kind==='mouse')onMove(e.clientX,e.clientY,e)});
  window.addEventListener('pointerup',e=>{if(track?.kind==='mouse')onEnd()});
  window.addEventListener('blur',()=>{track=null;if(!busy)hide()});
  document.getElementById('tinderDislike').addEventListener('click',()=>{if(openCard())finish(-1)});
  document.getElementById('tinderLike').addEventListener('click',()=>{if(openCard())finish(1)});
  document.addEventListener('keydown',e=>{
    if(e.altKey||e.metaKey||e.ctrlKey||modalOpen()||/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||''))return;
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){
      e.preventDefault();if(openCard())finish(e.key==='ArrowRight'?1:-1);
    }
  });
  console.info('АРХИВ · Tinder-свайпы включены: ← дизлайк / лайк →');
})();
