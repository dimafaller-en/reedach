# reedach

Ядро проекта Reedach: лёгкая проверка русского текста на канцелярит, штампы, воду,
неконкретные и оценочные слова, длинные предложения и абзацы. Без зависимостей,
работает в браузере и в Node. Текст никуда не отправляется.

Это подсказки по словарю и простым правилам, а не приговор: проверка иногда ошибается
и не заменяет редактора.

```bash
npm i reedach
```

```js
import {checkStyle, sourceBlocks, mergeIssues} from 'reedach';

const markdown = 'В настоящее время мы осуществляем монтаж перегородок.';
const blocks = sourceBlocks(markdown);
const issues = mergeIssues(blocks, {local: checkStyle(blocks)});
// [{start, end, id, category, label, message, fix}, …] — start и end указывают в исходный текст
```

Без Markdown: `checkStyle([{text: '…', kind: 'p'}])`, где `kind` — `p` (абзац), `li` (пункт
списка) или `h` (заголовок). Настройки длины: `checkStyle(blocks, {maxSentenceWords: 25,
maxParagraphWords: 120})`.

Словарь правил, источники и лицензии — в README и NOTICE.md [репозитория проекта](https://github.com/dimafaller-en/reedach).

MIT, © 2026 Дима Фаллер.
