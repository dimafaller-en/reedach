import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer,parseKeys,closeChecks} from '../src/index.mjs';

const SITE='https://site.example',KEY='site-key-0123456789',BACK='backend-key-0123456789';
let server,base;
before(async()=>{server=createServer({keys:parseKeys(KEY+'='+SITE+'; '+BACK),maxBytes:2000});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;});
after(()=>{server.close();closeChecks();});
const call=(path,{key,origin,body,method=body?'POST':'GET',type='application/json'}={})=>fetch(base+path,{method,headers:{...(key&&{authorization:'Bearer '+key}),...(origin&&{origin}),...(body&&{'content-type':type})},body:body&&(typeof body==='string'?body:JSON.stringify(body))});
const style={markdown:'Это был очень долгий проект.',checks:['style']};

test('keys must be long enough',()=>{
 assert.throws(()=>parseKeys('short'));
 assert.deepEqual(parseKeys(KEY+'='+SITE+'/,https://b.example; '+BACK),[{key:KEY,origins:[SITE,'https://b.example']},{key:BACK,origins:[]}]);
 assert.deepEqual(parseKeys('aGVsbG8td29ybGQtMTIzNA==; aGVsbG8td29ybGQtNTY3OA===https://Site.Example'),[{key:'aGVsbG8td29ybGQtMTIzNA==',origins:[]},{key:'aGVsbG8td29ybGQtNTY3OA==',origins:[SITE]}]);
 assert.throws(()=>parseKeys(KEY+'; '+KEY),/дважды/);
 assert.throws(()=>parseKeys(KEY+'=https://'),/адрес/);
});

test('health is open, everything else needs a key',async()=>{
 assert.equal((await call('/health')).status,200);
 assert.equal((await call('/v1/check',{body:style})).status,401);
 assert.equal((await call('/v1/check',{key:'wrong-key-0123456789',body:style})).status,401);
 const ok=await call('/v1/check',{key:BACK,body:style});
 assert.equal(ok.status,200);
 assert.ok((await ok.json()).issues.some(it=>it.id==='intensifiers'));
});

test('a site key works only from its own site; a server key not from browsers',async()=>{
 const own=await call('/v1/check',{key:KEY,origin:SITE,body:style});
 assert.equal(own.status,200);assert.equal(own.headers.get('access-control-allow-origin'),SITE);
 assert.equal((await call('/v1/check',{key:KEY,origin:'https://evil.example',body:style})).status,403);
 assert.equal((await call('/v1/check',{key:BACK,origin:SITE,body:style})).status,403);
 assert.equal((await call('/v1/check',{key:KEY,body:style})).status,200,'the site server may call without Origin');
 const pre=await call('/v1/check',{method:'OPTIONS',origin:SITE});
 assert.equal(pre.status,204);assert.match(pre.headers.get('access-control-allow-headers'),/authorization/);
 assert.equal((await call('/v1/check',{method:'OPTIONS',origin:'https://evil.example'})).status,403);
});

test('limits and bad requests',async()=>{
 assert.equal((await call('/v1/check',{key:BACK,body:{markdown:'а'.repeat(3000)}})).status,413);
 assert.equal((await call('/v1/check',{key:BACK,body:'{нет'})).status,400);
 assert.equal((await call('/v1/check',{key:BACK,body:'{}',type:'text/plain'})).status,415);
 assert.equal((await call('/v1/check',{key:BACK,body:{}})).status,422);
 assert.equal((await call('/v1/nope',{key:BACK,body:{}})).status,404);
 assert.equal((await call('/v1/check',{key:BACK})).status,405);
});

test('rules are listed for settings screens',async()=>{
 const res=await call('/v1/rules',{key:BACK});
 assert.equal(res.status,200);
 assert.ok((await res.json()).rules.length>50);
});
