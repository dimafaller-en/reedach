import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {words,known,misspelled,Suggester} from '../src/spell.mjs';
const skip=spawnSync('hunspell',['-v']).error?'hunspell is not installed':false;

test('spelling input: links, e-mails, abbreviations and numbers are left out',()=>{
 assert.deepEqual(words('Текст про сайт https://x.ru/путь и почту a@b.ru, SMM и iPhone 15, как-то так, abc123'),['Текст','про','сайт','почту','iPhone','как-то','так']);
 assert.deepEqual(words("It isn't true, they couldn’t care 'слово'"),['It','true','they','care','слово']);
});

test('own words accept their forms but not unrelated words',()=>{
 const own=['нейросеть','заматировать','продажник'];
 assert.ok(known('нейросетями',own));
 assert.ok(known('заматировали',own));
 assert.ok(known('продажника',own));
 assert.ok(!known('продажа',own));
 assert.ok(!known('заматывали',own));
});

test('hunspell finds typos and suggests fixes',{skip},async()=>{
 assert.deepEqual(await misspelled(['Я','превет','передаю','собственой','компании']),['превет','собственой']);
 const sg=new Suggester();
 try{
  assert.ok((await sg.suggest('собственой')).includes('собственной'));
  assert.deepEqual(await sg.suggest('компании'),[]);
  const [a,b]=await Promise.all([sg.suggest('превет'),sg.suggest('провверка')]);
  assert.ok(a.includes('привет')&&b.includes('проверка'),'parallel asks get their own answers');
 }finally{sg.close();}
});

test('text cannot become a hunspell command and own words are not remembered',{skip},async()=>{
 const sg=new Suggester();
 try{
  assert.deepEqual(await sg.suggest('*превет'),[]);
  assert.deepEqual(await sg.suggest('@превет'),[]);
  assert.deepEqual(await sg.suggest('a\nb'),[]);
  assert.ok((await sg.suggest('превет')).length>0,'the word is still unknown after the attempts');
 }finally{sg.close();}
});

test('a hung hunspell is replaced and the next word still works',{skip},async()=>{
 const sg=new Suggester({wordTimeout:1});
 try{
  await assert.rejects(sg.suggest('собственой'));
  sg.wordTimeout=5000;
  assert.ok((await sg.suggest('превет')).includes('привет'));
 }finally{sg.close();}
});
