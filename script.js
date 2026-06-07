// Turmas disponíveis por série
const turmasPorSerie = {
  "1ano": ["a","b","c","d","e"],
  "2ano": ["a","b","c","d","e"],
  "3ano": ["a","b","c","d"]
};

function atualizarTurmas() {
  const serie = document.getElementById("serie").value;
  const turmaSelect = document.getElementById("turma");
  
  // Limpa
  turmaSelect.innerHTML = '<option value="">Selecione a turma</option>';

  if (serie && turmasPorSerie[serie]) {
    turmasPorSerie[serie].forEach(t => {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = `Turma ${t.toUpperCase()}`;
      turmaSelect.appendChild(opt);
    });
  }
}

function acessar() {
  const serie = document.getElementById("serie").value;
  const turma = document.getElementById("turma").value;

  if (!serie || !turma) {
    mostrarErro("⚠️ Selecione a série e a turma!");
    return;
  }

  window.location.href = `/series/${serie}/${turma}/index.html`;
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
