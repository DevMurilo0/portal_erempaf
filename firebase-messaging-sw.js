/* ──────────────────────────────────────────────
   firebase-messaging-sw.js
   Service Worker de notificações push — EREMPAF

   Esse arquivo PRECISA ficar na raiz do site
   (mesmo nível do index.html principal), senão o
   navegador não consegue registrar o escopo certo
   e o push não chega com o site fechado.

   FIX: agora lê tudo de payload.data (não mais de
   payload.notification). Isso combina com o backend
   que manda só "data" no envio — assim o SDK do FCM
   não exibe a notificação sozinho, e ela só aparece
   uma vez, aqui, com o ícone certo.
────────────────────────────────────────────── */

importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

// Mesma config que já existe em cada página de turma
firebase.initializeApp({
    apiKey: "AIzaSyDgMBfsuR66vQiz5hG5F2OkhiTE_H1ZCTk",
    authDomain: "portal-erempaf.firebaseapp.com",
    projectId: "portal-erempaf",
    storageBucket: "portal-erempaf.firebasestorage.app",
    messagingSenderId: "124907592592",
    appId: "1:124907592592:web:a9de2e6959a768c7d4b115"
});

const messaging = firebase.messaging();

// Dispara quando a notificação chega com o site FECHADO ou em segundo plano
messaging.onBackgroundMessage((payload) => {
    const dados = payload.data || {};
    const titulo = dados.title || "EREMPAF";
    const opcoes = {
        body: dados.body || "",
        icon: dados.icon || "/logo.png",
        badge: "/logo.png",
        data: { url: dados.url || "/" }
    };
    self.registration.showNotification(titulo, opcoes);
});

// Clique na notificação leva direto pra turma certa
self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = event.notification.data?.url || "/";
    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
            for (const janela of janelas) {
                if (janela.url.includes(url) && "focus" in janela) return janela.focus();
            }
            if (clients.openWindow) return clients.openWindow(url);
        })
    );
});