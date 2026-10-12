// Pure parts of the widget, testable without a browser.

// Typing keeps the marks in place: those before the edit stay, those after it move, those it touched go away.
export function shiftIssues(issues,old,value){
 let p=0;const max=Math.min(old.length,value.length);while(p<max&&old[p]===value[p])p++;
 let s=0;while(s<max-p&&old[old.length-1-s]===value[value.length-1-s])s++;
 const oldEnd=old.length-s,delta=value.length-old.length;
 return issues.filter(it=>it.end<p||it.start>oldEnd).map(it=>it.start>oldEnd?{...it,start:it.start+delta,end:it.end+delta}:it);
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

// Request to a Reedach server (or a site's own proxy with the same API).
export async function request(endpoint,path,body,{key,signal,fetch:f=globalThis.fetch}={}){
 const res=await f(endpoint.replace(/\/+$/,'')+path,{method:'POST',signal,headers:{'content-type':'application/json',...(key&&{authorization:'Bearer '+key})},body:JSON.stringify(body)});
 let data=null;try{data=await res.json();}catch{}
 if(!res.ok)throw Object.assign(new Error(data?.error?.message||'HTTP '+res.status),{status:res.status,code:data?.error?.code});
 return data;
}

export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
