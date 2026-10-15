// Style hints by dictionary and simple rules. Runs in the browser and in Node; the rules are our own word lists.
import {RULES,CATEGORIES} from './rules.js';
const L='A-Za-zА-Яа-яЁё';
const norm=s=>s.toLowerCase().replace(/ё/g,'е');
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
// "осуществл*" matches any ending; spaces between words may be any whitespace.
const tokenSource=t=>t.endsWith('*')?esc(norm(t.slice(0,-1)))+'['+L+']*':esc(norm(t));
function compile(rule){if(rule.pattern)return new RegExp(rule.pattern,'g');const alts=(rule.words||[]).map(w=>w.trim().split(/\s+/).map(tokenSource).join('\\s+'));return alts.length?new RegExp('(?<!['+L+'])(?:'+alts.join('|')+')(?!['+L+'])','g'):null;}
// Paronyms: [forms, neighbours, where the neighbour stands (после, до, любой), right word, note]. Only the wrong
// word is marked, and only next to a neighbour that makes the mistake certain: «одеть пальто», not «одеть ребёнка».
const alt=list=>'(?:'+list.split('|').map(w=>w.trim().split(/\s+/).map(tokenSource).join('\\s+')).join('|')+')';
function pairRule(rule,[forms,near,where,right,note]){
 const f='(?<!['+L+'])'+alt(forms)+'(?!['+L+'])',n=alt(near),after=f+'(?=\\s+'+n+'(?!['+L+']))',before='(?<=(?<!['+L+'])'+n+'\\s+)'+f;
 const words=/^[а-яё]+(?:,\s*[а-яё]+)*$/i.test(right)?right.split(/,\s*/):null;
 return {rule:{...rule,pairs:undefined,fix:'Правильно: '+right+'. '+note,...(words&&{variants:words})},re:new RegExp(where==='до'?before:where==='любой'?after+'|'+before:after,'g')};
}
const compiled=RULES.flatMap(rule=>rule.pairs?rule.pairs.map(p=>pairRule(rule,p)):[{rule,re:compile(rule)}]);
// A rule with swap gives the replacement for the exact word found; the longest matching key wins. A key is a stem
// («релевантн») or a pattern like the rule's words («памятн* сувенир*»).
// hints hold advice for words with no drop-in replacement («в рамках проекта» is not «в проекта»).
// replace lists the variants a click can insert: one-word ones (the server puts them in the found word's form),
// or every variant when the rule is exact (a fixed form, nothing to inflect). Nothing changes without a click.
// $1, $2 in a variant stand for the words found, as written: «памятные сувениры» → «$2» → «сувениры».
const keyRe=new Map();
const fits=(k,word)=>{if(!/[*\s]/.test(k))return word.startsWith(k);let re=keyRe.get(k);if(!re)keyRe.set(k,re=new RegExp('^'+k.split(/\s+/).map(tokenSource).join('\\s+')+'(?!['+L+'])'));return re.test(word);};
const longest=(map,word)=>map&&Object.keys(map).filter(k=>fits(k,word)).sort((a,b)=>b.length-a.length)[0];
const swapped=(rule,word,found=word)=>{
 const k=longest(rule.swap,word),h=longest(rule.hints,word);
 if(h&&(!k||h.length>k.length))return {...rule,fix:rule.hints[h]};
 if(!k)return rule;
 const parts=found.split(/\s+/),all=rule.swap[k].split(/,\s*/).filter(Boolean).map(w=>w.replace(/\$(\d)/g,(_,n)=>parts[n-1]||''));
 const fix=(rule.exact?'Заменить: ':'Заменить обычным словом: ')+all.join(', ')+'.';
 if(rule.exact)return {...rule,fix,replace:[...new Set(all)],exact:true};
 const variants=[...new Set(all.filter(w=>!/\s/.test(w)))];
 return {...rule,fix,...(variants.length&&{variants,key:k})};
};
// variants are dictionary forms. The server puts them in the found word's form; without it a click inserts them as
// written, so they become buttons only where the found word is a dictionary form of the same kind too:
// «осуществлять → делать», but not «осуществляет → делать».
const INF=/(?:ть|ти|чь)(?:ся|сь)?$/,ADJ=/(?:ый|ий|ой)$/,NOUN=/(?:ия|ие|ость)$/;
const asIs=(found,key,v)=>{const w=norm(found).split(/[\s-]+/).pop();if(key&&w===key)return true;if(INF.test(w))return INF.test(v);if(ADJ.test(w))return ADJ.test(v);if(NOUN.test(w))return !INF.test(v)&&!ADJ.test(v);return false;};
const offered=(r,found)=>{if(!r.variants)return r;const {key,...rest}=r,replace=r.variants.filter(v=>asIs(found,key,v));return replace.length?{...rest,replace}:rest;};
export const sentences=text=>[...text.matchAll(/[^.!?…]+(?:[.!?…]+|$)/g)].map(m=>({start:m.index,end:m.index+m[0].length,text:m[0]})).filter(s=>s.text.trim());
const wordCount=s=>(s.match(new RegExp('['+L+'0-9]+(?:-['+L+']+)*','g'))||[]).length;
const trimmed=(s,offset=0)=>{const lead=s.text.length-s.text.trimStart().length;return {start:s.start+offset+lead,end:s.start+offset+s.text.trimEnd().length};};
export const BUILTIN={
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
 'word-double':{category:'repetition',message:'Слово стоит два раза подряд.',fix:'Уберите лишнее слово.'},
 'typo-double-space':{category:'typography',message:'Два пробела подряд.',fix:'Оставьте один пробел.'},
 'typo-space-before':{category:'typography',message:'Лишний пробел перед знаком препинания или внутри скобок и кавычек.',fix:'Уберите пробел: «двери, окна», «(окна)».'},
 'typo-space-after':{category:'typography',message:'После запятой или точки с запятой нет пробела.',fix:'Поставьте пробел после знака.'},
 'typo-quotes':{category:'typography',message:'Прямые кавычки в русском тексте выглядят как набор с клавиатуры.',fix:'Поставьте ёлочки: «Стандарт», а внутри других кавычек — „лапки“.'},
 'typo-unpaired':{category:'typography',message:'У скобки или кавычки нет пары.',fix:'Закройте скобку или кавычку либо уберите лишнюю.'},
 'typo-dash':{category:'typography',message:'Дефис вместо тире.',fix:'Между словами — длинное тире с пробелами: «Москва — столица». Между числами — короткое без пробелов: «5–10».'},
 'typo-repeat-punct':{category:'typography',message:'Знак препинания повторяется.',fix:'Оставьте один знак. Можно только «?!», «?..», «!..» и многоточие.'},
 'typo-initials':{category:'typography',message:'Инициалы слиплись.',fix:'Разделите пробелом: «И. И. Иванов».'},
 'typo-range-dash':{category:'typography',message:'Дефис в диапазоне.',fix:'Между числами, годами, временем и днями — короткое тире без пробелов: «10:00–18:00», «пн–пт», «5–10 мм».'},
 'typo-dash-glued':{category:'typography',message:'Тире прилипло к слову с одной стороны.',fix:'Поставьте пробелы с обеих сторон: «Москва — столица».'},
 'typo-ellipsis':{category:'typography',message:'Три точки вместо многоточия.',fix:'Поставьте знак многоточия: «…».'},
 'typo-abbr-space':{category:'typography',message:'Нет пробела после сокращения.',fix:'Отделите пробелом: «г. Москва», «ул. Ленина», «см. рис. 3».'},
 'typo-abbr-inner':{category:'typography',message:'Сокращение без пробела внутри.',fix:'Пишите с пробелом: «т. е.», «и т. д.», «т. к.».'},
 'typo-year-glued':{category:'typography',message:'Год слипся со словом «год» или «г.».',fix:'Отделите пробелом: «2024 г.», «в 2024 году».'},
 'typo-currency-glued':{category:'typography',message:'Сумма слиплась со знаком валюты.',fix:'Отделите пробелом: «1500 ₽», «1500 руб.».'},
 'typo-power':{category:'typography',message:'Степень записана цифрой.',fix:'Поставьте знак степени: «м²», «м³».'},
 'typo-ordinal':{category:'typography',message:'Лишние буквы в окончании порядкового числительного.',fix:'Пишите коротко: «25-й», «1-я», «5-е», «в 3-м».'},
 'typo-number-sign':{category:'typography',message:'Знак номера вплотную к числу.',fix:'Отделите пробелом: «№ 5».'},
 'typo-copyright':{category:'typography',message:'Знак набран буквами в скобках.',fix:'Поставьте сам знак: ©, ™, ®.'},
 'typo-mixed-script':{category:'typography',message:'В слове смешаны русские и латинские буквы: так бывает после копирования. Поиск и проверка орфографии такое слово не узнают.',fix:'Наберите слово заново на одной раскладке.'},
};
// Typography: [id, pattern, fix?]; fix(match) gives the text a click puts in its place. A match must not span removed markup or a joined line break (see plain below).
const TYPO=[
 ['typo-double-space',/(?<=\S) {2,}(?=\S)/g],
 ['typo-space-before',/(?<=\S) +(?=[,;](?![-()DPp])|\)|»(?!\s|$)|[.!?](?=\s|$))|(?<=[^\s\d]) +(?=:(?=\s|$))|(?<=[(«]) +(?=\S)/g],
 ['typo-space-after',/,(?=[A-Za-zА-Яа-яЁё])|;(?![DPp](?![A-Za-zА-Яа-яЁё]))(?=[A-Za-zА-Яа-яЁё])/g],
 ['typo-dash',/(?<=\S) --? (?=\S)/g],
 ['typo-repeat-punct',/[!?]{3,}|!!|\?\?|,{2,}|;{2,}|(?<![.?!])\.\.(?!\.)|\.{4,}/g],
 // «И.И. Иванов», «Иванов И.И.», «А.Пушкин»; «Ф.И.О.» and «до Н.Э.» are abbreviations, not initials.
 ['typo-initials',/(?<!\p{L})[А-ЯЁ]\.[А-ЯЁ]\.(?=\s?[А-ЯЁ][а-яё])|(?<=[А-ЯЁ][а-яё]+\s)[А-ЯЁ]\.[А-ЯЁ]\.(?!\p{L})|(?<![\p{L}.])[А-ЯЁ]\.(?=[А-ЯЁ][а-яё]{2,})/gu],
 // Ranges take an en dash: time, days of the week, years, numbers with a unit, days of a month, months, centuries.
 ['typo-range-dash',new RegExp(['(?:(?<![\\d:.])\\d{1,2}[:.]\\d{2})-(?:\\d{1,2}[:.]\\d{2}(?![\\d:.]))','(?:(?<![А-Яа-яЁё])(?:[Пп]н|[Вв]т|[Сс]р|[Чч]т|[Пп]т|[Сс]б|[Вв]с))-(?:(?:[Пп]н|[Вв]т|[Сс]р|[Чч]т|[Пп]т|[Сс]б|[Вв]с)(?![А-Яа-яЁё]))','(?:(?<![\\d.\\-/])(?:1[89]|20)\\d{2})-(?:(?:1[89]|20)\\d{2}(?![\\d\\-./]))','(?:(?<![\\d.,\\-/:])\\d+(?:[.,]\\d+)?)-(?:\\d+(?:[.,]\\d+)?\\s?(?:мм|см|м|км|кг|г|т|л|мл|%|₽|руб|шт|дн|дня|дней|час|часа|часов|мин|минут|лет|года|месяц|месяца|месяцев|недел|раз|человек)(?![А-Яа-яЁё]))','(?:(?<![\\d\\-.])\\d{1,2})-(?:\\d{1,2}\\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?![А-Яа-яЁё]))','(?:(?<![А-Яа-яЁё])(?:[Яя]нварь|[Фф]евраль|[Мм]арт|[Аа]прель|[Мм]ай|[Ии]юнь|[Ии]юль|[Аа]вгуст|[Сс]ентябрь|[Оо]ктябрь|[Нн]оябрь|[Дд]екабрь))-(?:(?:январь|февраль|март|апрель|май|июнь|июль|август|сентябрь|октябрь|ноябрь|декабрь)(?![А-Яа-яЁё]))','(?:(?<![A-Za-z])[IVXL]+)-(?:[IVXL]+\\s*(?:вв?\\.|век))'].join('|'),'g'),m=>m.replace('-','–')],
 ['typo-dash-glued',/(?<=[А-Яа-яЁё,]) —(?=[А-Яа-яЁё])|(?<=[А-Яа-яЁё])— (?=[А-Яа-яЁё])/g,()=>' — '],
 ['typo-ellipsis',/(?<![.…])\.\.\.(?![.…])/g,()=>'…'],
 ['typo-abbr-space',/(?<![А-Яа-яЁё.])(?:(?:г|ул|д|пр|пер|обл|кв|корп|стр|пос|рис|гл|им|тел)\.[А-ЯЁ0-9]|см\.[А-Яа-яЁё0-9])[А-Яа-яЁё0-9]*/g,m=>m.replace('.','. ')],
 ['typo-abbr-inner',/(?<![А-Яа-яЁё.])(?:т\.е|т\.д|т\.п|т\.к|т\.н|т\.ч|н\.э)\.(?!\s?[А-Яа-яЁё]\.)/g,m=>m.replace('.','. ')],
 ['typo-year-glued',/(?<!\d)(?:1[89]|20)\d{2}(?:гг?\.|год(?:а|у|ом)?(?![А-Яа-яЁё]))/g,m=>m.slice(0,4)+' '+m.slice(4)],
 ['typo-currency-glued',/(?<![\d.,])\d+(?:[.,]\d+)?(?:₽|руб\.|рубл[а-яё]*|руб(?![А-Яа-яЁё]))/g,m=>m.replace(/(?=₽|руб)/,' ')],
 ['typo-power',/(?<![А-Яа-яЁёA-Za-z\d])[кдсм]?м[23](?![\dА-Яа-яЁёA-Za-z])/g,m=>m.slice(0,-1)+(m.endsWith('2')?'²':'³')],
 ['typo-ordinal',/(?<=\d)-(?:ый|ий|ой|ей|ая|ое|ые|ых|их|ым|ом|ую|ого|ому|ыми|ими)(?![А-Яа-яЁё])/g,m=>'-'+{ый:'й',ий:'й',ой:'й',ей:'й',ая:'я',ое:'е',ые:'е',ых:'х',их:'х',ым:'м',ом:'м',ую:'ю',ого:'го',ому:'му',ыми:'ми',ими:'ми'}[m.slice(1)]],
 ['typo-number-sign',/№\d+/g,m=>'№ '+m.slice(1)],
 ['typo-copyright',/\([cс]\)(?=\s*\d)|\((?:tm|TM|r|R)\)/g,m=>({'(tm)':'™','(TM)':'™','(r)':'®','(R)':'®'})[m]||'©'],
];
// Mixed scripts are checked word by word: one pattern over the whole text backtracked for seconds on a long word.
const MIXED=/\p{Script=Cyrillic}\p{Script=Latin}|\p{Script=Latin}\p{Script=Cyrillic}/u;
// Addresses, e-mails and HTML entities are not prose: no typography hints inside them.
// Marked once per block (a looked-up word per hint made a long text with many hints quadratic).
const technical=text=>{const marks=new Uint8Array(text.length);for(const m of text.matchAll(/[^ ]+/g))if(/[/@&=]/.test(m[0]))marks.fill(1,m.index,m.index+m[0].length);return s=>marks[s]===1;};
// The last sentence starting at or before `at` (sentences are in order), by binary search.
const sentenceAt=(list,at)=>{let lo=0,hi=list.length-1,hit=null;while(lo<=hi){const mid=(lo+hi)>>1;if(list[mid].start<=at){hit=list[mid];lo=mid+1;}else hi=mid-1;}return hit;};
// Brackets and guillemets without a pair. Not brackets: «а)», «1)», «п. 2)», smileys «:)», «:-(», «:))»;
// a lone «»» or ««» between spaces is a navigation arrow.
function unpaired(text){
 const out=[],open=[];
 for(let k=0;k<text.length;k++){const c=text[k],before=text.slice(Math.max(0,k-6),k);
  if('()«»'.indexOf(c)<0)continue;
  if((c==='('||c===')')&&/[:;=]-?[()]*$/.test(before))continue;
  if((c==='«'||c==='»')&&/(?:^|\s)$/.test(before)&&/^(?:\s|$)/.test(text.slice(k+1)))continue;
  if(c==='('||c==='«'){open.push(k);continue;}
  const top=open.length?open[open.length-1]:-1;
  if(top>=0&&text[top]===(c===')'?'(':'«')){open.pop();continue;}
  if(c===')'&&/(?:^|\s)(?:\p{L}|\p{L}?\.?\s?[\d.]{1,4})$/u.test(before))continue;
  out.push(k);
 }
 return [...out,...open];
}
const DOUBLE_OK=new Set(['да','нет','ну','так','вот','ни','ха','хе','ой','ах','ох','эх','бла','тук','кап']);
const PASSIVE=new RegExp('(?<!['+L+'])(?:был|была|было|были|будет|будут)\\s+['+L+']+(?:ан|ян|ен|ён|т)(?:а|о|ы)?(?!['+L+'])','gi');
const NOMINAL=new RegExp('(?:(?<!['+L+'])['+L+']+(?:ние|ния|нию|нием|нии|ость|ости|остью|ция|ции|цию|цией)(?!['+L+'])\\s+){2,}['+L+']+(?:ние|ния|нию|нием|нии|ость|ости|остью|ция|ции|цию|цией)(?!['+L+'])','gi');
const REPEAT_SKIP=new Set(['который','которая','которое','которые','которых','которым','потому','только','сейчас','больше','меньше','просто','сделать','делать','чтобы','когда','после','через','between','about']);
// blocks: [{text, kind:'p'|'li'|'h', tag?:'H1'|'H2'…}] → issues: [{block,start,end,id,category,label,message,fix}]
export function checkStyle(blocks,{maxSentenceWords=25,maxParagraphWords=120}={}){
 const issues=[],add=(block,start,end,id,rule)=>issues.push({block,start,end,id,category:rule.category,label:CATEGORIES[rule.category]||rule.category,message:rule.message,fix:rule.fix,...(rule.replace&&{replace:rule.replace}),...(rule.exact&&{exact:true}),...(rule.variants&&{variants:rule.variants})});
 blocks.forEach((b,i)=>{
  const text=b.text,low=norm(text),list=sentences(text);
  // A start-only rule needs nothing but spaces between the sentence start and the match.
  for(const {rule,re} of compiled){if(!re)continue;re.lastIndex=0;for(const m of low.matchAll(re)){if(rule.start){const s=sentenceAt(list,m.index);if(!s||low.slice(s.start,m.index).trim()!=='')continue;}{const found=text.slice(m.index,m.index+m[0].length);add(i,m.index,m.index+m[0].length,rule.id,offered(swapped(rule,m[0],found),found));}}}
  // Blocks map every character to the source; gaps are spaces that stand for code, an image or a line break, not typos.
  // before[k] = gaps before offset k, so "a gap inside s..e" costs the same however many gaps the block has.
  const before=new Uint32Array(text.length+1);for(const j of b.gaps||[])if(j>=0&&j<text.length)before[j+1]++;for(let k=1;k<=text.length;k++)before[k]+=before[k-1];
  const gap=(s,e)=>before[e]-before[s]>0,plain=(s,e)=>(!b.map||b.map[e-1]-b.map[s]===e-1-s)&&!gap(s,e),tech=technical(text);
  for(const [id,re,fix] of TYPO)for(const m of text.matchAll(re))if(plain(m.index,m.index+m[0].length)&&!tech(m.index))add(i,m.index,m.index+m[0].length,id,fix?{...BUILTIN[id],replace:[fix(m[0])],exact:true}:BUILTIN[id]);
  for(const m of text.matchAll(/\p{L}+/gu))if(MIXED.test(m[0])&&plain(m.index,m.index+m[0].length)&&!tech(m.index))add(i,m.index,m.index+m[0].length,'typo-mixed-script',BUILTIN['typo-mixed-script']);
  for(const m of text.matchAll(/"[^"\n]*"/g))if(/[А-Яа-яЁё]/.test(m[0]))add(i,m.index,m.index+m[0].length,'typo-quotes',BUILTIN['typo-quotes']);
  for(const k of unpaired(text))add(i,k,k+1,'typo-unpaired',BUILTIN['typo-unpaired']);
  for(const m of low.matchAll(new RegExp('(?<!['+L+'])(['+L+']+)\\s+\\1(?![-'+L+'])','g')))if(!DOUBLE_OK.has(m[1])&&plain(m.index,m.index+m[0].length))add(i,m.index,m.index+m[0].length,'word-double',BUILTIN['word-double']);
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
