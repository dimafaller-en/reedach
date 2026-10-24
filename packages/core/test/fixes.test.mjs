import test from 'node:test';
import assert from 'node:assert/strict';
import {readyEdit} from '../src/fixes.js';
import {checkStyle} from '../src/style.js';
import {sourceBlocks,textBlocks,mergeIssues} from '../src/markdown.js';

// Ready edits for hints without the rule's replacement (moved from the Yokey keyboard, its ReedachFixesTest):
// replacements by the words found and by tables, typography, «Убрать» where the sentence stays whole.

// the edit of a hint of rule id on the first occurrence of fragment in text
const edit=(id,text,fragment=text)=>{const s=text.indexOf(fragment);assert.ok(s>=0,fragment);return readyEdit(id,text,s,s+fragment.length);};
// the replacement, «-» for «Убрать», null for an advice
const action=(id,text,fragment)=>{const e=edit(id,text,fragment);return e?(e.remove?'-':e.text):null;};
const apply=(text,e)=>text.slice(0,e.start)+e.text+text.slice(e.end);
// the text after accepting the hints [rule id, fragment], applied from the end of the text
const acceptAll=(text,...found)=>found.map(([id,f])=>edit(id,text,f)).filter(Boolean).sort((a,b)=>b.start-a.start).reduce(apply,text);

test('the owner\'s example',()=>{
 const text='Николай, мы отправили вам договор и счет на оплату. Ожидаем подписания как можно скорее и оплату.';
 assert.equal(acceptAll(text,['pleonasm-dependent','счет на оплату'],['vague-soon','как можно скорее']),'Николай, мы отправили вам договор и счет. Ожидаем подписания и оплату.');
 assert.equal(action('pleonasm-dependent',text,'счет на оплату'),'счет');
 assert.equal(action('vague-soon',text,'как можно скорее'),'-');
});

test('the main word stays',()=>{
 assert.equal(acceptAll('Свободная вакансия закрыта.',['pleonasm-pairs','Свободная вакансия']),'Вакансия закрыта.');
 assert.equal(acceptAll('Это свой собственный дом.',['pleonasm-pairs','свой собственный']),'Это свой дом.');
 assert.equal(acceptAll('Повторите еще раз, пожалуйста.',['pleonasm-pairs','Повторите еще раз']),'Повторите, пожалуйста.');
 assert.equal(acceptAll('Отчёт за январь месяц готов.',['pleonasm-dependent','январь месяц']),'Отчёт за январь готов.');
 assert.equal(action('pleonasm-dependent','коллеги по работе'),'коллеги');
 assert.equal(action('pleonasm-more','наглядные примеры'),'примеры');
 assert.equal(action('pleonasm-more','в удобное для вас время'),'в удобное время');
 assert.equal(action('modality-softener','очень вероятно'),'вероятно');
 // a pair the tables do not know is an advice
 assert.equal(action('pleonasm-pairs','новое слово'),null);
});

test('tables',()=>{
 assert.equal(action('mistake-soglasno','согласно договора'),'согласно договору');
 assert.equal(action('mistake-oboih','обоих сторон'),'обеих сторон');
 assert.equal(action('mistake-po-case','по окончанию'),'по окончании');
 assert.equal(action('mistake-po-case','по приезду'),'по приезде');
 assert.equal(action('mistake-oplata','оплатил за'),'заплатил за');
 assert.equal(action('mistake-context','в течении'),'в течение');
 assert.equal(action('pronoun-dannyy','данной'),'этой');
 assert.equal(action('modality-subjunctive','мы бы хотели'),'мы хотим');
 assert.equal(action('modality-subjunctive','было бы здорово'),null);
 assert.equal(action('vague-quantity','большое количество'),'много');
 assert.equal(action('vague-quantity','Ждём на большое количество заказов.','большое количество'),null);
 assert.equal(action('vague-quantity','Такое большое количество ошибок.','большое количество'),null);
 // a no-break space between the words
 assert.equal(acceptAll('Выставили счет на оплату.',['pleonasm-dependent','счет на оплату']),'Выставили счет.');
 assert.equal(action('word-double','что что'),'что');
 assert.equal(action('paronyms','играет'),'имеет');
 assert.equal(action('stamp-business-claims','в кратчайшие сроки'),'быстро');
 assert.equal(action('adjective-metaphor','железной волей'),'сильной волей');
 assert.equal(action('stamp-cliche','сочетает в себе'),'сочетает');
 assert.equal(action('bureaucratese-verbs','с целью экономии','с целью'),'для');
 assert.equal(action('bureaucratese-verbs','с целью сэкономить','с целью'),'чтобы');
 assert.equal(action('bureaucratese-verbs','с целью быстро закончить','с целью'),'чтобы');
 assert.equal(acceptAll('Согласно плана мы начали.',['mistake-soglasno','Согласно плана']),'Согласно плану мы начали.');
});

test('typography',()=>{
 assert.equal(acceptAll('Мы  и они.',['typo-double-space','  ']),'Мы и они.');
 // the spaces go with the mark after them or the bracket before them
 assert.equal(acceptAll('Мы , они.',['typo-space-before',' ']),'Мы, они.');
 assert.equal(acceptAll('( двери).',['typo-space-before',' ']),'(двери).');
 assert.equal(acceptAll('Окна,двери.',['typo-space-after',',']),'Окна, двери.');
 assert.equal(acceptAll('Магазин "Стандарт".',['typo-quotes','"Стандарт"']),'Магазин «Стандарт».');
 assert.equal(acceptAll('Москва - столица.',['typo-dash',' - ']),'Москва — столица.');
 assert.equal(acceptAll('Что?!?',['typo-repeat-punct','?!?']),'Что?!');
 assert.equal(acceptAll('Ура!!!',['typo-repeat-punct','!!!']),'Ура!');
 assert.equal(acceptAll('Ну..',['typo-repeat-punct','..']),'Ну.');
 assert.equal(acceptAll('И.И. Иванов',['typo-initials','И.И.']),'И. И. Иванов');
 assert.equal(acceptAll('А.Пушкин',['typo-initials','А.']),'А. Пушкин');
 // Latin «о» in a Russian word
 assert.equal(action('typo-mixed-script','слoвo'),'слово');
 assert.equal(action('typo-mixed-script','слоwо'),null);
});

test('«Убрать» where the sentence stays whole',()=>{
 // «, что» goes with the predicate; without it the hint is an advice
 assert.equal(acceptAll('Не секрет, что цены растут.',['intro-obviousness','Не секрет']),'Цены растут.');
 assert.equal(action('intro-obviousness','Это не секрет.','не секрет'),null);
 assert.equal(acceptAll('Обратите внимание: цены выросли.',['intro-attention','Обратите внимание']),'Цены выросли.');
 assert.equal(action('intro-attention','Обратите внимание на цены.','Обратите внимание'),null);
 assert.equal(acceptAll('Рады сообщить, что офис открыт.',['self-announce','Рады сообщить']),'Офис открыт.');
 assert.equal(action('self-announce','Мы рады сообщить, что офис открыт.','рады сообщить'),null);
 // a parenthetical between commas
 assert.equal(acceptAll('Мы, как я уже говорил, работаем.',['back-reference','как я уже говорил']),'Мы работаем.');
 assert.equal(action('back-reference','В прошлой статье мы писали.','В прошлой статье'),null);
 // the whole sentence with its mark
 assert.equal(acceptAll('Спасибо за внимание! Пока.',['sign-off','Спасибо за внимание']),'Пока.');
 assert.equal(acceptAll('Текст. Спасибо за внимание!',['sign-off','Спасибо за внимание']),'Текст.');
 assert.equal(acceptAll('Здравствуйте, Николай, мы ждём.',['greeting-start','Здравствуйте']),'Николай, мы ждём.');
 assert.equal(action('stamp-call-to-action','Оставьте заявку на сайте.','Оставьте заявку'),null);
 assert.equal(acceptAll('Вы не поверите, но цены упали.',['stamp-clickbait','Вы не поверите']),'Цены упали.');
 // a modifier goes, the predicate stays
 assert.equal(acceptAll('Мы просто сделали.',['filler-simply','просто']),'Мы сделали.');
 assert.equal(action('filler-simply','Это просто.','просто'),null);
 assert.equal(action('success-word','Проект был успешным.','успешным'),null);
 assert.equal(action('success-word','Успешным проект стал после запуска.','Успешным'),null);
 assert.equal(acceptAll('Успешный проект завершён.',['success-word','Успешный']),'Проект завершён.');
 assert.equal(action('success-word','Успешность проекта.','Успешность'),null);
 assert.equal(action('vague-indefinite','Какой-то из них придёт.','Какой-то'),null);
 assert.equal(action('vague-indefinite','Пришёл какой-то человек.','какой-то'),'-');
 assert.equal(action('vague-indefinite','Он куда-то делся.','куда-то'),null);
 // a date range keeps its «с»
 assert.equal(acceptAll('Работы в течение периода с мая по июнь.',['date-range-period','в течение периода']),'Работы с мая по июнь.');
 assert.equal(action('date-range-period','в течение периода действия','в течение периода'),null);
 assert.equal(action('date-range-period','в период с'),'с');
 assert.equal(acceptAll('Ответим в ближайшее время.',['vague-soon','в ближайшее время']),'Ответим.');
});

test('every rule with an edit',()=>{
 assert.equal(action('stamp-newspaper-idioms','в лучших традициях'),'по традиции');
 assert.equal(action('stamp-idioms-more','бытует мнение'),'считается');
 assert.equal(action('stamp-idioms-more','в сети интернет'),'в интернете');
 assert.equal(action('stamp-formal-letter','приносим глубочайшие извинения'),'приносим извинения');
 assert.equal(action('stamp-formal-letter','с радостью предложим'),'предложим');
 assert.equal(acceptAll('Текст. Заранее спасибо!',['stamp-formal-letter','Заранее спасибо']),'Текст.');
 assert.equal(action('preachy-refusal','в обязательном порядке'),'обязательно');
 assert.equal(action('pleonasm-more','провайдер услуг'),'провайдер');
 assert.equal(action('pleonasm-more','самый оптимальный'),'оптимальный');
 assert.equal(action('modality-softener','немножко'),null);
 assert.equal(acceptAll('Во-первых, это дёшево.',['intro-transition','Во-первых']),'Это дёшево.');
 assert.equal(acceptAll('В заключение скажу главное.',['intro-structure','В заключение']),'Скажу главное.');
 assert.equal(acceptAll('К примеру, вчера был дождь.',['intro-example','К примеру']),'Вчера был дождь.');
 assert.equal(acceptAll('Цены, как сказано выше, растут.',['ui-reference','как сказано выше']),'Цены растут.');
 assert.equal(acceptAll('С давних пор люди строят дома.',['banal-intro','С давних пор']),'Люди строят дома.');
 assert.equal(acceptAll('Обязательно возьмите паспорт.',['preachy-tone','Обязательно']),'Возьмите паспорт.');
 assert.equal(acceptAll('Работают высококвалифицированные мастера.',['stamp-sales','высококвалифицированные']),'Работают мастера.');
 assert.equal(acceptAll('Мы нашли проверенного поставщика.',['proof-claims','проверенного']),'Мы нашли поставщика.');
 assert.equal(action('proof-claims','Мы гарантируем.','гарантируем'),null);
 assert.equal(acceptAll('Вау, как красиво!',['slang-register','Вау']),'Как красиво!');
 assert.equal(acceptAll('Обращаем ваше внимание: офис закрыт.',['bureaucratese-phrases','Обращаем ваше внимание']),'Офис закрыт.');
 assert.equal(acceptAll('Короче, мы ушли.',['intro-oral','Короче']),'Мы ушли.');
 assert.equal(action('intro-oral','Сделай короче.','короче'),null);
 assert.equal(action('intro-oral','Это супер!','супер'),null);
});

test('a sentence that is a fragment is joined',()=>{
 assert.equal(acceptAll('Мы купили дом. Который стоит у реки.',['syntax-fragment-start','Который']),'Мы купили дом, который стоит у реки.');
 // at the start of the text there is nothing to join to
 assert.equal(action('syntax-fragment-start','Который час?','Который'),null);
});

// The edits in the core's answer: what a click does with replace (the fragment's capital) or edit.
const accept=(source,issues)=>issues.map(it=>it.edit||(it.replace&&{start:it.start,end:it.end,text:/^\p{Lu}/u.test(source.slice(it.start,it.end))?it.replace[0][0].toUpperCase()+it.replace[0].slice(1):it.replace[0]})).filter(Boolean).sort((a,b)=>b.start-a.start).reduce(apply,source);
const answer=(source,blocks)=>mergeIssues(blocks,{local:checkStyle(blocks)});

test('the answer: replace on the hint\'s fragment, edit for «Убрать» and a wider fragment',()=>{
 const text='Николай, мы отправили вам договор и счет на оплату. Ожидаем подписания как можно скорее и оплату.';
 const issues=answer(text,textBlocks(text)),at=f=>issues.find(it=>text.slice(it.start,it.end)===f);
 assert.deepEqual([at('счет на оплату').replace,at('счет на оплату').exact],[['счет'],true]);
 const soon=text.indexOf('как можно скорее');
 assert.deepEqual(at('как можно скорее').edit,{start:soon,end:soon+'как можно скорее '.length,text:'',remove:true});
 assert.equal(at('как можно скорее').replace,undefined);
 assert.equal(accept(text,issues),'Николай, мы отправили вам договор и счет. Ожидаем подписания и оплату.');
 const join='Мы купили дом. Который стоит у реки.',j=answer(join,textBlocks(join)).find(it=>it.id==='syntax-fragment-start');
 assert.deepEqual(j.edit,{start:13,end:22,text:', который'});
 assert.equal(accept(join,[j]),'Мы купили дом, который стоит у реки.');
});

test('the edit points into the Markdown source and skips markup',()=>{
 const md='# Заголовок\n\nНе секрет, что цены **растут**.';
 const issues=answer(md,sourceBlocks(md)),it=issues.find(x=>x.id==='intro-obviousness');
 assert.equal(md.slice(it.edit.start,it.edit.end),'Не секрет, что ц');
 assert.equal(accept(md,[it]),'# Заголовок\n\nЦены **растут**.');
 // markup inside the edit: no edit, the hint stays an advice
 const bold='**Не секрет**, что цены растут.',b=answer(bold,sourceBlocks(bold)).find(x=>x.id==='intro-obviousness');
 assert.equal(b.edit,undefined);
 // a line break inside a paragraph is not a space to cut
 const lines='Мы купили дом.\nКоторый стоит у реки.',l=answer(lines,textBlocks(lines)).find(x=>x.id==='syntax-fragment-start');
 assert.equal(l.edit,undefined);
});
