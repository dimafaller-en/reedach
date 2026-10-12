import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
// Spelling by the hunspell binary on this server: the text never leaves it.
// Finding misspelled words is cheap, suggestions are not (~0.3 s per word), so they are two steps:
// a short-lived `hunspell -l` per request finds the words, a long-lived `hunspell -a` suggests fixes.
const dict=name=>fileURLToPath(import.meta.resolve(name)).replace(/\.js$/,'');
export const DEFAULT_DICTS=[dict('dictionary-ru'),dict('dictionary-en')].join(',');
const LETTERS=/^[A-Za-zА-Яа-яЁё]+(?:-[A-Za-zА-Яа-яЁё]+)*$/;
const spellError=(code,message)=>Object.assign(new Error(message),{status:503,code});

// Words worth checking: letters with inner hyphens; links, e-mails, abbreviations, words with digits
// and English contractions (isn't, couldn’t) are skipped.
export function words(text,{limit=20000}={}){
 const seen=new Set(),clean=String(text).replace(/https?:\/\/\S+|www\.\S+|[\w.+-]+@[\w-]+\.[\w.-]+/g,' ');
 for(const [w] of clean.matchAll(/(?<![\w-])[A-Za-zА-Яа-яЁё]+(?:[-'’][A-Za-zА-Яа-яЁё]+)*(?![\w-])/g))if(w.length>1&&!/['’]/.test(w)&&w!==w.toUpperCase()&&seen.size<limit)seen.add(w);
 return [...seen];
}

// Own words: a form is accepted when it shares the stem and differs by a short ending; for verbs the stem drops -ть/-ться.
const stem=e=>/(?:ться|ть|ти|чь)$/.test(e)?e.replace(/(?:ться|ть|ти|чь)$/,''):e.slice(0,-1);
export function known(word,entries){const w=word.toLowerCase();return entries.some(entry=>{const e=String(entry).toLowerCase(),s=stem(e);return w===e||e.length>=5&&w.startsWith(s)&&w.length-s.length<=5;});}

// One `hunspell -l` per request: it prints the misspelled words and exits when stdin closes.
export function misspelled(list,{dicts=DEFAULT_DICTS,timeout=10000}={}){
 const input=list.filter(w=>LETTERS.test(w));
 if(!input.length)return Promise.resolve([]);
 return new Promise((resolve,reject)=>{
  const child=spawn('hunspell',['-l','-i','utf-8','-d',dicts],{stdio:['pipe','pipe','ignore']});let out='',timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},timeout);
  child.stdout.setEncoding('utf8').on('data',chunk=>{out+=chunk;});
  child.on('error',e=>{clearTimeout(timer);reject(Object.assign(spellError('spell_unavailable','Проверка орфографии недоступна'),{cause:e}));});
  child.on('close',code=>{clearTimeout(timer);if(timedOut||code!==0)return reject(spellError('spell_failed','Проверка орфографии не удалась'));resolve([...new Set(out.split('\n').filter(Boolean))]);});
  child.stdin.on('error',()=>{});
  child.stdin.end(input.join('\n')+'\n');
 });
}

// A long-lived `hunspell -a` for suggestions. Safety:
// - only letter words go in, each as one line behind "^", so text can never become a hunspell command;
// - own words are never added to hunspell, so nothing is remembered between requests;
// - one word at a time: hunspell answers every input line with a blank line, so answers cannot mix;
// - a hung or broken process is killed and started again; it is also recycled after `recycle` words.
export class Suggester{
 constructor({dicts=DEFAULT_DICTS,wordTimeout=3000,recycle=2000,cacheSize=5000,maxPending=50}={}){Object.assign(this,{dicts,wordTimeout,recycle,cacheSize,maxPending});this.cache=new Map();this.queue=Promise.resolve();this.child=null;this.used=0;this.pending=0;}
 #start(){
  const child=spawn('hunspell',['-a','-i','utf-8','-d',this.dicts],{stdio:['pipe','pipe','ignore']});
  // An idle hunspell must not keep the program alive: a pending answer has its own timer.
  child.unref();child.stdin.unref?.();child.stdout.unref?.();
  const state={child,buf:'',waiting:null,banner:true};
  child.stdout.setEncoding('utf8').on('data',chunk=>{state.buf+=chunk;this.#drain(state);});
  child.on('error',()=>this.#fail(state));child.on('close',()=>this.#fail(state));child.stdin.on('error',()=>this.#fail(state));
  this.child=state;this.used=0;return state;
 }
 #drain(state){
  if(state.banner){const nl=state.buf.indexOf('\n');if(nl<0)return;state.buf=state.buf.slice(nl+1);state.banner=false;}
  for(;;){
   const end=state.buf.startsWith('\n')?0:state.buf.indexOf('\n\n');if(end<0)return;
   const answer=state.buf.slice(0,end);state.buf=state.buf.slice(end?end+2:1);
   // An answer nobody asked for means hunspell and we are out of step: start over.
   const w=state.waiting;if(!w)return this.#fail(state);state.waiting=null;w.resolve(answer);
  }
 }
 #fail(state){if(this.child===state)this.child=null;state.dead=true;state.child.kill('SIGKILL');const w=state.waiting;state.waiting=null;w?.reject(spellError('spell_failed','Подбор вариантов не удался'));}
 #ask(word){
  let state=this.child;if(!state||state.dead||this.used>=this.recycle){if(state)this.#fail(state);state=this.#start();}
  this.used++;
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>this.#fail(state),this.wordTimeout);
   state.waiting={resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}};
   state.child.stdin.write('^'+word+'\n');
  });
 }
 // word → up to five suggestions; correct words and words hunspell cannot fix give [].
 suggest(word){
  if(typeof word!=='string'||word.length>40||!LETTERS.test(word))return Promise.resolve([]);
  if(this.cache.has(word))return Promise.resolve(this.cache.get(word));
  if(this.pending>=this.maxPending)return Promise.reject(Object.assign(spellError('busy','Сервер занят, попробуйте позже'),{status:503}));
  this.pending++;
  const run=this.queue.then(()=>this.#ask(word)).then(answer=>{
   const m=/^& \S+ \d+ \d+: (.*)$/m.exec(answer),list=m?m[1].split(', ').slice(0,5):[];
   if(this.cache.size>=this.cacheSize)this.cache.delete(this.cache.keys().next().value);
   this.cache.set(word,list);return list;
  }).finally(()=>{this.pending--;});
  this.queue=run.catch(()=>{});return run;
 }
 close(){if(this.child)this.#fail(this.child);}
}
