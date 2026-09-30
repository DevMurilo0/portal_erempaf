import { TURMAS } from './config/turmas.js';

const turmasPorSerie = TURMAS.reduce((map, turma) => {
  (map[turma.serie] ||= []).push(turma);
  return map;
}, {});

const serieSelect = document.getElementById('serie');
const turmaSelect = document.getElementById('turma');
const btnAcessar = document.getElementById('btn-acessar');
const avisoErro = document.getElementById('aviso-erro');

function atualizarTurmas() {
  const serie = serieSelect?.value || '';

  if (!turmaSelect) return;

  turmaSelect.innerHTML = '<option value="">Selecione a turma</option>';

  if (!serie || !turmasPorSerie[serie]) return;

  turmasPorSerie[serie].forEach((turma) => {
    const option = document.createElement('option');
    option.value = turma.turma;
    option.textContent = `Turma ${turma.turma.toUpperCase()}`;
    turmaSelect.appendChild(option);
  });
}

function mostrarErro(mensagem) {
  if (!avisoErro) return;

  avisoErro.textContent = mensagem;
  window.clearTimeout(mostrarErro.timeout);

  mostrarErro.timeout = window.setTimeout(() => {
    avisoErro.textContent = '';
  }, 3200);
}

function acessar() {
  const serie = serieSelect?.value || '';
  const turma = turmaSelect?.value || '';

  if (!serie || !turma) {
    mostrarErro('Selecione a série e a turma para continuar.');
    return;
  }

  const destino = TURMAS.find(
    (item) => item.serie === serie && item.turma === turma
  );

  if (!destino) {
    mostrarErro('Não foi possível localizar essa turma.');
    return;
  }

  window.location.href = destino.path;
}

serieSelect?.addEventListener('change', atualizarTurmas);
btnAcessar?.addEventListener('click', acessar);

turmaSelect?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') acessar();
});

/* Menu mobile — sem animações de entrada. */
const menuToggle = document.getElementById('menu-toggle');
const mainNav = document.getElementById('main-nav');

function fecharMenu() {
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
  link.addEventListener('click', fecharMenu);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') fecharMenu();
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 900) fecharMenu();
}, { passive: true });
