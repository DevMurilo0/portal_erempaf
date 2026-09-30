import { TURMAS } from './config/turmas.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const coarsePointer = window.matchMedia('(pointer: coarse)');

/*
  Instagram oficial da escola:
  deixe vazio enquanto não houver um perfil confirmado.
  Quando houver, basta colocar a URL aqui.
*/
const INSTAGRAM_URL = '';

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

/* HEADER + MENU MOBILE */
const header = document.getElementById('site-header');
const menuToggle = document.getElementById('menu-toggle');
const mainNav = document.getElementById('main-nav');

function atualizarHeader() {
  header?.classList.toggle('is-scrolled', window.scrollY > 18);
}

function fecharMenu() {
  if (!menuToggle || !mainNav) return;

  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Abrir menu');
  mainNav.classList.remove('is-open');
  document.body.classList.remove('menu-open');
}

function alternarMenu() {
  if (!menuToggle || !mainNav) return;

  const aberto = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', String(!aberto));
  menuToggle.setAttribute('aria-label', aberto ? 'Abrir menu' : 'Fechar menu');
  mainNav.classList.toggle('is-open', !aberto);
  document.body.classList.toggle('menu-open', !aberto);
}

menuToggle?.addEventListener('click', alternarMenu);

mainNav?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', fecharMenu);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') fecharMenu();
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 860) fecharMenu();
}, { passive: true });

window.addEventListener('scroll', atualizarHeader, { passive: true });
atualizarHeader();

/* PLACEHOLDERS DE FOTO */
document.querySelectorAll('[data-photo-frame]').forEach((frame) => {
  const img = frame.querySelector('img');

  if (!img) {
    frame.classList.add('is-missing');
    return;
  }

  const marcarAusente = () => frame.classList.add('is-missing');
  const marcarPresente = () => frame.classList.remove('is-missing');

  img.addEventListener('error', marcarAusente, { once: true });
  img.addEventListener('load', marcarPresente, { once: true });

  if (img.complete) {
    if (img.naturalWidth > 0) marcarPresente();
    else marcarAusente();
  }
});

/* REVEALS */
document.documentElement.classList.add('motion-ready');

const revelarTudo = () => {
  document.querySelectorAll('[data-reveal]').forEach((element) => {
    element.classList.add('is-revealed');
  });
  document.documentElement.classList.add('hero-loaded');
};

let revealObserver;

function iniciarReveals() {
  revealObserver?.disconnect();

  if (reducedMotion.matches || !('IntersectionObserver' in window)) {
    revelarTudo();
    return;
  }

  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      const element = entry.target;
      element.classList.add('is-revealed');
      revealObserver.unobserve(element);
    });
  }, {
    threshold: 0.08,
    rootMargin: '0px 0px -7%'
  });

  document.querySelectorAll('[data-reveal]').forEach((element) => {
    const delay = Math.min(Number(element.dataset.delay) || 0, 240);
    element.style.setProperty('--reveal-delay', `${delay}ms`);
    revealObserver.observe(element);
  });

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.documentElement.classList.add('hero-loaded');
    });
  });
}

iniciarReveals();

if (typeof reducedMotion.addEventListener === 'function') {
  reducedMotion.addEventListener('change', iniciarReveals);
}

/* PARALLAX SUAVE */
let motionFrame = 0;

function atualizarParallax() {
  motionFrame = 0;

  const permitido =
    !reducedMotion.matches &&
    !coarsePointer.matches &&
    window.innerWidth > 800;

  document.querySelectorAll('[data-parallax]').forEach((element) => {
    if (!permitido) {
      element.style.setProperty('--photo-parallax', '0px');
      return;
    }

    const rect = element.getBoundingClientRect();

    if (rect.bottom < -120 || rect.top > window.innerHeight + 120) return;

    const velocidade = Number(element.dataset.parallax) || 0.016;
    const centro = rect.top + rect.height / 2;
    const deslocamento = (window.innerHeight / 2 - centro) * velocidade;
    const limitado = Math.max(-20, Math.min(20, deslocamento));

    element.style.setProperty('--photo-parallax', `${limitado.toFixed(2)}px`);
  });
}

function solicitarParallax() {
  if (!motionFrame) {
    motionFrame = requestAnimationFrame(atualizarParallax);
  }
}

window.addEventListener('scroll', solicitarParallax, { passive: true });
window.addEventListener('resize', solicitarParallax, { passive: true });
atualizarParallax();

/* TRILHO DE FOTOS */
const rail = document.getElementById('photo-rail');

if (rail) {
  let arrastando = false;
  let inicioX = 0;
  let ultimoX = 0;
  let arrastou = false;

  function atualizarProgresso() {
    const maximo = rail.scrollWidth - rail.clientWidth;
    const progresso = maximo > 0 ? rail.scrollLeft / maximo : 0;

    document.documentElement.style.setProperty(
      '--rail-progress',
      Math.max(0, Math.min(1, progresso)).toFixed(3)
    );
  }

  rail.addEventListener('scroll', atualizarProgresso, { passive: true });

  rail.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;

    arrastando = true;
    arrastou = false;
    inicioX = event.clientX;
    ultimoX = event.clientX;

    rail.classList.add('is-dragging');
    rail.setPointerCapture(event.pointerId);
  });

  rail.addEventListener('pointermove', (event) => {
    if (!arrastando) return;

    const distancia = event.clientX - inicioX;
    if (Math.abs(distancia) > 4) arrastou = true;

    rail.scrollLeft += ultimoX - event.clientX;
    ultimoX = event.clientX;
  });

  function pararArraste(event) {
    if (!arrastando) return;

    arrastando = false;
    rail.classList.remove('is-dragging');

    if (rail.hasPointerCapture(event.pointerId)) {
      rail.releasePointerCapture(event.pointerId);
    }
  }

  rail.addEventListener('pointerup', pararArraste);
  rail.addEventListener('pointercancel', pararArraste);

  rail.addEventListener('click', (event) => {
    if (arrastou) event.preventDefault();
    arrastou = false;
  }, true);

  atualizarProgresso();
}

/* INSTAGRAM OPCIONAL */
const instagramCta = document.getElementById('instagram-cta');
const instagramLink = document.getElementById('instagram-link');

if (INSTAGRAM_URL && instagramCta && instagramLink) {
  instagramLink.href = INSTAGRAM_URL;
  instagramCta.hidden = false;
}