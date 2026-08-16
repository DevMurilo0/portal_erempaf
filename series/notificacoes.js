/* ──────────────────────────────────────────────
   notificacoes.js
   Botão "Ativar notificações" + disparo de eventos
   novos — EREMPAF

   Salva em /series/notificacoes.js
   (mesma pasta do calendario.js, no repositório
   do SITE — não é o mesmo repositório do backend)
────────────────────────────────────────────── */

import { getApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getMessaging, getToken } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";
import {
    doc,
    setDoc,
    arrayUnion,
    arrayRemove,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const VAPID_KEY = "BEiUVJTzBgQOWKT0Oa9SCppUYu5AxGQq0ofDwVCgP2uPGunn3TQAGV5_z1txOGi-A_y80gZPC1vNaRt_5d2ux00";

/* ──────────────────────────────────────────────
   ÚNICO PONTO A MUDAR SE TROCAR DE HOSPEDAGEM
   Esse endereço é do site "backend" separado
   (só as funções), que continua na Netlify mesmo
   que o site principal mude pra Hostinger ou
   qualquer outro lugar. Troque aqui pela URL real
   que aparecer depois do deploy do backend.
────────────────────────────────────────────── */
const API_URL = "https://erempafbackend.netlify.app/.netlify/functions";

const LOCAL_KEY = `erempaf_notif_${SALA_ID}`;
const DEVICE_ID_KEY = "erempaf_device_id";

let tokenAtual = null;

/* ──────────────────────────────────────────────
   ID FIXO DO APARELHO
   Ao contrário do token do FCM (que pode mudar
   de vez em quando), esse ID nunca muda depois de
   gerado — é ele que identifica o documento no
   Firestore, evitando cadastros duplicados quando
   o token do FCM rotaciona.
────────────────────────────────────────────── */
function obterDeviceId() {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
        id = (crypto.randomUUID ? crypto.randomUUID() : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
}

function estaAtivoNesteAparelho() {
    return localStorage.getItem(LOCAL_KEY) === "1";
}

function marcarLocal(ativo) {
    if (ativo) localStorage.setItem(LOCAL_KEY, "1");
    else localStorage.removeItem(LOCAL_KEY);
}

function toast(msg, tipo) {
    if (window.mostrarToast) window.mostrarToast(msg, tipo);
}

async function obterToken() {
    if (tokenAtual) return tokenAtual;

    if (!("serviceWorker" in navigator) || !("Notification" in window)) {
        throw new Error("Este navegador não suporta notificações push.");
    }

    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const messaging = getMessaging(getApp());

    tokenAtual = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration
    });

    if (!tokenAtual) {
        throw new Error("Não foi possível gerar o token de notificação.");
    }

    return tokenAtual;
}

async function ativar(btn) {
    btn.disabled = true;
    btn.textContent = "⏳ Ativando...";

    try {
        const permissao = await Notification.requestPermission();
        if (permissao !== "granted") {
            throw new Error("Permissão negada. Ative nas configurações do navegador.");
        }

        const token = await obterToken();
        const deviceId = obterDeviceId();

        await setDoc(
            doc(window.db, "inscricoes", deviceId),
            { token, turmas: arrayUnion(SALA_ID), atualizadoEm: serverTimestamp() },
            { merge: true }
        );

        marcarLocal(true);
        toast("🔔 Notificações ativadas para esta turma!", "success");
    } catch (e) {
        toast("❌ " + e.message, "error");
    }

    atualizarVisual(btn);
}

async function desativar(btn) {
    btn.disabled = true;
    btn.textContent = "⏳...";

    try {
        const deviceId = obterDeviceId();

        await setDoc(
            doc(window.db, "inscricoes", deviceId),
            { turmas: arrayRemove(SALA_ID), atualizadoEm: serverTimestamp() },
            { merge: true }
        );

        marcarLocal(false);
        toast("🔕 Notificações desativadas para esta turma.", "info");
    } catch (e) {
        toast("❌ " + e.message, "error");
    }

    atualizarVisual(btn);
}

function atualizarVisual(btn) {
    btn.disabled = false;
    if (estaAtivoNesteAparelho()) {
        btn.textContent = "🔔 Ativado";
        btn.classList.add("notif-ativo");
    } else {
        btn.textContent = "🔕 Notificações";
        btn.classList.remove("notif-ativo");
    }
}

export function initNotificacoes() {
    const acoes = document.querySelector(".topo-acoes");
    if (!acoes) return;

    const btn = document.createElement("button");
    btn.id = "btn-notif";
    btn.type = "button";
    atualizarVisual(btn);

    btn.addEventListener("click", () => {
        if (estaAtivoNesteAparelho()) desativar(btn);
        else ativar(btn);
    });

    acoes.prepend(btn);
}

/* ──────────────────────────────────────────────
   DISPARO DE NOTIFICAÇÃO IMEDIATA
   Chamado pelo calendario.js logo após salvar,
   quando existem eventos novos/alterados.
────────────────────────────────────────────── */
window.notificarNovosEventos = async function (eventos) {
    try {
        await fetch(`${API_URL}/notificar-imediato`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ turma: SALA_ID, eventos })
        });
    } catch (e) {
        console.warn("Não foi possível notificar:", e);
    }
};