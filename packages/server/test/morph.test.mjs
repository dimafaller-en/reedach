import test from 'node:test';
import assert from 'node:assert/strict';
import {morphCheck,inflectReplacements} from '../src/morph.mjs';
import {checkStyle} from 'reedach';

const check=async text=>(await morphCheck([{text,kind:'p'}])).map(it=>[it.id,text.slice(it.start,it.end)]);

test('morphology hints find heavy syntax',async()=>{
 assert.deepEqual(await check('Сделав работу, мы ушли домой.'),[['gerund-start','Сделав работу']]);
 assert.deepEqual(await check('Проведение проверки выполнения работ заняло день.'),[['genitive-chain','Проведение проверки выполнения работ']]);
 assert.deepEqual(await check('Решение принято.'),[['short-passive','принято']]);
 assert.deepEqual(await check('Хотел бы начать делать ремонт.'),[['verb-chain','Хотел бы начать делать']]);
 assert.deepEqual(await check('Осуществляем доставку по городу.'),[['weak-verb-noun','Осуществляем доставку']]);
 assert.deepEqual(await check('Красивое большое прозрачное стекло стоит дорого.'),[['adjective-pile','Красивое большое прозрачное']]);
 assert.deepEqual(await check('Стекло хорошее, но стекло мутное.'),[['lemma-repeat','стекло']]);
});

test('three sentences opening with the same word',async()=>{
 assert.deepEqual(await check('Проектирую окна. Проектировал двери. Проектирую фасады.'),[['start-repeat','Проектирую']]);
 assert.deepEqual(await check('Я пришёл. Он ушёл. Я остался.'),[]);
});

test('plain sentences and headings stay clean',async()=>{
 assert.deepEqual(await check('Мы привезли стекло и поставили его в раму.'),[]);
 assert.deepEqual(await morphCheck([{text:'Сделав работу, мы ушли',kind:'h'}]),[]);
});

test('a made-up word of thousands of letters is not parsed',async()=>{
 const t=performance.now();await morphCheck([{text:'а'.repeat(95000)+' был сделан',kind:'p'}]);
 assert.ok(performance.now()-t<3000);
});

test('a replacement takes the form of the word it replaces',async()=>{
 const variants=async text=>{const blocks=[{text,kind:'p'}];return (await inflectReplacements(checkStyle(blocks),blocks)).filter(it=>it.replace).map(it=>it.replace);};
 assert.deepEqual(await variants('Релевантных запросов нет.'),[['подходящих','нужных','уместных']]);
 assert.deepEqual(await variants('Мы минимизировали расходы.'),[['сократили','уменьшили']]);
 assert.deepEqual(await variants('Получили фидбек.'),[['отзыв','отклик']]);
});

test('common mistakes that need parts of speech',async()=>{
 const hits=async text=>(await morphCheck([{text,kind:'p'}])).filter(it=>it.category==='mistake').map(it=>[it.id,text.slice(it.start,it.end),...it.replace]);
 assert.deepEqual(await hits('Были блоги и не сложные сайты для себя и друзей.'),[['ne-adjective','не сложные','несложные']]);
 assert.deepEqual(await hits('Еще занимался настройка сетей.'),[['instrumental-case','настройка','настройкой']]);
 assert.deepEqual(await hits('Она занималась музыка.'),[['instrumental-case','музыка','музыкой']]);
 assert.deepEqual(await hits('Это всерьез изменило пой подход к работе и организации процессов.'),[['typo-real-word','пой','мой']]);
 for(const ok of ['Сайты не сложные, а простые.','Это не сложные сайты.','Я не большой любитель кофе.','Вовсе не сложные задачи.','Окна не большие и не маленькие.','Это постыдное, а не возвышенное дело.','Не такие сайты.','Оказались не готовыми к бою.','В зале занимаются дети.','Этим занималась жена.','Он занимался спортом.','Обладала перед битвой силой.','Пой песню громче.','Давай пой песню.','Я знаю, где занимается мама.','Иди и пой песни.','Продали билеты в еще не открытого парка зону.','Он считает, что заявления боевиков не пустые слова.','Это не исключаетвозможного участия.'])assert.deepEqual(await hits(ok),[],ok);
});
