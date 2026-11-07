// Pure parts of the widget, testable without a browser.

// Typing keeps the marks in place: those before the edit stay, those after it move, those it touched go away.
// A hint's ready edit (it.edit) can be wider than the hint: the hint goes when typing touches either.
export function shiftIssues(issues,old,value){
 let p=0;const max=Math.min(old.length,value.length);while(p<max&&old[p]===value[p])p++;
 let s=0;while(s<max-p&&old[old.length-1-s]===value[value.length-1-s])s++;
 const oldEnd=old.length-s,delta=value.length-old.length;
 const lo=it=>it.edit?Math.min(it.start,it.edit.start):it.start,hi=it=>it.edit?Math.max(it.end,it.edit.end):it.end;
 return issues.filter(it=>hi(it)<p||lo(it)>oldEnd).map(it=>lo(it)>oldEnd?{...it,start:it.start+delta,end:it.end+delta,...(it.edit&&{edit:{...it.edit,start:it.edit.start+delta,end:it.edit.end+delta}})}:it);
}

// Own words kept in this browser. Storage may be missing or blocked (private mode): then nothing is kept.
// Even reading window.localStorage throws when site data is blocked, so it is touched only inside try.
export function localDictionary(storage,key='reedach:words'){
 const store=()=>{try{return storage===undefined?globalThis.localStorage:storage;}catch{return null;}};
 const read=()=>{try{const v=JSON.parse(store()?.getItem(key)||'[]');return Array.isArray(v)?v.filter(w=>typeof w==='string'):[];}catch{return [];}};
 return {
  list:read,
  add(word){const words=read();if(!words.includes(word))words.push(word);try{store()?.setItem(key,JSON.stringify(words.slice(-2000)));}catch{}},
 };
}

// A skipped hint is known by its rule and the sentence around it, so it stays skipped while the author
// edits other sentences, and comes back once its own sentence changes. The same hint in a repeated sentence
// is skipped too: it is the same choice.
export function skipKey(text,it){
 const stop=/[.!?…\n]/;
 let a=it.start;while(a>0&&!stop.test(text[a-1]))a--;
 let b=it.end;while(b<text.length&&!stop.test(text[b]))b++;
 return [it.id,it.start-a,it.end-a,text.slice(a,b)].join('|');
}

// Skipped hints kept in this browser, the same way as own words. Without storage they last until the page reloads.
export function localSkips(storage,key='reedach:skipped'){
 let memory=[];
 const store=()=>{try{return storage===undefined?globalThis.localStorage:storage;}catch{return null;}};
 const read=()=>{try{const s=store();if(!s)return memory;const v=JSON.parse(s.getItem(key)||'[]');return Array.isArray(v)?v.filter(k=>typeof k==='string'):memory;}catch{return memory;}};
 const write=list=>{memory=list.slice(-500);try{store()?.setItem(key,JSON.stringify(memory));}catch{}};
 return {
  list:read,
  add(k){const list=read().filter(x=>x!==k);list.push(k);write(list);},
  remove(keys){const drop=new Set(keys);write(read().filter(x=>!drop.has(x)));},
 };
}

// Request to a Reedach server (or a site's own proxy with the same API).
export async function request(endpoint,path,body,{key,signal,fetch:f=globalThis.fetch}={}){
 const res=await f(endpoint.replace(/\/+$/,'')+path,{method:'POST',signal,headers:{'content-type':'application/json',...(key&&{authorization:'Bearer '+key})},body:JSON.stringify(body)});
 let data=null;try{data=await res.json();}catch{}
 if(!res.ok)throw Object.assign(new Error(data?.error?.message||'HTTP '+res.status),{status:res.status,code:data?.error?.code});
 return data;
}

export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
