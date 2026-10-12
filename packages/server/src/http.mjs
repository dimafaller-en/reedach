import http from 'node:http';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash,timingSafeEqual} from 'node:crypto';
import {check,suggest,rules} from './check.mjs';
// HTTP API. Every /v1 call needs a key. A key may list the sites whose pages can call it from the browser;
// calls without an Origin header (from a site's own server) work with any valid key.
// The server keeps nothing: texts are not stored and not logged.

// "key1=https://a.ru,https://www.a.ru; key2" → [{key, origins}]. A key may itself contain "=" (base64):
// the sites start only at "=http://" or "=https://".
const origin=o=>{try{return new URL(o).origin;}catch{throw new Error('Неверный адрес сайта: '+o);}};
export function parseKeys(value){
 const keys=String(value??'').split(/[;\n]/).map(s=>s.trim()).filter(Boolean).map(entry=>{
  const m=/^(.*?)=(https?:\/\/.*)$/i.exec(entry),key=(m?m[1]:entry).trim();
  return {key,origins:m?m[2].split(/[,\s]+/).filter(Boolean).map(origin):[]};
 });
 for(const k of keys)if(k.key.length<16)throw new Error('Ключ доступа должен быть не короче 16 символов');
 if(new Set(keys.map(k=>k.key)).size<keys.length)throw new Error('Один и тот же ключ указан дважды');
 return keys;
}
const digest=s=>createHash('sha256').update(s).digest();
const fail=(status,code,message)=>Object.assign(new Error(message),{status,code});

// Demo page from reedach-widget: four fixed files read once, nothing else is served.
function demoFiles(){
 let base;try{base=import.meta.resolve('reedach-widget/package.json');}catch{throw new Error('Для страницы-примера установите пакет reedach-widget');}
 const file=p=>fileURLToPath(new URL(p,base));
 const types={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8'};
 const map={'/demo/':'demo/index.html','/demo/demo.css':'demo/demo.css','/demo/demo.js':'demo/demo.js','/demo/reedach.min.js':'dist/reedach.min.js'};
 return new Map(Object.entries(map).map(([url,p])=>[url,{body:readFileSync(file(p)),type:types[p.split('.').pop()]}]));
}

export function createServer({keys,maxBytes=1_000_000,concurrency=2,queue=20,demo=false}={}){
 if(!keys?.length)throw new Error('Нужен хотя бы один ключ доступа');
 const pages=demo?demoFiles():null;
 const entries=keys.map(k=>({...k,hash:digest(k.key)})),siteOrigins=new Set(entries.flatMap(k=>k.origins));
 const find=token=>{const h=digest(token);let hit=null;for(const k of entries)if(timingSafeEqual(h,k.hash))hit=k;return hit;};
 let active=0;const waiting=[];
 const slot=()=>{if(active<concurrency){active++;return Promise.resolve();}if(waiting.length>=queue)throw fail(503,'busy','Сервер занят, попробуйте позже');return new Promise(resolve=>waiting.push(resolve));};
 const release=()=>{const next=waiting.shift();if(next)next();else active--;};

 const server=http.createServer(async(req,res)=>{
  const origin=req.headers.origin,headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
  const send=(status,body,extra={})=>{if(res.headersSent)return;res.writeHead(status,{...headers,...extra});res.end(JSON.stringify(body));};
  try{
   const url=new URL(req.url,'http://localhost');
   if(url.pathname==='/health'&&req.method==='GET')return send(200,{ok:true});
   if(pages&&req.method==='GET'&&(url.pathname==='/demo'||pages.has(url.pathname))){
    if(url.pathname==='/demo'){res.writeHead(308,{location:'/demo/'});return res.end();}
    const page=pages.get(url.pathname);
    res.writeHead(200,{'content-type':page.type,'cache-control':'no-cache','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"});
    return res.end(page.body);
   }
   if(req.method==='OPTIONS'){
    if(!origin||!siteOrigins.has(origin))return send(403,{error:{code:'origin',message:'Этому сайту доступ не разрешён'}});
    res.writeHead(204,{'access-control-allow-origin':origin,'access-control-allow-methods':'GET, POST','access-control-allow-headers':'authorization, content-type','access-control-max-age':'600',vary:'Origin'});return res.end();
   }
   const auth=/^Bearer\s+(\S+)$/i.exec(req.headers.authorization||''),key=auth&&find(auth[1]);
   if(origin&&siteOrigins.has(origin))Object.assign(headers,{'access-control-allow-origin':origin,vary:'Origin'});
   if(!key)throw fail(401,'unauthorized','Нужен ключ доступа');
   if(origin&&!key.origins.includes(origin))throw fail(403,'origin','Этот ключ не работает на этом сайте');
   if(url.pathname==='/v1/rules'&&req.method==='GET')return send(200,rules());
   const route=url.pathname==='/v1/check'?b=>check(b):url.pathname==='/v1/suggest'?b=>suggest(b?.words):null;
   if(!route)throw fail(404,'not_found','Нет такого адреса');
   if(req.method!=='POST')throw fail(405,'method','Используйте POST');
   if(!/^application\/json\b/i.test(req.headers['content-type']||''))throw fail(415,'content_type','Нужен JSON');
   const body=await readJson(req,maxBytes);
   await slot();
   try{return send(200,await route(body));}finally{release();}
  }catch(e){
   const status=e.status||500;
   if(status>=500&&e.code!=='busy'&&!e.code?.startsWith('spell_'))console.error('reedach:',e.code||e.name);
   send(status,{error:{code:e.code||'internal',message:status===500?'Внутренняя ошибка':e.message}},e.code==='busy'?{'retry-after':'5'}:status===413?{connection:'close'}:{});
  }
 });
 server.requestTimeout=30000;server.headersTimeout=10000;
 return server;
}

function readJson(req,maxBytes){
 return new Promise((resolve,reject)=>{
  if(Number(req.headers['content-length'])>maxBytes)return reject(fail(413,'too_large','Слишком большой текст'));
  const chunks=[];let size=0;
  req.on('data',chunk=>{size+=chunk.length;if(size>maxBytes){chunks.length=0;reject(fail(413,'too_large','Слишком большой текст'));}else chunks.push(chunk);});
  req.on('end',()=>{if(size>maxBytes)return;try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{reject(fail(400,'bad_json','Неверный JSON'));}});
  req.on('error',reject);
 });
}
