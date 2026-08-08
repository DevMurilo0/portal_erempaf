/* ──────────────────────────────────────────────
   notificacoes.js
   Botão "Ativar notificações" por turma — EREMPAF

   Salva em /series/notificacoes.js
   (mesma pasta do calendario.js)

   Como funciona:
   - Ao clicar, pede permissão de notificação no navegador
   - Gera um token FCM único pra esse aparelho
   - Salva esse token no Firestore junto com a lista de
     turmas que a pessoa escolheu acompanhar
   - O estado do botão (ativado/desativado) fica salvo
     no localStorage do próprio aparelho
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

// SALA_ID já existe globalmente (definido no <script> de cada index.html de turma)
const LOCAL_KEY = `erempaf_notif_${SALA_ID}`;

let tokenAtual = null;

function estaAtivoNesteAparelho() {
    return localStorage.getItem(LOCAL_KEY) === "1";
}

function marcarLocal(ativo) {
    if (ativo) localStorage.setItem(LOCAL_KEY, "1");
    else localStorage.removeItem(LOCAL_KEY);
}

function toast(msg, tipo) {
    // Reaproveita o mesmo sistema de toast do calendario.js
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

        await setDoc(
            doc(window.db, "inscricoes", token),
            { turmas: arrayUnion(SALA_ID), atualizadoEm: serverTimestamp() },
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
        const token = await obterToken();

        await setDoc(
            doc(window.db, "inscricoes", token),
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