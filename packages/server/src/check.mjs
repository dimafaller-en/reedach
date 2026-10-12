import {checkStyle,sourceBlocks,textBlocks,mergeIssues,RULES,BUILTIN,CATEGORIES} from 'reedach';
import {morphCheck,MORPH_RULES} from './morph.mjs';
import {words,known,misspelled,Suggester} from './spell.mjs';
// One check = spelling (hunspell) + morphology (Az.js) + dictionary style hints (reedach core), merged into one list.
export const CHECKS=['spelling','morph','style'];
const LIMITS={blocks:5000,blockChars:20000,suggestWords:10,suggestBudget:3000};
const bad=message=>Object.assign(new Error(message),{status:422,code:'validation'});
let shared=null;
const suggester=()=>shared??=new Suggester();

// Blocks from the caller: every UTF-16 unit keeps its own offset (emoji take two).
const identity=b=>({text:b.text,kind:['h','li'].includes(b.kind)?b.kind:'p',map:Array.from({length:b.text.length},(_,i)=>i)});

// input: {markdown | text | blocks:[{text,kind}], ignore:[own words], disable:[rule ids or categories], checks:[...]}
// Markdown and text hints point into the source string; block hints carry `block` and point into that block's text.
// Options for running elsewhere: `suggester` and `misspelled` replace the hunspell calls (the HTTP server's workers ask its main thread).
export async function check(input,{suggester:sg=suggester(),misspelled:ms=misspelled,limits={}}={}){
 const lim={...LIMITS,...limits},{markdown,text,blocks:raw}=input??{};
 let blocks,blocksInput=false;
 if(typeof markdown==='string')blocks=sourceBlocks(markdown);
 else if(typeof text==='string')blocks=textBlocks(text);
 else if(Array.isArray(raw)){blocksInput=true;if(raw.length>lim.blocks)throw bad('Слишком много блоков');blocks=raw.map(b=>{if(typeof b?.text!=='string')throw bad('У каждого блока должен быть текст');if(b.text.length>lim.blockChars)throw bad('Слишком длинный блок');return identity(b);});}
 else throw bad('Передайте markdown, text или blocks');
 const list=(v,name)=>{if(v==null)return [];if(!Array.isArray(v)||v.some(x=>typeof x!=='string'))throw bad('Поле '+name+' должно быть списком строк');return v.slice(0,5000);};
 const ignore=list(input.ignore,'ignore'),disable=new Set(list(input.disable,'disable')),checks=new Set(input.checks==null?CHECKS:list(input.checks,'checks'));
 const [spelling,morph]=await Promise.all([
  checks.has('spelling')?findSpelling(blocks,ignore,sg,lim,ms):[],
  checks.has('morph')?morphCheck(blocks).catch(()=>[]):[],
 ]);
 const local=checks.has('style')?checkStyle(blocks):[];
 const issues=mergeIssues(blocks,{spelling,style:morph,local}).filter(it=>!disable.has(it.id)&&!disable.has(it.category));
 return {issues:blocksInput?issues.sort((a,b)=>a.block-b.block||a.start-b.start):issues.map(({block,...it})=>it)};
}

// Misspelled words minus own words; suggestions for the first few within a time budget, the rest get null (ask /v1/suggest).
async function findSpelling(blocks,ignore,sg,lim,ms){
 const found=(await ms(words(blocks.map(b=>b.text).join('\n')))).filter(w=>!known(w,ignore));
 const result=found.map(word=>({word,suggestions:null}));
 const deadline=new Promise(resolve=>setTimeout(resolve,lim.suggestBudget).unref());
 await Promise.race([deadline,Promise.all(result.slice(0,lim.suggestWords).map(item=>sg.suggest(item.word).then(s=>{item.suggestions=s;},()=>{})))]);
 return result.map(item=>({...item,suggestions:item.suggestions&&[...item.suggestions]}));
}

export async function suggest(list,{suggester:sg=suggester()}={}){
 if(!Array.isArray(list)||!list.length||list.length>20||list.some(w=>typeof w!=='string'))throw bad('Передайте от 1 до 20 слов');
 const out={};for(const w of list)out[w]=await sg.suggest(w).catch(e=>{if(e.code==='busy')throw e;return [];});
 return {suggestions:out};
}

// Rules for settings screens: id, category and the explanation, so a site can let authors switch checks off.
export function rules(){
 const pick=(id,r)=>({id,category:r.category,label:r.label||CATEGORIES[r.category]||r.category,message:r.message,fix:r.fix});
 return {categories:{...CATEGORIES,spelling:'Орфография'},rules:[...RULES.map(r=>pick(r.id,r)),...Object.entries(BUILTIN).map(([id,r])=>pick(id,r)),...Object.entries(MORPH_RULES).map(([id,r])=>pick(id,r))]};
}

// hunspell for the HTTP server's workers, run in the main thread.
export const spellHost={misspelled:list=>misspelled(list),suggest:word=>suggester().suggest(word)};

export function closeChecks(){shared?.close();shared=null;}
