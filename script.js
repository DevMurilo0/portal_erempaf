// Turmas disponíveis por série
import { TURMAS } from './config/turmas.js';
const turmasPorSerie = TURMAS.reduce((map, t) => { (map[t.serie] ||= []).push(t); return map; }, {});

function atualizarTurmas() {
  const serie = document.getElementById("serie").value;
  const turmaSelect = document.getElementById("turma");
  
  // Limpa
  turmaSelect.innerHTML = '<option value="">Selecione a turma</option>';

  if (serie && turmasPorSerie[serie]) {
    turmasPorSerie[serie].forEach(t => {
      const opt = document.createElement("option");
      opt.value = t.turma;
      opt.textContent = `Turma ${t.turma.toUpperCase()}`;
      turmaSelect.appendChild(opt);
    });
  }
}

function acessar() {
  const serie = document.getElementById("serie").value;
  const turma = document.getElementById("turma").value;

  if (!serie || !turma) {
    mostrarErro("Selecione a série e a turma para continuar.");
    return;
  }

  const entry = TURMAS.find(t => t.serie === serie && t.turma === turma);
  if (entry) window.location.href = entry.path;
}

function mostrarErro(msg) {
  let aviso = document.getElementById("aviso-erro");
  if (!aviso) {
    aviso = document.createElement("p");
    aviso.id = "aviso-erro";
    aviso.style.cssText = `
      color: #f87171;
      font-size: 13px;
      text-align: center;
      margin-top: -6px;
      animation: fadeIn 0.3s ease;
    `;
    document.querySelector(".form-block").appendChild(aviso);
  }
  aviso.textContent = msg;
  setTimeout(() => aviso && (aviso.textContent = ""), 3000);
}

Object.assign(window, { atualizarTurmas, acessar });
