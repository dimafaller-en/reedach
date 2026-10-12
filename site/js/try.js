// Live demo on the page: the widget checks style in the browser, without a server.
// After «Закрыть» the check comes back when the visitor returns to the field.
const text = document.querySelector('#try-text'), hints = document.querySelector('#try-hints');
text?.addEventListener('focus', () => { if (hints.hidden) Reedach.attach(text, {panel: hints}); });
