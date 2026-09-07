// ============================================================
// CARDÁPIO — EREMPAF  |  Firebase Firestore
// ============================================================
import { db } from '../shared/firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import '../shared/accessibility.js';

/* ── Constantes ── */
const DIAS_KEY  = ["segunda","terca","quarta","quinta","sexta"];
const DIAS_NOME = { segunda:"Segunda-feira", terca:"Terça-feira", quarta:"Quarta-feira", quinta:"Quinta-feira", sexta:"Sexta-feira" };
const TIPOS     = ["cafe","almoco","lanche"];
const LABELS    = {
  cafe:   { tipo: "Café da manhã",   dotClass: "dot-cafe"   },
  almoco: { tipo: "Almoço",          dotClass: "dot-almoco" },
  lanche: { tipo: "Lanche da tarde", dotClass: "dot-lanche" }
};

/* ── Estado ── */
let modoEdicao = false;
let carregado = false;
let diaAtivo   = diaDeHoje();
let dados      = {};          // { segunda: { cafe:"...", almoco:"...", lanche:"..." }, ... }
let senhaEdicao = "";
const ENDPOINT_CARDAPIO = "https://erempafbackend.netlify.app/.netlify/functions/cardapio";

/* ── Helpers ── */
function escapeHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

function diaDeHoje() {
  const mapa = { 1:"segunda", 2:"terca", 3:"quarta", 4:"quinta", 5:"sexta" };
  return mapa[new Date().getDay()] || "segunda";
}

async function chamarBackend(operation, payload = {}) {
  const response = await fetch(ENDPOINT_CARDAPIO, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operation, password: senhaEdicao, ...payload })
  });
  if (!response.ok) {
    const error = new Error(response.status === 401 || response.status === 403 ? "Senha incorreta." : "Não foi possível concluir a operação.");
    error.status = response.status;
    throw error;
  }
  return response.json();
}

/* ── Firebase: carregar / salvar ── */
async function carregarCardapio() {
  try {
    const snap = await getDoc(doc(db, "cardapio", "semana"));
    dados = snap.exists() ? snap.data() : {};
    carregado = true;
  } catch (e) {
    console.warn("Erro ao carregar:", e);
    dados = {};
  }
  renderizarDia(diaAtivo);
}

async function salvarCardapio() {
  if (!carregado) { toast("Recarregue o cardápio antes de salvar.", "error"); return; }
  // Coleta o HTML de cada campo editável
  document.querySelectorAll(".editor-cardapio").forEach(campo => {
    const { dia, tipo } = campo.dataset;
    if (!dados[dia]) dados[dia] = {};
    // Salva como texto puro (innerText preserva quebras de linha) — nunca innerHTML,
    // pra não gravar HTML/script arbitrário no Firestore (stored XSS).
    dados[dia][tipo] = campo.innerText.trim();
  });

  const btn = document.getElementById("btnSalvar");
  btn.textContent = "Salvando...";
  btn.disabled    = true;

  try {
    await chamarBackend("save-legacy-week", { menu: dados });
    sairEdicao();
    toast("Alterações salvas com sucesso.", "success");
  } catch (e) {
    toast(e.status === 401 || e.status === 403
      ? "Senha incorreta. Saia da edição e tente novamente."
      : "Não foi possível salvar. Seus dados foram mantidos; tente novamente.", "error");
  } finally {
    btn.textContent = "Salvar";
    btn.disabled    = false;
  }
}

/* ── Render ── */
function renderizarDia(diaKey) {
  const diaData = dados[diaKey] || {};

  document.getElementById("diaNome").textContent = DIAS_NOME[diaKey] || diaKey;

  const badge = document.getElementById("diaBadge");
  const ehHoje = diaKey === diaDeHoje();
  badge.textContent      = ehHoje ? "Hoje" : "";
  badge.style.display    = ehHoje ? "inline-block" : "none";

  const grid = document.getElementById("refeicoesGrid");
  grid.innerHTML = "";

  TIPOS.forEach(tipo => {
    const info    = LABELS[tipo];
    const conteudo = diaData[tipo] || "";

    const card = document.createElement("div");
    card.className = "refeicao-card";

    card.innerHTML = `
      <div class="refeicao-header">
        <span class="refeicao-dot ${info.dotClass}"></span>
        <span class="refeicao-tipo">${info.tipo}</span>
      </div>
      <div class="refeicao-itens">
        <div
          class="editor-cardapio${modoEdicao ? " editando" : ""}"
          data-dia="${diaKey}"
          data-tipo="${tipo}"
          ${modoEdicao ? 'contenteditable="true"' : ""}
        >${conteudo ? escapeHtml(conteudo).replace(/\n/g, "<br>") : (modoEdicao ? "" : '<span class="vazio">Não informado</span>')}</div>
      </div>`;

    grid.appendChild(card);
  });
}

/* ── Abas ── */
function ativarAba(diaKey) {
  if (modoEdicao) document.querySelectorAll('.editor-cardapio').forEach(c => { (dados[c.dataset.dia] ||= {})[c.dataset.tipo] = c.innerText.trim(); });
  diaAtivo = diaKey;
  document.querySelectorAll(".tab-btn").forEach(btn =>
    btn.classList.toggle("ativo", btn.dataset.dia === diaKey)
  );
  renderizarDia(diaKey);
}

document.querySelectorAll(".tab-btn").forEach(btn =>
  btn.addEventListener("click", () => ativarAba(btn.dataset.dia))
);

/* ── Edição ── */
function entrarEdicao() {
  modoEdicao = true;
  renderizarDia(diaAtivo);
  document.getElementById("btnSalvar").style.display = "inline-block";
  document.getElementById("btnEditar").textContent   = "Sair da edição";
}

function sairEdicao() {
  modoEdicao = false;
  renderizarDia(diaAtivo);
  document.getElementById("btnSalvar").style.display = "none";
  document.getElementById("btnEditar").textContent   = "Editar Cardápio";
}

/* ── Modal de senha ── */
function abrirModalSenha() {
  document.getElementById("inp-senha").value          = "";
  document.getElementById("erro-senha").textContent   = "";
  document.getElementById("modal-senha").classList.remove("hidden");
  setTimeout(() => document.getElementById("inp-senha").focus(), 80);
}
function fecharModalSenha() {
  document.getElementById("modal-senha").classList.add("hidden");
}

async function verificarSenha() {
  const val  = document.getElementById("inp-senha").value;
  const erro = document.getElementById("erro-senha");
  const btn = document.getElementById("btn-ok-senha");
  if (!val) { erro.textContent = "Digite a senha."; return; }
  erro.textContent = "";
  btn.textContent = "Verificando...";
  btn.disabled = true;

  try {
    senhaEdicao = val;
    await chamarBackend("verify");
    {
      document.getElementById("inp-senha").value = "";
      fecharModalSenha();
      entrarEdicao();
    }
  } catch (e) {
    senhaEdicao = "";
    erro.textContent = e.status === 401 || e.status === 403 ? "Senha incorreta." : "Não foi possível verificar a senha. Tente novamente.";
  } finally {
    btn.textContent = "Entrar";
    btn.disabled = false;
  }
}

/* ── Eventos ── */
document.getElementById("btnEditar").addEventListener("click", () => {
  if (modoEdicao) {
    senhaEdicao = "";
    sairEdicao();
    toast("Modo de edição encerrado.", "info");
  } else { abrirModalSenha(); }
});

document.getElementById("btnSalvar").addEventListener("click", salvarCardapio);

document.getElementById("btn-ok-senha").addEventListener("click", verificarSenha);
document.getElementById("inp-senha").addEventListener("keydown", e => {
  if (e.key === "Enter") verificarSenha();
});
document.getElementById("btn-cancelar-senha").addEventListener("click", fecharModalSenha);
document.getElementById("modal-senha").addEventListener("click", e => {
  if (e.target.id === "modal-senha") fecharModalSenha();
});

/* ── Toast ── */
function toast(msg, tipo = "info") {
  const el = document.createElement("div");
  el.className   = `toast toast-${tipo}`;
  el.textContent = msg;
  document.getElementById("toasts").appendChild(el);
  setTimeout(() => { el.classList.add("hide"); setTimeout(() => el.remove(), 350); }, 2800);
}

/* ── Init ── */
ativarAba(diaDeHoje());
carregarCardapio();
