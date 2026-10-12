# Источники и сторонние лицензии

## Словарь правил

Правила и формулировки подсказок в `packages/core/src/rules.js` написаны для проекта
самостоятельно. Идеи взяты из открытых статей об информационном стиле:
[Максим Ильяхов](https://maximilyahov.ru), [Бюро Горбунова](https://bureau.ru) и другие авторы.
Тексты статей в проект не копировались.

Проверка не заменяет профессиональную редактуру.

## Сторонние данные и программы

Ядро (`packages/core`) не содержит сторонних данных и зависимостей.

Сервер (`packages/server`) использует их как зависимости, не включая в этот репозиторий:

| Компонент | Лицензия | Источник |
|---|---|---|
| Az.js — морфологический анализ | MIT | https://github.com/deNULL/Az.js |
| Словари Az.js — данные OpenCorpora, сборка pymorphy2 | CC BY-SA | https://opencorpora.org |
| dictionary-ru — словарь hunspell, © 1997–2008 Alexander I. Lebedev | BSD-3-Clause | https://github.com/wooorm/dictionaries |
| dictionary-en — словарь hunspell на основе SCOWL | MIT AND BSD | https://github.com/wooorm/dictionaries |
| hunspell — проверка орфографии, запускается как отдельная программа | GPL-2.0 / LGPL-2.1 / MPL-1.1 на выбор | https://github.com/hunspell/hunspell |

Hunspell не входит в код Reedach и не распространяется вместе с ним: сервер запускает
установленную в системе программу `hunspell` отдельным процессом и передаёт ей слова. В
Docker-образ она попадает из пакета Alpine `hunspell` со своей лицензией. Словари hunspell
ставятся из npm вместе с `reedach-server` (пакеты `dictionary-ru` и `dictionary-en`) и
используются без изменений.

Словари OpenCorpora используются без изменений. Изменённые словари, если появятся,
будут распространяться под той же лицензией CC BY-SA с указанием источника.
