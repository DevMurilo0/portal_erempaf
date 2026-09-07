import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onIdTokenChanged, signInWithEmailAndPassword, setPersistence, browserLocalPersistence, connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, connectFirestoreEmulator } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
const local = ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('emulators');
export const app = getApps().length ? getApp() : initializeApp({
  apiKey: local ? 'demo-key' : 'AIzaSyDgMBfsuR66vQiz5hG5F2OkhiTE_H1ZCTk',
  authDomain: 'portal-erempaf.firebaseapp.com',
  projectId: local ? 'demo-erempaf' : 'portal-erempaf',
  messagingSenderId: '124907592592', appId: '1:124907592592:web:a9de2e6959a768c7d4b115'
});
export const auth = getAuth(app);
// Mantém o login entre páginas e novas visitas no mesmo navegador.
const persistenceReady = setPersistence(auth, browserLocalPersistence).catch(error => {
  console.error('Não foi possível manter a sessão local', error);
});
export const db = getFirestore(app);
export const emulators = local;
if (local) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
const subscribers = new Set();
let session = { user: null, claims: {}, ready: false };
let version = 0;
onIdTokenChanged(auth, async user => {
  const current = ++version;
  let claims = {};
  try { claims = user ? (await user.getIdTokenResult()).claims : {}; } catch (e) { console.error('Permissões indisponíveis', e); }
  if (current !== version) return;
  session = { user, claims, ready: true };
  subscribers.forEach(fn => fn(session));
});
export function observeSession(fn) {
  subscribers.add(fn);
  if (session.ready) queueMicrotask(() => subscribers.has(fn) && fn(session));
  return () => subscribers.delete(fn);
}
function emailDaTurma(turma) {
  // Atualmente só A–E possuem contas reais. 1º F e 3º F ficam sem editor até existirem novamente.
  return /^[123]ano-[a-e]$/.test(turma) ? turma.replace('-', '') + '@erempaf.com' : null;
}
export function canEdit(turma, claims = session.claims, user = session.user) {
  const porClaim = Array.isArray(claims.editorTurmas) && claims.editorTurmas.includes(turma);
  const emailEsperado = emailDaTurma(turma);
  const porContaDaTurma = !!emailEsperado && user?.email?.toLowerCase() === emailEsperado;
  return porClaim || porContaDaTurma;
}
export async function requireEditor(turma) {
  const user = auth.currentUser;
  if (!user) throw new Error('Faça login para editar esta turma.');
  const claims = (await user.getIdTokenResult()).claims;
  if (!canEdit(turma, claims, user)) throw new Error('Esta conta não tem permissão para editar esta turma.');
  return user;
}
export const login = async (email, password) => {
  await persistenceReady;
  return signInWithEmailAndPassword(auth, email, password);
};
