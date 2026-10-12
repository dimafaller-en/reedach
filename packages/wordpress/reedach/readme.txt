=== Reedach ===
Contributors: dimafaller
Tags: russian, proofreading, writing, style, gutenberg
Requires at least: 6.5
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 0.1.2
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Style hints for Russian text in the block editor: bureaucratese, clichés, filler words, heavy syntax, typography.

== Description ==

Reedach checks Russian text while you write in the block editor. It finds bureaucratese, clichés, filler and evaluative words, time parasites, heavy syntax, common mistakes, colloquialisms and typography slips, explains what is wrong and suggests how to say it simpler.

* The Reedach panel in the editor lists the hints; marks appear right in the text.
* Click a hint to jump to the fragment and select it.
* The check runs in the author's browser. The text is not sent anywhere, there is no external service and no account.
* Settings → Reedach: switch off the kinds of hints your authors do not need.

The hints themselves are in Russian: they explain Russian text. The interface is in English and Russian.

This plugin checks style only. Spelling and morphology need a Reedach server, see the [project site](https://dimafaller.ru/reedach/).

Hints are a guide, not a rule. The check works by a dictionary and simple rules, so it sometimes errs and does not replace an editor.

Reedach is an open project: [source code on GitHub](https://github.com/dimafaller-en/reedach). The plugin is under GPLv2 or later; the bundled Reedach core and rules are under the MIT license.

= По-русски =

Reedach проверяет русский текст прямо в редакторе блоков: канцелярит, штампы, вода, оценочные слова, паразиты времени, тяжёлый синтаксис, частые ошибки, просторечия, типографика. Объясняет, что не так, и подсказывает, как сказать проще. Проверка идёт в браузере автора, текст никуда не отправляется.

== Installation ==

1. Install the plugin from the Plugins screen or upload the `reedach` folder to `/wp-content/plugins/`.
2. Activate it.
3. Open a post in the block editor and click the Reedach icon in the top toolbar.

== Frequently Asked Questions ==

= Is my text sent to a server? =

No. The rules are inside the plugin and run in the browser.

= Does it check spelling? =

No. Spelling needs the hunspell program and dictionaries, which shared hosting usually cannot run. The full Reedach with spelling is a separate server: see the project site.

= Which browsers mark the text? =

Chrome and Edge 105+, Safari 17.2+, Firefox 140+. In older browsers the list of hints works, the marks in the text do not.

= Does it work with the classic editor? =

No, only with the block editor.

== Changelog ==

= 0.1.2 =
* First version: style hints in the block editor, marks in the text, settings for kinds of hints.
