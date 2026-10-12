# reedach-widget

Виджет Reedach: подсказки по русскому тексту прямо в поле ввода (`textarea`) на любом
сайте. Подсветка лежит поверх текста, список замечаний обновляется, пока автор пишет.

- **Без сервера** работает словарь стиля: канцелярит, штампы, вода, длинные предложения.
- **С сервером Reedach** добавляются орфография с вариантами исправления и морфология.
- Нажатие на вариант заменяет слово в поле, Ctrl+Z отменяет замену.
- «Добавить в словарь» запоминает слово в браузере автора, а сайт может подключить своё
  хранилище.
- Интерфейс на русском и английском. Сами подсказки на русском: они объясняют русский текст.

Подсветка работает в Chrome и Edge 105+, Safari 17.2+, Firefox 140+. В старых браузерах
будет только список замечаний.

## Подключение одной строкой

```html
<script src="https://cdn.jsdelivr.net/npm/reedach-widget@0.1.0/dist/reedach.min.js" defer></script>

<textarea data-reedach
  data-reedach-endpoint="https://checker.example.ru/v1"
  data-reedach-key="ключ-сайта"
  data-reedach-format="markdown"
  data-reedach-panel="#hints"></textarea>
<div id="hints"></div>
```

Все атрибуты, кроме `data-reedach`, необязательны. Без `data-reedach-endpoint` проверка идёт
только в браузере. Без `data-reedach-panel` список появится сразу под полем.

Ключ в коде страницы виден любому посетителю. Привяжите его на сервере к адресу своего
сайта (см. README сервера) или отправляйте запросы через сервер сайта: тогда укажите в
`data-reedach-endpoint` адрес своего посредника, а ключ не указывайте.

## Из кода

```js
import {attach} from 'reedach-widget';

const checker = attach(document.querySelector('textarea'), {
  endpoint: '/api/reedach',      // сервер Reedach или посредник с тем же API; без него — только стиль
  key: null,                     // ключ, если браузер обращается к серверу Reedach напрямую
  format: 'markdown',            // 'text' (по умолчанию) или 'markdown'
  panel: document.querySelector('#hints'),  // куда выводить список; без него — под полем
  lang: 'en',                    // язык интерфейса; по умолчанию берётся из <html lang>
  delay: 1000,                   // пауза перед повторной проверкой, мс
  disable: ['intensifiers'],     // выключить правила по id или целые категории
  dictionary: {                  // своё хранилище слов автора; по умолчанию — localStorage
    list: async () => ['Glaskraft'],
    add: async word => { /* сохранить у себя */ },
  },
  onChange: issues => {},        // после каждой проверки
  onClose: () => {},             // когда автор нажал «Закрыть»
});

checker.check();   // проверить сейчас
checker.stop();    // убрать подсветку и список
```

Повторный `attach()` на то же поле запускает проверку заново. Если сайт меняет текст в поле из кода,
а не руками автора, вызовите `checker.check()` или отправьте полю событие `input`.

## Оформление

Виджет не приносит своих цветов и шрифтов, только служебные стили, которые держат подсветку
точно над текстом. Остальное задаёт сайт:

```css
::highlight(reedach-word)  { background-color: rgba(215, 242, 91, .6); }   /* слова и обороты */
::highlight(reedach-long)  { background-color: rgba(96, 112, 214, .14); }  /* длинные предложения и абзацы */
::highlight(reedach-spell) { text-decoration: underline wavy #c0392b; }    /* опечатки */
::highlight(reedach-active){ background-color: #ffd54a; }                  /* место, куда перешли из списка */
.reedach-mirror { mix-blend-mode: multiply; }  /* на тёмном фоне — screen */
```

Список и подсказка при наведении собраны из элементов с классами `reedach-*`:
`reedach-panel`, `reedach-head`, `reedach-title`, `reedach-count`, `reedach-close`,
`reedach-status`, `reedach-error`, `reedach-list`, `reedach-item` (с `reedach-spell`,
`reedach-word` или `reedach-long`), `reedach-jump`, `reedach-label`, `reedach-fragment`,
`reedach-message`, `reedach-actions`, `reedach-variant`, `reedach-action`, `reedach-note`,
`reedach-credit`, `reedach-tooltip`. Готовый пример стилей для светлой и тёмной темы лежит
в [`demo/demo.css`](demo/demo.css), начиная со строки `/* Widget */`.

## Страница-пример

Сервер Reedach показывает её по адресу `/demo/`, если запустить его с `REEDACH_DEMO=1`:

```bash
docker run -p 3000:3000 -e REEDACH_DEMO=1 -e REEDACH_KEYS="демо-ключ-не-короче-16=http://localhost:3000" reedach
```

Откройте `http://localhost:3000/demo/` и введите ключ.

MIT, © 2026 Дима Фаллер.
