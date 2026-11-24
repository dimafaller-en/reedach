import test from 'node:test';
import assert from 'node:assert/strict';
import {checkStyle} from '../src/style.js';
import {mergeIssues,sourceBlocks,textBlocks} from '../src/markdown.js';

const markdownHints=(src,opts)=>{
 const blocks=sourceBlocks(src);
 return mergeIssues(blocks,{local:checkStyle(blocks,opts)});
};
const apply=(src,it)=>src.slice(0,it.start)+it.replace[0]+src.slice(it.end);

test('keep Markdown advice, but never replace through markup',()=>{
 for(const src of ['О нашей [компании](https://example.ru/about).','О нашей **компании**.','О нашей\nкомпании.']){
  const hit=markdownHints(src).find(it=>it.id==='pronoun-ours');
  assert.ok(hit?.fix,src);
  for(const key of ['replace','variants','exact','edit'])assert.equal(hit[key],undefined,key+' in '+src);
 }
 const src='🔎 **О нашей компании**.';
 const hit=markdownHints(src).find(it=>it.id==='pronoun-ours');
 assert.equal(apply(src,hit),'🔎 **о компании**.');
});

test('Markdown rejects unsafe explicit and server-supplied edits',()=>{
 const blocks=sourceBlocks('Наша [компания](https://example.ru).'),end=blocks[0].text.indexOf('.');
 const [it]=mergeIssues(blocks,{style:[{block:0,start:0,end,replace:['Компания'],edit:{start:0,end,text:'Компания'}}]});
 assert.ok(it);
 assert.equal(it.replace,undefined);
 assert.equal(it.edit,undefined);
});

test('digit grouping distinguishes IPv4, IDs and postcodes from amounts',()=>{
 const src='IP 192.168.100.200, заказ ORD123456 и ЗАКАЗ_123456, адрес 123456, г. Москва. Суммы 123456, 1500000 и 1.500.000 ₽.';
 const hits=checkStyle(textBlocks(src)).filter(it=>it.id==='typo-digits');
 assert.deepEqual(hits.map(it=>[src.slice(it.start,it.end),it.replace[0]]),
  [['123456','123\u00a0456'],['1500000','1\u00a0500\u00a0000'],['1.500.000','1\u00a0500\u00a0000']]);
});

test('optional ё leaves URL and email intact without skipping nearby prose',()=>{
 const src='партнер@компания.рф\u00a0Еще https://сайт.рф/отчет/2026\tотчет';
 const hits=checkStyle(textBlocks(src),{yo:true}).filter(it=>it.id==='typo-yo');
 assert.deepEqual(hits.map(it=>[src.slice(it.start,it.end),it.replace[0]]),[['Еще','Ещё'],['отчет','отчёт']]);
 const md='**Еще** пред**отчет**? [отчет](https://сайт.рф/отчет/2026) и от**чет**.';
 const fixes=markdownHints(md,{yo:true}).filter(it=>it.id==='typo-yo');
 assert.deepEqual(fixes.map(it=>md.slice(it.start,it.end)),['Еще','отчет']);
 assert.equal(apply(md,fixes[1]),'**Еще** пред**отчет**? [отчёт](https://сайт.рф/отчет/2026) и от**чет**.');
});
