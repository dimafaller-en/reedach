// Demo page: the widget talks to the server that serves this page.
const $=s=>document.querySelector(s),form=$('#settings'),key=$('#key'),format=$('#format'),lang=$('#lang'),text=$('#text'),hints=$('#hints');
const saved=(()=>{try{return JSON.parse(localStorage.getItem('reedach-demo')||'{}');}catch{return {};}})();
key.value=saved.key||'';format.value=saved.format||'text';lang.value=saved.lang||'ru';
let checker=null;

function translate(){
 document.documentElement.lang=lang.value;
 for(const el of document.querySelectorAll('[data-ru]'))el.textContent=el.dataset[lang.value]??el.dataset.ru;
}
function start(){
 checker?.stop();
 checker=Reedach.attach(text,{endpoint:location.origin+'/v1',key:key.value.trim()||null,format:format.value,lang:lang.value,panel:hints,onClose:()=>{checker=null;}});
}
function save(){try{localStorage.setItem('reedach-demo',JSON.stringify({key:key.value.trim(),format:format.value,lang:lang.value}));}catch{}}

form.addEventListener('submit',e=>{e.preventDefault();save();start();});
form.addEventListener('change',()=>{save();translate();if(checker)start();});
translate();start();
