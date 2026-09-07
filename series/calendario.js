import { auth, db, observeSession, canEdit, login } from '../shared/firebase.js';
import { TURMAS } from '../config/turmas.js';
import { escapeHtml, normalizedPhoto, photoSource, stableJson } from '../shared/content.js';
import { compressPhoto } from '../shared/photos.js';
import '../shared/accessibility.js';
const turma = TURMAS.find(t => t.path === location.pathname || t.path.replace('index.html', '') === location.pathname);
if (!turma) throw new Error('Turma não cadastrada.');
const SALA_ID = turma.id;
window.SALA_ID = SALA_ID;
window.db = db;
window.auth = auth;

import {
  doc,
  getDocFromServer
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { initNotificacoes } from "./notificacoes.js";

window.mostrarToast = mostrarToast;

/* ──────────────────────────────────────────────
   CONFIGURAÇÃO
────────────────────────────────────────────── */





const MATERIAS = [
  "Português", "Matemática", "História",
  "Geografia", "Biologia", "Lingua Inglesa",
  "Educação Física", "Artes", "Filosofia",
  "Quimica", "Sociologia", "Fisica"
];

let modoEdicao = false;
let diaDetalheAtual = null;
let estadoMaterias = {};
let estadoDetalhes = {};
let estadoFotos = {}; // { "2026-06-10": ["base64...", "base64..."] }
let tabAtiva = "anotacoes";
let dataAtual = new Date();
let salvamentoEmAndamento = false;
let senhaEdicaoTurma = ''; // fica só em memória; a senha real continua em /salas/{turma}.senha
const CALENDARIO_BACKEND_URL = 'https://erempafbackend.netlify.app/.netlify/functions/calendario';

// Fila de fotos aguardando descrição. As imagens voltaram a ser salvas em Base64 no Firestore.
let _filaPendente = [];
let _diaUpload = null;

function descartarAlteracoesFotosLocais() {
  _filaPendente = [];
  _diaUpload = null;

  const modal = document.getElementById('modal-desc-foto');
  if (modal) {
    modal._b64pendente = null;
    modal.classList.add('hidden');
  }
  const preview = document.getElementById('modal-desc-preview');
  if (preview) preview.removeAttribute('src');
}

function chavesAlteradas(atual = {}, anterior = {}) {
  const keys = new Set([...Object.keys(atual || {}), ...Object.keys(anterior || {})]);
  return [...keys].filter(key => stableJson(atual?.[key]) !== stableJson(anterior?.[key]));
}

function validarLimitesDeAlteracaoDasRules() {
  const anterior = loaded?.data || {};
  const limites = [
    ['anotações', estadoDetalhes, anterior.detalhes || {}, 10],
    ['matérias', estadoMaterias, anterior.materias || {}, 5],
    ['fotos', estadoFotos, anterior.fotos || {}, 3]
  ];

  for (const [nome, atual, antigo, limite] of limites) {
    const quantidade = chavesAlteradas(atual, antigo).length;
    if (quantidade > limite) {
      throw new Error(
        `Há alterações em ${quantidade} dias de ${nome}. Por segurança, salve no máximo ${limite} dias de ${nome} por vez.`
      );
    }
  }
}

/* ──────────────────────────────────────────────
   ELEMENTOS
────────────────────────────────────────────── */
const telaLogin = document.getElementById("tela-login");
const btnLoginForm = document.getElementById("btn-login");
const emailInput = document.getElementById("login-email");
const senhaInput = document.getElementById("login-senha");
const erroLogin = document.getElementById("login-erro");

const diasContainer = document.getElementById("dias");
const mesAnoSpan = document.getElementById("mes-ano");
const btnEditar = document.getElementById("btn-editar");
const btnSalvar = document.getElementById("btn-salvar");
const campoAvisos = document.getElementById("campo-avisos");

const painelDetalhes = document.getElementById("painel-detalhes");
const campoDetalhes = document.getElementById("campo-detalhes");
const tituloDetalhes = document.getElementById("titulo-detalhes");
const diaSemanaEl = document.getElementById("painel-dia-semana");
const materiasGrid = document.getElementById("materias-grid");

/* ──────────────────────────────────────────────
   AUTENTICAÇÃO — LOGIN DA TURMA
────────────────────────────────────────────── */

function abrirModalLogin(mensagem = "") {
  // O Firebase pode emitir mais de uma atualização de sessão enquanto a pessoa digita.
  // Mostrar o modal não deve apagar os campos já preenchidos.
  if (erroLogin) erroLogin.textContent = mensagem;
  telaLogin.classList.remove("hidden");
  setTimeout(() => emailInput?.focus(), 100);
}

function fecharModalLogin() {
  telaLogin.classList.add("hidden");
  if (senhaInput) senhaInput.value = "";
  if (erroLogin) erroLogin.textContent = "";
}

let claimsAtuais = {};
observeSession(({user, claims}) => {
  const uidAnterior = window.usuarioLogado?.uid;
  const changed = uidAnterior !== user?.uid;
  if (changed && uidAnterior) descartarAlteracoesFotosLocais();
  window.usuarioLogado = user;
  claimsAtuais = claims;

  // Uma sessão Firebase é global para o domínio, mas cada página de turma só aceita
  // a conta daquela própria turma (ou uma claim administrativa explícita).
  const permitido = canEdit(SALA_ID, claims, user);
  if (changed || !permitido) { modoEdicao = false; senhaEdicaoTurma = ''; }
  atualizarModoEdicao();
  btnEditar.disabled = !permitido;
  btnEditar.title = permitido ? 'Editar calendário' : 'Entre com a conta desta turma';

  if (user && permitido) {
    fecharModalLogin();
    if (changed || !loaded) carregarCalendario();
    return;
  }

  // Não deixa conteúdo de outra turma visível quando a conta atual não pertence à sala.
  estadoMaterias = {};
  estadoDetalhes = {};
  estadoFotos = {};
  campoAvisos.value = '';
  renderizarCalendario();
  abrirModalLogin(user ? 'Entre com o email e a senha desta turma.' : '');
});

// Submit do login
btnLoginForm.addEventListener("click", async () => {
  erroLogin.textContent = "";
  const email = emailInput.value.trim();
  const senha = senhaInput.value;

  if (!email || !senha) {
    erroLogin.textContent = "Preencha o email e a senha.";
    return;
  }

  btnLoginForm.disabled = true;
  try {
    await login(email, senha);
    fecharModalLogin();
    mostrarToast('Login realizado com sucesso.', 'success');
  } catch {
    erroLogin.textContent = "Email ou senha incorretos.";
  } finally { btnLoginForm.disabled = false; }
});

// Enter nos campos de login
senhaInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnLoginForm.click();
});
emailInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") senhaInput.focus();
});

/* ──────────────────────────────────────────────
   MODO EDIÇÃO — SENHA DA SALA
────────────────────────────────────────────── */

function garantirModalSenhaEdicao() {
  let modal = document.getElementById('modal-senha-edicao');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'modal-senha-edicao';
  modal.className = 'login-overlay hidden';
  modal.innerHTML = `
    <div class="login-box" role="dialog" aria-modal="true" aria-labelledby="titulo-senha-edicao">
      <div class="login-header">
        <span class="login-icon">✎</span>
        <h2 id="titulo-senha-edicao">Senha de edição</h2>
        <p class="login-sub">Digite a senha de edição desta turma.</p>
      </div>
      <div class="input-group">
        <label for="senha-edicao-turma">Senha</label>
        <input id="senha-edicao-turma" type="password" autocomplete="off" placeholder="••••••" />
      </div>
      <p class="login-erro" id="erro-senha-edicao"></p>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button type="button" id="cancelar-senha-edicao" style="padding:12px 16px;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--text-primary);cursor:pointer">Cancelar</button>
        <button type="button" id="confirmar-senha-edicao" style="padding:12px 16px;border-radius:10px;border:0;background:var(--red-main);color:#fff;font-weight:700;cursor:pointer">Editar</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const input = modal.querySelector('#senha-edicao-turma');
  const erro = modal.querySelector('#erro-senha-edicao');
  const fechar = () => {
    modal.classList.add('hidden');
    input.value = '';
    erro.textContent = '';
  };
  modal.querySelector('#cancelar-senha-edicao').addEventListener('click', fechar);
  modal.addEventListener('click', e => { if (e.target === modal) fechar(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') fechar();
    if (e.key === 'Enter') modal.querySelector('#confirmar-senha-edicao').click();
  });
  return modal;
}

async function chamarBackendCalendario(body) {
  const user = auth.currentUser;
  if (!user || !canEdit(SALA_ID, claimsAtuais, user)) throw new Error('Entre com a conta desta turma.');
  const token = await user.getIdToken();
  const response = await fetch(CALENDARIO_BACKEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) {
    const error = new Error(data.error || 'Não foi possível concluir a operação.');
    error.status = response.status;
    throw error;
  }
  return data;
}

btnEditar.addEventListener('click', async () => {
  if (!auth.currentUser || !canEdit(SALA_ID, claimsAtuais, auth.currentUser)) {
    mostrarToast('Entre com a conta desta turma.', 'error');
    return;
  }

  const modal = garantirModalSenhaEdicao();
  const input = modal.querySelector('#senha-edicao-turma');
  const erro = modal.querySelector('#erro-senha-edicao');
  const confirmar = modal.querySelector('#confirmar-senha-edicao');
  modal.classList.remove('hidden');
  input.value = '';
  erro.textContent = '';
  setTimeout(() => input.focus(), 50);

  confirmar.onclick = async () => {
    const senha = input.value;
    if (!senha) { erro.textContent = 'Digite a senha de edição.'; return; }
    confirmar.disabled = true;
    erro.textContent = '';
    try {
      await chamarBackendCalendario({ operation: 'verify', turma: SALA_ID, password: senha });
      senhaEdicaoTurma = senha;
      modal.classList.add('hidden');
      input.value = '';
      modoEdicao = true;
      window._snapshotMaterias = structuredClone(estadoMaterias);
      atualizarModoEdicao();
      if (diaDetalheAtual) renderizarMaterias(diaDetalheAtual);
      mostrarToast('Modo de edição ativado.', 'info');
    } catch (e) {
      erro.textContent = e.status === 401 ? 'Senha de edição incorreta.' : e.message;
    } finally { confirmar.disabled = false; }
  };
});

btnSalvar.addEventListener("click", async () => {
  if (salvamentoEmAndamento) return;
  try {
    const salvo = await salvarCalendario();
    if (!salvo) return;
    mostrarToast("Alterações salvas com sucesso.", "success");
  } catch (e) {
    mostrarToast("Não foi possível salvar as alterações: " + e.message, "error");
    return;
  }
  modoEdicao = false;
  senhaEdicaoTurma = '';
  atualizarModoEdicao();
  renderizarCalendario();
});

function atualizarModoEdicao() {
  document.querySelectorAll("textarea").forEach(t => { t.disabled = !modoEdicao; });
  campoAvisos.disabled = !modoEdicao;
  campoDetalhes.disabled = !modoEdicao || salvamentoEmAndamento;
  btnSalvar.hidden = !modoEdicao;
  btnEditar.hidden = modoEdicao;

  const btnPainelSalvar = document.getElementById("btn-painel-salvar");
  if (btnPainelSalvar) btnPainelSalvar.hidden = !modoEdicao;

  // Atualiza aba fotos para mostrar/ocultar botão de upload
  if (diaDetalheAtual) renderizarFotos(diaDetalheAtual);
}

/* ──────────────────────────────────────────────
   TABS DO PAINEL
────────────────────────────────────────────── */
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    ativarTab(btn.dataset.tab);
    tabAtiva = btn.dataset.tab;
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${tabAtiva}`)?.classList.add("active");
  });
});

/* ──────────────────────────────────────────────
   RENDERIZAR CALENDÁRIO
────────────────────────────────────────────── */
function renderizarCalendario() {
  diasContainer.innerHTML = "";

  const ano = dataAtual.getFullYear();
  const mes = dataAtual.getMonth();

  mesAnoSpan.textContent = dataAtual.toLocaleDateString("pt-BR", {
    month: "long", year: "numeric"
  });

  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();

  let offset = 0;
  if (primeiroDiaSemana >= 1 && primeiroDiaSemana <= 5) {
    offset = primeiroDiaSemana - 1;
  } else if (primeiroDiaSemana === 0) {
    offset = 0;
  }

  for (let i = 0; i < offset; i++) {
    const vazio = document.createElement("div");
    vazio.className = "dia vazio";
    diasContainer.appendChild(vazio);
  }

  const hoje = new Date();

  for (let dia = 1; dia <= ultimoDia; dia++) {
    const data = new Date(ano, mes, dia);
    const diaSemana = data.getDay();

    if (diaSemana >= 1 && diaSemana <= 5) {
      const div = document.createElement("div");
      div.className = "dia";

      const dataISO = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

      if (dia === hoje.getDate() && mes === hoje.getMonth() && ano === hoje.getFullYear()) {
        div.classList.add("hoje");
      }

      const materiasNoDia = Object.keys(estadoMaterias[dataISO] || {});
      if (estadoDetalhes[dataISO] || materiasNoDia.length > 0) {
        div.classList.add("tem-conteudo");
      }

      const chipsHTML = materiasNoDia.map(m =>
        `<span class="chip-materia">${escapeHtml(m)}</span>`
      ).join("");

      const notaTexto = (estadoDetalhes[dataISO] || "").trim();
      const notaHTML = notaTexto
        ? `<div class="dia-nota-preview">${escapeHtml(notaTexto)}</div>`
        : "";

      div.innerHTML = `
        <div class="topo-dia">
          <span class="numero">${dia}</span><span class="dia-semana-mobile">${data.toLocaleDateString("pt-BR", {weekday:"long"})}</span>
          <span class="dia-dot" title="Este dia tem anotação ou matéria marcada"></span>
          <span class="hoje-badge">hoje</span>
          <button class="btn-detalhes" data-dia="${dataISO}" aria-label="Ver detalhes de ${dia} de ${mesAnoSpan.textContent}" title="Ver detalhes do dia">＋</button>
        </div>
        <div class="dia-chips">${chipsHTML}</div>
        ${notaHTML}
        <textarea data-dia="${dataISO}" disabled placeholder="" style="display:none"></textarea>
      `;

      diasContainer.appendChild(div);
    }
  }

  document.querySelectorAll(".btn-detalhes").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      abrirPainel(btn.dataset.dia);
    });
  });
}

/* ──────────────────────────────────────────────
   PAINEL DE DETALHES
────────────────────────────────────────────── */
function abrirPainel(diaISO) {
  diaDetalheAtual = diaISO;

  const [ano, mes, dia] = diaISO.split("-").map(Number);
  const data = new Date(ano, mes - 1, dia);
  const diasSemana = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

  tituloDetalhes.textContent = data.toLocaleDateString("pt-BR", {
    day: "numeric", month: "long", year: "numeric"
  });
  if (diaSemanaEl) diaSemanaEl.textContent = diasSemana[data.getDay()];

  campoDetalhes.value = estadoDetalhes[diaISO] || "";
  campoDetalhes.disabled = !modoEdicao || salvamentoEmAndamento;

  renderizarMaterias(diaISO);
  renderizarFotos(diaISO);
  ativarTab("anotacoes");
  atualizarStats(diaISO);

  const btnPainelSalvar = document.getElementById("btn-painel-salvar");
  if (btnPainelSalvar) btnPainelSalvar.hidden = !modoEdicao;

  painelDetalhes.classList.remove("hidden");
}

function ativarTab(tab) {
  tabAtiva = tab;
  document.querySelectorAll(".tab-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.tab === tab);
    b.setAttribute("aria-selected", String(b.dataset.tab === tab));
  });
  document.querySelectorAll(".tab-content").forEach(c => {
    c.classList.toggle("active", c.id === `tab-${tab}`);
  });
}

function renderizarMaterias(diaISO) {
  if (!materiasGrid) return;
  const marcadas = estadoMaterias[diaISO] || {};

  // Aba Matérias: só o grid de seleção
  materiasGrid.innerHTML = `<div class="materias-selecao">` +
    MATERIAS.map(mat => {
      const ativa = mat in marcadas;
      return `
        <button type="button" aria-pressed="${ativa}" class="materia-item ${ativa ? "checked" : ""}"
             data-materia="${mat}"
             onclick="toggleMateria('${diaISO}','${mat}',this)">
          <div class="materia-check">${ativa ? "✓" : ""}</div>
          <span class="materia-nome">${mat}</span>
        </button>`;
    }).join("") +
    `</div>`;

  // Aba Anotações: blocos de descrição abaixo do campo de texto
  renderizarBlocosAnotacoes(diaISO);
}

function renderizarBlocosAnotacoes(diaISO) {
  const container = document.getElementById("blocos-materias");
  if (!container) return;
  const marcadas = estadoMaterias[diaISO] || {};

  if (Object.keys(marcadas).length === 0) {
    container.innerHTML = "";
    return;
  }

  container.replaceChildren();
  const list = document.createElement('div'); list.className = 'materias-blocos';
  for (const [mat, desc] of Object.entries(marcadas)) {
    const block = document.createElement('div'); block.className = 'materia-bloco'; block.dataset.materia = mat;
    const header = document.createElement('button'); header.type = 'button'; header.className = 'materia-bloco-header';
    header.textContent = mat + ' ▾'; header.setAttribute('aria-expanded', 'false');
    header.onclick = () => { block.classList.toggle('aberto'); header.setAttribute('aria-expanded', String(block.classList.contains('aberto'))); };
    const body = document.createElement('div'); body.className = 'materia-bloco-body';
    const input = document.createElement('textarea'); input.className = 'materia-bloco-desc'; input.dataset.dia = diaISO; input.dataset.materia = mat;
    input.value = typeof desc === 'string' ? desc : ''; input.disabled = !modoEdicao; input.placeholder = 'Tarefa, prova, conteúdo...'; input.setAttribute('aria-label', mat);
    input.oninput = () => window.salvarDescMateria(diaISO, mat, input.value);
    body.append(input); block.append(header, body); list.append(block);
  }
  container.append(list);
}

window.toggleBloco = function (header) {
  const bloco = header.closest(".materia-bloco");
  bloco.classList.toggle("aberto");
};

window.salvarDescMateria = function (diaISO, materia, valor) {
  if (!modoEdicao || salvamentoEmAndamento) return;
  if (!estadoMaterias[diaISO]) estadoMaterias[diaISO] = {};
  estadoMaterias[diaISO][materia] = valor;
};

window.toggleMateria = function (diaISO, materia, el) {
  if (!modoEdicao || salvamentoEmAndamento) {
    mostrarToast("Ative o modo de edição para fazer alterações.", "info");
    return;
  }
  if (!estadoMaterias[diaISO]) estadoMaterias[diaISO] = {};

  if (materia in estadoMaterias[diaISO]) {
    delete estadoMaterias[diaISO][materia];
  } else {
    estadoMaterias[diaISO][materia] = "";
  }

  renderizarMaterias(diaISO);
  atualizarChipsDia(diaISO);
};

function atualizarStats(diaISO) {
  const hoje = new Date();
  const data = new Date(diaISO);
  const diffMs = data - hoje;
  const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));

  const elDias = document.getElementById("stat-dias");
  const elMateria = document.getElementById("stat-materias");

  if (elDias) {
    if (diffDias === 0) elDias.textContent = "Hoje";
    else if (diffDias > 0) elDias.textContent = `+${diffDias}`;
    else elDias.textContent = diffDias;
  }
  if (elMateria) elMateria.textContent = Object.keys(estadoMaterias[diaISO] || {}).length;
}

campoDetalhes.addEventListener("input", () => {
  if (!modoEdicao || !diaDetalheAtual) return;
  estadoDetalhes[diaDetalheAtual] = campoDetalhes.value;
});

document.getElementById("fechar-detalhes")?.addEventListener("click", fecharPainel);
document.getElementById("btn-painel-fechar")?.addEventListener("click", fecharPainel);
painelDetalhes.addEventListener("click", (e) => {
  if (e.target === painelDetalhes) fecharPainel();
});
document.getElementById("btn-painel-salvar")?.addEventListener("click", async () => {
  if (salvamentoEmAndamento) return;
  try {
    const salvo = await salvarCalendario();
    if (!salvo) return;
    renderizarCalendario();
    mostrarToast("Alterações salvas com sucesso.", "success");
  } catch (e) {
    mostrarToast("Não foi possível salvar as alterações: " + e.message, "error");
  }
});

function fecharPainel() {
  painelDetalhes.classList.add("hidden");
  diaDetalheAtual = null;
}

/* ──────────────────────────────────────────────
   FOTOS DO QUADRO
   estadoFotos: { "2026-06-10": [{img: "base64", desc: "texto"}, ...] }
────────────────────────────────────────────── */
function renderizarFotos(diaISO) {
  const container = document.getElementById("tab-fotos");
  if (!container) return;

  const fotos = (estadoFotos[diaISO] || []).map(normalizedPhoto);

  const uploadHTML = modoEdicao ? `
    <label class="btn-upload-foto">
      <input type="file" id="input-foto" accept="image/*" multiple style="display:none">
      + Adicionar foto do quadro
    </label>
  ` : "";

  const galeriaHTML = fotos.length > 0
    ? `<div class="fotos-galeria">
        ${fotos.map((foto, i) => `
          <div class="foto-item">
            <img loading="lazy" decoding="async" alt="${escapeHtml(foto.desc || "Foto do quadro")}" tabindex="0" role="button" src="${escapeHtml(foto.img)}" onclick="abrirFotoGrande('${diaISO}', ${i})" title="${escapeHtml(foto.desc)}">
            ${foto.desc ? `<div class="foto-desc-badge">${escapeHtml(foto.desc)}</div>` : ""}
            ${modoEdicao ? `<button class="btn-remover-foto" onclick="removerFoto('${diaISO}', ${i})">✕</button>` : ""}
          </div>
        `).join("")}
       </div>`
    : `<p class="fotos-vazio">${modoEdicao ? "Nenhuma foto ainda. Adicione fotos do quadro." : "Nenhuma foto registrada neste dia."}</p>`;

  container.innerHTML = `
    <p class="anotacao-label">Fotos do quadro</p>
    ${uploadHTML}
    ${galeriaHTML}
  `;

  container.querySelectorAll('img[role="button"]').forEach(img => img.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); img.click(); } });
  container.querySelectorAll('.btn-remover-foto').forEach(b => b.setAttribute('aria-label', 'Remover foto'));
  const inputFoto = document.getElementById("input-foto");
  if (inputFoto) {
    inputFoto.addEventListener("change", (e) => iniciarUploadFotos(diaISO, e.target.files));
  }
}

// Fila de fotos aguardando descrição
async function iniciarUploadFotos(diaISO, files) {
  if (!modoEdicao || salvamentoEmAndamento || !files.length || _filaPendente.length) return;
  _diaUpload = diaISO;
  _filaPendente = Array.from(files);
  processarProximaFoto();
}

async function processarProximaFoto() {
  if (!_filaPendente.length) return;

  if (!estadoFotos[_diaUpload]) estadoFotos[_diaUpload] = [];
  if (estadoFotos[_diaUpload].length >= 6) {
    mostrarToast("O limite é de 6 fotos por dia.", "warning");
    _filaPendente = [];
    return;
  }

  const file = _filaPendente.shift();
  mostrarToast("Preparando a foto...", "info");
  try {
    const b64 = await compressPhoto(file, 900, 0.72);
    // Abre modal de descrição com a foto comprimida em Base64
    abrirModalDescFoto(b64);
  } catch (e) { mostrarToast(e.message, 'error'); _filaPendente = []; }
}

function abrirModalDescFoto(b64) {
  // Cria modal se não existir
  let modal = document.getElementById("modal-desc-foto");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "modal-desc-foto";
    modal.className = "login-overlay hidden";
    modal.innerHTML = `
      <div class="login-box modal-desc-box">
        <div class="login-header">
          <h2>Descrição da foto</h2>
          <p class="login-sub">Descreva o que está na foto (obrigatório)</p>
        </div>
        <img id="modal-desc-preview" style="width:100%;border-radius:8px;margin-bottom:12px;max-height:200px;object-fit:cover;">
        <div class="input-group">
          <label for="modal-desc-input">Descrição</label>
          <input type="text" id="modal-desc-input" placeholder="Ex: Matéria de Matemática - pág 42" maxlength="120">
        </div>
        <p class="login-erro" id="modal-desc-erro"></p>
        <div style="display:flex;gap:8px;margin-top:4px;">
          <button id="btn-desc-cancelar" style="flex:1;padding:12px;background:transparent;border:1px solid var(--border-lg);color:var(--text-secondary);border-radius:var(--radius-md);cursor:pointer;font-family:var(--font-main);font-size:14px;">Cancelar</button>
          <button id="btn-desc-confirmar" style="flex:2;padding:12px;background:var(--red-main);border:none;color:white;border-radius:var(--radius-md);cursor:pointer;font-family:var(--font-main);font-size:14px;font-weight:700;">Adicionar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById("btn-desc-confirmar").addEventListener("click", confirmarDescFoto);
    document.getElementById("btn-desc-cancelar").addEventListener("click", () => {
      fecharModalDescFoto();
      _filaPendente = []; // cancela fila
    });
    document.getElementById("modal-desc-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") confirmarDescFoto();
    });
  }

  document.getElementById("modal-desc-preview").src = b64;
  document.getElementById("modal-desc-input").value = "";
  document.getElementById("modal-desc-erro").textContent = "";
  modal._b64pendente = b64;
  modal.classList.remove("hidden");
  setTimeout(() => document.getElementById("modal-desc-input")?.focus(), 100);
}

function confirmarDescFoto() {
  const modal = document.getElementById("modal-desc-foto");
  const input = document.getElementById("modal-desc-input");
  const erro = document.getElementById("modal-desc-erro");
  const desc = input.value.trim();

  if (!desc) {
    erro.textContent = "A descrição é obrigatória.";
    input.focus();
    return;
  }

  if (!estadoFotos[_diaUpload]) estadoFotos[_diaUpload] = [];
  if (!modoEdicao || salvamentoEmAndamento) return;
  estadoFotos[_diaUpload].push({ img: modal._b64pendente, desc });

  fecharModalDescFoto();
  renderizarFotos(_diaUpload);
  mostrarToast("Foto adicionada! Salve para guardar.", "success");

  // Processa próxima foto da fila
  if (_filaPendente.length > 0) processarProximaFoto();
}

function fecharModalDescFoto() {
  document.getElementById("modal-desc-foto")?.classList.add("hidden");
}

window.removerFoto = function (diaISO, idx) {
  if (!modoEdicao || salvamentoEmAndamento || !estadoFotos[diaISO]) return;
  estadoFotos[diaISO].splice(idx, 1);
  renderizarFotos(diaISO);
  mostrarToast("Foto removida. Salve para confirmar.", "info");
};

window.abrirFotoGrande = function (diaISO, startIdx) {
  const fotos = (estadoFotos[diaISO] || []).map(normalizedPhoto);
  if (!fotos.length) return;

  let idx = startIdx;
  let modoFoco = false;

  // Estado do zoom
  let scale = 1, lastScale = 1;
  let originX = 0, originY = 0;
  let isPinching = false;
  let isDragging = false;
  let dragStart = { x: 0, y: 0 };
  let translateX = 0, translateY = 0;

  function resetZoom() {
    scale = 1; lastScale = 1;
    translateX = 0; translateY = 0;
    const img = document.getElementById("lb-img");
    if (img) img.style.transform = "";
  }

  function applyTransform() {
    const img = document.getElementById("lb-img");
    if (img) img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
  }

  function toggleFoco() {
    modoFoco = !modoFoco;
    overlay.classList.toggle("modo-foco", modoFoco);
    const btn = document.getElementById("lb-foco");
    if (btn) btn.textContent = modoFoco ? "⊞" : "⊡";
  }

  const overlay = document.createElement("div");
  overlay.className = "lightbox-overlay";
  overlay.id = "lightbox-overlay";

  function buildHTML() {
    const foto = fotos[idx];
    const total = fotos.length;
    overlay.innerHTML = `
      <div class="lightbox-topbar">
        <div class="lightbox-topbar-left">
          <span class="lightbox-counter">${idx + 1} / ${total}</span>
        </div>
        <div class="lightbox-topbar-right">
          <button class="lightbox-btn foco" id="lb-foco" title="Modo foco">⊡</button>
          <button class="lightbox-btn download" id="lb-download" title="Baixar imagem">⬇</button>
          <button class="lightbox-btn fechar" id="lb-fechar" title="Fechar">✕</button>
        </div>
      </div>
      <div class="lightbox-stage" id="lb-stage">
        <button class="lightbox-nav lb-prev${total <= 1 ? ' hidden-nav' : ''}" id="lb-prev">‹</button>
        <img src="${escapeHtml(foto.img)}" class="lightbox-img" id="lb-img" draggable="false">
        <button class="lightbox-nav lb-next${total <= 1 ? ' hidden-nav' : ''}" id="lb-next">›</button>
      </div>
      <div class="lightbox-bottombar" id="lb-bottombar" style="${foto.desc ? '' : 'display:none'}">
        <p class="lightbox-desc" id="lb-desc">${escapeHtml(foto.desc || '')}</p>
      </div>
    `;
  }

  function atualizar(novoIdx) {
    const total = fotos.length;
    idx = (novoIdx + total) % total;
    resetZoom();
    const f = fotos[idx];
    const img = document.getElementById("lb-img");
    if (img) {
      img.style.opacity = "0";
      setTimeout(() => { img.src = photoSource(f); img.style.opacity = "1"; }, 150);
    }
    const counter = overlay.querySelector(".lightbox-counter");
    if (counter) counter.textContent = `${idx + 1} / ${total}`;
    const desc = document.getElementById("lb-desc");
    const bar = document.getElementById("lb-bottombar");
    if (desc) desc.textContent = f.desc || "";
    if (bar) bar.style.display = f.desc ? "" : "none";
  }

  const opener = document.activeElement;
  const closeLightbox = () => { overlay.remove(); document.removeEventListener('keydown', onKey); opener?.focus(); };
  buildHTML();
  overlay.querySelectorAll('button').forEach(b => b.setAttribute('aria-label', b.title || (b.id === 'lb-prev' ? 'Foto anterior' : 'Próxima foto')));
  document.body.appendChild(overlay);

  // Botões
  overlay.querySelector("#lb-fechar").addEventListener("click", closeLightbox);
  overlay.querySelector("#lb-foco").addEventListener("click", toggleFoco);
  overlay.querySelector("#lb-prev")?.addEventListener("click", (e) => { e.stopPropagation(); if (scale === 1) atualizar(idx - 1); });
  overlay.querySelector("#lb-next")?.addEventListener("click", (e) => { e.stopPropagation(); if (scale === 1) atualizar(idx + 1); });

  // Clique na imagem: se zoom normal → toggle foco; se com zoom → nada
  overlay.querySelector("#lb-img").addEventListener("click", (e) => {
    e.stopPropagation();
    if (scale === 1) toggleFoco();
  });

  // Download
  overlay.querySelector("#lb-download").addEventListener("click", () => {
    const foto = fotos[idx];
    const a = document.createElement("a");
    a.href = photoSource(foto);
    a.download = foto.desc ? `${escapeHtml(foto.desc)}.jpg` : `foto-${idx + 1}.jpg`;
    a.click();
  });

  // Teclado (sem F)
  function onKey(e) {
    if (e.key === "ArrowLeft") { if (scale === 1) atualizar(idx - 1); }
    if (e.key === "ArrowRight") { if (scale === 1) atualizar(idx + 1); }
    if (e.key === "Escape") { closeLightbox(); }
  }
  document.addEventListener("keydown", onKey);

  // ── TOUCH: Swipe + Pinch zoom (estilo WhatsApp) ──
  const stage = overlay.querySelector("#lb-stage");
  let touch1 = null, touch2 = null;
  let pinchStartDist = 0;
  let pinchStartScale = 1;
  let swipeStartX = null;

  stage.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
      touch1 = e.touches[0];
      swipeStartX = touch1.clientX;
      isPinching = false;
    } else if (e.touches.length === 2) {
      isPinching = true;
      swipeStartX = null;
      touch1 = e.touches[0];
      touch2 = e.touches[1];
      pinchStartDist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      pinchStartScale = scale;
      e.preventDefault();
    }
  }, { passive: false });

  stage.addEventListener("touchmove", (e) => {
    if (e.touches.length === 2 && isPinching) {
      e.preventDefault();
      const t1 = e.touches[0], t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      scale = Math.min(Math.max(pinchStartScale * (dist / pinchStartDist), 1), 5);
      applyTransform();
    } else if (e.touches.length === 1 && scale > 1 && !isPinching) {
      e.preventDefault();
      const dx = e.touches[0].clientX - touch1.clientX;
      const dy = e.touches[0].clientY - touch1.clientY;
      translateX += dx;
      translateY += dy;
      touch1 = e.touches[0];
      applyTransform();
    }
  }, { passive: false });

  stage.addEventListener("touchend", (e) => {
    if (isPinching && e.touches.length < 2) {
      isPinching = false;
      lastScale = scale;
      if (scale <= 1.05) resetZoom();
      return;
    }
    if (!isPinching && swipeStartX !== null && scale === 1) {
      const diff = e.changedTouches[0].clientX - swipeStartX;
      if (Math.abs(diff) > 50) atualizar(diff < 0 ? idx + 1 : idx - 1);
    }
    swipeStartX = null;
  });

  // Duplo toque: zoom rápido (estilo WhatsApp)
  let lastTap = 0;
  stage.addEventListener("touchend", (e) => {
    if (e.touches.length > 0) return;
    const now = Date.now();
    if (now - lastTap < 300) {
      if (scale > 1) { resetZoom(); applyTransform(); }
      else { scale = 2.5; applyTransform(); }
    }
    lastTap = now;
  });

  // Clique no fundo fecha
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeLightbox(); });
};

function atualizarChipsDia(diaISO) {
  const diaEl = diasContainer.querySelector(`[data-dia="${diaISO}"]`)?.closest(".dia");
  if (!diaEl) return;
  const chips = diaEl.querySelector(".dia-chips");
  if (!chips) return;

  const materias = Object.keys(estadoMaterias[diaISO] || {});
  chips.innerHTML = materias.map(m => `<span class="chip-materia">${escapeHtml(m)}</span>`).join("");

  if (materias.length > 0 || estadoDetalhes[diaISO]) {
    diaEl.classList.add("tem-conteudo");
  } else {
    diaEl.classList.remove("tem-conteudo");
  }
}

/* ──────────────────────────────────────────────
   FIRESTORE — SALVAR / CARREGAR
────────────────────────────────────────────── */
const mesAnoKey = () =>
  `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, "0")}`;

// ← NOVO: compara o estado atual das matérias com a "foto" tirada antes
// da edição começar, e devolve só o que é novo/mudou pra dias futuros
function detectarNovosEventos() {
  const antes = window._snapshotMaterias || {};
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const eventos = [];
  Object.entries(estadoMaterias).forEach(([diaISO, materias]) => {
    const dataEvento = new Date(diaISO + "T00:00:00");
    if (dataEvento < hoje) return; // ignora dias que já passaram

    Object.entries(materias).forEach(([materia, desc]) => {
      const descAntes = (antes[diaISO] || {})[materia];
      if (descAntes === undefined || descAntes !== desc) {
        eventos.push({ data: diaISO, materia, descricao: desc });
      }
    });
  });
  return eventos;
}

let loaded = null;
let loadSequence = 0;
async function salvarCalendario() {
  if (salvamentoEmAndamento) return false;
  if (!auth.currentUser || !canEdit(SALA_ID, claimsAtuais, auth.currentUser)) throw new Error('Entre com a conta desta turma.');
  if (!senhaEdicaoTurma) throw new Error('Digite a senha de edição desta turma.');
  if (!modoEdicao || !loaded || loaded.month !== mesAnoKey()) throw new Error('Carregue o mês antes de salvar.');
  validarLimitesDeAlteracaoDasRules();
  salvamentoEmAndamento = true;
  const controls = [...document.querySelectorAll('button,textarea,input')];
  const disabled = controls.map(el => el.disabled);
  controls.forEach(el => el.disabled = true);
  try {
    const month = mesAnoKey();
    const baseRevision = Number.isInteger(loaded.data.revision) ? loaded.data.revision : 0;
    const payload = {
      operation: 'save-month',
      turma: SALA_ID,
      password: senhaEdicaoTurma,
      month,
      baseRevision,
      avisos: campoAvisos.value.trim(),
      detalhes: structuredClone(estadoDetalhes),
      materias: structuredClone(estadoMaterias),
      fotos: structuredClone(estadoFotos)
    };

    let result;
    try {
      result = await chamarBackendCalendario(payload);
    } catch (e) {
      if (e.status === 401) {
        senhaEdicaoTurma = '';
        throw new Error('Senha de edição incorreta ou alterada. Clique em Editar e digite a senha novamente.');
      }
      throw e;
    }

    const revision = Number.isInteger(result.revision) ? result.revision : baseRevision + 1;
    loaded.data = {
      ...loaded.data,
      avisos: payload.avisos,
      detalhes: structuredClone(payload.detalhes),
      materias: structuredClone(payload.materias),
      fotos: structuredClone(payload.fotos),
      revision
    };

    const events = detectarNovosEventos();
    window._snapshotMaterias = structuredClone(estadoMaterias);
    if (events.length && window.notificarNovosEventos) {
      try { await window.notificarNovosEventos(events); }
      catch (e) { console.warn(e); mostrarToast('Calendário salvo, mas o envio de push falhou.', 'warning'); }
    }
    return true;
  } finally {
    salvamentoEmAndamento = false;
    controls.forEach((el, i) => el.disabled = disabled[i]);
  }
}

async function carregarCalendario() {
  const sequence = ++loadSequence;
  const month = mesAnoKey();
  loaded = null;
  btnEditar.disabled = true;
  try {
    const snap = await getDocFromServer(doc(db, 'salas', SALA_ID, 'calendario', month));
    if (sequence !== loadSequence || month !== mesAnoKey() || !auth.currentUser) return;
    const data = snap.exists() ? snap.data() : {};
    loaded = { month, data };
    campoAvisos.value = data.avisos || '';
    estadoDetalhes = structuredClone(data.detalhes || {});
    // Notas do formato antigo continuam visíveis e não são apagadas ao salvar.
    for (const [key, value] of Object.entries(data)) if (/^\d{4}-\d{2}-\d{2}$/.test(key) && typeof value === 'string' && !estadoDetalhes[key]) estadoDetalhes[key] = value;
    estadoMaterias = structuredClone(data.materias || {});
    estadoFotos = structuredClone(data.fotos || {});
    window._snapshotMaterias = structuredClone(estadoMaterias);
    renderizarCalendario();
    btnEditar.disabled = !canEdit(SALA_ID, claimsAtuais);
  } catch (e) { if (sequence === loadSequence) mostrarToast('Não foi possível carregar o calendário. Tente novamente.', 'error'); }
}


window.carregarCalendario = carregarCalendario;

/* ──────────────────────────────────────────────
   NAVEGAÇÃO DE MÊS
────────────────────────────────────────────── */
async function mudarMes(delta) {
  if (salvamentoEmAndamento) return;
  if (modoEdicao && !confirm('Mudar de mês e descartar alterações não salvas?')) return;
  modoEdicao = false; senhaEdicaoTurma = ''; fecharPainel();
  descartarAlteracoesFotosLocais();
  dataAtual = new Date(dataAtual.getFullYear(), dataAtual.getMonth() + delta, 1);
  estadoMaterias = {}; estadoDetalhes = {}; estadoFotos = {}; campoAvisos.value = '';
  atualizarModoEdicao(); renderizarCalendario();
  await carregarCalendario();
}
document.getElementById('mes-anterior').addEventListener('click', () => mudarMes(-1));
document.getElementById('mes-proximo').addEventListener('click', () => mudarMes(1));
window.addEventListener('beforeunload', e => { if (modoEdicao || salvamentoEmAndamento) { e.preventDefault(); e.returnValue = ''; } });

/* ──────────────────────────────────────────────
   MENU LATERAL
────────────────────────────────────────────── */
const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebar-overlay");

menuBtn?.addEventListener("click", () => {
  const open = sidebar.classList.toggle("open");
  sidebarOverlay?.classList.toggle("show", open);
  menuBtn.setAttribute("aria-expanded", String(open));
  sidebarOverlay?.setAttribute("aria-hidden", String(!open));
});

sidebarOverlay?.addEventListener("click", () => {
  sidebar.classList.remove("open");
  sidebarOverlay.classList.remove("show");
  menuBtn?.setAttribute("aria-expanded", "false");
  sidebarOverlay.setAttribute("aria-hidden", "true");
});
document.querySelectorAll(".sidebar a").forEach(a =>
  a.addEventListener("click", () => {
    sidebar.classList.remove("open");
    sidebarOverlay?.classList.remove("show");
    menuBtn?.setAttribute("aria-expanded", "false");
    sidebarOverlay?.setAttribute("aria-hidden", "true");
  })
);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && sidebar?.classList.contains("open")) {
    sidebar.classList.remove("open");
    sidebarOverlay?.classList.remove("show");
    menuBtn?.setAttribute("aria-expanded", "false");
    sidebarOverlay?.setAttribute("aria-hidden", "true");
    menuBtn?.focus();
  }
});

/* ──────────────────────────────────────────────
   TOAST
────────────────────────────────────────────── */
function mostrarToast(msg, tipo = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${tipo}`;
  const icones = {
    success: '<path d="m5 12 4 4L19 6"/>',
    error: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>',
    warning: '<path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 4h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>'
  };
  toast.innerHTML = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icones[tipo] || icones.info}</svg><span></span>`;
  toast.querySelector("span").textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("saindo");
    setTimeout(() => toast.remove(), 350);
  }, 2800);
}

/* ──────────────────────────────────────────────
   INICIALIZAÇÃO
────────────────────────────────────────────── */
// O calendário é renderizado e carregado pelo observador de sessão acima.
// Renderiza a estrutura vazia imediatamente para não mostrar tela em branco.
renderizarCalendario();
initNotificacoes(SALA_ID);
