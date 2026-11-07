// Reedach widget: hints right over a textarea. A transparent mirror of the field carries the marks
// (CSS Custom Highlight API), so the author keeps typing with the list open; edited marks drop at once
// and the check reruns after a short pause. Without an endpoint the dictionary check runs in the browser;
// with one, a Reedach server adds spelling and morphology.
// The widget ships no visual styles: only what keeps the mirror on top of the text. The site styles the rest.
import {checkStyle,sourceBlocks,textBlocks,mergeIssues,MISTAKES} from 'reedach';
import {strings} from './i18n.js';
import {shiftIssues,localDictionary,localSkips,skipKey,request,esc} from './core.js';

const LENGTH=new Set(['long-sentence','long-paragraph']);
// Keys that move the caret without typing: after them the hint of the word under the caret shows, as on hover.
const NAV=new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown']);
const HL=typeof CSS!=='undefined'&&!!CSS.highlights&&typeof Highlight==='function';
const COPY=['fontFamily','fontSize','fontWeight','fontStyle','fontStretch','fontVariant','fontFeatureSettings','fontKerning','lineHeight','letterSpacing','wordSpacing','textIndent','textTransform','tabSize','wordBreak','paddingTop','paddingLeft','paddingBottom','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth'];
const kind=it=>it.id==='spelling'?'spell':LENGTH.has(it.id)?'long':'word';
// A plain mistake («вообщем», a paronym, typography) is also in reedach-word, so a site without a style for
// reedach-mistake marks it as before.
const mistake=it=>kind(it)==='word'&&MISTAKES.has(it.category);
const live=new Set(),attached=new WeakMap();
let flashTimer=0;

// Highlights are global by name, so every open widget paints into the same four.
function paintAll(){
 if(!HL)return;
 const sets={spell:new Highlight(),word:new Highlight(),long:new Highlight(),mistake:Object.assign(new Highlight(),{priority:1})};
 for(const w of live)for(const it of w.issues)if(it.range){sets[kind(it)].add(it.range);if(mistake(it))sets.mistake.add(it.range);}
 for(const [name,h] of Object.entries(sets))h.size?CSS.highlights.set('reedach-'+name,h):CSS.highlights.delete('reedach-'+name);
}

// attach(textarea, {endpoint, key, request, format, panel, lang, delay, dictionary, skips, disable, onChange, onClose}) → checker.
// Attaching to a field that is already checked runs the check again.
export function attach(source,options={}){
 const open=attached.get(source);
 if(open){open.check();return open;}
 const checker=new Checker(source,options);attached.set(source,checker);return checker;
}

class Checker{
 constructor(source,{endpoint=null,key=null,request:send=null,format='text',panel=null,lang,delay=1000,dictionary=localDictionary(),skips=localSkips(),disable=[],onChange,onClose}={}){
  if(!(source instanceof HTMLTextAreaElement))throw new TypeError('Reedach: attach() expects a textarea');
  Object.assign(this,{source,format,delay,dictionary,skips,disable:new Set(disable),onChange,onClose});
  // Server calls go through the site's own function when given (cookies, CSRF), else straight to the endpoint.
  this.send=send||(endpoint?(path,body,o={})=>request(endpoint,path,body,{key,...o}):null);
  this.t=strings(lang);this.issues=[];this.value=source.value;this.busy=true;this.error='';this.variants=new Map();this.hidden=[];this.notice=null;
  this.mirror=Object.assign(document.createElement('div'),{className:'reedach-mirror'});this.mirror.setAttribute('aria-hidden','true');
  Object.assign(this.mirror.style,{position:'absolute',zIndex:'1',boxSizing:'border-box',margin:'0',overflow:'hidden',whiteSpace:'pre-wrap',overflowWrap:'break-word',borderStyle:'solid',borderColor:'transparent',color:'transparent',background:'none',pointerEvents:'none'});
  source.before(this.mirror);
  this.ownPanel=!panel;this.panel=panel||document.createElement('div');this.panel.classList.add('reedach-panel');this.panel.hidden=false;
  if(this.ownPanel)source.after(this.panel);
  this.tooltip=Object.assign(document.createElement('div'),{className:'reedach-tooltip',hidden:true});this.tooltip.setAttribute('role','tooltip');this.tooltip.setAttribute('aria-live','polite');
  Object.assign(this.tooltip.style,{position:'fixed',zIndex:'2147483000',pointerEvents:'none'});
  document.body.append(this.tooltip);
  this.#listen();live.add(this);this.render();this.check();
 }
 #listen(){
  const {source,mirror,panel,tooltip}=this;let frame=0;
  const place=()=>{if(!this.closed)this.place();};
  this.off=[
   [source,'input',()=>this.#onInput()],
   [source,'scroll',()=>{mirror.scrollTop=source.scrollTop;mirror.scrollLeft=source.scrollLeft;tooltip.hidden=true;}],
   [source,'mousemove',e=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=0;if(this.closed)return;this.#tip(e.clientX,e.clientY);});}],
   [source,'mouseleave',()=>{tooltip.hidden=true;}],
   // Keyboard and touch have no hover: the hint follows the caret after an arrow key or a tap on a word.
   [source,'keyup',e=>{if(NAV.has(e.key))this.#caretTip();}],
   [source,'keydown',e=>{if(e.key==='Escape')tooltip.hidden=true;}],
   [source,'pointerdown',e=>{this.pointer=e.pointerType;}],
   [source,'click',()=>{if(this.pointer&&this.pointer!=='mouse')this.#caretTip();}],
   [source,'blur',()=>{tooltip.hidden=true;}],
   [panel,'click',e=>this.#onPanel(e)],
   [window,'resize',place],
  ].map(([el,type,fn])=>{el.addEventListener(type,fn);return ()=>el.removeEventListener(type,fn);});
  const ro=new ResizeObserver(place);ro.observe(source);ro.observe(panel);ro.observe(document.documentElement);this.off.push(()=>ro.disconnect());
  document.fonts?.ready.then(place);
 }
 // The mirror copies the textarea's box and type exactly, so a range in it covers the same pixels as the source text.
 place(){
  const {source,mirror}=this;mirror.hidden=source.hidden;if(source.hidden)return;
  const cs=getComputedStyle(source);for(const p of COPY)mirror.style[p]=cs[p];
  const bar=source.offsetWidth-source.clientWidth-parseFloat(cs.borderLeftWidth)-parseFloat(cs.borderRightWidth);
  mirror.style.paddingRight=parseFloat(cs.paddingRight)+bar+'px';mirror.style.width=source.offsetWidth+'px';mirror.style.height=source.offsetHeight+'px';
  mirror.style.left=mirror.style.top='0px';const s=source.getBoundingClientRect(),m=mirror.getBoundingClientRect();
  mirror.style.left=s.left-m.left+'px';mirror.style.top=s.top-m.top+'px';
  mirror.scrollTop=source.scrollTop;mirror.scrollLeft=source.scrollLeft;
 }
 async check(){
  if(this.closed)return;
  clearTimeout(this.timer);this.timer=0;this.controller?.abort();
  const controller=new AbortController(),value=this.source.value;this.controller=controller;
  const local=()=>{const blocks=this.format==='markdown'?sourceBlocks(value):textBlocks(value);return mergeIssues(blocks,{local:checkStyle(blocks)});};
  let issues,error='';
  if(this.send){
   try{const ignore=await this.dictionary.list();({issues}=await this.send('/check',{[this.format==='markdown'?'markdown':'text']:value,ignore,disable:[...this.disable]},{signal:controller.signal}));}
   catch(e){if(e.name==='AbortError')return;error=this.t('serverFailed',{error:e.message||'?'});issues=local();}
  }else issues=local();
  let skipped=new Set();try{skipped=new Set(await this.skips.list());}catch{}
  // The text changed while we waited: these offsets are stale. Typing already set a timer; a script
  // that set .value without an input event did not, so check again after the pause.
  if(this.closed||this.controller!==controller)return;
  if(this.source.value!==value){if(!this.timer)this.timer=setTimeout(()=>this.check(),this.delay);return;}
  const hidden=[];
  this.issues=(Array.isArray(issues)?issues:[]).filter(it=>Number.isInteger(it.start)&&Number.isInteger(it.end)&&it.start<it.end&&it.end<=value.length&&!this.disable.has(it.id)&&!this.disable.has(it.category))
   .filter(it=>{const k=skipKey(value,it);if(!skipped.has(k))return true;hidden.push(k);return false;});
  this.hidden=hidden;
  for(const it of this.issues)if(it.word&&Array.isArray(it.suggestions))this.variants.set(it.word,it.suggestions);
  this.value=value;this.error=error;this.busy=false;this.render();
  this.onChange?.(this.issues.map(({range,...it})=>it));
 }
 // The author's own typing ends the chance to undo the last fix or skip from the list; Ctrl+Z still works.
 #onInput(){
  this.tooltip.hidden=true;
  if(!this.ours)this.notice=null;
  clearTimeout(this.timer);this.timer=setTimeout(()=>this.check(),this.delay);
  if(this.busy)return;
  this.issues=shiftIssues(this.issues,this.value,this.source.value);this.value=this.source.value;this.render();
 }
 render(){
  const {mirror}=this,text=this.value+'\n​';
  if(mirror.firstChild?.data!==text)mirror.textContent=text;
  const node=mirror.firstChild;
  for(const it of this.issues){const r=new Range();r.setStart(node,it.start);r.setEnd(node,it.end);it.range=r;}
  this.#renderPanel();this.place();paintAll();
 }
 #fragment(it){const t=this.value.slice(it.start,it.end).replace(/\s+/g,' ').trim();return t.length>70?t.slice(0,67)+'…':t;}
 // Every hint can be skipped: it leaves the list and stays away until its sentence changes.
 #actions(it,i){
  const skip='<button type="button" class="reedach-action reedach-skip" data-reedach-skip="'+i+'" aria-label="'+esc(this.t('skipLabel',{text:this.#fragment(it)}))+'">'+esc(this.t('skip'))+'</button>';
  return '<div class="reedach-actions">'+this.#fixes(it,i)+skip+'</div>';
 }
 #fixes(it,i){
  // A style hint with ready replacements: buttons only, a style word is not a typo for the dictionary.
  // The replacement starts with a capital letter when the found word does.
  if(Array.isArray(it.replace)&&it.replace.length){const cap=/^\p{Lu}/u.test(this.value.slice(it.start,it.end)),up=w=>cap?w[0].toUpperCase()+w.slice(1):w;return it.replace.map(w=>this.#variant(i,up(w))).join('');}
  // A ready edit of the core: «Убрать» or a piece wider than the hint, already cased and with its commas and spaces.
  if(it.edit){const e=it.edit,from=this.value.slice(e.start,e.end).trim(),to=e.text.trim(),label=e.remove?this.t('removeLabel',{text:this.#fragment(it)}):this.t('applyLabel',{from,to});
   return '<button type="button" class="reedach-variant" data-reedach-edit="'+i+'" aria-label="'+esc(label)+'">'+esc(e.remove?this.t('remove'):this.t('apply',{text:to}))+'</button>';}
  if(!it.word)return '';
  const t=this.t,v=this.variants.get(it.word);let out='';
  if(Array.isArray(v))out=v.length?v.map(w=>this.#variant(i,w)).join(''):'<span class="reedach-note">'+esc(t('noVariants'))+'</span>';
  else if(v==='loading')out='<span class="reedach-note">'+esc(t('loading'))+'</span>';
  else if(this.send)out='<button type="button" class="reedach-action" data-reedach-variants="'+esc(it.word)+'">'+esc(t('variants'))+'</button>';
  return out+'<button type="button" class="reedach-action" data-reedach-add="'+esc(it.word)+'">'+esc(t('add',{word:it.word}))+'</button>';
 }
 #variant(i,w){return '<button type="button" class="reedach-variant" data-reedach-replace="'+i+'" data-reedach-value="'+esc(w)+'" aria-label="'+esc(this.t('replace',{word:w}))+'">'+esc(w)+'</button>';}
 #renderPanel(){
  const {panel,issues,busy,error,t}=this;
  const head='<div class="reedach-head"><div class="reedach-title" role="heading" aria-level="2">'+esc(t('title'))+(busy?'':' <span class="reedach-count">'+issues.length+'</span>')+'</div><button type="button" class="reedach-close" data-reedach-close>'+esc(t('close'))+'</button></div>';
  if(busy){panel.innerHTML=head+'<p class="reedach-status" role="status">'+esc(t('checking'))+'</p>';return;}
  const note=error?'<p class="reedach-error" role="alert">'+esc(error)+'</p>':'';
  // What the last click did, with a way back, stands where the hint was.
  const n=this.notice,done=n?'<li class="reedach-item reedach-done"><span role="status">'+esc(n.message)+'</span> <button type="button" class="reedach-action" '+(n.skip?'data-reedach-restore':'data-reedach-undo')+'>'+esc(t(n.skip?'restore':'undo'))+'</button></li>':'';
  const hidden=this.hidden.length?'<p class="reedach-hidden">'+esc(t('hidden',{n:this.hidden.length}))+' <button type="button" class="reedach-action" data-reedach-unskip>'+esc(t('showHidden'))+'</button></p>':'';
  if(!issues.length){panel.innerHTML=head+note+(done&&'<ol class="reedach-list">'+done+'</ol>')+'<p class="reedach-status" role="status">'+esc(t('none'))+'</p>'+hidden;return;}
  panel.innerHTML=head+note+'<ol class="reedach-list">'+issues.map((it,i)=>(n?.i===i?done:'')+'<li class="reedach-item reedach-'+kind(it)+(mistake(it)?' reedach-mistake':'')+'"><button type="button" class="reedach-jump" data-reedach-index="'+i+'"><span class="reedach-label">'+esc(it.label)+'</span> <span class="reedach-fragment">'+esc(this.#fragment(it))+'</span></button><p class="reedach-message">'+esc(it.message)+(this.variants.get(it.word)?.length?'':' '+esc(it.fix))+'</p>'+this.#actions(it,i)+'</li>').join('')+(n&&n.i>=issues.length?done:'')+'</ol>'+hidden+'<p class="reedach-credit">'+esc(t('credit'))+'</p>';
 }
 async #onPanel(e){
  const el=e.target.closest('button');if(!el||!this.panel.contains(el))return;
  const d=el.dataset,i=Number(d.reedachIndex??d.reedachReplace??d.reedachEdit??d.reedachSkip),it=this.issues[i];
  if('reedachClose' in d)return this.stop();
  if(d.reedachIndex&&it)return this.#jump(it);
  if(d.reedachReplace&&it)return this.#apply(i,it.start,it.end,d.reedachValue,this.t('replaced',{text:d.reedachValue}));
  if(d.reedachEdit&&it?.edit)return this.#apply(i,it.edit.start,it.edit.end,it.edit.text,it.edit.remove?this.t('removed',{text:this.#fragment(it)}):this.t('replaced',{text:it.edit.text.trim()}));
  if(d.reedachSkip&&it)return this.#skip(i,it);
  if('reedachUndo' in d)return this.#undo();
  if('reedachRestore' in d)return this.#restore();
  if('reedachUnskip' in d){const keys=this.hidden;this.hidden=[];this.notice=null;try{await this.skips.remove(keys);}catch{}return this.check();}
  if(d.reedachVariants)return this.#loadVariants(d.reedachVariants);
  if(d.reedachAdd){el.disabled=true;try{await this.dictionary.add(d.reedachAdd);this.check();}catch{el.disabled=false;el.textContent=this.t('addFailed');}}
 }
 async #loadVariants(word){
  this.variants.set(word,'loading');this.#renderPanel();
  try{const {suggestions}=await this.send('/suggest',{words:[word]});this.variants.set(word,Array.isArray(suggestions?.[word])?suggestions[word]:[]);}
  catch{this.variants.delete(word);}
  if(!this.closed)this.#renderPanel();
 }
 // A fix from the list can be taken back from the list until the author types again: Ctrl+Z is not
 // obvious, and the fallback below (setRangeText) does not reach the browser's undo at all.
 #apply(i,start,end,text,message){
  this.notice={i,message,undo:{start,end:start+text.length,text:this.value.slice(start,end)}};
  if(this.#replace(start,end,text))this.notice.after=this.source.value;
  else{this.notice=null;this.#renderPanel();}
 }
 #undo(){
  const n=this.notice;if(!n?.undo||this.source.value!==n.after)return;
  this.notice=null;if(this.#replace(n.undo.start,n.undo.end,n.undo.text))this.check();else this.#renderPanel();
 }
 async #skip(i,it){
  const key=skipKey(this.value,it);
  this.issues=this.issues.filter(x=>x!==it);this.hidden=[...this.hidden.filter(k=>k!==key),key];
  this.notice={i,message:this.t('skipped',{text:this.#fragment(it)}),skip:{key,it}};
  this.render();this.panel.querySelector('[data-reedach-restore]')?.focus({preventScroll:true});
  try{await this.skips.add(key);}catch{}
 }
 // Nothing was typed since the skip (typing drops the notice), so the hint's offsets still hold.
 async #restore(){
  const n=this.notice;if(!n?.skip)return;
  this.notice=null;this.hidden=this.hidden.filter(k=>k!==n.skip.key);
  const at=Math.min(n.i,this.issues.length);this.issues.splice(at,0,n.skip.it);
  this.render();this.panel.querySelector('[data-reedach-index="'+at+'"]')?.focus({preventScroll:true});
  try{await this.skips.remove([n.skip.key]);}catch{}
 }
 // Replacing through the editing command keeps the browser's undo; the input event then moves the other marks.
 // An empty value («Убрать») is a delete: insertText with nothing does not delete everywhere.
 #replace(start,end,value){
  const {source}=this,old=source.value;if(old.slice(start,end)!==this.value.slice(start,end))return false;
  this.ours=true;
  try{
   source.focus({preventScroll:true});source.setSelectionRange(start,end);
   try{document.execCommand(value?'insertText':'delete',false,value);}catch{}
   if(source.value===old){source.setRangeText(value,start,end,'end');source.dispatchEvent(new Event('input',{bubbles:true}));}
  }finally{this.ours=false;}
  return source.value!==old;
 }
 #jump(it){
  const {source,mirror}=this;this.place();
  source.focus({preventScroll:true});source.setSelectionRange(it.start,it.end);
  const r=it.range.getBoundingClientRect(),m=mirror.getBoundingClientRect();
  source.scrollTop=mirror.scrollTop+r.top-m.top-source.clientHeight/2;mirror.scrollTop=source.scrollTop;
  const now=it.range.getBoundingClientRect();if(now.top<0||now.bottom>innerHeight)scrollBy({top:now.top-innerHeight/2,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  if(HL){CSS.highlights.set('reedach-active',new Highlight(it.range));clearTimeout(flashTimer);flashTimer=setTimeout(()=>CSS.highlights.delete('reedach-active'),1600);}
 }
 #tip(x,y){
  const hits=this.issues.filter(it=>it.range&&[...it.range.getClientRects()].some(r=>x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom));
  const it=hits.find(h=>!LENGTH.has(h.id))||hits[0];
  if(!it){this.tooltip.hidden=true;return;}
  this.#show(it,x+14,y+14,y-14);
 }
 // The hint of the word with the caret in it or right after it; a long sentence alone is not worth a hint on every
 // arrow key. Placed under the line with the caret, or above it when there is no room below.
 #caretTip(){
  const {source,mirror,tooltip}=this,at=source.selectionEnd;
  const it=document.activeElement===source&&this.value===source.value&&this.issues.find(h=>h.range&&!LENGTH.has(h.id)&&h.start<=at&&at<=h.end);
  if(!it){tooltip.hidden=true;return;}
  this.place();const node=mirror.firstChild,r=new Range();r.setStart(node,at);r.setEnd(node,at);
  const c=r.getClientRects()[0]||it.range.getClientRects()[0],s=source.getBoundingClientRect();
  if(!c||c.bottom<s.top||c.top>s.bottom){tooltip.hidden=true;return;}
  this.#show(it,c.left,c.bottom+6,c.top-6);
 }
 // Top-left corner at x, y, or the bottom edge at above when the hint does not fit below.
 #show(it,x,y,above){
  const {tooltip}=this;
  tooltip.innerHTML='<strong class="reedach-label">'+esc(it.label)+'</strong> '+esc(it.message)+'<br>'+esc(it.fix);tooltip.hidden=false;
  const w=tooltip.offsetWidth,h=tooltip.offsetHeight;
  tooltip.style.left=Math.max(8,Math.min(innerWidth-w-8,x))+'px';tooltip.style.top=Math.max(8,y+h>innerHeight-8?above-h:y)+'px';
 }
 stop(){
  if(this.closed)return;this.closed=true;
  this.controller?.abort();clearTimeout(this.timer);this.off.forEach(fn=>fn());
  live.delete(this);attached.delete(this.source);this.issues=[];paintAll();
  this.mirror.remove();this.tooltip.remove();
  if(this.ownPanel)this.panel.remove();else{this.panel.innerHTML='';this.panel.hidden=true;}
  this.onClose?.();
 }
}
