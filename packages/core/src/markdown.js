// Markdown helpers for editors and the command line:
// Markdown source → plain blocks for the checkers, and all hints merged back onto source offsets.
const L='A-Za-zА-Яа-яЁё';

// Link or image target "(…)" starting at p → index of its closing ")", or -1; one level of inner
// parentheses is allowed: "(a_(b))". A scan gives the same answer to every position it passed outside
// inner parentheses, so the answers are kept and a line full of unclosed "](" stays linear.
function closing(line,p,memo){
 if(line[p]!=='(')return -1;
 const passed=[];let depth=0,end=-1;
 for(let k=p+1;k<line.length;k++){
  if(!depth){if(memo.has(k)){end=memo.get(k);break;}passed.push(k);}
  const c=line[k];
  if(c==='('){if(depth)break;depth=1;}
  else if(c===')'){if(!depth){end=k;break;}depth=0;}
 }
 for(const k of passed)memo.set(k,end);
 return end;
}
// One line of Markdown → text the checkers see, with every character mapped back to its offset in the source.
// The next ">" and "]" are looked up once and reused: unclosed "<a" or "![" must not rescan the rest of the line.
function inline(line,base,from,kind){
 let text='',gt=-1,bracket=-1,end;const map=[],gaps=[],memo=new Map(),put=(c,at)=>{text+=c;map.push(at);};
 const next=(ch,i,last)=>{if(last>=i)return last;const k=line.indexOf(ch,i);return k<0?Infinity:k;};
 for(let i=from;i<line.length;i++){
  const c=line[i];
  if(c==='\\'&&i+1<line.length){i++;put(line[i],base+i);continue;}
  if(c==='`'&&line.indexOf('`',i+1)>i){gaps.push(text.length);put(' ',base+i);i=line.indexOf('`',i+1);continue;}
  if(c==='!'&&line[i+1]==='['&&(bracket=next(']',i+2,bracket))<Infinity&&(end=closing(line,bracket+1,memo))>=0){gaps.push(text.length);put(' ',base+i);i=end;continue;}
  if(c===']'&&(end=closing(line,i+1,memo))>=0){i=end;continue;}
  if(c==='<'&&/^<\/?[a-z]/i.test(line.slice(i,i+3))&&(gt=next('>',i,gt))<Infinity){i=gt;continue;}
  if(c==='['||c==='*'||c==='_'&&!(/[\p{L}\d]/u.test(line[i-1]||'')&&/[\p{L}\d]/u.test(line[i+1]||'')))continue;
  put(c,base+i);
 }
 return {text,map,kind,gaps};
}
// Markdown source → paragraphs, list items and headings; code, images, galleries and tables are left alone.
export function sourceBlocks(src){
 const blocks=[];let cur=null,fence=false,pos=0;
 const flush=()=>{if(cur&&cur.text.trim())blocks.push(cur);cur=null;};
 for(const line of src.split('\n')){
  const start=pos;pos+=line.length+1;let m;
  if(/^\s*(?:```|~~~)/.test(line)){flush();fence=!fence;continue;}
  if(fence)continue;
  if(!line.trim()||/^\s*(?::::|\|)/.test(line)||/^\s*!\[[^\]]*\]\([^)]*\)\s*$/.test(line)||/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)){flush();continue;}
  const quote=/^\s{0,3}(?:>\s?)+/.exec(line)?.[0].length||0;
  if((m=/^\s{0,3}#{1,6}\s+/.exec(line))){flush();const b=inline(line,start,m[0].length,'h');if(b.text.trim())blocks.push(b);continue;}
  if((m=/^\s*(?:[-*+]|\d+[.)])\s+/.exec(line.slice(quote)))){flush();cur=inline(line,start,quote+m[0].length,'li');continue;}
  const part=inline(line,start,quote,'p');
  // No push(...list): a line of 100k+ characters would overflow the call stack.
  if(cur){const at=cur.text.length+1;cur.gaps.push(at-1);for(const g of part.gaps)cur.gaps.push(g+at);cur.text+=' '+part.text;cur.map.push(start-1);for(const k of part.map)cur.map.push(k);}else cur=part;
 }
 flush();return blocks;
}
function spellingIssues(blocks,spelling){
 const issues=[];
 for(const item of spelling){const re=new RegExp('(?<!['+L+'])'+item.word.replace(/[-]/g,'\\-')+'(?!['+L+'])','g');
  blocks.forEach((b,i)=>{for(const m of b.text.matchAll(re))issues.push({block:i,start:m.index,end:m.index+m[0].length,id:'spelling',category:'spelling',label:'Орфография',message:'Возможна опечатка: «'+item.word+'».',fix:item.suggestions?.length?'Варианты: '+item.suggestions.join(', ')+'.':'Проверьте написание или добавьте слово в словарь.',word:item.word,suggestions:item.suggestions??null});});}
 return issues;
}
// spelling: hunspell misses from the server; style: server (morphology) hints by block; local: dictionary hints by block.
// Returns hints with start/end in the Markdown source, sorted by position.
export function mergeIssues(blocks,{spelling=[],style=[],local=[]}){
 // A server genitive chain replaces the rough suffix-based one, a weak verb + noun hint replaces the dictionary hit
 // on the same verb, a server repeat replaces a local one on the same word.
 const overlaps=(x,it)=>x.block===it.block&&x.start<it.end&&it.start<x.end;
 const kept=local.filter(it=>!(it.id==='nominal-chain'&&style.some(x=>x.id==='genitive-chain'&&overlaps(x,it)))&&!style.some(x=>(x.id==='weak-verb-noun'||x.category===it.category&&it.category==='repetition')&&overlaps(x,it)&&x.start<=it.start&&it.end<=x.end));
 const found=[...spellingIssues(blocks,spelling),...kept,...style.filter(it=>blocks[it.block]&&it.start<it.end&&it.end<=blocks[it.block].text.length)];
 return found.map(it=>{const b=blocks[it.block];return {...it,start:b.map[it.start],end:b.map[it.end-1]+1};}).sort((a,b)=>a.start-b.start||b.end-a.end);
}
// Plain text → paragraphs split by blank lines; every UTF-16 unit keeps its own offset (emoji take two).
export function textBlocks(text){
 const blocks=[];
 for(const m of String(text).matchAll(/[^\n]+(?:\n(?!\s*\n)[^\n]*)*/g)){const t=m[0].replace(/\n/g," ");if(t.trim())blocks.push({text:t,kind:"p",gaps:[...m[0].matchAll(/\n/g)].map(x=>x.index),map:Array.from({length:t.length},(_,i)=>m.index+i)});}
 return blocks;
}
