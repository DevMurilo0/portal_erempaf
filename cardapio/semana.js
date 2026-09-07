
import { db } from '../shared/firebase.js';
import { doc, getDocFromServer as getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { escapeHtml } from '../shared/content.js';
import '../shared/accessibility.js';

    /* ── Constantes ── */
    const NOMES  = ["Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira"];

    /* ── Estado ── */
    let dados     = {};  // { "YYYY-MM-DD": { lancheManha, almoco, lanche, status } }
    let editando  = false;
    let diaISO    = null;
    let senhaEdicao = '';
    const ENDPOINT_CARDAPIO = 'https://erempafbackend.netlify.app/.netlify/functions/cardapio';

    /* ── Helpers de data ── */
    function isoStr(d) {
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    }
    function segundaDaSemana() {
      const h = new Date(); h.setHours(0,0,0,0);
      const dow = h.getDay();
      const diff = dow === 0 ? -6 : 1 - dow;
      h.setDate(h.getDate() + diff);
      return h;
    }
    function diasDaSemana() {
      const seg = segundaDaSemana();
      return Array.from({length:5}, (_,i) => {
        const d = new Date(seg); d.setDate(seg.getDate() + i); return d;
      });
    }
    function chaveFirestore() {
      return isoStr(segundaDaSemana());
    }

    async function chamarBackend(operation, payload = {}) {
      const response = await fetch(ENDPOINT_CARDAPIO, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation, password: senhaEdicao, ...payload })
      });
      if (!response.ok) {
        const error = new Error(response.status === 401 || response.status === 403 ? 'Senha incorreta.' : 'Não foi possível concluir a operação.');
        error.status = response.status;
        throw error;
      }
      return response.json();
    }

    /* ── Firebase ── */
    async function carregar() {
      document.getElementById("dias-grid").innerHTML = `<div class="loading">Carregando cardápio...</div>`;
      try {
        const snap = await getDoc(doc(db, "cardapio", chaveFirestore()));
        dados = snap.exists() ? snap.data() : {};
      } catch { document.getElementById('dias-grid').textContent = 'Erro ao carregar o cardápio. Recarregue para tentar novamente.'; return; }
      renderizar();
    }

    async function salvarDia(iso, payload) {
      const chave = chaveFirestore();
      await chamarBackend('save-day', { week: chave, day: iso, menu: payload });
      dados[iso]  = payload;
    }

    /* ── Render ── */
    function renderizar() {
      const dias  = diasDaSemana();
      const seg   = dias[0], sex = dias[4];
      const hoje  = new Date(); hoje.setHours(0,0,0,0);

      const fmtCurto = { day: "numeric", month: "short" };
      const fmtLongo = { day: "numeric", month: "long", year: "numeric" };
      document.getElementById("semana-label").textContent =
        `${seg.toLocaleDateString("pt-BR", fmtCurto)} – ${sex.toLocaleDateString("pt-BR", fmtLongo)}`;

      const grid = document.getElementById("dias-grid");
      grid.innerHTML = "";

      dias.forEach((data, i) => {
        const iso    = isoStr(data);
        const d      = dados[iso] || {};
        const status = d.status || "normal";
        const isHoje = data.getTime() === hoje.getTime();
        const passado = data < hoje;

        const statusClass = { normal: "", alterado: "card-alterado" }[status] || "";
        const badge = {
          normal:   "",
          alterado: `<span class="badge badge-amarelo">Sujeito a alteração</span>`
        }[status] || "";

        const vazio = !d.lancheManha && !d.almoco && !d.lanche;

        grid.innerHTML += `
          <div class="dia-card ${statusClass}${isHoje ? " card-hoje" : ""}${passado && !isHoje ? " card-passado" : ""}">
            <div class="dia-card-top">
              <div>
                <div class="dia-nome">${NOMES[i]}</div>
                <div class="dia-data">${data.toLocaleDateString("pt-BR", { day:"numeric", month:"long" })}</div>
              </div>
              <div class="dia-top-right">
                ${isHoje ? `<span class="hoje-tag">Hoje</span>` : ""}
                ${editando ? `<button class="btn-editar-dia" data-iso="${iso}" aria-label="Editar cardápio deste dia"><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg></button>` : ""}
              </div>
            </div>

            ${badge}

            <div class="dia-corpo">
              ${d.lancheManha ? `<div class="refeicao"><span class="ref-icon"><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3v18M4 3v6a3 3 0 0 0 6 0V3M17 3c-2 0-3 2.5-3 6s1 5 3 5v7"/></svg></span><div><span class="ref-label">Lanche da manhã</span><p class="ref-texto">${escapeHtml(d.lancheManha)}</p></div></div>` : ""}
              ${d.almoco ? `<div class="refeicao"><span class="ref-icon"><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3v18M4 3v6a3 3 0 0 0 6 0V3M17 3c-2 0-3 2.5-3 6s1 5 3 5v7"/></svg></span><div><span class="ref-label">Almoço</span><p class="ref-texto">${escapeHtml(d.almoco)}</p></div></div>` : ""}
              ${d.lanche ? `<div class="refeicao"><span class="ref-icon"><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3v18M4 3v6a3 3 0 0 0 6 0V3M17 3c-2 0-3 2.5-3 6s1 5 3 5v7"/></svg></span><div><span class="ref-label">Lanche da tarde</span><p class="ref-texto">${escapeHtml(d.lanche)}</p></div></div>` : ""}
              ${vazio    ? `<p class="dia-vazio">${editando ? 'Use o botão de editar para preencher' : 'Cardápio não divulgado ainda.'}</p>` : ""}
            </div>
          </div>`;
      });

      document.querySelectorAll(".btn-editar-dia").forEach(btn =>
        btn.addEventListener("click", () => abrirEdicao(btn.dataset.iso))
      );
    }

    /* ── Modal Senha ── */
    function abrirSenha() {
      document.getElementById("inp-senha").value = "";
      document.getElementById("erro-senha").textContent = "";
      document.getElementById("modal-senha").classList.remove("hidden");
      setTimeout(() => document.getElementById("inp-senha").focus(), 80);
    }
    function fecharSenha() { document.getElementById("modal-senha").classList.add("hidden"); }

    document.getElementById("btn-editar").addEventListener("click", () => {
      if (editando) {
        senhaEdicao = '';
        editando = false;
        document.getElementById("btn-editar").innerHTML = `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>Editar cardápio`;
        document.getElementById("btn-editar").classList.remove("ativo");
        renderizar();
        toast("Modo de edição encerrado.", "info");
      } else {
        abrirSenha();
      }
    });
    document.getElementById("btn-cancelar-senha").addEventListener("click", fecharSenha);
    document.getElementById("modal-senha").addEventListener("click", e => { if(e.target.id==="modal-senha") fecharSenha(); });

    async function verificarSenha() {
      const val  = document.getElementById("inp-senha").value;
      const erro = document.getElementById("erro-senha");
      const btn = document.getElementById("btn-ok-senha");
      if (!val) { erro.textContent = "Digite a senha."; return; }
      erro.textContent = "";
      btn.textContent = 'Verificando...';
      btn.disabled = true;
      try {
        senhaEdicao = val;
        await chamarBackend('verify');
        {
          document.getElementById("inp-senha").value = '';
          fecharSenha();
          editando = true;
          document.getElementById("btn-editar").innerHTML = `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>Sair da edição`;
          document.getElementById("btn-editar").classList.add("ativo");
          renderizar();
          toast("Modo de edição ativado.", "success");
        }
      } catch (e) {
        senhaEdicao = '';
        erro.textContent = e.status === 401 || e.status === 403 ? 'Senha incorreta.' : 'Não foi possível verificar a senha. Tente novamente.';
      } finally {
        btn.textContent = 'Entrar';
        btn.disabled = false;
      }
    }
    document.getElementById("btn-ok-senha").addEventListener("click", verificarSenha);
    document.getElementById("inp-senha").addEventListener("keydown", e => { if(e.key==="Enter") verificarSenha(); });

    /* ── Modal Edição ── */
    function abrirEdicao(iso) {
      diaISO = iso;
      const d    = dados[iso] || {};
      const data = new Date(iso + "T12:00:00");
      const idx  = data.getDay() - 1;

      document.getElementById("modal-edicao-titulo").textContent = NOMES[idx];
      document.getElementById("modal-edicao-data").textContent   =
        data.toLocaleDateString("pt-BR", { weekday:"long", day:"numeric", month:"long", year:"numeric" });

      document.getElementById("inp-lanche-manha").value = d.lancheManha || "";
      document.getElementById("inp-almoco").value       = d.almoco || "";
      document.getElementById("inp-lanche").value       = d.lanche || "";
      document.getElementById("erro-edicao").textContent = "";

      const status = d.status || "normal";
      document.querySelectorAll(".status-btn").forEach(b =>
        b.classList.toggle("ativo", b.dataset.s === status)
      );
      document.getElementById("modal-edicao").classList.remove("hidden");
      setTimeout(() => document.getElementById("inp-lanche-manha").focus(), 80);
    }
    function fecharEdicao() {
      document.getElementById("modal-edicao").classList.add("hidden");
      diaISO = null;
    }
    document.getElementById("btn-cancelar-edicao").addEventListener("click", fecharEdicao);
    document.getElementById("modal-edicao").addEventListener("click", e => { if(e.target.id==="modal-edicao") fecharEdicao(); });

    document.querySelectorAll(".status-btn").forEach(btn =>
      btn.addEventListener("click", () => {
        document.querySelectorAll(".status-btn").forEach(b => b.classList.remove("ativo"));
        btn.classList.add("ativo");
      })
    );

    document.getElementById("btn-salvar-edicao").addEventListener("click", async () => {
      if (!diaISO) return;
      const btn = document.getElementById("btn-salvar-edicao");
      btn.textContent = "Salvando..."; btn.disabled = true;
      try {
        await salvarDia(diaISO, {
          lancheManha: document.getElementById("inp-lanche-manha").value.trim(),
          almoco:      document.getElementById("inp-almoco").value.trim(),
          lanche:      document.getElementById("inp-lanche").value.trim(),
          status:      document.querySelector(".status-btn.ativo")?.dataset.s || "normal"
        });
        fecharEdicao(); renderizar();
        toast("Alterações salvas com sucesso.", "success");
      } catch (e) {
        document.getElementById("erro-edicao").textContent = e.status === 401 || e.status === 403
          ? "Senha incorreta. Saia da edição e tente novamente."
          : "Erro ao salvar. Seus dados foram mantidos; tente novamente.";
      } finally { btn.innerHTML = `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>Salvar`; btn.disabled = false; }
    });

    /* ── Toast ── */
    function toast(msg, tipo="info") {
      const el = document.createElement("div");
      el.className = `toast toast-${tipo}`;
      el.textContent = msg;
      document.getElementById("toasts").appendChild(el);
      setTimeout(() => { el.classList.add("hide"); setTimeout(() => el.remove(), 350); }, 2800);
    }

    /* ── Init ── */
    carregar();
