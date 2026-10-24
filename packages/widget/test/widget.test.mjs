import test from 'node:test';
import assert from 'node:assert/strict';
import {shiftIssues,localDictionary,request,esc} from '../src/core.js';
import {STRINGS,strings} from '../src/i18n.js';

test('typing keeps marks before the edit, moves those after it and drops the touched ones',()=>{
 const old='один два три',issues=[{start:0,end:4},{start:5,end:8},{start:9,end:12}];
 assert.deepEqual(shiftIssues(issues,old,'один двва три'),[{start:0,end:4},{start:10,end:13}]);
 // Typing right at the start of a mark may change that word, so the mark goes until the next check.
 assert.deepEqual(shiftIssues(issues,old,'новое один два три').map(i=>i.start),[11,15]);
});

test('a ready edit moves with its hint, and typing anywhere inside the edit drops the hint',()=>{
 // «Не секрет, что цены растут.»: the hint is «Не секрет», its edit takes «, что ц» too
 const old='Да. Не секрет, что цены растут.',issues=[{start:4,end:13,edit:{start:4,end:20,text:'Ц',remove:true}}];
 assert.deepEqual(shiftIssues(issues,old,'Ну да. Не секрет, что цены растут.'),[{start:7,end:16,edit:{start:7,end:23,text:'Ц',remove:true}}]);
 assert.deepEqual(shiftIssues(issues,old,'Да. Не секрет, что цены быстро растут.'),issues);
 assert.deepEqual(shiftIssues(issues,old,'Да. Не секрет, что все цены растут.'),[]);
});

test('own words live in the browser and survive a blocked storage',()=>{
 const data={},storage={getItem:k=>data[k]??null,setItem:(k,v)=>{data[k]=v;}};
 const dict=localDictionary(storage);
 dict.add('Glaskraft');dict.add('Glaskraft');
 assert.deepEqual(dict.list(),['Glaskraft']);
 const broken=localDictionary({getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}});
 assert.doesNotThrow(()=>broken.add('слово'));
 assert.deepEqual(broken.list(),[]);
 assert.deepEqual(localDictionary(null).list(),[]);
 const had=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('SecurityError');}});
 try{const blocked=localDictionary();assert.doesNotThrow(()=>blocked.add('слово'));assert.deepEqual(blocked.list(),[]);}
 finally{if(had)Object.defineProperty(globalThis,'localStorage',had);else delete globalThis.localStorage;}
});

test('requests carry the key and turn server errors into readable messages',async()=>{
 let seen;
 const ok=async(url,init)=>{seen={url,init};return {ok:true,json:async()=>({issues:[]})};};
 assert.deepEqual(await request('https://x.example/v1/','/check',{text:'a'},{key:'k',fetch:ok}),{issues:[]});
 assert.equal(seen.url,'https://x.example/v1/check');
 assert.equal(seen.init.headers.authorization,'Bearer k');
 const noKey=async(url,init)=>{seen={url,init};return {ok:true,json:async()=>({})};};
 await request('/proxy','/check',{},{fetch:noKey});
 assert.equal(seen.init.headers.authorization,undefined);
 const bad=async()=>({ok:false,status:401,json:async()=>({error:{code:'unauthorized',message:'Нужен ключ доступа'}})});
 await assert.rejects(request('/v1','/check',{},{fetch:bad}),{message:'Нужен ключ доступа',status:401});
});

test('both interface languages have every string; unknown languages fall back to Russian',()=>{
 assert.deepEqual(Object.keys(STRINGS.en).sort(),Object.keys(STRINGS.ru).sort());
 assert.equal(strings('en-GB')('add',{word:'x'}),'Add “x” to the dictionary');
 assert.equal(strings('de')('close'),'Закрыть');
 assert.equal(esc('<b a="1">&\''),'&lt;b a=&quot;1&quot;&gt;&amp;&#39;');
});
