import test from 'node:test';
import assert from 'node:assert/strict';
import {check} from '../src/check.mjs';

// The variant of a hint in the found word's form (forms.mjs, moved from the Yokey keyboard with its forms.json):
// [text, fragment, the replacement or null]. Refusals: a genitive after the phrase, another gender of the noun,
// another animacy in the accusative or the genitive.
const FORMS=[
 ['Мы оказываем содействие клиентам.','оказываем содействие','помогаем'],
 ['Текст.\n\nМы оказываем содействие клиентам.','оказываем содействие','помогаем'],
 ['Мы предоставляем возможность выбора.','предоставляем возможность',null],
 ['Мы предоставляем возможность выбрать.','предоставляем возможность','позволяем'],
 ['Отправьте дашборды.','дашборды',null],
 ['Мы предоставляем возможность только одного выбора.','предоставляем возможность',null],
 ['Мы производим оплату именно этого заказа.','производим оплату',null],
 ['Компания оказывала влияние на рынок.','оказывала влияние','влияла'],
 ['Мы производим оплату картой.','производим оплату','оплачиваем'],
 ['Нужно производить оплату вовремя.','производить оплату','оплачивать'],
 ['Мы производим оплату заказа.','производим оплату',null],
 ['Мы приобрели станок.','приобрели','купили'],
 ['Мы приобретаем станки.','приобретаем','покупаем'],
 ['Приобретение станка заняло месяц.','Приобретение',null],
 ['Мы предоставляем скидку постоянным клиентам.','предоставляем скидку','даём скидку'],
 ['Мы информируем вас о переезде.','информируем вас','сообщаем'],
 ['Ввод в эксплуатацию занял неделю.','Ввод в эксплуатацию','запуск'],
 ['Это был финальный аккорд вечера.','финальный аккорд','финал'],
 ['Мы прошли тернистый путь.','тернистый путь','трудный путь'],
 ['Отправьте скриншоты ошибки.','скриншоты','снимки экрана'],
 ['Нужно надлежащее качество.','надлежащее','правильное'],
 ['Готов роадмап.','роадмап',null],
 ['Нам нужен тимлид.','тимлид','руководитель группы'],
 ['Это мастхэв сезона.','мастхэв',null],
 ['Их коллабом гордятся.','коллабом','совместным проектом'],
];

test('the variant of a hint in the found word\'s form',async()=>{
 const got=[];
 for(const [text,fragment] of FORMS){
  const {issues}=await check({text,checks:['morph','style']}),at=issues.filter(x=>text.slice(x.start,x.end)===fragment);
  got.push([text,fragment,at.length?at[0].replace?.[0]??null:'(no hint)']);
 }
 assert.deepEqual(got,FORMS);
});

test('no variant across Markdown or a line break',async()=>{
 const replaced=async input=>(await check({...input,checks:['morph','style']})).issues.filter(x=>x.replace&&/оказыва/i.test((input.markdown??input.text).slice(x.start,x.end))).length;
 assert.equal(await replaced({markdown:'Мы оказываем **содействие** клиентам.'}),0);
 assert.equal(await replaced({text:'Мы оказываем\nсодействие клиентам.'}),0);
 assert.ok(await replaced({markdown:'Мы **оказываем содействие** клиентам.'})>=1);
});
