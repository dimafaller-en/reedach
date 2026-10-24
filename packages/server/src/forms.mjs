// The first variant of a hint in the found word's form (moved from the Yokey keyboard, forms.js): the core gives
// these hints as an advice — variants in the dictionary form («оказываем содействие» → «Сказать проще: помогать») or
// variants that are phrases («скриншоты» → «снимок экрана»). Here the variant takes the found word's form on the same
// morphology as inflectReplacements: «помогаем», «снимки экрана». It goes to `replace` of a hint that has none.
const L='A-Za-zА-Яа-яЁё';
const norm=s=>s.toLowerCase().replace(/ё/g,'е');
const FAMILY={INFN:'verb',VERB:'verb',ADJF:'adj',NOUN:'noun'};
// [rule, key, variants, flags]. The key as in the rules: words, * for any ending. Of the variants the first of the found
// word's part of speech (and aspect, for a verb) is taken; $2 is the second word found, as written. Flags: gent - a
// word in the genitive after the fragment depends on its noun and would need another case after the verb («производим
// оплату заказа» is not «оплачиваем заказа»): no variant then; w2 - the form is the second word's; fixed - the variant
// as it is, for the found form written in the key (words the dictionary does not know). A noun in the singular is
// replaced only by one of its gender: the predicate and the adjectives around agree with it («коллаба удалась» is not
// «совместный проект удалась»), so «коллаба», «коллаборация» stay an advice.
// The phrases of bureaucratese-turns come as weak-verb-noun too (the server's hint replaces the dictionary's there).
const FORMS=[
 ['bureaucratese-turns','надлежащ*',['правильный']],
 ['bureaucratese-turns','приобре*',['купить','покупать','покупка']],
 ['bureaucratese-turns','реализ* продукци*',['продать','продавать'],'gent'],
 ['bureaucratese-turns','реализац* товар*',['продажа $2']],
 ['bureaucratese-turns','производ* оплат*',['оплатить','оплачивать'],'gent'],
 ['bureaucratese-turns','производ* замер*',['замерить','замерять'],'gent'],
 ['bureaucratese-turns','производ* расчет*',['рассчитать','рассчитывать'],'gent'],
 ['bureaucratese-turns','оказыва* содействие',['помогать']],
 ['bureaucratese-turns','оказыва* влияние',['влиять']],
 ['bureaucratese-turns','предоставля* возможность',['позволять'],'gent'],
 ['bureaucratese-turns','предоставля* скидк*',['давать $2']],
 ['bureaucratese-turns','довод* до сведения',['сообщать'],'gent'],
 ['bureaucratese-turns','информиру* вас',['сообщать']],
 ['bureaucratese-turns','ввод* в эксплуатацию',['запуск','запустить','запускать']],
 ['stamp-newspaper-idioms','финальн* аккорд*',['финал'],'w2'],
 ['stamp-newspaper-idioms','тернист* пут*',['трудный путь'],'w2'],
 ['bureaucratese-latinisms','синерги*',['совместная польза']],
 ['borrowing-business','контент-план*',['план публикаций']],
 ['borrowing-business','тимлид*',['руководитель группы']],
 ['borrowing-business','роадмап*',['дорожная карта']],
 ['borrowing-business','хард скилл*',['профессиональные навыки'],'w2'],
 ['borrowing-business','софт скилл*',['гибкие навыки'],'w2'],
 ['borrowing-business','багфикс*',['исправление ошибки']],
 ['borrowing-business','скриншот*',['снимок экрана']],
 ['borrowing-business','скрин',['снимок экрана']],
 ['borrowing-business','дашборд*',['панель показателей']],
 ['borrowing-business','вишлист*',['список желаний']],
 ['borrowing-business','онбординг*',['вхождение в должность']],
 ['borrowing-business','бэклог*',['список задач']],
 ['borrowing-business','скоуп*',['объем работ']],
 ['borrowing-business','стейкхолдер*',['заинтересованная сторона']],
 ['borrowing-business','чекпоинт*',['контрольная точка']],
 ['borrowing-business','хедхантинг*',['переманивание специалистов']],
 ['borrowing-business','хедхантер*',['охотник за кадрами']],
 ['borrowing-business','брейншторм*',['мозговой штурм']],
 ['borrowing-business','брейнсторм*',['мозговой штурм']],
 ['borrowing-business','лидген*',['привлечение клиентов']],
 ['borrowing-business','рефералк*',['приглашение друга']],
 ['borrowing-business','реферал*',['приглашенный пользователь']],
 ['borrowing-business','экшен-план*',['план действий']],
 ['borrowing-business','вейтлист*',['лист ожидания']],
 ['slang-register','мастхэв*',['обязательная вещь']],
 ['slang-register','коллаб',['совместный проект'],'fixed'],
 ['slang-register','коллабом',['совместным проектом'],'fixed'],
].map(([rule,key,variants,flag])=>({rule,key,variants,flag,re:new RegExp('^'+key.split(' ').map(t=>t.endsWith('*')?t.slice(0,-1)+'['+L+'-]*':t).join('\\s+')+'$')}));

const best=(Az,word)=>{try{return word.length<=40?Az.Morph(word).filter(p=>p.parser==='Dictionary'||p.parser==='PrefixKnown'):[];}catch{return [];}};
const want=(tag,keys)=>keys.map(k=>tag[k]).filter(Boolean);

// The variant [v] in the form of [p] (a parse of the found word): its first word of p's family is inflected, the
// adjectives before it (a noun's) agree with it, the rest stays. null: it does not fit or does not inflect.
function inflected(Az,p,v){
 const fam=FAMILY[p.tag.POS],words=v.split(' ');
 for(let h=0;h<words.length;h++){
  // «покупать» is a perfective too («покупать детей»): the parse of the found word's aspect first
  const ts=best(Az,words[h]).filter(x=>FAMILY[x.tag.POS]===fam),t=ts.find(x=>x.tag.ASpc===p.tag.ASpc)||ts[0];if(!t)continue;
  if(fam==='verb'&&p.tag.ASpc&&t.tag.ASpc&&p.tag.ASpc!==t.tag.ASpc)return null;
  let head;
  if(p.tag.POS==='INFN')head=t.normalize()?.word;
  else if(fam==='verb')head=t.inflect([...want(p.tag,['NMbr','TEns','PErs','GNdr','MOod','INvl']),'VERB'])?.word;
  else if(fam==='adj')head=t.inflect(want(p.tag,['NMbr','CAse','GNdr','ANim']))?.word;
  else head=(t.inflect(want(p.tag,['NMbr','CAse']))||t.inflect(want(p.tag,['CAse'])))?.word;
  if(fam==='noun'&&p.tag.NMbr!=='plur'&&p.tag.GNdr&&t.tag.GNdr&&p.tag.GNdr!==t.tag.GNdr)return null;
  // the accusative of another animacy is another form («увидели стейкхолдеров» is not «заинтересованных сторон»)
  if(fam==='noun'&&(p.tag.CAse==='accs'||p.tag.CAse==='gent')&&p.tag.ANim&&t.tag.ANim&&p.tag.ANim!==t.tag.ANim)return null;
  if(!head)return null;
  const out=words.slice();out[h]=head;
  if(fam==='noun'){
   const ht=best(Az,head).find(x=>x.tag.POS==='NOUN')?.tag||t.tag;
   for(let a=0;a<h;a++){
    const at=best(Az,words[a]).find(x=>x.tag.POS==='ADJF');if(!at)return null;
    const g=[ht.NMbr||p.tag.NMbr,p.tag.CAse];if(ht.NMbr!=='plur'&&t.tag.GNdr)g.push(t.tag.GNdr);if(p.tag.CAse==='accs'&&t.tag.ANim)g.push(t.tag.ANim);
    const f=at.inflect(g.filter(Boolean))?.word;if(!f)return null;out[a]=f;
   }
  }
  return out.join(' ');
 }
 return null;
}

const GENITIVE=new Set(['NOUN','ADJF','PRTF','NPRO','NUMR']);
const PARTICLES=new Set(['только','именно','лишь','даже','еще','уже','всего','ровно','почти','как','хотя','бы']);
// the first word after the fragment but particles and adverbs («только одного выбора», «именно этого заказа»)
function genitiveAfter(Az,text,end){
 const re=new RegExp('^\\s+(['+L+']+)');
 for(let rest=text.slice(end),m;(m=re.exec(rest));rest=rest.slice(m[0].length)){
  const w=m[1].toLowerCase(),ps=best(Az,w);
  if(PARTICLES.has(w)||ps.length&&ps.every(p=>p.tag.POS==='PRCL'||p.tag.POS==='ADVB'||p.tag.POS==='CONJ'))continue;
  return ps.some(p=>GENITIVE.has(p.tag.POS)&&(p.tag.CAse==='gent'||p.tag.CAse==='gen2'));
 }
 return false;
}

// The gender of a noun the dictionary does not know, by its ending (borrowings: «дашборд», «рефералка»).
const guessed=w=>/[ая]$/.test(w)?'femn':/[оеи]$/.test(w)?'neut':'masc';
const headGender=(Az,v)=>{for(const w of v.split(' ')){const t=best(Az,w).find(x=>x.tag.POS==='NOUN');if(t)return t.tag.GNdr;}return null;};

// issues (block offsets) and their blocks; Az: Az.js initialized (morph.mjs) or the keyboard's AOT shim.
// as the core's ready edits: the fragment maps onto the source one to one, no Markdown or gap (a line break, code) inside
const plain=(b,s,e)=>(!b.map||b.map[e-1]-b.map[s]===e-1-s)&&!(b.gaps||[]).some(j=>j>=s&&j<e)&&!b.text.slice(s,e).includes('\n');
// w2: the parses of the noun that agree with the adjective before it («тернистые пути» is the plural, not «пути» of
// the singular), all of them when none does
function agreeing(Az,parses,adjective){
 const adj=best(Az,adjective).filter(x=>x.tag.POS==='ADJF'),fit=parses.filter(p=>adj.some(a=>a.tag.CAse===p.tag.CAse&&a.tag.NMbr===p.tag.NMbr));
 return fit.length?fit:parses;
}
export const formWanted=it=>!it.replace&&!it.edit&&(it.id==='weak-verb-noun'||FORMS.some(f=>f.rule===it.id));
export function formReplacements(issues,blocks,Az){
 for(const it of issues.filter(formWanted)){
  const b=blocks[it.block],text=b?.text;if(typeof text!=='string'||!plain(b,it.start,it.end))continue;
  const found=text.slice(it.start,it.end),words=found.split(/\s+/),low=norm(found).split(/\s+/).join(' ');
  const f=FORMS.find(x=>(x.rule===it.id||it.id==='weak-verb-noun'&&x.rule==='bureaucratese-turns')&&x.re.test(low));if(!f)continue;
  if(f.flag==='gent'&&genitiveAfter(Az,text,it.end))continue;
  const variants=f.variants.map(v=>v.replace(/\$(\d)/g,(_,n)=>words[n-1]||''));
  if(f.flag==='fixed'){it.replace=[variants[0]];continue;}
  const carrier=norm(words[f.flag==='w2'?1:0]||'');
  let form=null;
  const parses=f.flag==='w2'?agreeing(Az,best(Az,carrier),norm(words[0])):best(Az,carrier);
  for(const p of parses){
   if(!FAMILY[p.tag.POS])continue;
   for(const v of variants)if((form=inflected(Az,p,v)))break;
   if(form)break;
  }
  // a word the dictionary does not know, written as in the key: the variant as it is (its dictionary form)
  if(!form&&!best(Az,carrier).length&&!/\s/.test(f.key)&&carrier===f.key.replace('*','')&&headGender(Az,variants[0])===guessed(carrier))
   form=variants[0];
  if(form)it.replace=[form];
 }
 return issues;
}
