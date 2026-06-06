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
  "Educação Física", "Artes", "Fisica", "Filosofia",
  "Quimica", "Sociologia"
];

let modoEdicao      = false;
let diaDetalheAtual = null;
let estadoMaterias  = {};
let estadoDetalhes  = {};
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

// onAuthStateChanged dispara uma vez ao carregar com o estado real da sessão
// (incluindo sessão persistida do localStorage pelo Firebase)
onAuthStateChanged(auth, (user) => {
  window.usuarioLogado = user || null;

  if (estaLogadoNaTurma(user)) {
    // Sessão válida desta turma → entra direto, sem pedir nada
    fecharModalLogin();
    if (btnLoginTopo) btnLoginTopo.style.display = "none";
    btnEditar.disabled = false;
    if (window.carregarCalendario) window.carregarCalendario();
  } else {
    // Sem sessão ou sessão de outra turma → pede login
    if (btnLoginTopo) btnLoginTopo.style.display = "inline-flex";
    btnEditar.disabled = true;
    abrirModalLogin();
  }
});

// Botão "Entrar" no topo (caso feche o modal e queira logar de novo)
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
      fecharModalLogin();
      btnEditar.disabled = false;
      mostrarToast("✅ Login realizado!", "success");
      await carregarCalendario();
    } else {
      // Logou, mas com email de outra turma
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

btnEditar.addEventListener("click", async () => {
  if (!estaLogadoNaTurma(window.usuarioLogado)) {
    abrirModalLogin();
    return;
  }

  const senha = prompt("🔑 Digite a senha de edição:");
  if (senha === null) return;

  const ok = await verificarSenhaEdicao(senha);
  if (ok) {
    modoEdicao = true;
    atualizarModoEdicao();
    mostrarToast("✏️ Modo edição ativado", "info");
  } else {
    mostrarToast("❌ Senha incorreta", "error");
  }
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
   CHIPS NOS DIAS DO CALENDÁRIO
────────────────────────────────────────────── */
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
  if (!estaLogadoNaTurma(window.usuarioLogado)) {
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
