// Copies CHANGELOG.md into site/index.html between <!-- changelog --> and <!-- /changelog -->.
//   node site/tools/changelog.mjs
import {readFileSync, writeFileSync} from 'node:fs';

const root = new URL('../../', import.meta.url), page = new URL('site/index.html', root);
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>');

// Paragraphs and list items may wrap onto indented lines: join them first.
const lines = [];
for (const line of readFileSync(new URL('CHANGELOG.md', root), 'utf8').replace(/\r/g, '').split('\n')) {
 if (lines.length && line.trim() && !/^(#|- )/.test(line) && lines.at(-1).trim()) lines[lines.length - 1] += ' ' + line.trim();
 else lines.push(line);
}
let html = '', list = false;
for (const line of lines) {
 if (!line.startsWith('- ') && list) { html += ' </ul>\n'; list = false; }
 if (line.startsWith('# ')) continue;   // the section has its own title
 if (line.startsWith('## ')) html += ` <h3>${inline(line.slice(3))}</h3>\n`;
 else if (line.startsWith('- ')) { if (!list) { html += ' <ul>\n'; list = true; } html += `  <li>${inline(line.slice(2))}</li>\n`; }
 else if (line.trim()) html += ` <p>${inline(line)}</p>\n`;
}
if (list) html += ' </ul>\n';

const source = readFileSync(page, 'utf8'), marks = /(<!-- changelog -->\n)[\s\S]*?( <!-- \/changelog -->)/;
if (!marks.test(source)) throw new Error('no <!-- changelog --> marks in site/index.html');
writeFileSync(page, source.replace(marks, (_, a, b) => a + html + b));
console.log('changelog copied into site/index.html');
