// Observa abertura/fechamento sem duplicar listeners nos modais criados sob demanda.
const initialized = new WeakSet();
function enhance(el) {
  if (initialized.has(el)) return;
  initialized.add(el);
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.tabIndex = -1;
  el.setAttribute('aria-label', el.querySelector('h2')?.textContent || 'Detalhes');
  let opener, visible = false;
  const update = () => {
    const next = el.isConnected && !el.classList.contains('hidden');
    if (next && !visible) { opener = document.activeElement; queueMicrotask(() => (el.querySelector('input,button,textarea') || el).focus()); }
    if (!next && visible) opener?.focus();
    visible = next;
  };
  const observer = new MutationObserver(update); observer.observe(el, {attributes:true, attributeFilter:['class']}); update();
  el.addEventListener('keydown', e => {
    if (e.key === 'Escape') { const close = el.querySelector('#lb-fechar,#fechar-detalhes,#btn-cancelar-senha,#btn-cancelar-edicao,#btn-cancelar-senha-edicao,#btn-desc-cancelar,[data-close]'); close?.click(); }
    if (e.key !== 'Tab') return;
    const focus = [...el.querySelectorAll('button,input,textarea,select,a[href],[tabindex="0"]')].filter(n => !n.disabled && n.getClientRects().length);
    const first = focus[0], last = focus.at(-1);
    if (!first) { e.preventDefault(); el.focus(); }
    else if (e.shiftKey && (document.activeElement === first || document.activeElement === el)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}
const scan = () => document.querySelectorAll('.login-overlay,.modal-overlay,.painel-detalhes,.lightbox-overlay').forEach(enhance);
new MutationObserver(scan).observe(document.body, {childList:true,subtree:true}); scan();
document.querySelectorAll('button[title]').forEach(b => { if (!b.hasAttribute('aria-label')) b.setAttribute('aria-label', b.title); });
document.querySelectorAll('a[target="_blank"]').forEach(a => a.rel = 'noopener noreferrer');
