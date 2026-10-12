// One-file build for <script>: every <textarea data-reedach> gets the widget; window.Reedach.attach for the rest.
// <textarea data-reedach data-reedach-endpoint="https://checker.example/v1" data-reedach-key="…"
//   data-reedach-format="markdown" data-reedach-panel="#hints" data-reedach-lang="en"></textarea>
import {attach} from './widget.js';
import {localDictionary} from './core.js';

export function init(root=document){
 for(const el of root.querySelectorAll('textarea[data-reedach]')){
  const d=el.dataset;
  attach(el,{endpoint:d.reedachEndpoint||null,key:d.reedachKey||null,format:d.reedachFormat||'text',lang:d.reedachLang,panel:d.reedachPanel?document.querySelector(d.reedachPanel):null});
 }
}
globalThis.Reedach={attach,init,localDictionary};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>init(),{once:true});else init();
