// ============================================================
// CARDÁPIO — EREMPAF  |  Firebase Firestore
// ============================================================
import { initializeApp }   from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc }
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ── Firebase ── */
const app = initializeApp({
  apiKey:            "AIzaSyDgMBfsuR66vQiz5hG5F2OkhiTE_H1ZCTk",
  authDomain:        "portal-erempaf.firebaseapp.com",
  projectId:         "portal-erempaf",
  storageBucket:     "portal-erempaf.firebasestorage.app",
  messagingSenderId: "124907592592",
  appId:             "1:124907592592:web:a9de2e6959a768c7d4b115"
});
const db = getFirestore(app);

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
let diaAtivo   = diaDeHoje();
let dados      = {};          // { segunda: { cafe:"...", almoco:"...", lanche:"..." }, ... }

/* ── Helpers ── */
function diaDeHoje() {
  const mapa = { 1:"segunda", 2:"terca", 3:"quarta", 4:"quinta", 5:"sexta" };
  return mapa[new Date().getDay()] || "segunda";
}

/* ── Firebase: carregar / salvar ── */
async function carregarCardapio() {
  try {
    const snap = await getDoc(doc(db, "cardapio", "semana"));
    dados = snap.exists() ? snap.data() : {};
  } catch (e) {
    console.warn("Erro ao carregar:", e);
    dados = {};
  }
  renderizarDia(diaAtivo);
}

async function salvarCardapio() {
  // Coleta o HTML de cada campo editável
  document.querySelectorAll(".editor-cardapio").forEach(campo => {
    const { dia, tipo } = campo.dataset;
    if (!dados[dia]) dados[dia] = {};
    dados[dia][tipo] = campo.innerHTML.trim();
  });

  const btn = document.getElementById("btnSalvar");
  btn.textContent = "Salvando...";
  btn.disabled    = true;

  try {
    await setDoc(doc(db, "cardapio", "semana"), dados);
    sairEdicao();
    toast("✅ Cardápio salvo com sucesso!", "success");
  } catch (e) {
    toast("❌ Erro ao salvar. Tente novamente.", "error");
    console.error(e);
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
        >${conteudo || (modoEdicao ? "" : '<span class="vazio">Não informado</span>')}</div>
      </div>`;

    grid.appendChild(card);
  });
}

/* ── Abas ── */
function ativarAba(diaKey) {
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
  document.getElementById("btnEditar").textContent   = "Cancelar";
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
  const val  = document.getElementById("inp-senha").value.trim();
  const erro = document.getElementById("erro-senha");
  if (!val) { erro.textContent = "Digite a senha."; return; }
  erro.textContent = "";

  try {
    const snap = await getDoc(doc(db, "config", "cardapio"));
    if (!snap.exists()) {
      erro.textContent = "Configuração não encontrada no Firebase.";
      return;
    }
    if (val === snap.data().senha) {
      fecharModalSenha();
      entrarEdicao();
    } else {
      erro.textContent = "Senha incorreta. Tente novamente.";
      document.getElementById("inp-senha").value = "";
      document.getElementById("inp-senha").focus();
    }
  } catch {
    erro.textContent = "Erro ao verificar. Tente novamente.";
  }
}

/* ── Eventos ── */
document.getElementById("btnEditar").addEventListener("click", () => {
  if (modoEdicao) { sairEdicao(); } else { abrirModalSenha(); }
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
