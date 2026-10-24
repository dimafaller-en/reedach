// Reedach in the WordPress block editor: style hints for Russian text, checked in the browser.
// The text never leaves the page: no server, no keys. Spelling needs a Reedach server and is not here.
import {checkStyle} from 'reedach';

const {createElement: el, Fragment, useSyncExternalStore} = wp.element;
const {select, dispatch, subscribe} = wp.data;
const {PluginSidebar, PluginSidebarMoreMenuItem} = wp.editor?.PluginSidebar ? wp.editor : wp.editPost;
const {ToggleControl} = wp.components;

const settings = window.reedachSettings || {};
const disabled = new Set(settings.disabled || []);
const t = key => settings.strings?.[key] ?? key;

// Code and raw HTML are not prose.
const SKIP = new Set(['core/code', 'core/preformatted', 'core/html', 'core/shortcode', 'core/freeform']);
// Hints about a whole sentence or paragraph get a quieter mark than hints about a word.
const LONG = new Set(['long-sentence', 'long-paragraph', 'first-paragraph-long', 'no-headings', 'thin-section', 'title-too-long', 'question-run', 'nominal-chain']);

// Every rich text of every block, as plain text with the editor's own offsets.
// Inline images and other objects are one character (U+FFFC) in rich text; the check sees a space there.
function collect() {
 const items = [];
 const title = wp.richText.create({html: select('core/editor').getEditedPostAttribute('title') || ''}).text;   // the title is stored as HTML
 if (title.trim()) items.push({clientId: null, key: 'title', text: title, kind: 'h', tag: 'H1', gaps: []});
 const walk = blocks => {
  for (const block of blocks) {
   const type = wp.blocks.getBlockType(block.name);
   if (type && !SKIP.has(block.name)) for (const [key, def] of Object.entries(type.attributes || {})) {
    if ((def.source !== 'rich-text' && def.source !== 'html') || def.multiline) continue;
    const value = block.attributes[key];
    if (value === undefined || value === null) continue;
    const raw = wp.richText.create({html: String(value)}).text;
    if (!raw.trim()) continue;
    const gaps = [], text = raw.replace(/￼/g, (_, i) => (gaps.push(i), ' '));
    const kind = block.name === 'core/heading' ? 'h' : block.name === 'core/list-item' ? 'li' : 'p';
    items.push({clientId: block.clientId, key, text, kind, tag: kind === 'h' ? 'H' + (block.attributes.level || 2) : undefined, gaps});
   }
   walk(block.innerBlocks || []);
  }
 };
 walk(select('core/block-editor').getBlocks());
 return items;
}

// State shared by the sidebar and the marks in the text.
let state = {issues: [], highlight: select('core/preferences')?.get('reedach', 'highlight') ?? true, active: null};
const listeners = new Set();
function setState(patch) {
 state = {...state, ...patch};
 listeners.forEach(f => f());
 paintSoon();
}
const useReedach = () => useSyncExternalStore(f => (listeners.add(f), () => listeners.delete(f)), () => state);

const texts = new Map();   // clientId:key → checked text, to match it with the page
function run() {
 const items = collect();
 texts.clear();
 for (const item of items) texts.set(item.clientId + ':' + item.key, item.text);
 const issues = checkStyle(items).filter(it => !disabled.has(it.category)).map(it => {
  const item = items[it.block];
  return {...it, clientId: item.clientId, key: item.key, fragment: item.text.slice(it.start, it.end), ...(it.edit && {editFrom: item.text.slice(it.edit.start, it.edit.end)}), uid: [item.clientId, item.key, it.start, it.end, it.id].join(':')};
 });
 setState({issues, active: issues.some(it => it.uid === state.active) ? state.active : null});
}

let lastBlocks, lastTitle, timer;
subscribe(() => {
 const blocks = select('core/block-editor').getBlocks(), title = select('core/editor').getEditedPostAttribute('title');
 if (blocks === lastBlocks && title === lastTitle) return;
 lastBlocks = blocks; lastTitle = title;
 clearTimeout(timer); timer = setTimeout(run, 350);
});

// The post is drawn in an iframe (or right in the page in older setups); marks live in that document.
function canvas() {
 const frame = document.querySelector('iframe[name="editor-canvas"]');
 return frame?.contentDocument?.body ? frame.contentDocument : document;
}
function richElement(doc, it) {
 if (!it.clientId) return doc.querySelector('.editor-post-title__input');
 const block = doc.querySelector(`[data-block="${it.clientId}"]`);
 if (!block) return null;
 const own = `[data-wp-block-attribute-key="${it.key}"]`;
 return block.matches(own) ? block : block.querySelector(own) || (block.isContentEditable ? block : null);
}
// Characters as the editor counts them: text, a line break for <br>, one character for an inline object.
function characters(root) {
 const marks = [], text = [];
 const visit = node => {
  for (let c = node.firstChild; c; c = c.nextSibling) {
   if (c.nodeType === Node.TEXT_NODE) {
    for (let i = 0; i < c.data.length; i++) if (c.data[i] !== '﻿') { marks.push([c, i, c, i + 1]); text.push(c.data[i]); }
   } else if (c.nodeType === Node.ELEMENT_NODE) {
    const at = [...node.childNodes].indexOf(c);
    if (c.tagName === 'BR') { if (c.nextSibling || !c.hasAttribute('data-rich-text-line-break')) { marks.push([node, at, node, at + 1]); text.push('\n'); } }
    else if (c.tagName === 'IMG' || c.getAttribute('contenteditable') === 'false') { marks.push([node, at, node, at + 1]); text.push(' '); }
    else visit(c);
   }
  }
 };
 visit(root);
 return {marks, text: text.join('')};
}
// The page may show the text a little differently (the editor collapses double spaces):
// walk both texts and match them, letting whitespace differ. Returns value offset → page offset, or null.
function align(value, page) {
 const at = new Array(value.length + 1);
 let i = 0, j = 0;
 while (i < value.length) {
  if (value[i] === page[j]) { at[i++] = j++; continue; }
  const a = /\s/.test(value[i]), b = /\s/.test(page[j] ?? '');
  if (a) { at[i++] = j; continue; }
  if (b) { j++; continue; }
  return null;
 }
 at[value.length] = j;
 return at;
}
function ranges(doc, issues) {
 const cache = new Map(), out = new Map();
 for (const it of issues) {
  const id = it.clientId + ':' + it.key;
  if (!cache.has(id)) {
   const root = richElement(doc, it), chars = root && characters(root), at = chars && align(texts.get(id) ?? '', chars.text);
   cache.set(id, at && {...chars, at});
  }
  const chars = cache.get(id);
  if (!chars?.marks.length) continue;
  const m = chars.marks, s = chars.at[it.start], e = chars.at[it.end];
  const range = doc.createRange();
  const start = s < m.length ? m[s].slice(0, 2) : m[m.length - 1].slice(2), end = e > 0 ? m[e - 1].slice(2) : m[0].slice(0, 2);
  range.setStart(...start); range.setEnd(...end);
  if (range.toString().replace(/[\s￼]/g, '') !== it.fragment.replace(/\s/g, '')) continue;   // the page and the check disagree: no mark
  out.set(it.uid, range);
 }
 return out;
}

const STYLE = '::highlight(reedach-word){background-color:rgba(255,61,31,.2)}::highlight(reedach-long){background-color:rgba(255,176,0,.2)}::highlight(reedach-active){background-color:rgba(255,61,31,.5)}';
// The editor redraws the text a moment after its data changes: paint after that, and once more to be sure.
let soon = [];
function paintSoon() { soon.forEach(clearTimeout); soon = [setTimeout(paint, 30), setTimeout(paint, 300)]; }
function paint() {
 const doc = canvas(), win = doc.defaultView;
 if (!win?.CSS?.highlights) return;   // Firefox before 140, older Safari: the list still works
 if (!doc.getElementById('reedach-marks')) doc.head.append(Object.assign(doc.createElement('style'), {id: 'reedach-marks', textContent: STYLE}));
 const found = state.highlight ? ranges(doc, state.issues) : new Map();
 const word = [], long = [], active = [];
 for (const it of state.issues) {
  const range = found.get(it.uid);
  if (!range) continue;
  (LONG.has(it.id) ? long : word).push(range);
  if (it.uid === state.active) active.push(range);
 }
 const set = (name, list, priority = 0) => win.CSS.highlights.set(name, Object.assign(new win.Highlight(...list), {priority}));
 set('reedach-long', long); set('reedach-word', word, 1); set('reedach-active', active, 2);
}
// The canvas iframe may load after the first check, and blocks may render later: repaint for a while.
let tries = 0;
const settle = setInterval(() => { paint(); if (++tries > 20) clearInterval(settle); }, 500);

function show(it) {
 setState({active: it.uid});
 if (it.clientId) {
  dispatch('core/block-editor').selectBlock(it.clientId);
  dispatch('core/block-editor').selectionChange(it.clientId, it.key, it.start, it.end);
 }
 const doc = canvas(), range = ranges(doc, [it]).get(it.uid), node = range?.startContainer;
 if (!it.clientId && range) {   // the title is not a block: select the fragment in the page itself
  richElement(doc, it)?.focus();
  doc.getSelection().removeAllRanges(); doc.getSelection().addRange(range);
 }
 (node?.nodeType === Node.TEXT_NODE ? node.parentElement : node || richElement(doc, it))?.scrollIntoView({block: 'center', behavior: 'smooth'});
}

const short = s => (s.length > 70 ? s.slice(0, 67).trimEnd() + '…' : s);

// A suggested word replaces the fragment right in the block, keeping its formatting; the editor's Undo takes it back.
// The text is not touched unless the author clicks. There is no server here, so the core offers a synonym
// only where the found word is a dictionary form too («осуществлять → делать», not «осуществляет → делать»).
// A ready edit of the core («Убрать», or a piece wider than the hint) is put the same way on its own range; it is
// already cased and takes in the commas and spaces that go with it. The new text keeps the formatting of the place:
// the capital a removal gives the next word keeps that word's.
const capital = (it, word) => (/^\p{Lu}/u.test(it.fragment) ? word[0].toUpperCase() + word.slice(1) : word);
const replace = (it, word) => put(it, it.start, it.end, it.fragment, capital(it, word), it.start);
const applyEdit = it => put(it, it.edit.start, it.edit.end, it.editFrom, it.edit.text, it.edit.remove ? it.edit.end - 1 : it.edit.start);
function put(it, start, end, expected, text, at) {
 const swap = html => {
  const value = wp.richText.create({html: String(html ?? '')});
  if (value.text.slice(start, end).replace(/￼/g, ' ') !== expected) return null;   // the text changed since the check
  const piece = wp.richText.create({text});
  piece.formats = Array.from({length: text.length}, () => value.formats[at]);
  return wp.richText.toHTMLString({value: wp.richText.insert(value, piece, start, end)});
 };
 if (!it.clientId) {
  const html = swap(select('core/editor').getEditedPostAttribute('title'));
  if (html !== null) dispatch('core/editor').editPost({title: html});
  return;
 }
 const block = select('core/block-editor').getBlock(it.clientId), html = block && swap(block.attributes[it.key]);
 if (html) dispatch('core/block-editor').updateBlockAttributes(it.clientId, {[it.key]: html});
}

const icon = el('svg', {viewBox: '0 0 256 256', width: 24, height: 24, 'aria-hidden': true},
 el('path', {d: REEDACH_ICON_E, fill: 'currentColor'}),
 el('path', {d: 'M100 214 L128 186 L156 214', fill: 'none', stroke: 'currentColor', strokeWidth: 16, strokeLinecap: 'round', strokeLinejoin: 'round'}));

function Sidebar() {
 const s = useReedach();
 return el(Fragment, null,
  el(PluginSidebarMoreMenuItem, {target: 'reedach', icon}, 'Reedach'),
  el(PluginSidebar, {name: 'reedach', title: 'Reedach', icon},
   el('div', {className: 'reedach-panel'},
    el(ToggleControl, {
     label: t('highlight'), checked: s.highlight, __nextHasNoMarginBottom: true,
     onChange: value => { dispatch('core/preferences')?.set('reedach', 'highlight', value); setState({highlight: value}); },
    }),
    el('p', {className: 'reedach-count'}, s.issues.length ? t('count').replace('%d', s.issues.length) : t('none')),
    el('ul', {className: 'reedach-list'}, s.issues.map(it => el('li', {key: it.uid},
     el('button', {type: 'button', className: 'reedach-item' + (it.uid === s.active ? ' is-active' : ''), onClick: () => show(it)},
      el('span', {className: 'reedach-label'}, it.label),
      el('span', {className: 'reedach-fragment'}, short(it.fragment)),
      el('span', {className: 'reedach-message'}, [it.message, it.fix].filter(Boolean).join(' '))),
     it.replace?.length ? el('div', {className: 'reedach-variants'}, it.replace.map(word => el('button', {
      type: 'button', key: word, className: 'reedach-variant', onClick: () => replace(it, word),
      'aria-label': t('replace').replace('%s', capital(it, word)),
     }, capital(it, word)))) : it.edit ? el('div', {className: 'reedach-variants'}, el('button', {
      type: 'button', className: 'reedach-variant', onClick: () => applyEdit(it),
      'aria-label': it.edit.remove ? t('removeLabel').replace('%s', short(it.fragment)) : t('applyLabel').replace('%1$s', it.editFrom.trim()).replace('%2$s', it.edit.text.trim()),
     }, it.edit.remove ? t('remove') : t('apply').replace('%s', it.edit.text.trim()))) : null))),
    el('p', {className: 'reedach-credit'}, t('credit')))));
}

wp.plugins.registerPlugin('reedach', {render: Sidebar, icon});
