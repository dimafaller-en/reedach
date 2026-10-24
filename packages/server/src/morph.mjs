import {createRequire} from 'node:module';
import path from 'node:path';
import {formReplacements as forms,formWanted} from './forms.mjs';
// Style hints that need parts of speech: Az.js with the OpenCorpora dictionaries, loaded once on first use.
const require=createRequire(import.meta.url),Az=require('az'),DICTS=path.join(path.dirname(require.resolve('az/package.json')),'dicts');
let ready=null;
const init=()=>ready??=new Promise((resolve,reject)=>Az.Morph.init(DICTS,error=>error?reject(error):resolve()));
const cache=new Map();
// Russian words are shorter than 40 letters; Az.js spends seconds on a made-up word of thousands, so those are not parsed.
const MAX_WORD=40;
function parse(word){
 const key=word.toLowerCase();let hit=cache.get(key);
 if(!hit){let p;try{if(key.length<=MAX_WORD)p=Az.Morph(key)[0];}catch{}hit={pos:p?.tag?.POS||'',cas:p?.tag?.CAse||'',lemma:String(p?.normalize()?.word||key),score:p?.score||0};if(cache.size>50000)cache.clear();cache.set(key,hit);}
 return hit;
}
const RULES={
 'gerund-start':{category:'syntax',label:'Синтаксис',message:'Предложение начинается с деепричастного оборота: читателю приходится держать его в голове.',fix:'Начните с того, кто действует: не «Сделав работу, мы ушли», а «Мы сделали работу и ушли».'},
 'participle-stack':{category:'syntax',label:'Синтаксис',message:'Несколько причастных оборотов в одном предложении утяжеляют его.',fix:'Вынесите один оборот в отдельное предложение.'},
 'short-passive':{category:'passive',label:'Страдательный залог',message:'Краткое причастие прячет того, кто действует.',fix:'Назовите действующее лицо: не «решение принято», а «мы решили».'},
 'genitive-chain':{category:'nominalization',label:'Отглагольное',message:'Цепочка существительных в родительном падеже: смысл приходится распутывать.',fix:'Разорвите цепочку глаголом: не «проведение проверки выполнения работ», а «проверили, как сделана работа».'},
 'verb-chain':{category:'syntax',label:'Синтаксис',message:'Цепочка глаголов размывает действие.',fix:'Оставьте главный глагол: не «хотел бы начать делать», а «начну делать» или «делаю».'},
 'weak-verb-noun':{category:'bureaucratese',label:'Канцелярит',message:'Пустой глагол плюс отглагольное существительное звучат казённо.',fix:'Замените одним глаголом: не «осуществляем доставку», а «доставляем».'},
 'long-row':{category:'syntax',label:'Однородные',message:'Длинный ряд однородных слов: читатель не удержит все.',fix:'Оставьте два-три главных или превратите ряд в список.'},
 'adjective-pile':{category:'adjective',label:'Прилагательное',message:'Несколько прилагательных подряд перегружают фразу.',fix:'Оставьте одно, самое точное, или замените фактом.'},
 'start-repeat':{category:'repetition',label:'Повтор',message:'Третье предложение подряд начинается с того же слова: текст звучит монотонно.',fix:'Начните одно из предложений иначе или объедините их.'},
 'lemma-repeat':{category:'repetition',label:'Повтор',message:'Одно и то же слово дважды в предложении.',fix:'Замените повтор местоимением или перестройте фразу.'},
 'ne-adjective':{category:'mistake',label:'Частая ошибка',message:'Не с прилагательным пишется слитно, если нет противопоставления.',fix:'Пишите слитно: несложные сайты. Раздельно — с противопоставлением: не сложные, а простые.'},
 'instrumental-case':{category:'mistake',label:'Частая ошибка',message:'После этого глагола нужен творительный падеж: заниматься чем?',fix:'Поставьте слово в творительный падеж: занимался настройкой сетей.'},
 'typo-real-word':{category:'mistake',label:'Частая ошибка',message:'Похоже на опечатку: слово есть в словаре, но здесь не к месту.',fix:'Проверьте слово: возможно, имелось в виду мой.'},
};
const WEAK=new Set(['осуществлять','осуществить','производить','произвести','проводить','провести','совершать','совершить','оказывать','оказать','выполнять','выполнить','обеспечивать','обеспечить','предоставлять','предоставить','принимать','принять','давать','дать']);
const CHAIN_HEAD=new Set(['хотеть','мочь','начать','начинать','стать','пытаться','попытаться','собираться','решить','планировать']);
const SKIP_REPEAT=new Set(['быть','мочь','это','этот','который','свой','весь','такой','тот','один','год','раз','так','как','что','когда','если','также','тоже','только','очень','уже','еще','ещё','друг','другой','какой','какой-то','каждый','самый','себя','чуть']);
const NOMINAL=/(?:ние|тие|ство|ция|ка)$/;
// Verbs that take the instrumental: «занимался настройкой», not «занимался настройка».
const INSTRUMENTAL=new Set(['заниматься','увлекаться','интересоваться','пользоваться','руководить','управлять','владеть','гордиться','торговать','обладать','командовать','восхищаться','любоваться','дорожить']);
// Before these «не» negates the whole phrase or the predicate: «вовсе не сложные», «я не большой любитель».
const NE_KEEP=new Set(['еще','ещё','уже','пока','вовсе','отнюдь','далеко','совсем','ничуть','нисколько','ни','это','был','была','было','были','будет','будут','быть','является','являются','стал','стала','стали','оказался','оказалась','оказались']);
// Every parse of a word, for agreement checks; the best one alone often hides the right case.
const allCache=new Map();
function all(word){const key=word.toLowerCase();let hit=allCache.get(key);if(!hit){try{hit=key.length<=MAX_WORD?Az.Morph(key):[];}catch{hit=[];}if(allCache.size>50000)allCache.clear();allCache.set(key,hit);}return hit;}
// «не сложные сайты»: «не», a qualitative adjective and a noun it agrees with, no contrast around («а не сложные»).
function neAdjective(words,k,gap){
 const [ne,adj,noun]=words.slice(k,k+3);
 if(!noun||ne.w.toLowerCase()!=='не'||!/^\s+$/.test(gap(ne,adj))||!/^\s+$/.test(gap(adj,noun)))return false;
 const prev=words[k-1];if(prev&&(NE_KEEP.has(prev.w.toLowerCase())||/^(?:а|но)$/i.test(prev.w)||prev.pos==='NPRO'))return false;
 if(words.slice(k+3).some(w=>/^(?:а|но|зато|не|ни)$/i.test(w.w))||words.slice(Math.max(0,k-4),k).some(w=>/^(?:не|ни)$/i.test(w.w)))return false;
 // Dictionary words only: a guess for «исключаетвозможного» or a typo is not an adjective.
 const as=all(adj.w).filter(p=>p.parser==='Dictionary'&&p.tag.POS==='ADJF'&&p.tag.Qual&&!p.tag.Apro&&!p.tag.Anum&&!p.tag.Supr),ns=noun.w.length>1&&noun.pos==='NOUN'?all(noun.w).filter(p=>p.parser==='Dictionary'&&p.tag.POS==='NOUN'):[];
 const cases=as.flatMap(a=>ns.filter(n=>a.tag.CAse===n.tag.CAse&&a.tag.NMbr===n.tag.NMbr&&(a.tag.NMbr==='plur'||a.tag.GNdr===n.tag.GNdr||n.tag['Ms-f'])).map(n=>n.tag.CAse));
 if(!cases.length)return false;
 // In the nominative or accusative with no verb before it in the clause the phrase may be a predicate: «заявления — не пустые слова».
 let c=k;while(c>0&&!/[,;:—–-]/.test(gap(words[c-1],words[c])))c--;
 return cases.some(x=>x!=='nomn'&&x!=='accs')||words.slice(c,k).some(w=>['VERB','INFN','GRND'].includes(w.pos));
}
// «занимался настройка»: a noun in the nominative right after a verb that takes the instrumental, when the noun
// cannot be its subject («в зале занимаются дети» is right). Gives the noun in the instrumental, or null.
function instrumental(words,k,gap){
 const verb=words[k],noun=words[k+1];
 if(!noun||!(verb.pos==='VERB'&&INSTRUMENTAL.has(verb.lemma))||!/^\s+$/.test(gap(verb,noun)))return null;
 if(words.slice(0,k).some(w=>w.cas==='ablt'))return null;
 const ps=all(noun.w),n=ps.find(p=>p.tag.POS==='NOUN'&&p.tag.CAse==='nomn');
 if(!n||ps.some(p=>p.tag.POS!=='NOUN'||p.parser!=='Dictionary')||ps.some(p=>p.tag.CAse==='ablt'||p.tag['Ms-f']))return null;
 const v=all(verb.w).find(p=>p.tag.POS==='VERB')?.tag;if(!v)return null;
 // A personal pronoun before the verb in the same clause is its subject already: «она занималась музыка».
 let c=k;while(c>0&&!/[,;:—–-]/.test(gap(words[c-1],words[c])))c--;
 const before=words.slice(c,k).some(w=>w.pos==='NPRO'&&w.cas==='nomn'&&/^(?:я|ты|он|она|оно|мы|вы|они)$/i.test(w.w));
 const subject=!before&&v.MOod!=='impr'&&!['1per','2per'].includes(v.PErs)&&(v.NMbr==='plur'?n.tag.NMbr==='plur':n.tag.NMbr==='sing'&&(!v.GNdr||v.GNdr===n.tag.GNdr));
 if(subject)return null;
 try{return n.inflect(['ablt',n.tag.NMbr])?.word||null;}catch{return null;}
}
// «изменило пой подход»: the imperative of «петь» cannot follow a preposition or a verb (but «давай пой») and stand before a noun.
const poiTypo=(words,k,gap)=>{const [prev,w,next]=[words[k-1],words[k],words[k+1]];return !!(prev&&next&&w.w.toLowerCase()==='пой'&&/^\s+$/.test(gap(prev,w))&&/^\s+$/.test(gap(w,next))&&next.pos==='NOUN'&&(prev.pos==='PREP'||prev.pos==='INFN'||prev.pos==='VERB'&&!all(prev.w).some(p=>p.tag.MOod==='impr')));};
const sentences=text=>[...text.matchAll(/[^.!?…]+(?:[.!?…]+|$)/g)].map(m=>({start:m.index,text:m[0]})).filter(s=>s.text.trim());
// blocks: [{text, kind}] → issues [{block,start,end,id,category,label,message,fix}]
export async function morphCheck(blocks){
 await init();
 const issues=[],add=(block,start,end,id)=>issues.push({block,start,end,id,...RULES[id]});
 blocks.forEach((b,i)=>{
  if(typeof b?.text!=='string'||b.kind==='h')return;
  const firsts=[];
  for(const s of sentences(b.text)){
   const words=[...s.text.matchAll(/[А-Яа-яЁё]+(?:-[А-Яа-яЁё]+)*/g)].map(m=>({w:m[0],start:s.start+m.index,end:s.start+m.index+m[0].length,...parse(m[0])}));
   if(!words.length)continue;
   firsts.push(words[0]);
   const gap=(a,b)=>s.text.slice(a.end-s.start,b.start-s.start);
   if(words[0].pos==='GRND'){const comma=s.text.indexOf(',',words[0].end-s.start);add(i,words[0].start,comma>0?s.start+comma:words[0].end,'gerund-start');}
   const prtf=words.filter(w=>w.pos==='PRTF');if(prtf.length>=2)add(i,prtf[1].start,prtf[1].end,'participle-stack');
   words.forEach((w,k)=>{
    if(neAdjective(words,k,gap))issues.push({block:i,start:w.start,end:words[k+1].end,id:'ne-adjective',...RULES['ne-adjective'],replace:['не'+words[k+1].w.toLowerCase()]});
    const ablt=instrumental(words,k,gap);if(ablt)issues.push({block:i,start:words[k+1].start,end:words[k+1].end,id:'instrumental-case',...RULES['instrumental-case'],replace:[ablt]});
    if(poiTypo(words,k,gap))issues.push({block:i,start:w.start,end:w.end,id:'typo-real-word',...RULES['typo-real-word'],replace:['мой']});
    if(w.pos==='PRTS'&&w.score>=0.5&&!/^(?:был|была|было|были|будет|будут)$/i.test(words[k-1]?.w||''))add(i,w.start,w.end,'short-passive');
    if(w.pos==='VERB'&&WEAK.has(w.lemma)){const n=words.slice(k+1,k+3).find(x=>x.pos==='NOUN');if(n&&NOMINAL.test(n.lemma)&&n.lemma!=='участие'||n&&w.lemma.startsWith('при')&&n.lemma==='участие')add(i,w.start,n.end,'weak-verb-noun');}
   });
   for(let k=0;k<words.length;){let j=k;if(words[k].pos==='NOUN')while(j+1<words.length&&words[j+1].pos==='NOUN'&&words[j+1].cas==='gent'&&/^\s+$/.test(gap(words[j],words[j+1])))j++;if(j-k>=2){add(i,words[k].start,words[j].end,'genitive-chain');k=j+1;}else k++;}
   for(let k=0;k<words.length;k++){const head=words[k];if(!(head.pos==='VERB'&&CHAIN_HEAD.has(head.lemma)))continue;let j=k+1;if(words[j]?.w==='бы')j++;let n=0;while(words[j+n]?.pos==='INFN')n++;if(n>=2){add(i,head.start,words[j+n-1].end,'verb-chain');k=j+n;}}
   for(let k=0;k<words.length;){const pos=words[k].pos;let j=k;if(['VERB','ADJF','NOUN','INFN'].includes(pos))while(j+1<words.length&&words[j+1].pos===pos&&/^\s*(?:,|и|или|,\s*и)\s*$/.test(gap(words[j],words[j+1])))j++;if(j-k>=3){add(i,words[k].start,words[j].end,'long-row');k=j+1;}else k++;}
   for(let k=0;k+2<words.length;k++)if(words[k].pos==='ADJF'&&words[k+1].pos==='ADJF'&&words[k+2].pos==='ADJF'&&/^\s+$/.test(gap(words[k],words[k+1])+gap(words[k+1],words[k+2]).replace(/\S/g,'x'))){add(i,words[k].start,words[k+2].end,'adjective-pile');k+=2;}
   const seen=new Map();for(const w of words){if(w.lemma.length<4||SKIP_REPEAT.has(w.lemma)||!['NOUN','VERB','INFN','ADJF','ADVB'].includes(w.pos))continue;if(seen.has(w.lemma)){add(i,w.start,w.end,'lemma-repeat');}else seen.set(w.lemma,w);}
  }
  // Three sentences in a row opening with the same word ("Проектирую… Проектировал… Проектирую…").
  for(let k=2;k<firsts.length;k++)if(firsts[k].lemma===firsts[k-1].lemma&&firsts[k].lemma===firsts[k-2].lemma&&!['и','а','но'].includes(firsts[k].lemma)){add(i,firsts[k].start,firsts[k].end,'start-repeat');k+=2;}
 });
 return issues;
}
export const MORPH_RULES=RULES;

// A click puts the replacement in place of the found word, so it takes that word's form: «релевантные» → «подходящие».
// The parse of the found word is the one with the replacement's part of speech («фичи» is a noun here, not a verb);
// a noun keeps its own gender and, when its base form is plural («возможности»), its number.
const FAMILY={INFN:'verb',VERB:'verb',ADJF:'adj',PRTF:'adj',ADJS:'adjs',PRTS:'adjs',NOUN:'noun',ADVB:'advb'};
const KEEP={verb:['NMbr','TEns','PErs','GNdr','MOod','INvl'],adj:['NMbr','CAse','GNdr','ANim'],adjs:['NMbr','GNdr'],noun:['NMbr','CAse'],advb:[]};
function inflect(found,word){
 const lower=found.toLowerCase();if(lower.length>MAX_WORD||word.length>MAX_WORD)return word;
 let parses,targets;try{parses=Az.Morph(lower);targets=Az.Morph(word);}catch{return word;}
 for(const f of parses){
  const fam=FAMILY[f.tag.POS],t=fam&&targets.find(x=>FAMILY[x.tag.POS]===fam);if(!t)continue;
  if(fam==='advb')return word;
  const keep=KEEP[fam].filter(k=>!(fam==='noun'&&k==='NMbr'&&t.tag.NMbr==='plur'));
  const want=keep.map(k=>f.tag[k]).filter(Boolean);if(fam==='noun'&&t.tag.NMbr==='plur')want.push('plur');
  if(fam==='verb'&&f.tag.POS==='VERB'&&t.tag.POS==='INFN')want.push('VERB');
  if(f.tag.POS==='INFN')return t.normalize()?.word||word;
  try{const r=t.inflect(want);if(r?.word)return r.word;}catch{}
  return word;
 }
 return word;
}
// issues from checkStyle on the same blocks: variants (dictionary forms) become replacements in the found word's form.
export async function inflectReplacements(issues,blocks){
 const todo=issues.filter(it=>it.variants);if(!todo.length)return issues;
 await init();
 // In a phrase («личного бренда», «веб-сайта») the form comes from its last word.
 for(const it of todo){const found=(blocks[it.block]?.text.slice(it.start,it.end)||'').split(/[\s-]+/).pop();if(/^[А-Яа-яЁё]+$/.test(found))it.replace=it.variants.map(w=>inflect(found,w));}
 return issues;
}
// Hints from checkStyle and morphCheck on the same blocks that have no replacement: the variant of the hint in the
// found word's form (forms.mjs) becomes the replacement.
export async function formReplacements(issues,blocks){
 if(!issues.some(formWanted))return issues;
 await init();
 return forms(issues,blocks,Az);
}
