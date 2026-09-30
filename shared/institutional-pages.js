const menuToggle = document.getElementById('institutional-menu-toggle');
const mainNav = document.getElementById('institutional-main-nav');

function fecharMenuInstitucional() {
  if (!menuToggle || !mainNav) return;
  mainNav.classList.remove('is-open');
  menuToggle.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('menu-open');
}

menuToggle?.addEventListener('click', () => {
  if (!mainNav) return;
  const aberto = mainNav.classList.toggle('is-open');
  menuToggle.setAttribute('aria-expanded', String(aberto));
  document.body.classList.toggle('menu-open', aberto);
});

mainNav?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', fecharMenuInstitucional);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') fecharMenuInstitucional();
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 900) fecharMenuInstitucional();
}, { passive: true });
