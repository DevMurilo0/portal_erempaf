import { auth, emulators, requireEditor, observeSession } from '../shared/firebase.js';

/* ──────────────────────────────────────────────
   notificacoes.js
   - pede permissão do navegador;
   - obtém token FCM;
   - salva/remove a inscrição pelo backend com Firebase Admin;
   - mostra notificações também com a página em primeiro plano.
────────────────────────────────────────────── */

import { getApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getMessaging,
    getToken,
    onMessage
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";

const VAPID_KEY = "BEiUVJTzBgQOWKT0Oa9SCppUYu5AxGQq0ofDwVCgP2uPGunn3TQAGV5_z1txOGi-A_y80gZPC1vNaRt_5d2ux00";
const API_URL = "https://erempaf-backend.vercel.app/api";

let SALA_ID;
let LOCAL_KEY;
const DEVICE_ID_KEY = "erempaf_device_id";

let tokenAtual = null;
let registrationAtual = null;
let messagingAtual = null;
let listenerForegroundPronto = false;
let unsubscribeSession = null;

const BELL_ICON = '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>';

function definirConteudoBotao(btn, texto) {
    btn.innerHTML = `${BELL_ICON}<span>${texto}</span>`;
}

function obterDeviceId() {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
        id = crypto.randomUUID
            ? crypto.randomUUID()
            : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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

function mensagemErro(error) {
    const msg = String(error?.message || "");
    if (/permission-denied|Missing or insufficient permissions/i.test(msg)) {
        return "A inscrição de notificações não pôde ser atualizada. Entre novamente e tente mais uma vez.";
    }
    return msg || "Não foi possível atualizar as notificações.";
}

async function garantirCanalPush() {
    if (!("serviceWorker" in navigator) || !("Notification" in window)) {
        throw new Error("Este navegador não suporta notificações push.");
    }

    if (!registrationAtual) {
        registrationAtual = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
        await navigator.serviceWorker.ready;
    }

    if (!messagingAtual) {
        messagingAtual = getMessaging(getApp());
    }

    if (!listenerForegroundPronto) {
        listenerForegroundPronto = true;
        onMessage(messagingAtual, async (payload) => {
            const dados = payload?.data || {};
            if (Notification.permission !== "granted" || !registrationAtual) return;

            const titulo = dados.title || "EREMPAF";
            const opcoes = {
                body: dados.body || "",
                icon: dados.icon || "/logo.png",
                badge: "/logo.png",
                data: { url: dados.url || "/" }
            };

            try {
                await registrationAtual.showNotification(titulo, opcoes);
            } catch (error) {
                console.warn("Não foi possível exibir a notificação em primeiro plano.", error);
                toast(`${titulo}${opcoes.body ? " — " + opcoes.body : ""}`, "info");
            }
        });
    }

    return { registration: registrationAtual, messaging: messagingAtual };
}

async function obterToken() {
    const { registration, messaging } = await garantirCanalPush();

    tokenAtual = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration
    });

    if (!tokenAtual) {
        throw new Error("Não foi possível gerar o token de notificação.");
    }

    return tokenAtual;
}

async function atualizarInscricao(operation, token) {
    const user = auth.currentUser;
    if (!user) throw new Error("Faça login para gerenciar notificações.");

    const idToken = await user.getIdToken();
    const response = await fetch(`${API_URL}/notificacoes`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
            operation,
            turma: SALA_ID,
            deviceId: obterDeviceId(),
            token
        }),
        signal: AbortSignal.timeout(15000)
    });

    let data = {};
    try { data = await response.json(); } catch {}

    if (!response.ok) {
        const error = new Error(data.error || `Falha ao atualizar notificações (HTTP ${response.status}).`);
        error.status = response.status;
        throw error;
    }

    return data;
}

async function ativar(btn) {
    btn.disabled = true;
    definirConteudoBotao(btn, "Ativando...");

    try {
        if (emulators) throw new Error("Push real desativado nos emuladores.");
        if (!auth.currentUser) throw new Error("Faça login antes de ativar notificações.");
        if (!("Notification" in window)) throw new Error("Navegador sem suporte a push.");

        const permissao = await Notification.requestPermission();
        if (permissao !== "granted") {
            throw new Error("Permissão negada. Ative as notificações nas configurações do navegador.");
        }

        const token = await obterToken();
        await atualizarInscricao("subscribe", token);

        marcarLocal(true);
        toast("Notificações ativadas para esta turma.", "success");
    } catch (error) {
        marcarLocal(false);
        toast(mensagemErro(error), "error");
    }

    atualizarVisual(btn);
}

async function desativar(btn) {
    btn.disabled = true;
    definirConteudoBotao(btn, "Desativando...");

    try {
        if (!auth.currentUser) throw new Error("Faça login para gerenciar notificações.");
        const token = await obterToken();
        await atualizarInscricao("unsubscribe", token);

        marcarLocal(false);
        toast("Notificações desativadas para esta turma.", "info");
    } catch (error) {
        toast(mensagemErro(error), "error");
    }

    atualizarVisual(btn);
}

function atualizarVisual(btn) {
    btn.disabled = false;
    if (estaAtivoNesteAparelho()) {
        definirConteudoBotao(btn, "Ativadas");
        btn.classList.add("notif-ativo");
    } else {
        definirConteudoBotao(btn, "Notificações");
        btn.classList.remove("notif-ativo");
    }
}

async function sincronizarInscricaoExistente(btn) {
    if (!estaAtivoNesteAparelho()) return;
    if (!auth.currentUser) return;

    if (!("Notification" in window) || Notification.permission !== "granted") {
        marcarLocal(false);
        atualizarVisual(btn);
        return;
    }

    try {
        const token = await obterToken();
        await atualizarInscricao("subscribe", token);
        atualizarVisual(btn);
    } catch (error) {
        console.warn("Não foi possível sincronizar a inscrição de push.", error);
    }
}

export function initNotificacoes(turma) {
    SALA_ID = turma;
    LOCAL_KEY = `erempaf_notif_${turma}`;

    const acoes = document.querySelector(".topo-acoes");
    if (!acoes || document.getElementById("btn-notif")) return;

    const btn = document.createElement("button");
    btn.id = "btn-notif";
    btn.type = "button";
    atualizarVisual(btn);

    btn.addEventListener("click", () => {
        if (estaAtivoNesteAparelho()) desativar(btn);
        else ativar(btn);
    });

    acoes.prepend(btn);

    if (unsubscribeSession) unsubscribeSession();
    unsubscribeSession = observeSession(({ user }) => {
        if (user) void sincronizarInscricaoExistente(btn);
    });
}

/* ──────────────────────────────────────────────
   DISPARO DE NOTIFICAÇÃO IMEDIATA
   Chamado pelo calendario.js logo após salvar
   quando existem eventos novos/alterados.
────────────────────────────────────────────── */
window.notificarNovosEventos = async function (eventos) {
    if (emulators) return;

    const user = await requireEditor(SALA_ID);
    const response = await fetch(`${API_URL}/notificar-imediato`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${await user.getIdToken()}`
        },
        body: JSON.stringify({ turma: SALA_ID, eventos }),
        signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
        let data = {};
        try { data = await response.json(); } catch {}
        throw new Error(data.error || `Push respondeu HTTP ${response.status}`);
    }
};
