const HISTORY_PAGE_SIZE = 20;

function formatarHora(timestamp) {
  if (!Number.isFinite(timestamp)) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

function inicioDoDia(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function rotuloGrupo(timestamp) {
  if (!Number.isFinite(timestamp)) return "Alterações recentes";

  const data = inicioDoDia(new Date(timestamp));
  const hoje = inicioDoDia(new Date());
  const diferenca = Math.round((hoje - data) / 86400000);

  if (diferenca === 0) return "Hoje";
  if (diferenca === 1) return "Ontem";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: data.getFullYear() === hoje.getFullYear() ? undefined : "numeric"
  }).format(data).replace(".", "").toUpperCase();
}

function formatarDataReferencia(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long"
  }).format(date);
}

function iconeTipo(tipo) {
  return {
    aviso: "!",
    link: "↗",
    anotacao: "✎",
    materia: "•",
    foto: "▧"
  }[tipo] || "•";
}

function criarEstrutura() {
  const section = document.createElement("section");
  section.className = "historico";
  section.id = "historico-alteracoes";
  section.setAttribute("aria-labelledby", "historico-titulo");

  const header = document.createElement("div");
  header.className = "historico-header";

  const tituloWrap = document.createElement("div");
  tituloWrap.className = "historico-titulo-wrap";

  const kicker = document.createElement("span");
  kicker.className = "historico-kicker";
  kicker.textContent = "ATIVIDADE DA TURMA";

  const titulo = document.createElement("h2");
  titulo.id = "historico-titulo";
  titulo.textContent = "Histórico de alterações";

  const descricao = document.createElement("p");
  descricao.textContent = "Mudanças recentes feitas no calendário e nos conteúdos da turma.";

  tituloWrap.append(kicker, titulo, descricao);
  header.appendChild(tituloWrap);

  const lista = document.createElement("div");
  lista.className = "historico-lista";
  lista.setAttribute("aria-live", "polite");

  const rodape = document.createElement("div");
  rodape.className = "historico-rodape";

  const status = document.createElement("p");
  status.className = "historico-status";

  const btnMais = document.createElement("button");
  btnMais.type = "button";
  btnMais.className = "historico-ver-mais";
  btnMais.textContent = "Ver mais";
  btnMais.hidden = true;

  rodape.append(status, btnMais);
  section.append(header, lista, rodape);

  const calendario = document.querySelector(".calendario-wrap") || document.querySelector(".calendario");
  if (calendario) calendario.insertAdjacentElement("afterend", section);
  else document.querySelector("main")?.appendChild(section);

  return { section, lista, status, btnMais };
}

function criarItem(item) {
  const article = document.createElement("article");
  article.className = "historico-item";

  const time = document.createElement("time");
  time.className = "historico-hora";
  if (Number.isFinite(item.createdAt)) time.dateTime = new Date(item.createdAt).toISOString();
  time.textContent = formatarHora(item.createdAt) || "—";

  const marker = document.createElement("span");
  marker.className = `historico-marker historico-marker--${item.tipo || "geral"}`;
  marker.setAttribute("aria-hidden", "true");
  marker.textContent = iconeTipo(item.tipo);

  const content = document.createElement("div");
  content.className = "historico-item-conteudo";

  const title = document.createElement("strong");
  title.textContent = item.titulo || "Alteração registrada";

  const details = [];
  if (item.detalhe) details.push(item.detalhe);
  const dataReferencia = formatarDataReferencia(item.dataReferencia);
  if (dataReferencia) details.push(dataReferencia);

  content.appendChild(title);

  if (details.length) {
    const detail = document.createElement("p");
    detail.textContent = details.join(" · ");
    content.appendChild(detail);
  }

  article.append(time, marker, content);
  return article;
}

function renderizar(lista, items, append = false) {
  if (!append) lista.replaceChildren();

  let grupoAtual = lista.lastElementChild?.dataset?.grupo || "";

  for (const item of items) {
    const grupo = rotuloGrupo(item.createdAt);

    if (grupo !== grupoAtual) {
      const heading = document.createElement("div");
      heading.className = "historico-grupo";
      heading.dataset.grupo = grupo;
      heading.textContent = grupo;
      lista.appendChild(heading);
      grupoAtual = grupo;
    }

    lista.appendChild(criarItem(item));
  }
}

export function criarHistoricoAlteracoes({ carregarPagina }) {
  if (typeof carregarPagina !== "function") throw new Error("carregarPagina é obrigatório.");

  const ui = criarEstrutura();
  let cursor = null;
  let carregando = false;
  let temMais = false;

  function mostrarVazio() {
    ui.lista.replaceChildren();
    const vazio = document.createElement("p");
    vazio.className = "historico-vazio";
    vazio.textContent = "Nenhuma alteração registrada até o momento.";
    ui.lista.appendChild(vazio);
  }

  async function carregar(reset = false) {
    if (carregando) return;

    if (reset) {
      cursor = null;
      temMais = false;
      ui.lista.replaceChildren();
    }

    carregando = true;
    ui.section.hidden = false;
    ui.btnMais.disabled = true;
    ui.status.textContent = reset ? "Carregando histórico…" : "Carregando mais alterações…";

    try {
      const data = await carregarPagina({
        cursorId: reset ? null : cursor,
        limit: HISTORY_PAGE_SIZE
      });

      const items = Array.isArray(data?.items) ? data.items : [];

      if (reset && items.length === 0) mostrarVazio();
      else if (items.length) renderizar(ui.lista, items, !reset);

      cursor = data?.nextCursor || null;
      temMais = Boolean(data?.hasMore && cursor);
      ui.btnMais.hidden = !temMais;
      ui.status.textContent = "";
    } catch (error) {
      // Enquanto o backend antigo ainda estiver publicado, não deixa um painel quebrado
      // aparecer na página. Assim que a função nova entrar no ar, o próximo reload exibe.
      if (error?.status === 400) {
        ui.section.hidden = true;
        return;
      }

      if (reset && !ui.lista.children.length) {
        const erro = document.createElement("p");
        erro.className = "historico-vazio";
        erro.textContent = "Não foi possível carregar o histórico agora.";
        ui.lista.appendChild(erro);
      }
      ui.status.textContent = "";
    } finally {
      carregando = false;
      ui.btnMais.disabled = false;
    }
  }

  function limpar() {
    cursor = null;
    temMais = false;
    ui.lista.replaceChildren();
    ui.status.textContent = "";
    ui.btnMais.hidden = true;
    ui.section.hidden = true;
  }

  ui.btnMais.addEventListener("click", () => {
    if (temMais) void carregar(false);
  });

  ui.section.hidden = true;

  return {
    carregar,
    limpar
  };
}
