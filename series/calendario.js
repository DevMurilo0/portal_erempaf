import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  deleteField
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ──────────────────────────────────────────────
   CONFIGURAÇÃO
────────────────────────────────────────────── */
const auth = getAuth();

// Email esperado para esta turma: "2ano-b" → "2anob@erempaf.com"
const EMAIL_TURMA = SALA_ID.replace("-", "") + "@erempaf.com";

const MATERIAS = [
  "Português", "Matemática", "História",
  "Geografia", "Biologia", "Lingua Inglesa",
  "Educação Física", "Artes", "Filosofia",
  "Quimica", "Sociologia", "Fisica"
];

let modoEdicao      = false;
let diaDetalheAtual = null;
let estadoMaterias  = {};
let estadoDetalhes  = {};
let estadoFotos     = {}; // { "2026-06-10": ["base64...", "base64..."] }
let tabAtiva        = "anotacoes";
let dataAtual       = new Date();

/* ──────────────────────────────────────────────
   ELEMENTOS
────────────────────────────────────────────── */
const telaLogin      = document.getElementById("tela-login");
const btnLoginForm   = document.getElementById("btn-login");
const emailInput     = document.getElementById("login-email");
const senhaInput     = document.getElementById("login-senha");
const erroLogin      = document.getElementById("login-erro");
const btnLoginTopo   = document.getElementById("btn-login-topo");

const diasContainer  = document.getElementById("dias");
const mesAnoSpan     = document.getElementById("mes-ano");
const btnEditar      = document.getElementById("btn-editar");
const btnSalvar      = document.getElementById("btn-salvar");
const campoAvisos    = document.getElementById("campo-avisos");

const painelDetalhes = document.getElementById("painel-detalhes");
const campoDetalhes  = document.getElementById("campo-detalhes");
const tituloDetalhes = document.getElementById("titulo-detalhes");
const diaSemanaEl    = document.getElementById("painel-dia-semana");
const materiasGrid   = document.getElementById("materias-grid");

/* ──────────────────────────────────────────────
   AUTENTICAÇÃO — LOGIN DA TURMA
────────────────────────────────────────────── */

function estaLogadoNaTurma(user) {
  return user && user.email === EMAIL_TURMA;
}

function abrirModalLogin() {
  if (emailInput) emailInput.value = "";
  if (senhaInput) senhaInput.value = "";
  if (erroLogin)  erroLogin.textContent = "";
  telaLogin.classList.remove("hidden");
  setTimeout(() => emailInput?.focus(), 100);
}

function fecharModalLogin() {
  telaLogin.classList.add("hidden");
}

const STORAGE_KEY = `erempaf_auth_${SALA_ID}`;

function turmaJaAutenticada() {
  return localStorage.getItem(STORAGE_KEY) === "1";
}

function marcarTurmaAutenticada() {
  localStorage.setItem(STORAGE_KEY, "1");
}

// onAuthStateChanged dispara uma vez ao carregar com o estado real da sessão
onAuthStateChanged(auth, (user) => {
  window.usuarioLogado = user || null;

  if (estaLogadoNaTurma(user)) {
    // Firebase ainda tem a sessão desta turma ativa
    marcarTurmaAutenticada();
    fecharModalLogin();
    if (btnLoginTopo) btnLoginTopo.style.display = "none";
    btnEditar.disabled = false;
    if (window.carregarCalendario) window.carregarCalendario();
  } else if (turmaJaAutenticada()) {
    // Já autenticou antes nesta turma — faz login silencioso pelo Firebase
    // O Firebase pode estar com outra sessão, mas o localStorage confirma que
    // esta turma já foi autenticada. Aguarda o relogin não ser necessário:
    // basta sinalizar como apto e carregar (modo leitura sem edição até relogar)
    fecharModalLogin();
    if (btnLoginTopo) btnLoginTopo.style.display = "none";
    btnEditar.disabled = false;
    window.modoSoLeitura = true;
    if (window.carregarCalendario) window.carregarCalendario();
  } else {
    // Primeira vez nesta turma → pede login
    if (btnLoginTopo) btnLoginTopo.style.display = "inline-flex";
    btnEditar.disabled = true;
    abrirModalLogin();
  }
});

// Botão "Entrar" no topo
if (btnLoginTopo) {
  btnLoginTopo.addEventListener("click", abrirModalLogin);
}

// Submit do login
btnLoginForm.addEventListener("click", async () => {
  erroLogin.textContent = "";
  const email = emailInput.value.trim();
  const senha = senhaInput.value;

  if (!email || !senha) {
    erroLogin.textContent = "Preencha o email e a senha.";
    return;
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, email, senha);
    window.usuarioLogado = cred.user;

    if (estaLogadoNaTurma(cred.user)) {
      marcarTurmaAutenticada();
      window.modoSoLeitura = false;
      fecharModalLogin();
      btnEditar.disabled = false;
      mostrarToast("✅ Login realizado!", "success");
      await carregarCalendario();
    } else {
      erroLogin.textContent = "Esse email não pertence a esta turma.";
      await auth.signOut();
    }
  } catch {
    erroLogin.textContent = "Email ou senha incorretos.";
  }
});

// Enter nos campos de login
senhaInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnLoginForm.click();
});
emailInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") senhaInput.focus();
});

/* ──────────────────────────────────────────────
   MODO EDIÇÃO — SENHA DO FIRESTORE
────────────────────────────────────────────── */

async function verificarSenhaEdicao(senhaDigitada) {
  const ref = doc(window.db, "salas", SALA_ID);
  const snap = await getDoc(ref);
  if (!snap.exists()) return false;
  return senhaDigitada === snap.data().senha;
}

function abrirModalSenhaEdicao() {
  const modal = document.getElementById("modal-senha-edicao");
  const input = document.getElementById("senha-edicao-input");
  const erro  = document.getElementById("senha-edicao-erro");
  if (input) input.value = "";
  if (erro)  erro.textContent = "";
  modal.classList.remove("hidden");
  setTimeout(() => input?.focus(), 100);
}

function fecharModalSenhaEdicao() {
  document.getElementById("modal-senha-edicao").classList.add("hidden");
}

document.getElementById("btn-confirmar-senha-edicao")?.addEventListener("click", async () => {
  const input = document.getElementById("senha-edicao-input");
  const erro  = document.getElementById("senha-edicao-erro");
  const senha = input.value;

  if (!senha) { erro.textContent = "Digite a senha."; return; }

  const ok = await verificarSenhaEdicao(senha);
  if (ok) {
    fecharModalSenhaEdicao();
    modoEdicao = true;
    atualizarModoEdicao();
    mostrarToast("✏️ Modo edição ativado", "info");
  } else {
    erro.textContent = "Senha incorreta.";
    input.value = "";
    input.focus();
  }
});

document.getElementById("btn-cancelar-senha-edicao")?.addEventListener("click", fecharModalSenhaEdicao);

document.getElementById("senha-edicao-input")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("btn-confirmar-senha-edicao")?.click();
  if (e.key === "Escape") fecharModalSenhaEdicao();
});

btnEditar.addEventListener("click", async () => {
  if (!estaLogadoNaTurma(window.usuarioLogado) && !window.modoSoLeitura) {
    abrirModalLogin();
    return;
  }
  abrirModalSenhaEdicao();
});

btnSalvar.addEventListener("click", async () => {
  try {
    await salvarCalendario();
    mostrarToast("✅ Salvo com sucesso!", "success");
  } catch (e) {
    mostrarToast("❌ Erro ao salvar: " + e.message, "error");
  }
  modoEdicao = false;
  atualizarModoEdicao();
  await carregarCalendario();
});

function atualizarModoEdicao() {
  document.querySelectorAll("textarea").forEach(t => { t.disabled = !modoEdicao; });
  campoAvisos.disabled    = !modoEdicao;
  campoDetalhes.disabled  = !modoEdicao;
  btnSalvar.hidden        = !modoEdicao;
  btnEditar.hidden        = modoEdicao;

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
    offset = 4;
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
        `<span class="chip-materia">${m}</span>`
      ).join("");

      div.innerHTML = `
        <div class="topo-dia">
          <span class="numero">${dia}</span>
          <span class="hoje-badge">hoje</span>
          <button class="btn-detalhes" data-dia="${dataISO}" title="Ver detalhes do dia">＋</button>
        </div>
        <div class="dia-chips">${chipsHTML}</div>
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
  const diasSemana = ["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];

  tituloDetalhes.textContent = data.toLocaleDateString("pt-BR", {
    day: "numeric", month: "long", year: "numeric"
  });
  if (diaSemanaEl) diaSemanaEl.textContent = diasSemana[data.getDay()];

  campoDetalhes.value    = estadoDetalhes[diaISO] || "";
  campoDetalhes.disabled = !modoEdicao;

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
        <div class="materia-item ${ativa ? "checked" : ""}"
             data-materia="${mat}"
             onclick="toggleMateria('${diaISO}','${mat}',this)">
          <div class="materia-check">${ativa ? "✓" : ""}</div>
          <span class="materia-nome">${mat}</span>
        </div>`;
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

  container.innerHTML = `<div class="materias-blocos">` +
    Object.entries(marcadas).map(([mat, desc]) => `
      <div class="materia-bloco" data-materia="${mat}">
        <div class="materia-bloco-header" onclick="toggleBloco(this)">
          <span class="materia-bloco-nome">${mat}</span>
          <span class="materia-bloco-arrow">▾</span>
        </div>
        <div class="materia-bloco-body">
          <textarea
            class="materia-bloco-desc"
            data-dia="${diaISO}"
            data-materia="${mat}"
            placeholder="Tarefa, prova, conteúdo..."
            ${modoEdicao ? "" : "disabled"}
            oninput="salvarDescMateria('${diaISO}','${mat}',this.value)"
          >${desc || ""}</textarea>
        </div>
      </div>
    `).join("") +
  `</div>`;
}

window.toggleBloco = function(header) {
  const bloco = header.closest(".materia-bloco");
  bloco.classList.toggle("aberto");
};

window.salvarDescMateria = function(diaISO, materia, valor) {
  if (!estadoMaterias[diaISO]) estadoMaterias[diaISO] = {};
  estadoMaterias[diaISO][materia] = valor;
};

window.toggleMateria = function(diaISO, materia, el) {
  if (!modoEdicao) {
    mostrarToast("🔒 Ative o modo edição para alterar", "info");
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
  const hoje    = new Date();
  const data    = new Date(diaISO);
  const diffMs  = data - hoje;
  const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));

  const elDias    = document.getElementById("stat-dias");
  const elMateria = document.getElementById("stat-materias");

  if (elDias) {
    if (diffDias === 0)      elDias.textContent = "Hoje";
    else if (diffDias > 0)   elDias.textContent = `+${diffDias}`;
    else                     elDias.textContent = diffDias;
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
  await salvarCalendario();
  mostrarToast("✅ Salvo!", "success");
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

  const fotos = estadoFotos[diaISO] || [];

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
            <img src="${foto.img}" onclick="abrirFotoGrande('${diaISO}', ${i})" title="${foto.desc}">
            ${foto.desc ? `<div class="foto-desc-badge">${foto.desc}</div>` : ""}
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

  const inputFoto = document.getElementById("input-foto");
  if (inputFoto) {
    inputFoto.addEventListener("change", (e) => iniciarUploadFotos(diaISO, e.target.files));
  }
}

// Fila de fotos aguardando descrição
let _filaPendente = [];
let _diaUpload    = null;

async function iniciarUploadFotos(diaISO, files) {
  if (!files.length) return;
  _diaUpload = diaISO;
  _filaPendente = Array.from(files);
  processarProximaFoto();
}

async function processarProximaFoto() {
  if (!_filaPendente.length) return;

  if (!estadoFotos[_diaUpload]) estadoFotos[_diaUpload] = [];
  if (estadoFotos[_diaUpload].length >= 6) {
    mostrarToast("⚠️ Limite de 6 fotos por dia", "error");
    _filaPendente = [];
    return;
  }

  const file = _filaPendente.shift();
  mostrarToast("⏳ Comprimindo foto...", "info");
  const b64 = await comprimirImagem(file, 900, 0.72);

  // Abre modal de descrição com a foto comprimida
  abrirModalDescFoto(b64);
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
  const erro  = document.getElementById("modal-desc-erro");
  const desc  = input.value.trim();

  if (!desc) {
    erro.textContent = "A descrição é obrigatória.";
    input.focus();
    return;
  }

  if (!estadoFotos[_diaUpload]) estadoFotos[_diaUpload] = [];
  estadoFotos[_diaUpload].push({ img: modal._b64pendente, desc });

  fecharModalDescFoto();
  renderizarFotos(_diaUpload);
  mostrarToast("✅ Foto adicionada! Salve para guardar.", "success");

  // Processa próxima foto da fila
  if (_filaPendente.length > 0) processarProximaFoto();
}

function fecharModalDescFoto() {
  document.getElementById("modal-desc-foto")?.classList.add("hidden");
}

function comprimirImagem(file, maxWidth, quality) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height, 1);
        canvas.width  = img.width  * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

window.removerFoto = function(diaISO, idx) {
  if (!estadoFotos[diaISO]) return;
  estadoFotos[diaISO].splice(idx, 1);
  renderizarFotos(diaISO);
  mostrarToast("🗑️ Foto removida. Salve para confirmar.", "info");
};

window.abrirFotoGrande = function(diaISO, startIdx) {
  const fotos = estadoFotos[diaISO] || [];
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
        <img src="${foto.img}" class="lightbox-img" id="lb-img" draggable="false">
        <button class="lightbox-nav lb-next${total <= 1 ? ' hidden-nav' : ''}" id="lb-next">›</button>
      </div>
      <div class="lightbox-bottombar" id="lb-bottombar" style="${foto.desc ? '' : 'display:none'}">
        <p class="lightbox-desc" id="lb-desc">${foto.desc || ''}</p>
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
      setTimeout(() => { img.src = f.img; img.style.opacity = "1"; }, 150);
    }
    const counter = overlay.querySelector(".lightbox-counter");
    if (counter) counter.textContent = `${idx + 1} / ${total}`;
    const desc = document.getElementById("lb-desc");
    const bar  = document.getElementById("lb-bottombar");
    if (desc) desc.textContent = f.desc || "";
    if (bar) bar.style.display = f.desc ? "" : "none";
  }

  buildHTML();
  document.body.appendChild(overlay);

  // Botões
  overlay.querySelector("#lb-fechar").addEventListener("click", () => overlay.remove());
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
    a.href = foto.img;
    a.download = foto.desc ? `${foto.desc}.jpg` : `foto-${idx + 1}.jpg`;
    a.click();
  });

  // Teclado (sem F)
  function onKey(e) {
    if (e.key === "ArrowLeft")  { if (scale === 1) atualizar(idx - 1); }
    if (e.key === "ArrowRight") { if (scale === 1) atualizar(idx + 1); }
    if (e.key === "Escape")     { overlay.remove(); document.removeEventListener("keydown", onKey); }
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
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
};

function atualizarChipsDia(diaISO) {
  const diaEl = diasContainer.querySelector(`[data-dia="${diaISO}"]`)?.closest(".dia");
  if (!diaEl) return;
  const chips = diaEl.querySelector(".dia-chips");
  if (!chips) return;

  const materias = Object.keys(estadoMaterias[diaISO] || {});
  chips.innerHTML = materias.map(m => `<span class="chip-materia">${m}</span>`).join("");

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

async function salvarCalendario() {
  if (!estaLogadoNaTurma(window.usuarioLogado) && !turmaJaAutenticada()) {
    mostrarToast("⚠️ Faça login para salvar", "error");
    return;
  }

  const mesAno = mesAnoKey();
  const dados  = {};

  document.querySelectorAll("textarea[data-dia]").forEach(el => {
    dados[el.dataset.dia] = el.value.trim() || deleteField();
  });

  dados.avisos = campoAvisos.value.trim() || deleteField();

  dados.detalhes = {};
  Object.entries(estadoDetalhes).forEach(([k, v]) => {
    if (k.startsWith(mesAno.slice(0, 7))) dados.detalhes[k] = v || deleteField();
  });

  dados.materias = {};
  Object.entries(estadoMaterias).forEach(([k, v]) => {
    if (k.startsWith(mesAno.slice(0, 7))) {
      dados.materias[k] = Object.keys(v).length ? v : deleteField();
    }
  });

  dados.fotos = {};
  Object.entries(estadoFotos).forEach(([k, v]) => {
    if (k.startsWith(mesAno.slice(0, 7))) {
      dados.fotos[k] = v.length ? v : deleteField();
    }
  });

  await setDoc(
    doc(window.db, "salas", SALA_ID, "calendario", mesAno),
    dados,
    { merge: true }
  );
}

async function carregarCalendario() {
  const mesAno = mesAnoKey();
  const ref    = doc(window.db, "salas", SALA_ID, "calendario", mesAno);
  const snap   = await getDoc(ref);

  campoAvisos.value = "";
  estadoDetalhes    = {};
  estadoMaterias    = {};
  estadoFotos       = {};

  if (!snap.exists()) return;
  const dados = snap.data();

  if (dados.avisos) campoAvisos.value = dados.avisos;

  document.querySelectorAll("textarea[data-dia]").forEach(el => {
    el.value = dados[el.dataset.dia] || "";
    const diaDiv = el.closest(".dia");
    if (el.value && diaDiv) diaDiv.classList.add("tem-conteudo");
  });

  if (dados.detalhes) Object.assign(estadoDetalhes, dados.detalhes);
  if (dados.materias) Object.assign(estadoMaterias, dados.materias);
  if (dados.fotos)    Object.assign(estadoFotos, dados.fotos);

  // Atualiza chips em todos os dias com matérias
  Object.keys(estadoMaterias).forEach(diaISO => atualizarChipsDia(diaISO));
}

window.carregarCalendario = carregarCalendario;

/* ──────────────────────────────────────────────
   NAVEGAÇÃO DE MÊS
────────────────────────────────────────────── */
document.getElementById("mes-anterior").addEventListener("click", async () => {
  dataAtual.setMonth(dataAtual.getMonth() - 1);
  renderizarCalendario();
  await carregarCalendario();
});

document.getElementById("mes-proximo").addEventListener("click", async () => {
  dataAtual.setMonth(dataAtual.getMonth() + 1);
  renderizarCalendario();
  await carregarCalendario();
});

/* ──────────────────────────────────────────────
   MENU LATERAL
────────────────────────────────────────────── */
const menuBtn        = document.getElementById("menuBtn");
const sidebar        = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebar-overlay");

menuBtn?.addEventListener("click", () => {
  const open = sidebar.classList.toggle("open");
  sidebarOverlay?.classList.toggle("show", open);
});

sidebarOverlay?.addEventListener("click", () => {
  sidebar.classList.remove("open");
  sidebarOverlay.classList.remove("show");
});

document.querySelectorAll(".sidebar a").forEach(a =>
  a.addEventListener("click", () => {
    sidebar.classList.remove("open");
    sidebarOverlay?.classList.remove("show");
  })
);

/* ──────────────────────────────────────────────
   TOAST
────────────────────────────────────────────── */
function mostrarToast(msg, tipo = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${tipo}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("saindo");
    setTimeout(() => toast.remove(), 350);
  }, 2800);
}

/* ──────────────────────────────────────────────
   INICIALIZAÇÃO
────────────────────────────────────────────── */
// O calendário é renderizado e carregado dentro do onAuthStateChanged acima.
// Renderiza a estrutura vazia imediatamente para não mostrar tela em branco.
renderizarCalendario();
