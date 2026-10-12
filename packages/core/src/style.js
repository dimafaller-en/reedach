// Style hints by dictionary and simple rules. Runs in the browser and in Node; the rules are our own word lists.
import {RULES,CATEGORIES} from './rules.js';
const L='A-Za-zА-Яа-яЁё';
const norm=s=>s.toLowerCase().replace(/ё/g,'е');
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
// "осуществл*" matches any ending; spaces between words may be any whitespace.
const tokenSource=t=>t.endsWith('*')?esc(norm(t.slice(0,-1)))+'['+L+']*':esc(norm(t));
function compile(rule){const alts=(rule.words||[]).map(w=>w.trim().split(/\s+/).map(tokenSource).join('\\s+'));return alts.length?new RegExp('(?<!['+L+'])(?:'+alts.join('|')+')(?!['+L+'])','g'):null;}
const compiled=RULES.map(rule=>({rule,re:compile(rule)}));
export const sentences=text=>[...text.matchAll(/[^.!?…]+(?:[.!?…]+|$)/g)].map(m=>({start:m.index,end:m.index+m[0].length,text:m[0]})).filter(s=>s.text.trim());
const wordCount=s=>(s.match(new RegExp('['+L+'0-9]+(?:-['+L+']+)*','g'))||[]).length;
const trimmed=(s,offset=0)=>{const lead=s.text.length-s.text.trimStart().length;return {start:s.start+offset+lead,end:s.start+offset+s.text.trimEnd().length};};
const BUILTIN={
 'long-sentence':{category:'length',message:'Длинное предложение: в нём легко потеряться.',fix:'Разделите на два-три предложения, по одной мысли в каждом.'},
 'long-paragraph':{category:'length',message:'Длинный абзац тяжело читать, особенно с телефона.',fix:'Разбейте абзац по мыслям: одна мысль — один абзац.'},
 'kotory-twice':{category:'kotory',message:'Несколько «который» в одном предложении запутывают.',fix:'Вынесите одну из частей в отдельное предложение или замените причастием.'},
 'passive-was':{category:'passive',message:'Страдательный залог прячет того, кто действует.',fix:'Назовите действующее лицо: не «было принято решение», а «мы решили».'},
 'nominal-chain':{category:'nominalization',message:'Цепочка отглагольных существительных звучит казённо.',fix:'Превратите одно из слов в глагол: не «проведение проверки», а «проверили».'},
 'word-repeat':{category:'repetition',message:'Одно и то же слово повторяется в абзаце.',fix:'Уберите лишние повторы или замените местоимением.'},
 'title-too-long':{category:'structure',message:'Длинный заголовок трудно охватить взглядом.',fix:'Сократите до одной мысли, примерно до 70 знаков.'},
 'first-paragraph-long':{category:'structure',message:'Длинный первый абзац: читатель может уйти, не дойдя до главного.',fix:'Начните с главной мысли в двух-трёх предложениях, подробности перенесите ниже.'},
 'no-headings':{category:'structure',message:'Длинный текст без подзаголовков: в нём трудно ориентироваться.',fix:'Разбейте текст на части с подзаголовками по смыслу.'},
 'thin-section':{category:'structure',message:'Под подзаголовком почти нет текста.',fix:'Допишите раздел или объедините его с соседним.'},
 'ya-start':{category:'structure',message:'Много предложений начинаются с «Я»: текст звучит как рассказ о себе.',fix:'Начните часть предложений с того, что важно читателю: с дела, факта, результата.'},
 'question-run':{category:'syntax',message:'Вопросы подряд выглядят как приём, а не как мысль.',fix:'Оставьте один вопрос или замените вопросы утверждением.'},
};
const PASSIVE=new RegExp('(?<!['+L+'])(?:был|была|было|были|будет|будут)\\s+['+L+']+(?:ан|ян|ен|ён|т)(?:а|о|ы)?(?!['+L+'])','gi');
const NOMINAL=new RegExp('(?:(?<!['+L+'])['+L+']+(?:ние|ния|нию|нием|нии|ость|ости|остью|ция|ции|цию|цией)(?!['+L+'])\\s+){2,}['+L+']+(?:ние|ния|нию|нием|нии|ость|ости|остью|ция|ции|цию|цией)(?!['+L+'])','gi');
const REPEAT_SKIP=new Set(['который','которая','которое','которые','которых','которым','потому','только','сейчас','больше','меньше','просто','сделать','делать','чтобы','когда','после','через','between','about']);
// blocks: [{text, kind:'p'|'li'|'h', tag?:'H1'|'H2'…}] → issues: [{block,start,end,id,category,label,message,fix}]
export function checkStyle(blocks,{maxSentenceWords=25,maxParagraphWords=120}={}){
 const issues=[],add=(block,start,end,id,rule)=>issues.push({block,start,end,id,category:rule.category,label:CATEGORIES[rule.category]||rule.category,message:rule.message,fix:rule.fix});
 blocks.forEach((b,i)=>{
  const text=b.text,low=norm(text),list=sentences(text);
  for(const {rule,re} of compiled){if(!re)continue;re.lastIndex=0;for(const m of low.matchAll(re)){if(rule.start&&!list.some(s=>s.start<=m.index&&low.slice(s.start,m.index).trim()===''))continue;add(i,m.index,m.index+m[0].length,rule.id,rule);}}
  if(b.kind==='h')return;
  for(let n=1;n<list.length;n++)if(/\?\s*$/.test(list[n].text)&&/\?\s*$/.test(list[n-1].text)){const r=trimmed(list[n]);add(i,r.start,r.end,'question-run',BUILTIN['question-run']);}
  for(const s of list){
   if(wordCount(s.text)>maxSentenceWords){const r=trimmed(s);add(i,r.start,r.end,'long-sentence',BUILTIN['long-sentence']);}
   const k=[...norm(s.text).matchAll(new RegExp('(?<!['+L+'])котор['+L+']*','g'))];if(k.length>=2)add(i,s.start+k[1].index,s.start+k[1].index+k[1][0].length,'kotory-twice',BUILTIN['kotory-twice']);
  }
  for(const m of text.matchAll(PASSIVE))add(i,m.index,m.index+m[0].length,'passive-was',BUILTIN['passive-was']);
  for(const m of text.matchAll(NOMINAL))add(i,m.index,m.index+m[0].trimEnd().length,'nominal-chain',BUILTIN['nominal-chain']);
  if(b.kind==='p'&&wordCount(text)>maxParagraphWords)add(i,0,Math.min(text.length,60),'long-paragraph',BUILTIN['long-paragraph']);
  if(b.kind==='p'){const seen=new Map();for(const m of low.matchAll(new RegExp('['+L+']{7,}','g'))){if(REPEAT_SKIP.has(m[0]))continue;const stem=m[0].slice(0,5),list2=seen.get(stem)||[];list2.push(m);seen.set(stem,list2);}for(const ms of seen.values())if(ms.length>=3)for(const m of ms.slice(2))add(i,m.index,m.index+m[0].length,'word-repeat',BUILTIN['word-repeat']);}
 });
 // Whole-text checks: title, first paragraph, headings, sentences that start with «Я».
 blocks.forEach((b,i)=>{if(b.tag==='H1'&&b.text.trim().length>70)add(i,0,b.text.length,'title-too-long',BUILTIN['title-too-long']);});
 const paras=blocks.map((b,i)=>({b,i})).filter(x=>x.b.kind==='p'),first=paras[0];
 if(first&&first.b.text.length>500)add(first.i,0,Math.min(first.b.text.length,60),'first-paragraph-long',BUILTIN['first-paragraph-long']);
 const total=blocks.reduce((n,b)=>n+(b.kind==='h'?0:wordCount(b.text)),0);
 if(first&&total>1500&&!blocks.some(b=>b.tag==='H2'||b.tag==='H3'))add(first.i,0,Math.min(first.b.text.length,60),'no-headings',BUILTIN['no-headings']);
 blocks.forEach((b,i)=>{if(b.kind!=='h'||b.tag==='H1')return;let j=i+1,size=0;while(j<blocks.length&&blocks[j].kind!=='h'){size+=blocks[j].text.trim().length;j++;}if(size<150)add(i,0,b.text.length,'thin-section',BUILTIN['thin-section']);});
 const starts=[];blocks.forEach((b,i)=>{if(b.kind!=='h')for(const s of sentences(b.text)){const r=trimmed(s);starts.push({i,start:r.start,ya:/^Я(?![A-Za-zА-Яа-яЁё])/.test(b.text.slice(r.start))});}});
 if(starts.length>=10&&starts.filter(s=>s.ya).length/starts.length>0.15)for(const s of starts.filter(s=>s.ya))add(s.i,s.start,s.start+1,'ya-start',BUILTIN['ya-start']);
 return issues.sort((a,b)=>a.block-b.block||a.start-b.start);
}
