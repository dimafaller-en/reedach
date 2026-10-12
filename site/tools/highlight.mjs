// Bakes syntax highlighting into site/index.html, so the page needs no script for it.
// Safe to run again: old markup inside code blocks is removed first.
//   npm i --no-save highlight.js@11 && node site/tools/highlight.mjs site/index.html
import {readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const hljs = createRequire(process.cwd() + '/')('highlight.js');
const file = process.argv[2] || 'site/index.html';
const entity = s => s.replace(/&(?:lt|gt|quot|amp|#\d+|#x[\da-f]+);/gi, e => ({'&lt;': '<', '&gt;': '>', '&quot;': '"', '&amp;': '&'})[e.toLowerCase()]
  ?? String.fromCodePoint(e[2].toLowerCase() === 'x' ? parseInt(e.slice(3, -1), 16) : parseInt(e.slice(2, -1), 10)));
// Text of a code block: tags off, entities decoded until nothing changes (an earlier run may have escaped twice).
const decode = html => { let s = html.replace(/<[^>]+>/g, ''), prev; do { prev = s; s = entity(s); } while (s !== prev); return s; };

let count = 0;
const html = readFileSync(file, 'utf8').replace(/<pre><code class="language-(\w+)[^"]*">([\s\S]*?)<\/code><\/pre>/g, (_, lang, body) => {
  count++;
  return `<pre><code class="language-${lang} hljs">${hljs.highlight(decode(body), {language: lang}).value}</code></pre>`;
});
writeFileSync(file, html);
console.log(`highlighted ${count} code blocks in ${file}`);
