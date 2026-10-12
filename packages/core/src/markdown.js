// Markdown helpers for editors and the command line:
// Markdown source → plain blocks for the checkers, and all hints merged back onto source offsets.
const L='A-Za-zА-Яа-яЁё';

// One line of Markdown → text the checkers see, with every character mapped back to its offset in the source.
function inline(line,base,from,kind){
 let text='';const map=[],put=(c,at)=>{text+=c;map.push(at);};
 for(let i=from;i<line.length;i++){
  const c=line[i],rest=line.slice(i);let m;
  if(c==='\\'&&i+1<line.length){i++;put(line[i],base+i);continue;}
  if(c==='`'&&line.indexOf('`',i+1)>i){put(' ',base+i);i=line.indexOf('`',i+1);continue;}
  if(c==='!'&&(m=/^!\[[^\]]*\]\([^)]*\)/.exec(rest))){put(' ',base+i);i+=m[0].length-1;continue;}
  if(c===']'&&(m=/^\]\([^)]*\)/.exec(rest))){i+=m[0].length-1;continue;}
  if(c==='<'&&(m=/^<\/?[a-z][^>]*>/i.exec(rest))){i+=m[0].length-1;continue;}
  if(c==='['||c==='*'||c==='_'&&!(/[\p{L}\d]/u.test(line[i-1]||'')&&/[\p{L}\d]/u.test(line[i+1]||'')))continue;
  put(c,base+i);
 }
 return {text,map,kind};
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
  if(cur){cur.text+=' '+part.text;cur.map.push(start-1,...part.map);}else cur=part;
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
