import { auth, emulators, requireEditor } from '../shared/firebase.js';
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

let SALA_ID;
let LOCAL_KEY;
const DEVICE_ID_KEY = "erempaf_device_id";

let tokenAtual = null;
const BELL_ICON = '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>';

function definirConteudoBotao(btn, texto) {
    btn.innerHTML = `${BELL_ICON}<span>${texto}</span>`;
}

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
    definirConteudoBotao(btn, "Ativando...");

    try {
        if (emulators) throw new Error('Push real desativado nos emuladores.');
        if (!auth.currentUser) throw new Error('Faça login antes de ativar notificações.');
        if (!('Notification' in window)) throw new Error('Navegador sem suporte a push.');
        const permissao = await Notification.requestPermission();
        if (permissao !== "granted") {
            throw new Error("Permissão negada. Ative nas configurações do navegador.");
        }

        const token = await obterToken();
        const deviceId = obterDeviceId();
        if (!auth.currentUser) throw new Error('Faça login para gerenciar notificações.');

        await setDoc(
            doc(window.db, "inscricoes", deviceId),
            { token, ownerUid: auth.currentUser.uid, turmas: arrayUnion(SALA_ID), atualizadoEm: serverTimestamp() },
            { merge: true }
        );

        marcarLocal(true);
        toast("Notificações ativadas para esta turma.", "success");
    } catch (e) {
        toast(e.message, "error");
    }

    atualizarVisual(btn);
}

async function desativar(btn) {
    btn.disabled = true;
    definirConteudoBotao(btn, "Desativando...");

    try {
        const deviceId = obterDeviceId();
        if (!auth.currentUser) throw new Error('Faça login para gerenciar notificações.');

        await setDoc(
            doc(window.db, "inscricoes", deviceId),
            { token: await obterToken(), ownerUid: auth.currentUser.uid, turmas: arrayRemove(SALA_ID), atualizadoEm: serverTimestamp() },
            { merge: true }
        );

        marcarLocal(false);
        toast("Notificações desativadas para esta turma.", "info");
    } catch (e) {
        toast(e.message, "error");
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

export function initNotificacoes(turma) {
    SALA_ID = turma; LOCAL_KEY = `erempaf_notif_${turma}`;
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
}

/* ──────────────────────────────────────────────
   DISPARO DE NOTIFICAÇÃO IMEDIATA
   Chamado pelo calendario.js logo após salvar,
   quando existem eventos novos/alterados.
────────────────────────────────────────────── */
window.notificarNovosEventos = async function (eventos) {
    if (emulators) return;
    const user = await requireEditor(SALA_ID);
    const response = await fetch(`${API_URL}/notificar-imediato`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ turma: SALA_ID, eventos }),
        signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`Push respondeu HTTP ${response.status}`);
};
