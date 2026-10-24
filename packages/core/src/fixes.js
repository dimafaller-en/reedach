// Ready edits for hints that come without the rule's replacement, by the rule's id and the words found, not by the
// advice's words (moved from the Yokey keyboard: ReedachFixes.kt and the «Убрать» of ReedachRemarks.kt). Two kinds:
// a replacement made of the words found or from the tables here («счет на оплату» → «счет», «согласно договора» →
// «согласно договору», «  » → « »), and «Убрать» where the sentence still reads without the fragment — some only next
// to the words that make it safe (a parenthetical set off by commas, a whole sentence, «Не секрет, что» with its
// «, что»). The fragment of an edit can be wider than the hint's: the punctuation that goes with it. The rest stays
// an advice: the list and the reasons in docs/handoff-fixes-from-keyboard.md.
const norm=s=>s.toLowerCase().replace(/ё/g,'е');
const SP='[ \\u00A0]',SPACES='  ',space=c=>c!==undefined&&SPACES.includes(c);
// after these (and spaces) a sentence starts; before these a fragment ends its sentence
const OPENING='.!?…\n«"(',CLOSING='.!?…;:)»"\n';
const THAT_AFTER=new RegExp('^'+SP+'*(?:,'+SP+'*что(?![а-яёА-ЯЁ])|:)');
const BUT_AFTER=new RegExp('^'+SP+'*,'+SP+'*(?:но|что)(?![а-яёА-ЯЁ])');
const END_MARKS=/^[.!?…]+/;
const WORD_AFTER=new RegExp('^'+SP+'*([\\p{L}\\d][\\p{L}\\d\\-]*)','u');
const WORD_BEFORE=new RegExp('([\\p{L}—\\-]+)'+SP+'*$','u');
const DATE_FROM=new RegExp('^'+SP+'+[сС]о?'+SP);
const INFINITIVE=new RegExp('^'+SP+'*(?:[а-яё]+'+SP+'+)?[а-яё]+(?:ть|ти|чь)(?:ся|сь)?(?![а-яё])');
const AGREEING=/(?:ое|ее|ой|ую|ая|ий|ый|ие|ые|ого|ему|ому|ом|ем|им|ым)$/;
const CONJUNCTIONS=new Set(['и','а','но','или','либо','да']);
// «Какой-то из них» is a pronoun, not a modifier; «на большое количество» does not take «много»
const PREPOSITIONS=new Set(['в','во','на','за','про','через','под','подо','о','об','обо','с','со','к','ко','по','для','из','изо','от','ото','до','у','без','при','над','перед','между','среди']);
// before these an adjective or an adverb is the predicate («проект был успешным»): it does not go
const LINKING=new Set(['был','была','было','были','будет','будут','быть','стал','стала','стало','стали','становится','является','являются','это','—','-']);
const upper=c=>/\p{Lu}/u.test(c||''),lower=c=>/\p{Ll}/u.test(c||'');
// a replacement from the rules is lower case: at the start of a sentence it takes the fragment's capital
const matchCase=(original,r)=>upper(original[0])&&lower(r[0])?r[0].toUpperCase()+r.slice(1):r;

// «повтор* снова» fits «повторить снова»: as many words, a key word with * is the start of the word; «*»: any fragment
function fits(key,fragment){
 if(key==='*')return true;
 const k=key.split(' '),w=norm(fragment).split(/\s+/);
 return k.length===w.length&&k.every((t,i)=>t.endsWith('*')?w[i].startsWith(t.slice(0,-1)):w[i]===t);
}
const longest=(table,fragment)=>{let best=null;for(const k of Object.keys(table))if(fits(k,fragment)&&(best===null||k.length>best.length))best=k;return best===null?undefined:table[best];};
// $1, $2 stand for the words found, as written
const fill=(template,fragment)=>{const words=fragment.trim().split(/\s+/);return template.replace(/\$(\d)/g,(_,n)=>words[n-1]??'');};
const each=(value,...keys)=>Object.fromEntries(keys.map(k=>[k,value]));

// a replacement by the words found
const REPLACE={
 // «что что»: the word once
 'word-double':{'*':'$1'},
 // the main noun is the first word in every phrase of the rule («счет на оплату», «январь месяц»)
 'pleonasm-dependent':each('$1','ареал* обитания','коллег* по работе','счет* на оплату','прейскурант цен','прейскуранта цен','период* времени','промежутк* времени','январь месяц','февраль месяц','март месяц','апрель месяц','май месяц','июнь месяц','июль месяц','август месяц','сентябрь месяц','октябрь месяц','ноябрь месяц','декабрь месяц'),
 // the pairs that have no replacement in the rule: the word that carries the meaning stays
 'pleonasm-pairs':{...each('$1','повтор* снова','подн* вверх','спуск* вниз','спуст* вниз','вернуть* назад','вернул* назад','возвраща* назад','сво* собственн*','вдруг внезапно','ежедневно каждый день','повтор* еще раз'),'каждый день ежедневно':'$1 $2',
  ...each('$2','предварительн* предоплат*','главн* приоритет*','свободн* ваканси*','совместн* сотрудничеств*','взаимн* сотрудничеств*','внезапно вдруг','краткое резюме','основной лейтмотив','первый дебют','стеклянн* остеклени*')},
 'pleonasm-more':{...each('$2','наглядн* пример*','наиболее оптимальн*','самый оптимальн*'),'в удобное для вас время':'в удобное время','в любое удобное время':'в удобное время','провайдер услуг':'$1'},
 'date-range-period':{'в период с':'с'},
 'modality-softener':{'очень вероятно':'$2'},
 'modality-subjunctive':{'я бы хотел':'я хочу','я бы хотела':'я хочу','мы бы хотели':'мы хотим','вы бы хотели':'вы хотите','мне бы хотелось':'мне хочется','нам бы хотелось':'нам хочется','хотелось бы':'хочется','я бы предпочел':'я предпочитаю','я бы предпочла':'я предпочитаю','мы бы предпочли':'мы предпочитаем'},
 'pronoun-dannyy':{'данный':'этот','данная':'эта','данное':'это','данную':'эту','данной':'этой','данного':'этого','данном':'этом','данному':'этому'},
 'vague-quantity':{'большое количество':'много','значительное количество':'много','незначительное количество':'немного','небольшое количество':'немного','уйма':'много','подавляющее большинство':'$2'},
 'bureaucratese-verbs':{'в целях':'для','посредством':'с помощью'},
 'stamp-newspaper-idioms':{'в лучших традициях':'по традиции'},
 'preachy-refusal':{'в обязательном порядке':'обязательно'},
 'stamp-cliche':{'сочета* в себе':'$1','легко и просто':'просто','без промедления':'сразу','прямиком':'прямо','на каждом шагу':'повсюду','в сухом остатке':'в итоге','на высоком уровне':'хорошо','на должном уровне':'хорошо'},
 'stamp-idioms-more':{'бытует мнение':'считается','в эпоху цифровых технологий':'сейчас','братья наши меньшие':'животные','в сети интернет':'в интернете','от а до я':'полностью'},
 'stamp-business-claims':{'в кратчайшие сроки':'быстро','кратчайшие сроки':'короткие сроки','точно в срок':'в срок','на самом высоком уровне':'хорошо','на высоком профессиональном уровне':'хорошо'},
 'stamp-formal-letter':{'приносим свои глубочайшие извинения':'приносим извинения','приносим глубочайшие извинения':'приносим извинения','глубочайшие извинения':'извинения','доброго времени суток':'здравствуйте','с радостью предложим':'$3','именно поэтому мы':'$2 $3'},
 'adjective-metaphor':{'железная воля':'сильная воля','железной воли':'сильной воли','железной волей':'сильной волей','железную волю':'сильную волю','стальные нервы':'крепкие нервы','стальных нервах':'крепких нервах','стальная хватка':'крепкая хватка','стальной хватки':'крепкой хватки','золотые руки':'умелые руки','золотой стандарт':'эталон','золотого стандарта':'эталона'},
 'mistake-po-case':{'по приезду':'по приезде','по прибытию':'по прибытии','по окончанию':'по окончании','по завершению':'по завершении','по истечению':'по истечении','по возвращению':'по возвращении'},
 'mistake-soglasno':{'согласно договора':'согласно договору','согласно приказа':'согласно приказу','согласно графика':'согласно графику','согласно плана':'согласно плану','согласно закона':'согласно закону','согласно решения':'согласно решению','согласно распоряжения':'согласно распоряжению','согласно требований':'согласно требованиям','согласно условий':'согласно условиям','согласно правил':'согласно правилам'},
 // «заплатить за» is right both for «за работу» and «за меня» (the rule's note)
 'mistake-oplata':{'оплатить за':'заплатить за','оплатил за':'заплатил за','оплатила за':'заплатила за','оплатили за':'заплатили за','оплачу за':'заплачу за','оплатите за':'заплатите за','оплачивать за':'платить за','оплачиваем за':'платим за','оплачивают за':'платят за'},
 'mistake-oboih':{'обоих сторон':'обеих сторон','обоим сторонам':'обеим сторонам','обоими сторонами':'обеими сторонами','обоих рук':'обеих рук','обоими руками':'обеими руками'},
 // the rule's own fix; «в течении реки» is rare next to «в течении дня»
 'mistake-context':{'в течении':'в течение','в продолжении':'в продолжение','в следствии':'вследствие','не смотря на':'несмотря на'},
 // the pairs whose right word is a phrase: the wrong word alone is marked («играет значение», «имеет роль»)
 'paronyms':{'играет':'имеет','играют':'имеют','играть':'иметь','играл':'имел','играла':'имела','играло':'имело','играли':'имели','играя':'имея','имеет':'играет','имеют':'играют','иметь':'играть','имел':'играл','имела':'играла','имело':'играло','имели':'играли','имея':'играя','оказывает':'играет','оказывают':'играют','оказать':'сыграть','оказывал':'играл','оказывала':'играла','оказывали':'играли','оказал':'сыграл','оказала':'сыграла','оказали':'сыграли','оказало':'сыграло','оплатить':'заплатить','оплатил':'заплатил','оплатила':'заплатила','оплатили':'заплатили','оплатит':'заплатит','оплатите':'заплатите','оплатим':'заплатим','оплатят':'заплатят','оплачу':'заплачу','оплачивать':'платить','оплачивает':'платит','оплачиваем':'платим','оплачивают':'платят','оплачивай':'плати','оплачивайте':'платите'},
};

// Where «Убрать» keeps the sentence whole. any: anywhere; mod: the fragment modifies the next word (a word follows,
// not a conjunction, and no linking verb is before it); paren: a parenthetical (at the start of a sentence or after a
// comma, a comma or a colon after it, with «что»); that: at the start of a sentence with «, что» or a colon after it,
// they go with it («Не секрет, что цены» → «Цены»); but: «, но» or «, что» after it go with it («Вы не поверите, но
// цены» → «Цены»); sent: the whole sentence (with its end mark) or its address before a comma («Здравствуйте,
// Николай!»); withS: before «с» or «со» of a date range («в течение периода с мая» → «с мая»).
const anywhere=['any'],never=[],mod=['mod','paren'],paren=['paren'],that=['that'],sent=['sent'];
// Words that can be the predicate («Это просто.», «Проект успешен.», «Мне плевать.») or that need their «, что»
// («Не секрет, что») have a condition.
const REMOVE={
 'time-parasite-start':{'*':anywhere},
 'time-parasite-anywhere':{'*':anywhere},
 'intro-oral':{'*':anywhere,'плевать':never,'супер':mod,'короче':paren},
 'intro-obviousness':{'*':anywhere,'не секрет':that,'ни для кого не секрет':that,'общеизвестно':that,'всем известно':that,'очевидно':[...paren,...that],'естественно':[...paren,...that]},
 'filler-simply':{'*':anywhere,'просто':mod},
 'filler-start':{'*':anywhere},
 'filler-phrases':{'*':anywhere},
 'intensifiers':{'*':anywhere},
 'sincerity':{'*':anywhere,'реальн*':mod},
 'vague-hedge':{'*':anywhere},
 'success-word':{'успешн*':mod,'успешност*':never},
 'vague-soon':{'*':anywhere},
 'intro-transition':{...each(anywhere,'во-первых','во-вторых','в-третьих','для начала','далее','прежде всего'),'отметим также':that},
 'intro-structure':{'в завершение':anywhere,'в заключение':anywhere,'подведем итог':[...sent,...that],'подведем итоги':[...sent,...that]},
 'intro-example':{'к примеру':paren,'скажем':paren},
 'intro-attention':{'*':paren},
 'bureaucratese-phrases':{'обращаем ваше внимание':paren,'обращаю ваше внимание':paren,'хочу обратить ваше внимание':paren,'сообщаем вам':that},
 'self-announce':{'*':that,'имеем честь':never},
 'ui-reference':each(paren,'как сказано выше','как было сказано выше','как говорилось выше'),
 'back-reference':each(paren,'как я уже говорил','как я говорил','как я писал','как я уже писал','как мы уже говорили','как мы писали'),
 'banal-intro':{'все мы знаем':that,'давно известно':that,...each(anywhere,'с давних пор','с незапамятных времен','с древних времен')},
 'greeting-start':each(sent,'здравствуйте','привет','всем привет','добро пожаловать','дорогие друзья','дорогие читатели','спасибо что читаете'),
 'sign-off':{'*':sent},
 'stamp-sales-phrases':{'*':sent},
 'stamp-call-to-action':{'*':sent},
 'stamp-clickbait':{'вы удивитесь':['but','sent'],'вы не поверите':['but','sent'],...each(sent,'не переключайтесь','доверьтесь мне','доверьтесь профессионалам')},
 'stamp-formal-letter':{'*':sent,'вынуждены сообщить':that},
 'stamp-cliche':{'как показывает практика':paren},
 'stamp-sales':each(mod,'высококвалифицированн*','клиентоориентированн*','динамично развивающ*'),
 'slang-register':each([...paren,...sent],'вау','ура-ура'),
 'proof-claims':{'*':mod,'гарантированно':anywhere,'без обмана':anywhere,'доказано':that,'гарантируем':never,'гарантирую':never},
 'vague-indefinite':{...each(anywhere,'как-то','где-то','зачем-то','почему-то','как-нибудь'),...each(mod,'какой-то','какая-то','какое-то','какие-то','каких-то','каким-то','какую-то','какого-то','какой-нибудь')},
 'preachy-tone':{'обязательно':mod,'ни в коем случае':mod,'не забывайте':that,'не забудьте':that,'запомните':that,'важно помнить':that},
 'date-range-period':{'на протяжении периода':['withS'],'в течение периода':['withS']},
};

// The fragment of «Убрать» by its conditions: [start, end) or wider (its «, что», its end mark), null: an advice.
function removal(conditions,text,start,end){
 const before=text.slice(0,start),after=text.slice(end),rest=before.replace(/[  ]+$/,'');
 const starts=!rest||OPENING.includes(rest[rest.length-1]);
 const extended=m=>m&&{start,end:end+m[0].length},plain={start,end};
 // «не просто работаем», «не очень хорошо»: without the word the negation moves to the next one
 if(WORD_BEFORE.exec(before)?.[1].toLowerCase()==='не')return null;
 for(const c of conditions){
  if(c==='any')return plain;
  if(c==='that'&&starts){const e=extended(THAT_AFTER.exec(after));if(e)return e;}
  if(c==='but'&&starts){const e=extended(BUT_AFTER.exec(after));if(e)return e;}
  if(c==='paren'&&(starts||rest.endsWith(','))){const e=extended(THAT_AFTER.exec(after));if(e)return e;if(after.replace(/^[  ]+/,'').startsWith(','))return plain;}
  if(c==='sent'&&starts){const e=extended(END_MARKS.exec(after));if(e)return e;const next=after.replace(/^[  ]+/,'');if(!next||next[0]===','||next[0]==='\n')return plain;}
  if(c==='mod'){
   const words=WORD_AFTER.exec(after),next=words?.[1].toLowerCase();
   // «Успешным проект стал»: the predicate put first
   const then=words&&WORD_AFTER.exec(after.slice(words[0].length))?.[1].toLowerCase(),prev=WORD_BEFORE.exec(before)?.[1].toLowerCase();
   if(next&&!CONJUNCTIONS.has(next)&&!PREPOSITIONS.has(next)&&!LINKING.has(prev)&&!LINKING.has(then))return plain;
  }
  if(c==='withS'&&DATE_FROM.test(after))return plain;
 }
 return null;
}

// «Убрать» of [start, end): with the comma that set it off («Кстати, это» → «Это», «Это, безусловно, важно» → «Это
// важно», «Это важно, кстати.» → «Это важно.») and the spaces that would double; at the start of a sentence the next
// word gets the fragment's capital (the edit then takes that letter in too).
const CONTEXT=12;
function cut(text,start,end){
 const before=text.slice(Math.max(0,start-CONTEXT),start),after=text.slice(end,end+CONTEXT),fragment=text.slice(start,end);
 let spacesAfter=0;while(spacesAfter<after.length&&space(after[spacesAfter]))spacesAfter++;
 let keep=before.length;while(keep>0&&space(before[keep-1]))keep--;
 const spacesBefore=before.length-keep,commaBefore=keep>0&&before[keep-1]===',',next=after[spacesAfter];
 const whole=(keep===0||OPENING.includes(before[keep-1]))&&next!==undefined&&'.!?…'.includes(next);
 let left,right;
 // «Мир. В настоящее время.»: the fragment is the whole sentence, its end mark goes too
 if(whole){let marks=spacesAfter;while(marks<after.length&&'.!?…'.includes(after[marks]))marks++;if(spacesBefore&&keep){left=spacesBefore;right=marks;}else{left=0;right=marks;while(right<after.length&&space(after[right]))right++;}}
 // «Это, безусловно, важно»: both commas go, the space after the second stays
 else if(next===','&&commaBefore){left=spacesBefore+1;right=spacesAfter+1;}
 // «Кстати, это», «Мы кстати, пришли»: the comma and the spaces after it go
 else if(next===','){left=0;right=spacesAfter+1;while(right<after.length&&space(after[right]))right++;}
 // «Это важно, кстати.»: the end of a sentence - the spaces and the comma before go
 else if(next===undefined||CLOSING.includes(next)){left=spacesBefore+(commaBefore?1:0);right=spacesAfter;}
 // the start or the middle: the spaces after go, a space before stays between the words
 else{left=0;right=spacesAfter;}
 const rest=before.slice(0,before.length-left).replace(/[  ]+$/,''),starts=!rest||OPENING.includes(rest[rest.length-1]);
 const letter=after[right],capital=starts&&upper(fragment[0])&&lower(letter);
 return capital?{start:start-left,end:end+right+1,text:letter.toUpperCase()}:{start:start-left,end:end+right,text:''};
}

// «Который…» starting a sentence of its own: joined to the sentence before («…дом. Который» → «…дом, который»)
function join(text,start,end,fragment){
 let dot=start;while(dot>0&&space(text[dot-1]))dot--;
 if(dot===start||dot<2||text[dot-1]!=='.'||!/[\p{L}\p{Nd}]/u.test(text[dot-2]))return null;
 return {start:dot-1,end,text:', '+fragment[0].toLowerCase()+fragment.slice(1)};
}

// a word of one script with letters of the other that look the same: they become the word's own script
const LATIN_LOOK='aceopxyACEHKMOPTXB',CYRILLIC_LOOK='асеорхуАСЕНКМОРТХВ';
function mixed(word){
 const latin=c=>/[a-zA-Z]/.test(c),cyrillic=c=>/[а-яА-ЯёЁ]/.test(c),chars=[...word];
 const toCyrillic=chars.filter(cyrillic).length>=chars.filter(latin).length,from=toCyrillic?LATIN_LOOK:CYRILLIC_LOOK,to=toCyrillic?CYRILLIC_LOOK:LATIN_LOOK;
 if(chars.some(c=>(toCyrillic?latin(c):cyrillic(c))&&!from.includes(c)))return null;
 return chars.map(c=>{const k=from.indexOf(c);return k>=0?to[k]:c;}).join('');
}

function typography(id,text,start,end,f){
 switch(id){
  case 'typo-double-space':return {start,end,text:' '};
  // the spaces go: with the mark after them, or with the bracket before them («( окна» → «(окна»); not after a
  // smiley («:( и»)
  case 'typo-space-before':if(start>0&&'(«'.includes(text[start-1]))return /[:;=]-?\($/.test(text.slice(Math.max(0,start-3),start))?null:{start:start-1,end,text:text[start-1]};
   return end<text.length?{start,end:end+1,text:text[end]}:null;
  case 'typo-space-after':return {start,end,text:f+' '};
  case 'typo-quotes':return f.length>=2?{start,end,text:'«'+f.slice(1,-1)+'»'}:null;
  case 'typo-dash':return {start,end,text:' — '};
  case 'typo-repeat-punct':return {start,end,text:/^\.+$/.test(f)?(f.length>=4?'…':'.'):/^[!?]+$/.test(f)?(f.includes('!')&&f.includes('?')?'?!':f[0]):f[0]};
  // «И.И. Иванов» → «И. И. Иванов», «А.Пушкин» → «А. Пушкин»
  case 'typo-initials':{const spaced=f.replace(/\.(?=\p{L})/gu,'. ');return {start,end,text:end<text.length&&/\p{L}/u.test(text[end])?spaced+' ':spaced};}
  case 'typo-mixed-script':{const w=mixed(f);return w===null?null:{start,end,text:w};}
 }
 return null;
}

// The ready edit of a hint of rule [id] on [start, end) of [text] (the block's text, line breaks as \n):
// {start, end, text} puts text in place of [start, end) (cased as the fragment), remove: true is «Убрать» (text is
// empty or the next word's capital). null: no edit, the hint stays an advice.
export function readyEdit(id,text,start,end){
 if(start<0||end>text.length||start>=end)return null;
 const f=text.slice(start,end),t=typography(id,text,start,end,f);if(t)return t;
 if(id==='syntax-fragment-start')return join(text,start,end,f);
 if(id==='bureaucratese-verbs'&&norm(f)==='с целью')return {start,end,text:INFINITIVE.test(text.slice(end))?'чтобы':'для'};
 const v=REPLACE[id]&&longest(REPLACE[id],f);
 if(v!==undefined&&v!==null){
  // «много» is no noun: not after a preposition or a word that agrees with «количество» («такое», «это»)
  const prev=WORD_BEFORE.exec(text.slice(0,start))?.[1].toLowerCase();
  if(id==='vague-quantity'&&v.endsWith('много')&&prev!==undefined&&(PREPOSITIONS.has(prev)||['это','то','все','всё'].includes(prev)||AGREEING.test(prev)))return null;
  return {start,end,text:matchCase(f,fill(v,f))};
 }
 const conditions=REMOVE[id]&&longest(REMOVE[id],f);if(!conditions)return null;
 const at=removal(conditions,text,start,end);
 return at&&{...cut(text,at.start,at.end),remove:true};
}
