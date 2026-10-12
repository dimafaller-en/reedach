import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {check,rules,closeChecks} from '../src/index.mjs';
const skip=spawnSync('hunspell',['-v']).error?'hunspell is not installed':false;
after(closeChecks);

test('markdown: spelling, morphology and dictionary hints point into the source',{skip},async()=>{
 const markdown='## Заголовок\n\nВ настоящее время мы осуществляем доставку. Сделав работу, мы ушли.\n\nЯ превет передаю [Glaskraft](https://x.ru).';
 const {issues}=await check({markdown});
 const at=id=>issues.filter(it=>it.id===id).map(it=>markdown.slice(it.start,it.end));
 assert.deepEqual(at('time-parasite-start'),['В настоящее время']);
 assert.deepEqual(at('weak-verb-noun'),['осуществляем доставку']);
 assert.deepEqual(at('gerund-start'),['Сделав работу']);
 assert.deepEqual(at('spelling'),['превет','Glaskraft']);
 const typo=issues.find(it=>it.word==='превет');
 assert.ok(typo.suggestions.includes('привет'));
 assert.equal(typo.block,undefined);
});

test('own words, switched-off rules and chosen checks',{skip},async()=>{
 const markdown='Мы очень любим Glaskraft и нейросетями пользуемся.';
 const {issues}=await check({markdown,ignore:['Glaskraft','нейросеть'],disable:['evaluation'],checks:['spelling','style']});
 assert.deepEqual(issues.map(it=>it.id),[]);
});

test('plain text keeps offsets; blocks get block-relative hints',async()=>{
 const text='Это был очень долгий проект.\n\nОчень хотим ещё.';
 const one=await check({text,checks:['style']});
 assert.deepEqual(one.issues.filter(it=>it.id==='intensifiers').map(it=>text.slice(it.start,it.end).toLowerCase()),['очень','очень']);
 const two=await check({blocks:[{text:'Заголовок',kind:'h'},{text:'Это был очень долгий проект.',kind:'p'}],checks:['style']});
 const hit=two.issues.find(it=>it.id==='intensifiers');
 assert.equal(hit.block,1);assert.equal('Это был очень долгий проект.'.slice(hit.start,hit.end),'очень');
});

test('emoji do not shift offsets in text and blocks',{skip},async()=>{
 const text='Hello 😀 тест превет';
 for(const input of [{text},{blocks:[{text,kind:'p'}]}]){
  const [hit]=(await check({...input,checks:['spelling']})).issues;
  assert.equal(text.slice(hit.start,hit.end),'превет');
 }
});

test('bad input is refused with a clear error',async()=>{
 await assert.rejects(check({}),{status:422});
 await assert.rejects(check({markdown:'текст',ignore:'слово'}),{status:422});
 await assert.rejects(check({blocks:[{kind:'p'}]}),{status:422});
});

test('rules list covers dictionary, built-in and morphology rules',()=>{
 const {rules:list,categories}=rules(),ids=new Set(list.map(r=>r.id));
 for(const id of ['intensifiers','long-sentence','gerund-start'])assert.ok(ids.has(id),id);
 assert.equal(ids.size,list.length);
 assert.ok(list.every(r=>r.message&&r.label));
 assert.equal(categories.spelling,'Орфография');
});
