#!/usr/bin/env node
import {createServer,parseKeys} from './http.mjs';
import {closeChecks} from './check.mjs';
// Settings come from the environment; without a key the server refuses to start.
const env=process.env,num=(name,fallback)=>{const v=Number(env[name]);return Number.isFinite(v)&&v>0?v:fallback;};
let keys;
try{keys=parseKeys(env.REEDACH_KEYS);if(!keys.length)throw new Error('Задайте REEDACH_KEYS: ключ=https://ваш-сайт.ru; второй-ключ');}
catch(e){console.error('reedach: '+e.message);process.exit(1);}
const server=createServer({keys,maxBytes:num('REEDACH_MAX_BYTES',1_000_000),concurrency:num('REEDACH_CONCURRENCY',2),queue:num('REEDACH_QUEUE',20)});
const port=num('PORT',3000),host=env.HOST||'0.0.0.0';
server.listen(port,host,()=>console.log('reedach: слушаю '+host+':'+port+', ключей: '+keys.length));
const stop=()=>{server.close(()=>process.exit(0));closeChecks();setTimeout(()=>process.exit(0),5000).unref();};
process.on('SIGTERM',stop);process.on('SIGINT',stop);
