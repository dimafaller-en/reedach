import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceBlocks,mergeIssues} from '../src/markdown.js';

const src='## Как мы работаем\n\nСделаем **быстро** и [в кратчайшие сроки](https://example.com), `npm` не мешает.\nВторая строка.\n\n- Пункт списка\n\n```\nкод не проверяем\n```\n\n![Фото](/a.jpg)';

test('Markdown source becomes plain blocks without markup',()=>{
 assert.deepEqual(sourceBlocks(src).map(b=>[b.kind,b.text]),[['h','Как мы работаем'],['p','Сделаем быстро и в кратчайшие сроки,   не мешает. Вторая строка.'],['li','Пункт списка']]);
});

test('hints land on the same words in the source',()=>{
 const blocks=sourceBlocks(src),b=blocks[1],at=b.text.indexOf('в кратчайшие сроки');
 const [hint]=mergeIssues(blocks,{local:[{block:1,start:at,end:at+'в кратчайшие сроки'.length,id:'x',label:'Штамп'}]});
 assert.equal(src.slice(hint.start,hint.end),'в кратчайшие сроки');
 const [typo]=mergeIssues(blocks,{spelling:[{word:'Вторая',suggestions:[]}]});
 assert.equal(src.slice(typo.start,typo.end),'Вторая');
});

test('unclosed marks do not rescan the line, links with inner parentheses still parse',()=>{
 for(const bad of ['<a'.repeat(80000),'!['.repeat(80000),']('.repeat(80000),'![a]('.repeat(40000)]){
  const t=performance.now();sourceBlocks(bad);assert.ok(performance.now()-t<1000,bad.slice(0,6)+' took too long');
 }
 assert.equal(sourceBlocks('Смотри [вики](https://ru.wikipedia.org/wiki/Тест_(значения)) и <b>жирный</b> ![x](a.png) текст.')[0].text,'Смотри вики и жирный   текст.');
 assert.equal(sourceBlocks('a ](b <c')[0].text,'a ](b <c');
 const long='x'.repeat(200000),[b]=sourceBlocks('Строка\n'+long);
 assert.equal(b.text.length,7+long.length);
});
