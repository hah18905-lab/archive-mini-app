(() => {
'use strict';
// Archive Cloud 9.1: cloud sync is opt-in until the Supabase endpoint is configured.
// Telegram authentication is checked on the Edge Function, never trusted from JS.
const config=window.ARCHIVE_CLOUD_CONFIG||{};
const endpoint=String(config.functionUrl||'').trim();
const tg=window.Telegram?.WebApp;
const initData=tg?.initData||'';
const readyToConnect=/^https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1\/archive-user\/?$/.test(endpoint)
  && initData.length>0;
const ratingsKey='archive_pages_ratings_v1';
const bookmarkKey='archive_pages_bookmarks_v1';
const progressKey='archive_pages_progress_v1';
const pendingKey='archive_pages_cloud_pending_v1';
const getJson=(key)=>{try{return JSON.parse(localStorage.getItem(key)||'{}')||{}}catch(_){return {}}};
const setJson=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch(_){return false}};
const getStories=()=>[...document.querySelectorAll('#stream article.story')];
const storyId=(story)=>Number(story?.id?.replace(/^story-/,''));
const validStory=id=>Number.isSafeInteger(id)&&id>0&&id<=1000000;
let online=false,booted=false,flushing=false,lastProgressStory=0,lastProgressPercent=0,lastProgressSent=0;
let accountId=null;
let queue=[];
const badge=document.createElement('div');
badge.id='archiveCloudBadge';
badge.setAttribute('role','status');
badge.setAttribute('aria-live','polite');
badge.textContent=readyToConnect?'☁️ Подключаем…':'☁️ Локально';
document.body.append(badge);
const indicator=document.getElementById('interests');
function status(value,kind){
  badge.textContent=value;
  badge.dataset.state=kind||'local';
  badge.title=value;
  if(indicator)indicator.dataset.cloudState=kind||'local';
}
async function request(action,payload={}){
  if(!readyToConnect)throw Error('Нет адреса Supabase или входа Telegram');
  const timeout=new AbortController();
  const handle=setTimeout(()=>timeout.abort(),10000);
  try{
    const r=await fetch(endpoint,{
      method:'POST',
      mode:'cors',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action,initData,...payload}),
      signal:timeout.signal
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok||!data.ok)throw Error(data.error||'Облако недоступно: HTTP '+r.status);
    return data;
  }finally{clearTimeout(handle);}
}
function decorate(){
  const bookmarks=getJson(bookmarkKey),ratings=getJson(ratingsKey);
  for(const story of getStories()){
    const id=storyId(story);
    if(!validStory(id))continue;
    let button=story.querySelector('.archive-bookmark');
    const row=story.querySelector('.actionrow');
    if(row&&!button){
      button=document.createElement('button');
      button.type='button';
      button.className='action archive-bookmark';
      row.append(button);
    }
    if(button){
      button.textContent=bookmarks[id]?'🔖 В закладках':'🔖 Сохранить';
      button.classList.toggle('selected',!!bookmarks[id]);
      button.setAttribute('aria-pressed',String(!!bookmarks[id]));
      button.dataset.storyId=String(id);
    }
    const buttons=story.querySelectorAll('.actionrow button.action:not(.archive-bookmark)');
    buttons.forEach((b,i)=>b.classList.toggle('selected',Number(ratings[id]||0)===(i===0?1:-1)));
  }
}
let updateQueued=false;
const observer=new MutationObserver(()=>{
  if(updateQueued)return;updateQueued=true;
  queueMicrotask(()=>{updateQueued=false;decorate()});
});
const stream=document.getElementById('stream');
if(stream)observer.observe(stream,{childList:true,subtree:true});
if(stream)stream.addEventListener('click',e=>{
  const button=e.target.closest?.('.archive-bookmark');
  if(!button)return;
  const id=Number(button.dataset.storyId);
  if(!validStory(id))return;
  const bookmarks=getJson(bookmarkKey);
  const value=bookmarks[id]?0:1;
  if(value)bookmarks[id]=true;else delete bookmarks[id];
  setJson(bookmarkKey,bookmarks);
  decorate();
  enqueue('bookmark',id,value);
});
function enqueue(action,storyId,value){
  if(!validStory(storyId)||!readyToConnect)return;
  const entry={action,storyId,value};
  // Keep only the most recent change for a field.
  const existing=queue.findIndex(x=>x.storyId===storyId&&x.action===action);
  if(existing!==-1)queue.splice(existing,1);
  queue.push(entry);
  if(queue.length>300)queue.shift();
  setJson(pendingKey,queue);
  flush();
}
async function flush(){
  if(flushing||!booted||!readyToConnect)return;
  flushing=true;
  try{
    while(queue.length){
      const item=queue[0];
      await request(item.action,{storyId:item.storyId,value:item.value});
      queue.shift();setJson(pendingKey,queue);
    }
    online=true;status('☁️ Синхронизировано','online');
  }catch(err){
    online=false;status('☁️ Ожидает синхронизации','offline');
    console.warn('АРХИВ: синхронизация отложена',err?.message||err);
  }finally{flushing=false;}
}
function noteProgress(){
  if(!stream||!getStories().length)return;
  let active=getStories()[0],position=stream.scrollTop+Math.max(80,Math.min(400,innerHeight*.4));
  for(const story of getStories()){
    if(story.offsetTop<=position)active=story;else break;
  }
  const id=storyId(active);if(!validStory(id))return;
  const relative=stream.scrollTop-active.offsetTop;
  const visible=Math.max(1,active.offsetHeight-stream.clientHeight);
  const pct=Math.max(0,Math.min(100,Math.round(relative/visible*100)));
  const progress=getJson(progressKey);
  const best=Math.max(Number(progress[id]||0),pct);
  if(best>Number(progress[id]||0)) {progress[id]=best;setJson(progressKey,progress);}
  const now=Date.now();
  if(readyToConnect && (id!==lastProgressStory||Math.abs(best-lastProgressPercent)>=10) &&
     now-lastProgressSent>6000 && best>=5){
    lastProgressStory=id;lastProgressPercent=best;lastProgressSent=now;
    enqueue('progress',id,best);
  }
}
let progressTimer=0;
if(stream)stream.addEventListener('scroll',()=>{
  clearTimeout(progressTimer);progressTimer=setTimeout(noteProgress,300);
},{passive:true});
window.addEventListener('pagehide',noteProgress);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')noteProgress();});
window.addEventListener('online',()=>{if(booted)flush()});
function rate(storyId,value){
  if(!validStory(Number(storyId))||![-1,0,1].includes(Number(value)))return;
  enqueue('rate',Number(storyId),Number(value));
}
async function bootstrap(){
  if(!readyToConnect){status(initData?'☁️ Supabase не настроен':'☁️ Локально · входи через Telegram','local');return;}
  try{
    const localRatings=getJson(ratingsKey),localBookmarks=getJson(bookmarkKey);
    const remote=await request('bootstrap');
    accountId=remote.telegram_id;
    const ratings={...localRatings},bookmarks={...localBookmarks},progress=getJson(progressKey);
    const known=new Set();
    for(const row of remote.states||[]){
      const id=Number(row.story_id);
      if(!validStory(id))continue;
      known.add(id);
      if(Number(row.rating))ratings[id]=Number(row.rating);else delete ratings[id];
      if(row.bookmarked)bookmarks[id]=true;else delete bookmarks[id];
      progress[id]=Math.max(Number(progress[id]||0),Number(row.progress_pct||0));
    }
    setJson(ratingsKey,ratings);setJson(bookmarkKey,bookmarks);setJson(progressKey,progress);
    // Restore earlier local ratings and bookmarks only when no cloud record exists.
    queue=Array.isArray(getJson(pendingKey))?getJson(pendingKey):[];
    if(!Array.isArray(queue))queue=[];
    for(const [idString,value] of Object.entries(localRatings)){
      const id=Number(idString);
      if(validStory(id)&&!known.has(id)&&[-1,1].includes(Number(value)) &&
         !queue.some(q=>q.storyId===id&&q.action==='rate'))queue.push({action:'rate',storyId:id,value:Number(value)});
    }
    for(const [idString,bookmarked] of Object.entries(localBookmarks)){
      const id=Number(idString);
      if(validStory(id)&&!known.has(id)&&bookmarked &&
         !queue.some(q=>q.storyId===id&&q.action==='bookmark'))queue.push({action:'bookmark',storyId:id,value:1});
    }
    queue=queue.filter(x=>['rate','bookmark','progress'].includes(x.action)&&
      validStory(x.storyId)&&Number.isSafeInteger(x.value));
    setJson(pendingKey,queue);
    booted=true;online=true;decorate();status('☁️ Подключено к облаку','online');
    if(typeof load==='function'&&typeof currentSection==='string'&&currentSection==='recommended')
      load('recommended',typeof currentTag==='string'?currentTag:'');
    flush();
  }catch(err){
    online=false;status('☁️ Локально · ошибка облака','offline');
    console.warn('АРХИВ: ошибка облачной авторизации',err?.message||err);
  }
}
window.ArchiveCloud={version:'9.1',rate,bookmark:(id,value)=>enqueue('bookmark',id,value),
  progress:(id,value)=>enqueue('progress',id,value),sync:bootstrap,
  get enabled(){return readyToConnect},get online(){return online},get accountId(){return accountId}};
decorate();
bootstrap();
})();
