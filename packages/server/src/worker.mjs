import {parentPort} from 'node:worker_threads';
import {check} from './check.mjs';
// One check per message, in a worker thread: a heavy text stalls only this worker, never the HTTP server.
// hunspell is asked for from the main thread: a process started here would stay a zombie when the worker
// is stopped on timeout, because only the thread that started a process collects its exit.
let seq=0;const asked=new Map();
const ask=(op,arg)=>new Promise((resolve,reject)=>{const id=++seq;asked.set(id,{resolve,reject});parentPort.postMessage({ask:{id,op,arg}});});
const spell={suggester:{suggest:word=>ask('suggest',word)},misspelled:list=>ask('misspelled',list)};
parentPort.on('message',async m=>{
 if(m.answer){
  const {id,value,error}=m.answer,wait=asked.get(id);asked.delete(id);
  if(error)wait?.reject(Object.assign(new Error(error.message),error));else wait?.resolve(value);
  return;
 }
 try{parentPort.postMessage({result:await check(m.input,spell)});}
 catch(e){parentPort.postMessage({error:{message:e.message,status:e.status,code:e.code}});}
});
