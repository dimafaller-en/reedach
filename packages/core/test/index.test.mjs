import test from 'node:test';
import assert from 'node:assert/strict';
import {checkStyle,sourceBlocks,mergeIssues,RULES} from 'yasno';

test('the README example finds hints at their place in the source',()=>{
 const markdown='В настоящее время мы осуществляем монтаж перегородок.';
 const blocks=sourceBlocks(markdown),issues=mergeIssues(blocks,{local:checkStyle(blocks)});
 const found=issues.map(it=>markdown.slice(it.start,it.end).toLowerCase());
 assert.ok(found.includes('в настоящее время'));
 assert.ok(found.some(f=>f.startsWith('осуществля')));
 for(const it of issues)assert.ok(it.label&&it.message,'every hint explains itself');
});

test('plain blocks work without Markdown and rules have unique ids',()=>{
 assert.ok(checkStyle([{text:'Это был очень долгий проект.',kind:'p'}]).some(it=>it.id==='intensifiers'));
 assert.equal(new Set(RULES.map(r=>r.id)).size,RULES.length);
});
