/* Browser-DOM smoke test for ARHIV 9.2; run against the built Pages output. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'../../public');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'data/stories.json'),'utf8'));
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(m=>m[1]).filter(s=>s.includes("getCatalog()"));
assert.equal(scripts.length,1,'main Archive script must be found');
const dom=new JSDOM(html,{url:'https://hah18905-lab.github.io/archive-mini-app/',runScripts:'outside-only',
  pretendToBeVisual:true});
const win=dom.window;
win.fetch=async()=>({ok:true,json:async()=>catalog});
win.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
win.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
win.confirm=()=>true;
win.eval(scripts[0]);
win.eval(fs.readFileSync(path.join(root,'tiktok-mode.js'),'utf8'));
win.eval(fs.readFileSync(path.join(root,'archive-cloud-config.js'),'utf8'));
win.eval(fs.readFileSync(path.join(root,'archive-cloud.js'),'utf8'));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const visible=()=>[...win.document.querySelectorAll('#stream > article.story')]
  .filter(a=>a.classList.contains('deck-active')&&!a.inert);
(async()=>{
  await pause(180);
  assert.equal(catalog.items.length,22,'22 stories must be retained');
  assert.equal(win.ArchiveDeck?.count,22,'22 stories should be addressable');
  assert.equal(visible().length,1,'exactly one visible story');
  const initial=visible()[0].id;
  win.document.getElementById('deckLike').click();
  const saved=JSON.parse(win.localStorage.getItem('archive_pages_ratings_v1')||'{}');
  assert.equal(saved[initial.replace(/^story-/,'')],1,'like is saved against current story');
  await pause(980);
  assert.equal(visible().length,1,'only one story after like');
  assert.notEqual(visible()[0].id,initial,'like switches story');
  assert.equal(win.document.getElementById('stream').scrollTop,0,'switch does not scroll the feed');
  const second=visible()[0].id;
  win.document.getElementById('deckNext').click();
  await pause(980);
  assert.equal(visible().length,1,'only one story after Next');
  assert.notEqual(visible()[0].id,second,'Next switches story');
  const third=visible()[0].id;
  win.document.getElementById('deckDislike').click();
  await pause(980);
  const after=JSON.parse(win.localStorage.getItem('archive_pages_ratings_v1')||'{}');
  assert.equal(after[third.replace(/^story-/,'')],-1,'dislike is saved');
  assert.equal(visible().length,1,'only one story after dislike');
  win.document.getElementById('forYou').click();
  await pause(150);
  assert.equal(visible().length,1,'recommendations stay one-story');
  console.log('ARHIV 9.2 smoke test PASS: one story, like, dislike, next, recommendations');
  dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1});
