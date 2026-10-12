// Reedach widget: hints right over a textarea. A transparent mirror of the field carries the marks
// (CSS Custom Highlight API), so the author keeps typing with the list open; edited marks drop at once
// and the check reruns after a short pause. Without an endpoint the dictionary check runs in the browser;
// with one, a Reedach server adds spelling and morphology.
// The widget ships no visual styles: only what keeps the mirror on top of the text. The site styles the rest.
import {checkStyle,sourceBlocks,textBlocks,mergeIssues} from 'reedach';
import {strings} from './i18n.js';
import {shiftIssues,localDictionary,request,esc} from './core.js';

const LENGTH=new Set(['long-sentence','long-paragraph']);
const HL=typeof CSS!=='undefined'&&!!CSS.highlights&&typeof Highlight==='function';
const COPY=['fontFamily','fontSize','fontWeight','fontStyle','fontStretch','fontVariant','fontFeatureSettings','fontKerning','lineHeight','letterSpacing','wordSpacing','textIndent','textTransform','tabSize','wordBreak','paddingTop','paddingLeft','paddingBottom','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth'];
const kind=it=>it.id==='spelling'?'spell':LENGTH.has(it.id)?'long':'word';
const live=new Set(),attached=new WeakMap();
let flashTimer=0;

// Highlights are global by name, so every open widget paints into the same three.
function paintAll(){
 if(!HL)return;
 const sets={spell:new Highlight(),word:new Highlight(),long:new Highlight()};
 for(const w of live)for(const it of w.issues)if(it.range)sets[kind(it)].add(it.range);
 for(const [name,h] of Object.entries(sets))h.size?CSS.highlights.set('reedach-'+name,h):CSS.highlights.delete('reedach-'+name);
}

// attach(textarea, {endpoint, key, request, format, panel, lang, delay, dictionary, disable, onChange, onClose}) → checker.
// Attaching to a field that is already checked runs the check again.
export function attach(source,options={}){
 const open=attached.get(source);
 if(open){open.check();return open;}
 const checker=new Checker(source,options);attached.set(source,checker);return checker;
}

class Checker{
 constructor(source,{endpoint=null,key=null,request:send=null,format='text',panel=null,lang,delay=1000,dictionary=localDictionary(),disable=[],onChange,onClose}={}){
  if(!(source instanceof HTMLTextAreaElement))throw new TypeError('Reedach: attach() expects a textarea');
  Object.assign(this,{source,format,delay,dictionary,disable:new Set(disable),onChange,onClose});
  // Server calls go through the site's own function when given (cookies, CSRF), else straight to the endpoint.
  this.send=send||(endpoint?(path,body,o={})=>request(endpoint,path,body,{key,...o}):null);
  this.t=strings(lang);this.issues=[];this.value=source.value;this.busy=true;this.error='';this.variants=new Map();
  this.mirror=Object.assign(document.createElement('div'),{className:'reedach-mirror'});this.mirror.setAttribute('aria-hidden','true');
  Object.assign(this.mirror.style,{position:'absolute',zIndex:'1',boxSizing:'border-box',margin:'0',overflow:'hidden',whiteSpace:'pre-wrap',overflowWrap:'break-word',borderStyle:'solid',borderColor:'transparent',color:'transparent',background:'none',pointerEvents:'none'});
  source.before(this.mirror);
  this.ownPanel=!panel;this.panel=panel||document.createElement('div');this.panel.classList.add('reedach-panel');this.panel.hidden=false;
  if(this.ownPanel)source.after(this.panel);
  this.tooltip=Object.assign(document.createElement('div'),{className:'reedach-tooltip',hidden:true});this.tooltip.setAttribute('role','tooltip');
  Object.assign(this.tooltip.style,{position:'fixed',zIndex:'2147483000',pointerEvents:'none'});
  document.body.append(this.tooltip);
  this.#listen();live.add(this);this.render();this.check();
 }
 #listen(){
  const {source,mirror,panel,tooltip}=this;let frame=0;
  const place=()=>{if(!this.closed)this.place();};
  this.off=[
   [source,'input',()=>this.#onInput()],
   [source,'scroll',()=>{mirror.scrollTop=source.scrollTop;mirror.scrollLeft=source.scrollLeft;}],
   [source,'mousemove',e=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=0;if(this.closed)return;this.#tip(e.clientX,e.clientY);});}],
   [source,'mouseleave',()=>{tooltip.hidden=true;}],
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
  // The text changed while we waited: these offsets are stale. Typing already set a timer; a script
  // that set .value without an input event did not, so check again after the pause.
  if(this.closed||this.controller!==controller)return;
  if(this.source.value!==value){if(!this.timer)this.timer=setTimeout(()=>this.check(),this.delay);return;}
  this.issues=(Array.isArray(issues)?issues:[]).filter(it=>Number.isInteger(it.start)&&Number.isInteger(it.end)&&it.start<it.end&&it.end<=value.length&&!this.disable.has(it.id)&&!this.disable.has(it.category));
  for(const it of this.issues)if(it.word&&Array.isArray(it.suggestions))this.variants.set(it.word,it.suggestions);
  this.value=value;this.error=error;this.busy=false;this.render();
  this.onChange?.(this.issues.map(({range,...it})=>it));
 }
 #onInput(){
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
 #actions(it,i){
  // A style hint with ready replacements: buttons only, a style word is not a typo for the dictionary.
  // The replacement starts with a capital letter when the found word does.
  if(Array.isArray(it.replace)&&it.replace.length){const cap=/^\p{Lu}/u.test(this.value.slice(it.start,it.end)),up=w=>cap?w[0].toUpperCase()+w.slice(1):w;return '<div class="reedach-actions">'+it.replace.map(w=>this.#variant(i,up(w))).join('')+'</div>';}
  if(!it.word)return '';
  const t=this.t,v=this.variants.get(it.word);let out='';
  if(Array.isArray(v))out=v.length?v.map(w=>this.#variant(i,w)).join(''):'<span class="reedach-note">'+esc(t('noVariants'))+'</span>';
  else if(v==='loading')out='<span class="reedach-note">'+esc(t('loading'))+'</span>';
  else if(this.send)out='<button type="button" class="reedach-action" data-reedach-variants="'+esc(it.word)+'">'+esc(t('variants'))+'</button>';
  return '<div class="reedach-actions">'+out+'<button type="button" class="reedach-action" data-reedach-add="'+esc(it.word)+'">'+esc(t('add',{word:it.word}))+'</button></div>';
 }
 #variant(i,w){return '<button type="button" class="reedach-variant" data-reedach-replace="'+i+'" data-reedach-value="'+esc(w)+'" aria-label="'+esc(this.t('replace',{word:w}))+'">'+esc(w)+'</button>';}
 #renderPanel(){
  const {panel,issues,busy,error,t}=this;
  const head='<div class="reedach-head"><div class="reedach-title" role="heading" aria-level="2">'+esc(t('title'))+(busy?'':' <span class="reedach-count">'+issues.length+'</span>')+'</div><button type="button" class="reedach-close" data-reedach-close>'+esc(t('close'))+'</button></div>';
  if(busy){panel.innerHTML=head+'<p class="reedach-status" role="status">'+esc(t('checking'))+'</p>';return;}
  const note=error?'<p class="reedach-error" role="alert">'+esc(error)+'</p>':'';
  if(!issues.length){panel.innerHTML=head+note+'<p class="reedach-status" role="status">'+esc(t('none'))+'</p>';return;}
  panel.innerHTML=head+note+'<ol class="reedach-list">'+issues.map((it,i)=>'<li class="reedach-item reedach-'+kind(it)+'"><button type="button" class="reedach-jump" data-reedach-index="'+i+'"><span class="reedach-label">'+esc(it.label)+'</span> <span class="reedach-fragment">'+esc(this.#fragment(it))+'</span></button><p class="reedach-message">'+esc(it.message)+(this.variants.get(it.word)?.length?'':' '+esc(it.fix))+'</p>'+this.#actions(it,i)+'</li>').join('')+'</ol><p class="reedach-credit">'+esc(t('credit'))+'</p>';
 }
 async #onPanel(e){
  const el=e.target.closest('button');if(!el||!this.panel.contains(el))return;
  const d=el.dataset,it=this.issues[Number(d.reedachIndex??d.reedachReplace)];
  if('reedachClose' in d)return this.stop();
  if(d.reedachIndex&&it)return this.#jump(it);
  if(d.reedachReplace&&it)return this.#replace(it,d.reedachValue);
  if(d.reedachVariants)return this.#loadVariants(d.reedachVariants);
  if(d.reedachAdd){el.disabled=true;try{await this.dictionary.add(d.reedachAdd);this.check();}catch{el.disabled=false;el.textContent=this.t('addFailed');}}
 }
 async #loadVariants(word){
  this.variants.set(word,'loading');this.#renderPanel();
  try{const {suggestions}=await this.send('/suggest',{words:[word]});this.variants.set(word,Array.isArray(suggestions?.[word])?suggestions[word]:[]);}
  catch{this.variants.delete(word);}
  if(!this.closed)this.#renderPanel();
 }
 // Replacing through the editing command keeps the browser's undo; the input event then moves the other marks.
 #replace(it,value){
  const {source}=this;if(source.value.slice(it.start,it.end)!==this.value.slice(it.start,it.end))return;
  source.focus({preventScroll:true});source.setSelectionRange(it.start,it.end);
  let done=false;try{done=document.execCommand('insertText',false,value);}catch{}
  if(!done||source.value.slice(it.start,it.start+value.length)!==value){source.setRangeText(value,it.start,it.end,'end');source.dispatchEvent(new Event('input',{bubbles:true}));}
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
  const it=hits.find(h=>!LENGTH.has(h.id))||hits[0],{tooltip}=this;
  if(!it){tooltip.hidden=true;return;}
  tooltip.innerHTML='<strong class="reedach-label">'+esc(it.label)+'</strong> '+esc(it.message)+'<br>'+esc(it.fix);tooltip.hidden=false;
  const pad=14,w=tooltip.offsetWidth,h=tooltip.offsetHeight;
  tooltip.style.left=Math.max(8,Math.min(innerWidth-w-8,x+pad))+'px';tooltip.style.top=(y+pad+h>innerHeight?y-h-pad:y+pad)+'px';
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
