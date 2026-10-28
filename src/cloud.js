// Local storage + automatic household cloud sync.
//
// The app (MakanLedger.jsx) only ever talks to window.storage. This file
// provides that, always saving on the device first, and — when someone is
// signed in with Google — mirroring it to their household in Firestore
// (households/{code}/…). Everyone in a household sees the same data, and
// changes made by one person show up for the others within a second or two.
// Households are private to their members; see firestore.rules.
//
// Conflict rule, deliberately simple: each saved item ("pantry-items",
// "plan-state", …) is stamped with the time it last changed. The most recent
// copy wins, item by item.

import { initializeApp } from "firebase/app";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  onAuthStateChanged, signOut as fbSignOut,
} from "firebase/auth";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc, writeBatch, updateDoc, onSnapshot, arrayUnion, arrayRemove,
} from "firebase/firestore";
import { firebaseConfig, isFirebaseConfigured, ADMIN_EMAIL } from "./firebaseConfig.js";

const P = "pmm:";
const META_KEY = "pmm-meta";
// Only these travel to the cloud. Drafts and legacy sync settings stay local.
export const SYNC_KEYS = [
  "pantry-items", "my-recipes", "household-profile", "plan-state", "slot-pax", "onboarding-seen",
];
const CHUNK = 200000; // characters per Firestore doc; keeps well under the 1 MB doc limit
const PUSH_DEBOUNCE_MS = 1200;
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

/* ---------- device-local storage (falls back to memory if blocked) ---------- */
const mem = new Map();
function lsGet(k) {
  try { return localStorage.getItem(k); } catch (e) { return mem.has(k) ? mem.get(k) : null; }
}
function lsSet(k, v) {
  try { localStorage.setItem(k, v); } catch (e) { mem.set(k, v); }
}
function lsRemove(k) {
  try { localStorage.removeItem(k); } catch (e) { /* ignore */ }
  mem.delete(k);
}
function lsKeys() {
  const out = [];
  try { for (let i = 0; i < localStorage.length; i++) out.push(localStorage.key(i)); } catch (e) { /* ignore */ }
  mem.forEach((_, k) => { if (!out.includes(k)) out.push(k); });
  return out;
}

function readMeta() {
  try {
    const m = JSON.parse(lsGet(META_KEY) || "{}");
    return { mod: m.mod || {}, linkedHid: m.linkedHid || null };
  } catch (e) { return { mod: {}, linkedHid: null }; }
}
let meta = readMeta();
function saveMeta() { lsSet(META_KEY, JSON.stringify(meta)); }

const DEVICE = (() => {
  let d = lsGet("pmm-device");
  if (!d) { d = Math.random().toString(36).slice(2, 10); lsSet("pmm-device", d); }
  return d;
})();

/* ---------- observable status for the UI ---------- */
let snapshot = {
  configured: isFirebaseConfigured,
  ready: !isFirebaseConfigured, // with no Firebase, there is nothing to wait for
  user: null,                   // { uid, email, name, photo }
  household: null,              // { id, members: [{uid, name}], owner }
  sync: "idle",                 // idle | saving | saved | offline | error
  epoch: 0,                     // bumps when the app must restart to re-read storage
  pendingRemote: 0,             // >0 when other people's changes are waiting to be shown
  error: "",
};
const listeners = new Set();
function emit(patch) { snapshot = { ...snapshot, ...patch }; listeners.forEach(fn => fn(snapshot)); }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function getSnapshot() { return snapshot; }
// Called by the UI once it has shown pending remote changes (restarted the app).
export function acknowledgeRemote() { emit({ pendingRemote: 0, epoch: snapshot.epoch + 1 }); }

/* ---------- window.storage, as the app expects it ---------- */
export function installStorage() {
  window.storage = {
    get(key) {
      const v = lsGet(P + key);
      return Promise.resolve(v == null ? undefined : { value: v });
    },
    set(key, value) {
      const str = typeof value === "string" ? value : JSON.stringify(value);
      if (lsGet(P + key) === str) return Promise.resolve(); // nothing changed — don't touch timestamps
      lsSet(P + key, str);
      if (SYNC_KEYS.includes(key)) {
        meta.mod[key] = Date.now();
        saveMeta();
        if (hid) { dirty.add(key); schedulePush(); }
      }
      return Promise.resolve();
    },
    remove(key) {
      lsRemove(P + key);
      return Promise.resolve();
    },
  };
}

/* ---------- firebase ---------- */
let app = null, auth = null, db = null, uid = null, hid = null;
let userName = "";
const dirty = new Set();
let pushTimer = null;
let pulling = false;
let unsubSlices = null, unsubHousehold = null;

function authDomainFor(cfg) {
  // Same-domain auth keeps sign-in working on browsers that block third-party storage.
  const h = location.hostname;
  if (h === "localhost" || h === "127.0.0.1") return cfg.authDomain;
  if (h.endsWith(".web.app") || h.endsWith(".firebaseapp.com")) return location.host;
  return cfg.authDomain;
}

function chunkString(s) {
  const out = [];
  for (let i = 0; i < s.length; i += CHUNK) out.push(s.slice(i, i + CHUNK));
  return out.length ? out : [""];
}

function newCode() {
  const a = new Uint8Array(8);
  (window.crypto || window.msCrypto).getRandomValues(a);
  const c = Array.from(a, x => CODE_ALPHABET[x % CODE_ALPHABET.length]).join("");
  return c.slice(0, 4) + "-" + c.slice(4);
}
function normaliseCode(input) {
  const raw = String(input || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return raw.length === 8 ? raw.slice(0, 4) + "-" + raw.slice(4) : "";
}

function schedulePush() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { pushDirty(); }, PUSH_DEBOUNCE_MS);
}

async function pushKey(key) {
  const text = lsGet(P + key);
  if (text == null || !hid) return;
  const chunks = chunkString(text);
  const batch = writeBatch(db);
  chunks.forEach((c, i) => batch.set(doc(db, "households", hid, "chunks", `${key}~${i}`), { d: c }));
  batch.set(doc(db, "households", hid, "slices", key), { n: chunks.length, updatedAt: meta.mod[key] || Date.now(), device: DEVICE });
  await batch.commit();
}

export async function pushDirty() {
  if (!hid || dirty.size === 0) return;
  clearTimeout(pushTimer);
  const keys = [...dirty];
  keys.forEach(k => dirty.delete(k));
  emit({ sync: "saving", error: "" });
  // Firestore queues writes while offline and only answers once it reconnects,
  // so if this takes long, say so instead of spinning forever.
  const slow = setTimeout(() => { if (snapshot.sync === "saving") emit({ sync: "offline" }); }, 10000);
  try {
    for (const k of keys) await pushKey(k);
    emit({ sync: "saved" });
  } catch (e) {
    keys.forEach(k => dirty.add(k)); // try again on the next change or pull
    emit({ sync: "error", error: "Couldn't save just now. Your changes are safe on this device." });
  } finally {
    clearTimeout(slow);
  }
}

function hasMeaningfulLocal() {
  try {
    const r = JSON.parse(lsGet(P + "my-recipes") || "[]");
    if (Array.isArray(r) && r.length) return true;
  } catch (e) { /* ignore */ }
  try {
    const s = JSON.parse(lsGet(P + "plan-state") || "{}");
    if (s && Array.isArray(s.plan) && s.plan.length) return true;
  } catch (e) { /* ignore */ }
  return false;
}

async function readRemoteText(slice, key) {
  const n = slice.n || 1;
  const docs = await Promise.all(
    Array.from({ length: n }, (_, i) => getDoc(doc(db, "households", hid, "chunks", `${key}~${i}`)))
  );
  if (docs.some(d => !d.exists())) return null; // half-written; try again next time
  return docs.map(d => d.data().d).join("");
}

// Applies one remote item to this device. Returns true if the stored text changed.
async function applyRemote(key, r) {
  const text = await readRemoteText(r, key);
  if (text == null) return false;
  const changed = lsGet(P + key) !== text;
  if (changed) lsSet(P + key, text);
  meta.mod[key] = r.updatedAt;
  saveMeta();
  return changed;
}

// mode "link":       first time this device meets this household. Ask before replacing real local data.
// mode "link-cloud": joining someone's household — the household's data wins, no questions.
// mode "normal":     newest copy wins, key by key.
async function pullAll(mode) {
  if (!hid || pulling) return;
  pulling = true;
  let applied = false;
  try {
    if (snapshot.sync !== "saving") emit({ sync: "saving" });
    const snap = await getDocs(collection(db, "households", hid, "slices"));
    const remote = {};
    snap.forEach(d => { remote[d.id] = d.data(); });
    const remoteKeys = SYNC_KEYS.filter(k => remote[k]);

    let cloudWins = mode === "link-cloud";
    if (mode === "link") {
      if (remoteKeys.length === 0) {
        // Nothing saved yet: upload whatever this device has.
        SYNC_KEYS.forEach(k => { if (lsGet(P + k) != null) { meta.mod[k] = meta.mod[k] || Date.now(); dirty.add(k); } });
        saveMeta();
      } else if (hasMeaningfulLocal() && !window.confirm(
        "This household already has saved meal plans.\n\nOK = load them onto this device (replaces what's here).\nCancel = keep what's on this device and overwrite the household."
      )) {
        SYNC_KEYS.forEach(k => { if (lsGet(P + k) != null) { meta.mod[k] = Date.now(); dirty.add(k); } });
        saveMeta();
      } else {
        cloudWins = true;
      }
    }

    for (const key of SYNC_KEYS) {
      const r = remote[key];
      const localMod = meta.mod[key] || 0;
      const hasLocal = lsGet(P + key) != null;
      if (r && (cloudWins || r.updatedAt > localMod || !hasLocal)) {
        if (!cloudWins && dirty.has(key) && localMod >= r.updatedAt) continue;
        if (await applyRemote(key, r)) applied = true;
      } else if (hasLocal && localMod > (r ? r.updatedAt : 0)) {
        dirty.add(key); // this device is newer — send it up
      }
    }
    meta.linkedHid = hid;
    saveMeta();
    if (applied) emit({ epoch: snapshot.epoch + 1 }); // initial load: restart the app on the fresh data
    if (dirty.size) await pushDirty(); else emit({ sync: "saved", error: "" });
  } catch (e) {
    emit({ sync: navigator.onLine === false ? "offline" : "error", error: "Couldn't reach your saved data. Showing what's on this device." });
  } finally {
    pulling = false;
  }
}

// Live updates: when another device or family member saves something, apply
// it and let the UI restart the app at a quiet moment (see main.jsx).
function startListening() {
  stopListening();
  const myHid = hid;
  unsubSlices = onSnapshot(collection(db, "households", myHid, "slices"), async (snap) => {
    if (hid !== myHid || pulling) return;
    let changed = false;
    for (const ch of snap.docChanges()) {
      if (ch.type === "removed") continue;
      const key = ch.doc.id, r = ch.doc.data();
      if (!SYNC_KEYS.includes(key) || r.device === DEVICE) continue;
      if (r.updatedAt <= (meta.mod[key] || 0)) continue;
      if (dirty.has(key) && (meta.mod[key] || 0) >= r.updatedAt) continue;
      try { if (await applyRemote(key, r)) changed = true; } catch (e) { /* retry on next change */ }
    }
    if (changed && hid === myHid) emit({ pendingRemote: Date.now() });
  }, () => { /* listener errors (offline etc.) recover on their own */ });
  unsubHousehold = onSnapshot(doc(db, "households", myHid), (d) => {
    if (hid !== myHid || !d.exists()) return;
    const v = d.data();
    const names = v.names || {};
    emit({ household: { id: myHid, owner: v.owner, members: (v.members || []).map(m => ({ uid: m, name: names[m] || "Family member" })) } });
  }, () => {});
}
function stopListening() {
  if (unsubSlices) { unsubSlices(); unsubSlices = null; }
  if (unsubHousehold) { unsubHousehold(); unsubHousehold = null; }
}

export function pullIfStale() { /* kept for the Refresh button */
  if (!hid) return;
  pullAll("normal");
}

/* ---------- household: create / join / leave ---------- */
async function createHousehold() {
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newCode();
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, "households", code), { owner: uid, members: [uid], names: { [uid]: userName }, createdAt: Date.now() });
      batch.set(doc(db, "users", uid, "meta", "household"), { id: code });
      await batch.commit();
      return code;
    } catch (e) { if (attempt === 2) throw e; }
  }
}

async function enterHousehold(id, mode) {
  hid = id;
  emit({ household: { id, owner: null, members: [] } });
  await pullAll(mode);
  startListening();
}

async function startForUser() {
  const mine = await getDoc(doc(db, "users", uid, "meta", "household"));
  let id = mine.exists() ? mine.data().id : null;
  if (!id) id = await createHousehold();
  await enterHousehold(id, meta.linkedHid === id ? "normal" : "link");
}

export async function joinHousehold(input) {
  const code = normaliseCode(input);
  if (!hid || !code) return { ok: false, message: "That doesn't look like a household code. It looks like ABCD-2345." };
  if (code === hid) return { ok: false, message: "You're already in that household." };
  try {
    const target = await getDoc(doc(db, "households", code));
    if (!target.exists()) return { ok: false, message: "No household found with that code. Check it and try again." };
    const old = hid;
    await pushDirty();
    try {
      await updateDoc(doc(db, "households", code), { members: arrayUnion(uid), [`names.${uid}`]: userName });
    } catch (e) {
      if (e && e.code === "permission-denied") {
        const mail = (snapshot.user && snapshot.user.email) || "your Google address";
        return { ok: false, message: `This household is invite-only. Ask its owner to add ${mail} under "Who can join", then try again.` };
      }
      throw e;
    }
    const batch = writeBatch(db);
    batch.set(doc(db, "users", uid, "meta", "household"), { id: code });
    await batch.commit();
    // Step out of the old household so it doesn't linger with a ghost member.
    try { await updateDoc(doc(db, "households", old), { members: arrayRemove(uid) }); } catch (e) { /* best effort */ }
    stopListening();
    dirty.clear();
    meta.linkedHid = null;
    await enterHousehold(code, "link-cloud");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: "Couldn't join just now. Check your connection and try again." };
  }
}

export async function leaveHousehold() {
  if (!hid) return { ok: false };
  try {
    await pushDirty();
    const old = hid;
    stopListening();
    await updateDoc(doc(db, "households", old), { members: arrayRemove(uid) });
    const fresh = await createHousehold();
    // Take what's on this device along into the new, private household.
    SYNC_KEYS.forEach(k => { if (lsGet(P + k) != null) { meta.mod[k] = Date.now(); dirty.add(k); } });
    saveMeta();
    meta.linkedHid = null;
    hid = fresh;
    await enterHousehold(fresh, "link");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: "Couldn't leave just now. Try again." };
  }
}

/* ---------- sign in / out ---------- */
function isStandalone() {
  try { return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true; }
  catch (e) { return false; }
}

export async function signIn() {
  if (!auth) return;
  emit({ error: "" });
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    if (isStandalone()) { await signInWithRedirect(auth, provider); return; }
    await signInWithPopup(auth, provider);
  } catch (e) {
    const c = e && e.code;
    if (c === "auth/popup-closed-by-user" || c === "auth/cancelled-popup-request") return;
    if (c === "auth/popup-blocked" || c === "auth/operation-not-supported-in-this-environment" || c === "auth/web-storage-unsupported") {
      try { await signInWithRedirect(auth, provider); return; } catch (e2) { /* fall through */ }
    }
    emit({ error: "Sign-in didn't work. If you opened this link inside WhatsApp, Instagram or Facebook, open it in Chrome or Safari instead." });
  }
}

export async function signOut() {
  if (!auth) return;
  try { await pushDirty(); } catch (e) { /* ignore */ }
  stopListening();
  uid = null; hid = null;
  dirty.clear();
  clearTimeout(pushTimer);
  await fbSignOut(auth);
  // Leave nothing behind on a shared computer.
  lsKeys().filter(k => k.startsWith(P) || k === META_KEY).forEach(lsRemove);
  meta = { mod: {}, linkedHid: null };
  emit({ user: null, household: null, sync: "idle", error: "", pendingRemote: 0, epoch: snapshot.epoch + 1 });
}

/* ---------- start-up ---------- */
export function initCloud() {
  if (!isFirebaseConfigured) return;
  app = initializeApp({ ...firebaseConfig, authDomain: authDomainFor(firebaseConfig) });
  auth = getAuth(app);
  db = getFirestore(app);

  const giveUp = setTimeout(() => { if (!snapshot.ready) emit({ ready: true }); }, 8000);

  getRedirectResult(auth).catch(() => {
    emit({ error: "Sign-in didn't work. If you opened this link inside WhatsApp, Instagram or Facebook, open it in Chrome or Safari instead." });
  });

  onAuthStateChanged(auth, async (u) => {
    if (u) {
      uid = u.uid;
      userName = u.displayName || (u.email || "").split("@")[0] || "Family member";
      emit({ user: { uid: u.uid, email: u.email || "", name: u.displayName || "", photo: u.photoURL || "" } });
      try { await startForUser(); }
      catch (e) { emit({ sync: navigator.onLine === false ? "offline" : "error", error: "Couldn't reach your saved data. Showing what's on this device." }); }
    } else {
      stopListening();
      uid = null; hid = null;
      emit({ user: null, household: null, sync: "idle" });
    }
    clearTimeout(giveUp);
    if (!snapshot.ready) emit({ ready: true });
  });

  const wake = () => { if (document.visibilityState === "visible" && hid) pushDirty(); };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") pushDirty(); else wake();
  });
  window.addEventListener("online", () => { pushDirty(); });
  window.addEventListener("pagehide", () => { pushDirty(); });
}


/* ---------- recipe library (shared by everyone, edited only by the admin) ---------- */
// One Firestore document per recipe in "library". Anyone can read it (even
// signed out); only the admin account can write (see firestore.rules). The
// recipe itself is kept as a JSON string so Firestore never trips over
// null / nested values.
export function isAdminUser(user) {
  const a = String(ADMIN_EMAIL || "").trim().toLowerCase();
  return !!(user && user.email && a && !a.startsWith("your_") && user.email.toLowerCase() === a);
}
export async function loadLibrary() {
  if (!db) return [];
  const snap = await getDocs(collection(db, "library"));
  const out = [];
  snap.forEach(d => {
    try {
      const r = JSON.parse(d.data().json);
      out.push({ ...r, id: d.id });
    } catch (e) { /* skip a damaged entry */ }
  });
  out.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return out;
}
// Official photos for built-in recipes live in the existing public-read,
// admin-write library collection. JPEG data URLs are capped below the Firestore
// document limit and never change the recipe definition.
export async function saveBuiltinRecipePhoto(mealId, photo) {
  if (!db || !auth?.currentUser) throw new Error("Sign in as admin to publish a photo.");
  if (!/^m\\d+$/.test(mealId)) throw new Error("Unknown built-in recipe.");
  if (!/^data:image\\/jpeg;base64,/.test(photo) || photo.length > 180000)
    throw new Error("Photo is too large. Please choose a smaller image.");
  await setDoc(doc(db, "library", "builtin-photo-" + mealId), {
    kind: "builtin-photo", mealId, photo, updatedAt: Date.now(),
  });
}

export async function saveLibraryRecipe(recipe) {
  if (!db) throw new Error("Not connected to Firebase.");
  const id = recipe.id || ("l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5));
  const clean = { ...recipe, id, componentId: undefined };
  clean.ingredients = (clean.ingredients || []).map(i => ({ ...i, componentId: null }));
  delete clean.custom; delete clean.libraryId;
  const data = {
    name: String(clean.name || ""), cuisine: String(clean.cuisine || ""), protein: String(clean.protein || ""),
    updatedAt: Date.now(), json: JSON.stringify(clean),
  };
  const ref = doc(db, "library", id);
  const b = writeBatch(db); b.set(ref, data); await b.commit();
  return id;
}
export async function deleteLibraryRecipe(id) {
  if (!db) throw new Error("Not connected to Firebase.");
  await deleteDoc(doc(db, "library", id));
}


/* ---------- invites: only emails the owner lists can join, even with the code ---------- */
const EMAIL_OK = /^[^\s@\/]+@[^\s@\/]+\.[^\s@\/]+$/;
export async function listInvites() {
  if (!db || !hid) return [];
  const snap = await getDocs(collection(db, "households", hid, "invites"));
  const out = []; snap.forEach(d => out.push(d.id));
  return out.sort();
}
export async function addInvite(email) {
  const e = String(email || "").trim().toLowerCase();
  if (!EMAIL_OK.test(e)) return { ok: false, message: "That doesn't look like an email address." };
  try {
    const b = writeBatch(db);
    b.set(doc(db, "households", hid, "invites", e), { by: uid, at: Date.now() });
    await b.commit();
    return { ok: true, email: e };
  } catch (err) { return { ok: false, message: "Couldn't add that just now. Only the household owner can." }; }
}
export async function removeInvite(email) {
  try { await deleteDoc(doc(db, "households", hid, "invites", String(email).toLowerCase())); return { ok: true }; }
  catch (err) { return { ok: false, message: "Couldn't remove that just now." }; }
}
