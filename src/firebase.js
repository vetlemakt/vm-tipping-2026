import { initializeApp } from 'firebase/app';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc,
  collection, getDocs, onSnapshot, addDoc,
  serverTimestamp, query, orderBy
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAELQvSWSmBt9RcL-d1eUlT2oogIbiQVkY",
  authDomain: "vm-tipping-2026.firebaseapp.com",
  projectId: "vm-tipping-2026",
  storageBucket: "vm-tipping-2026.firebasestorage.app",
  messagingSenderId: "1060307731188",
  appId: "1:1060307731188:web:df1771b481b630bd6cd4a1",
  measurementId: "G-5WE2HWBY2Q"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// ── Users ────────────────────────────────────────────────────────────
export async function getUser(username) {
  const snap = await getDoc(doc(db, 'users', username));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getAllUsers() {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createUser(username, data) {
  await setDoc(doc(db, 'users', username), data);
}

export async function updateUser(username, data) {
  await updateDoc(doc(db, 'users', username), data);
}

// ── Results (admin sets these) ───────────────────────────────────────
export async function getResults() {
  const snap = await getDoc(doc(db, 'config', 'results'));
  return snap.exists() ? snap.data() : {};
}

export async function setResults(data) {
  await setDoc(doc(db, 'config', 'results'), data, { merge: true });
}

// ── Phase ────────────────────────────────────────────────────────────
export async function getPhase() {
  const snap = await getDoc(doc(db, 'config', 'phase'));
  return snap.exists() ? snap.data().value : 'pre';
}

export async function setPhase(value) {
  await setDoc(doc(db, 'config', 'phase'), { value });
}

// ── Card stats ───────────────────────────────────────────────────────
export async function getCardStats() {
  const snap = await getDoc(doc(db, 'config', 'cards'));
  return snap.exists() ? snap.data() : {};
}

export async function setCardStats(data) {
  await setDoc(doc(db, 'config', 'cards'), data, { merge: true });
}

// ── Chat (realtime listener) ─────────────────────────────────────────
export function subscribeChatMessages(callback) {
  const q = query(collection(db, 'chat'), orderBy('ts', 'asc'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function sendChatMessage(user, text, image='') {
  await addDoc(collection(db, 'chat'), {
    user, text, image: image||'', ts: serverTimestamp()
  });
}

// ── Phase realtime listener ──────────────────────────────────────────
export function subscribePhase(callback) {
  return onSnapshot(doc(db, 'config', 'phase'), snap => {
    callback(snap.exists() ? snap.data().value : 'pre');
  });
}

// ── Results realtime listener ────────────────────────────────────────
export function subscribeResults(callback) {
  return onSnapshot(doc(db, 'config', 'results'), snap => {
    callback(snap.exists() ? snap.data() : {});
  });
}

export async function updatePresence(username) {
  await setDoc(doc(db, 'presence', username), { ts: Date.now() });
}

export function subscribeOnlineCount(callback) {
  return onSnapshot(collection(db, 'presence'), snap => {
    const now = Date.now();
    const active = snap.docs.filter(d => now - (d.data().ts || 0) < 60000);
    callback(active.length);
  });
}
