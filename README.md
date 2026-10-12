# Reedach

Лёгкая проверка русского текста для сайтов и редакторов: канцелярит, штампы, вода,
неконкретные и оценочные слова, длинные предложения и абзацы. Подсказывает, что можно
сказать проще, и объясняет почему.

Reedach работает у вас: в браузере или на вашем сервере. Текст никуда не отправляется.

Это подсказки, а не приговор. Проверка ищет по словарю и простым правилам, поэтому
иногда ошибается. Она не заменяет редактора и профессиональные сервисы.

> Проект в разработке. Готовы ядро со словарём правил и сервер с орфографией и
> морфологией. Виджет для любого сайта и плагин WordPress — следующие этапы.

## Из чего состоит

| Часть | Что делает | Состояние |
|---|---|---|
| `packages/core` (npm `reedach`) | Словарь правил и проверка стиля, разбор Markdown. Без зависимостей, работает в браузере и в Node | готово |
| `packages/server` | HTTP API и Docker-образ: орфография (hunspell) и морфология (Az.js + OpenCorpora) | готово |
| `packages/widget` | Подсветка замечаний прямо в поле ввода на любом сайте | позже |
| WordPress | Плагин для редактора Gutenberg | позже |

## Как пользоваться ядром

```js
import {checkStyle, sourceBlocks, mergeIssues} from 'reedach';

const markdown = 'В настоящее время мы осуществляем монтаж перегородок.';
const blocks = sourceBlocks(markdown);              // абзацы, пункты списков, заголовки
const issues = mergeIssues(blocks, {local: checkStyle(blocks)});

for (const it of issues)
  console.log(markdown.slice(it.start, it.end), '—', it.label, '—', it.message, it.fix);
```

`start` и `end` указывают на место в исходном тексте, поэтому замечание можно подсветить
прямо в поле ввода.

Блоки можно передать и без Markdown: `checkStyle([{text: '…', kind: 'p'}])`. Виды блоков:
`p` — абзац, `li` — пункт списка, `h` — заголовок. Длину предложения и абзаца можно
настроить: `checkStyle(blocks, {maxSentenceWords: 25, maxParagraphWords: 120})`.

## Сервер: орфография и морфология

Сервер можно подключить библиотекой (`import {check} from 'reedach-server'`) или запустить
в Docker и отправлять запросы по HTTP. Как настроить ключи и какие есть запросы — в
[packages/server/README.md](packages/server/README.md).

## Словарь

Правила лежат в [`packages/core/src/rules.js`](packages/core/src/rules.js): у каждого есть
категория, объяснение, совет и список слов. Звёздочка в конце слова означает «любое
окончание»: `осуществл*`.

Формулировки написаны для проекта самостоятельно по открытым статьям об информационном
стиле (Максим Ильяхов, Бюро Горбунова). Проект не связан с сервисом «Главред».
Источники и лицензии сторонних частей — в [NOTICE.md](NOTICE.md).

## Проверка

```bash
npm test
```

Для тестов орфографии нужна программа hunspell. Если её нет, эти тесты пропускаются.

## Лицензия

MIT, © 2026 Дима Фаллер.

---

## In English

Reedach is a lightweight style checker for Russian text: bureaucratese, clichés, filler and
vague words, long sentences. It runs in the browser or on your own server, and the text never
leaves it. The core package `reedach` has no dependencies. The self-hosted server `reedach-server` adds spelling
(hunspell) and morphology (Az.js + OpenCorpora), as a library or an HTTP API in Docker. A drop-in
widget and a WordPress plugin are in progress. MIT license.
