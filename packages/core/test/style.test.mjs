import test from 'node:test';
import assert from 'node:assert/strict';
import {checkStyle,BUILTIN} from '../src/style.js';
import {sourceBlocks,textBlocks,mergeIssues} from '../src/markdown.js';
import {RULES,CATEGORIES} from '../src/rules.js';

// One sentence per rule where that rule must fire.
const SAMPLES={
 'time-parasite-start':'В настоящее время мы делаем только офисные перегородки.',
 'time-parasite-anywhere':'Мы сдали три объекта на сегодняшний день.',
 'modality-need':'Нужно заранее согласовать размеры.',
 'modality-must':'Подрядчик должен был предупредить нас.',
 'modality-you-can':'Вы можете заказать замер на сайте.',
 'modality-intent':'Мы планируем открыть второй цех.',
 'modality-subjunctive':'Я бы хотел обсудить сроки.',
 'intro-transition':'Во-первых, мы замерили проём.',
 'intro-structure':'Рассмотрим цены на стекло.',
 'intro-example':'К примеру, возьмём стеклянную дверь.',
 'intro-oral':'Короче, мы всё переделали.',
 'intro-self-correction':'Стекло закалили, то есть нагрели и быстро охладили.',
 'intro-attention':'Обратите внимание на толщину стекла.',
 'intro-obviousness':'Безусловно, стекло бьётся.',
 'filler-simply':'Мы просто устали ждать поставщика.',
 'intensifiers':'Это был очень долгий проект.',
 'sincerity':'Мы действительно успели в срок.',
 'adjective-marketing':'Мы сделали безупречный монтаж.',
 'evaluation-superlatives':'Это лучший подрядчик в городе.',
 'success-word':'Монтаж завершили успешно.',
 'active-word':'Мы активно искали подрядчика.',
 'proof-claims':'Метод проверенный и дешёвый.',
 'vague-indefinite':'Что-то пошло не так с поставкой.',
 'vague-approximate':'Работа заняла примерно две недели.',
 'vague-hedge':'Вообще проект был сложный.',
 'pronoun-dannyy':'В данном случае заказчик отказался.',
 'bureaucratese-verbs':'Монтаж осуществляется силами подрядчика.',
 'bureaucratese-latinisms':'Нужна коммуникация с поставщиком.',
 'nominalization-support-verbs':'Мы произвели монтаж за два дня.',
 'stamp-cliche':'Опыт играет важную роль в таких проектах.',
 'stamp-newspaper-idioms':'Мы бежали сломя голову.',
 'stamp-sales':'У нас индивидуальный подход к каждому клиенту.',
 'pleonasm-pairs':'Пришлось повторить снова замеры.',
 'pleonasm-dependent':'Мы отправили счёт на оплату.',
 'date-range-period':'В период с мая по июнь мы строили цех.',
 'ui-reference':'Подробности ниже по тексту.',
 'greeting-start':'Всем привет! Сегодня расскажу про стекло.',
 'adjective-metaphor':'У него железная воля.',
 'passive-reflexive-impersonal':'Завтра будут проводиться замеры.',
 'syntax-fragment-start':'Курс стоит дорого. Плюс доставка.',
 'connective-start':'Цена выросла. Поэтому мы сменили поставщика.',
 'generic-start':'Обычно заказчики спрашивают про сроки.',
 'banal-intro':'Все мы знаем, что стекло бьётся.',
 'back-reference':'Как я писал, сроки сорвались.',
 'self-announce':'Рады сообщить, что цех открыт.',
 'preachy-tone':'Запомните это правило.',
 'razobralsya':'Я разобрался с фурнитурой.',
 'sign-off':'Подписывайтесь на канал.',
 'better-than-others':'Наш монтаж лучше конкурентов.',
 'advantage-word':'Главное преимущество закалённого стекла в прочности.',
 'stamp-sales-phrases':'Успейте заказать до зимы.',
 'scientific-terms':'У команды случилась апатия.',
 'definition-patterns':'Под этим понимается срок поставки.',
 'borrowing-business':'Соберём фидбек по каждому кейсу.',
 'slang-register':'Это было тупо и дорого.',
 'stamp-clickbait':'Вы удивитесь, сколько стоит замер.',
 'stamp-call-to-action':'Оставьте заявку на сайте.',
 'stamp-idioms-more':'Рано или поздно стекло придётся менять.',
 'stamp-business-claims':'Мы работаем в кратчайшие сроки.',
 'stamp-formal-letter':'Приносим глубочайшие извинения за задержку.',
 'bureaucratese-phrases':'Денежные средства поступили на счёт.',
 'pleonasm-more':'Покажем наглядные примеры.',
 'generalization-any':'Подберём решение для любой ситуации.',
 'vague-science-appeal':'Исследования показали, что стекло прочнее.',
 'vague-quantity':'Мы сделали большое количество проектов.',
 'vague-soon':'Пришлём смету в ближайшее время.',
 'adjective-hype':'Получился впечатляющий результат.',
 'modality-softener':'Стало немножко теплее.',
 'modality-promise':'Вы научитесь выбирать стекло.',
 'filler-start':'Кстати, перегородка уже стоит.',
 'filler-phrases':'Дальше пятое-десятое.',
 'pronoun-ours':'Наши клиенты довольны.',
 'euphemism-soft':'Сроки сорвались из-за форс-мажорных обстоятельств.',
 'preachy-refusal':'Я не работаю с теми, кто торгуется.',
 'self-praise':'Мы не новички в этом деле.',
 'mistake-spelling':'Вообщем, мы опоздали из за дождя.',
 'mistake-po-case':'Позвоните по приезду на объект.',
 'mistake-soglasno':'Работы идут согласно графика.',
 'mistake-oplata':'Заказчик оплатил за монтаж вперёд.',
 'mistake-oboih':'Договор подписали представители обоих сторон.',
 'mistake-context':'Монтаж займёт два дня в течении недели.',
 'colloquial-forms':'Мастер ложит плитку в ихней ванной.',
};
const NEUTRAL='Мы поставили перегородки в офисе на третьем этаже. Заказчик принял работу в пятницу.';
const ids=new Set(RULES.map(r=>r.id));
const run=text=>checkStyle([{text,kind:'p'}]);

test('rule count is within limits',()=>{assert.ok(RULES.length>=30&&RULES.length<=90,String(RULES.length));});
test('rule ids are unique kebab-case',()=>{
 assert.equal(ids.size,RULES.length);
 for(const r of RULES)assert.match(r.id,/^[a-z]+(-[a-z]+)*$/,r.id);
});
test('rules have known category, short message and fix, no guillemets',()=>{
 for(const r of RULES){
  assert.ok(CATEGORIES[r.category],r.id+' category');
  for(const k of ['message','fix']){assert.equal(typeof r[k],'string',r.id+' '+k);assert.ok(r[k].length>5&&r[k].length<200,r.id+' '+k+' length');assert.ok(!/[«»"]/.test(r[k]),r.id+' '+k+' quotes');}
  assert.ok(Array.isArray(r.words)&&r.words.length>0,r.id+' words');
  for(const w of r.words){assert.equal(w,w.trim(),r.id+' '+w);assert.ok(!/\*./.test(w.replace(/\*(?=\s|$)/g,'')),r.id+' star not at word end: '+w);}
 }
});
test('every rule has a sample and no sample is orphaned',()=>{
 for(const r of RULES)assert.ok(SAMPLES[r.id],'no sample for '+r.id);
 for(const id of Object.keys(SAMPLES))assert.ok(ids.has(id),'unknown rule '+id);
});
for(const [id,text] of Object.entries(SAMPLES)){
 test('rule '+id+' fires',()=>{
  const hit=run(text).filter(i=>i.id===id);
  assert.ok(hit.length>0,'did not fire on: '+text);
 });
}
test('start-only rules do not fire in the middle of a sentence',()=>{
 for(const r of RULES.filter(r=>r.start)){
  const w=r.words[0];
  const mid=run('Мы сказали, что '+w+' ничего не значит.').filter(i=>i.id===r.id);
  assert.equal(mid.length,0,r.id+' fired mid-sentence on '+w);
 }
});
test('neutral paragraph gets no hints from RULES',()=>{
 const hits=run(NEUTRAL).filter(i=>ids.has(i.id));
 assert.deepEqual(hits.map(i=>i.id),[]);
});
test('wide stems do not hit unrelated words',()=>{
 const text='Можжевельник растёт у стены. Мастерская на втором этаже. Данные таблицы проверены. Он поставил стекло в раму.';
 assert.deepEqual(run(text).filter(i=>ids.has(i.id)).map(i=>i.id),[]);
});
// Typography and doubled words: [id, text with a hit, text without one].
const TYPO={
 'typo-double-space':['Стекло  в раме.','Стекло в раме.'],
 'typo-space-before':['Двери , окна (стекло ) и « рамы ».','Двери, окна (стекло) и «рамы». Счёт 3 : 1. Ну и :) ;-) ;P Читать далее »'],
 'typo-space-after':['Двери,окна;стены.','Цена 3,5 тысячи; двери, окна. Ну ладно ;D а потом. Адрес https://x.ru/a,b и &nbsp;слово.'],
 'typo-quotes':['Модель "Стандарт" готова.','Модель «Стандарт» и "OK".'],
 'typo-unpaired':['Двери (окна и «стены.','Пункты: а) двери, 1) окна, п. 2) рамы, 1.2) стекло (кромка) и «рамы» :) Ура :)) Грустно :( и :-( « Назад'],
 'typo-dash':['Москва - столица.','Москва — столица, слово-слово, 5–10 дней.'],
 'typo-repeat-punct':['Звоните!!! Что?? Да,, нет..','Что?! Ну?.. Ох!.. И так далее...'],
 'typo-initials':['И.И. Иванов, Петров П.П. и А.Пушкин пришли.','И. И. Иванов, США, т.е., Ф.И.О., до Н.Э.'],
 'typo-mixed-script':['Стеклo и cтекло.','Стекло, iPhone-ом, Wi-Fi.'],
 'word-double':['Мы в в офисе.','Да да, нет нет, вот вот, еле-еле. Я думаю, что что-то не так, и как как-то.'],
};
for(const [id,[bad,good]] of Object.entries(TYPO)){
 test(id+' fires and stays quiet on correct text',()=>{
  assert.ok(BUILTIN[id],'no BUILTIN '+id);
  assert.ok(run(bad).some(i=>i.id===id),'did not fire on: '+bad);
  assert.deepEqual(run(good).filter(i=>i.id===id).map(i=>good.slice(i.start,i.end)),[]);
 });
}
test('typography ignores spaces left by Markdown markup and joined lines',()=>{
 const md='Строка с переносом  \nи код `x` здесь,\n   и отступ.\n\nА тут  два пробела.';
 const blocks=sourceBlocks(md),hits=mergeIssues(blocks,{local:checkStyle(blocks)}).filter(i=>i.id.startsWith('typo-'));
 assert.deepEqual(hits.map(i=>md.slice(i.start,i.end)),['  ']);
 assert.equal(hits[0].start,md.indexOf('тут')+3);
 assert.deepEqual(checkStyle(textBlocks('первая строка\n- вторая строка')).filter(i=>i.id.startsWith('typo-')),[]);
});
test('links with brackets in the address leave no stray bracket',()=>{
 const md='Смотрите [статью](https://ru.wikipedia.org/wiki/A_(b)) и ![схему](a_(1).png) ниже.';
 const blocks=sourceBlocks(md);
 assert.deepEqual(checkStyle(blocks).filter(i=>i.id==='typo-unpaired'),[]);
});
test('a word left between removed HTML tags is not a doubled word',()=>{
 const blocks=sourceBlocks('Слово <br> слово.');
 assert.deepEqual(checkStyle(blocks).filter(i=>i.id==='word-double'),[]);
});
