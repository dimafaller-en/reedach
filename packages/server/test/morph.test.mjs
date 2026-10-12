import test from 'node:test';
import assert from 'node:assert/strict';
import {morphCheck} from '../src/morph.mjs';

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
