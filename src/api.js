// Client de l'API REST Flask (routes /api/... du document de modélisation).
// Si l'API est injoignable, bascule automatiquement sur le backend simulé (demoBackend.js).
import { demo as demoDb } from './demoBackend.js';
import { normMedecin, normOrdonnance, normRdv, normSlot } from './models.js';

// nginx (production) et Vite (développement) relaient /api vers le backend Flask sans retirer le préfixe.
const BASE = (import.meta.env && import.meta.env.VITE_API_URL) || '/api';
const SESSION_KEY = 'esante_session_v1';

// ───────── Session (jeton JWT + utilisateur) ─────────
let session = null;
try {
  session = JSON.parse(localStorage.getItem(SESSION_KEY));
} catch {
  session = null;
}
const sessionListeners = new Set();

export const getUser = () => session?.user || null;
export function onSession(fn) {
  sessionListeners.add(fn);
  return () => sessionListeners.delete(fn);
}
function setSession(s) {
  session = s;
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  sessionListeners.forEach((f) => f(s?.user || null));
}
export const logout = () => setSession(null);

function decodeJwt(token) {
  try {
    const payload = String(token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

// ───────── Mode (API réelle ou démonstration locale) ─────────
let demo = false;
const modeListeners = new Set();
export const isDemo = () => demo;
export function onModeChange(fn) {
  modeListeners.add(fn);
  return () => modeListeners.delete(fn);
}
function setDemo(v) {
  if (demo === v) return;
  demo = v;
  // Une session créée dans l'autre mode n'est pas valable ici : reconnexion nécessaire
  if (session && Boolean(session.demo) !== v) setSession(null);
  modeListeners.forEach((f) => f(v));
}

// ───────── Client HTTP ─────────
async function http(path, { method = 'GET', body } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (session && !session.demo && session.token) headers.Authorization = `Bearer ${session.token}`;
    const res = await fetch(BASE + path, {
      method,
      headers,
      signal: ctrl.signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const err = new Error(data?.message || data?.msg || data?.error || data?.erreur || `Erreur serveur (${res.status})`);
      err.status = res.status;
      if (res.status === 401 && session && !path.startsWith('/auth/')) logout(); // jeton expiré
      throw err;
    }
    setDemo(false);
    return res.status === 204 ? null : await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// L'API répond-elle ? (GET /medecins est public ; toute réponse < 500 prouve que le backend est vivant)
async function ping() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(`${BASE}/medecins`, { signal: ctrl.signal });
    // Une page HTML (SPA ou page d'erreur d'un proxy) n'est pas notre API JSON
    return res.status < 500 && !(res.headers.get('content-type') || '').includes('text/html');
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkHealth() {
  const alive = await ping();
  setDemo(!alive);
  return alive;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const local = (fn) => () => sleep(250).then(fn);

// Erreurs métier (400, 401, 403, 409, 422…) : remontées à l'interface.
// Réseau coupé, 404 ou 5xx : on vérifie que l'API est réellement absente avant de passer en démo.
async function withFallback(remote, localFn) {
  if (demo) return localFn();
  try {
    return await remote();
  } catch (e) {
    const suspect = !e.status || e.status >= 500 || e.status === 404;
    if (suspect && !(await ping())) {
      setDemo(true);
      return localFn();
    }
    throw e;
  }
}

const qs = (obj = {}) => {
  const p = new URLSearchParams(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  const s = p.toString();
  return s ? `?${s}` : '';
};

const call = (path, opts, localFn, map = (x) => x) => withFallback(() => http(path, opts), local(localFn)).then(map);
const me = () => session?.user;
const list = (fn) => (l) => (Array.isArray(l) ? l : []).map(fn);

// ───────── API publique utilisée par les pages ─────────
export const api = {
  // POST /api/auth/register
  register: (d) => call('/auth/register', { method: 'POST', body: d }, () => demoDb.register(d)),

  // POST /api/auth/login -> jeton JWT ; le profil vient de la réponse ou des claims du jeton
  async login(email, password) {
    const res = await withFallback(
      () => http('/auth/login', { method: 'POST', body: { email, mot_de_passe: password } }),
      local(() => demoDb.login(email, password))
    );
    const token = res.token || res.access_token;
    const claims = decodeJwt(token) || {};
    const u = res.utilisateur || res.user || {};
    const user = {
      id: Number(u.id ?? claims.sub ?? claims.id ?? claims.identity),
      nom: u.nom || '',
      prenom: u.prenom || '',
      email: u.email || email,
      role: String(u.role ?? claims.role ?? '').toUpperCase(),
    };
    setSession({ token, user, demo });
    return user;
  },

  // GET /api/medecins?specialite=...  (filtre appliqué côté serveur)
  medecins: (specialite) => call(`/medecins${qs({ specialite })}`, {}, () => demoDb.medecins(specialite), list(normMedecin)),

  // GET /api/medecins/{id}/disponibilites   (créneaux libres) ; toutes=true : tous les créneaux du médecin connecté
  disponibilites: (idMedecin, toutes = false) =>
    call(
      `/medecins/${idMedecin}/disponibilites${qs({ toutes: toutes || undefined })}`,
      {},
      () => demoDb.disponibilites(idMedecin, toutes),
      list(normSlot)
    ),
  // POST /api/medecins/{id}/disponibilites  ·  DELETE /api/disponibilites/{id}
  creerDisponibilite: (idMedecin, { debut, fin }) =>
    call(
      `/medecins/${idMedecin}/disponibilites`,
      { method: 'POST', body: { date_heure_debut: debut, date_heure_fin: fin } },
      () => demoDb.creerDisponibilite(me(), idMedecin, { date_heure_debut: debut, date_heure_fin: fin }),
      normSlot
    ),
  supprimerDisponibilite: (id) => call(`/disponibilites/${id}`, { method: 'DELETE' }, () => demoDb.supprimerDisponibilite(me(), id)),

  // POST /api/rendezvous  { id_medecin, id_creneau, motif }  -> 201, ou 409 si le créneau vient d'être pris
  reserver: (body) => call('/rendezvous', { method: 'POST', body }, () => demoDb.reserver(me(), body), normRdv),

  // GET /api/patients/{id}/rendezvous  ·  GET /api/medecins/{id}/rendezvous?date=AAAA-MM-JJ (date facultative)
  rdvPatient: (idPatient) => call(`/patients/${idPatient}/rendezvous`, {}, () => demoDb.rdvPatient(idPatient), list(normRdv)),
  rdvMedecin: (idMedecin, date) =>
    call(`/medecins/${idMedecin}/rendezvous${qs({ date })}`, {}, () => demoDb.rdvMedecin(idMedecin, date), list(normRdv)),

  // PUT /api/rendezvous/{id}  { statut } ou { id_creneau }
  majRdv: (id, patch) => call(`/rendezvous/${id}`, { method: 'PUT', body: patch }, () => demoDb.majRdv(me(), id, patch), normRdv),

  // GET /api/patients/{id}/ordonnances  ·  GET /api/medecins/{id}/ordonnances
  ordonnancesPatient: (id) => call(`/patients/${id}/ordonnances`, {}, () => demoDb.ordonnancesPatient(id), list(normOrdonnance)),
  ordonnancesMedecin: (id) => call(`/medecins/${id}/ordonnances`, {}, () => demoDb.ordonnancesMedecin(id), list(normOrdonnance)),

  // POST /api/rendezvous/{id}/ordonnance  { instructions, lignes: [{ medicament, posologie, duree, quantite }] }
  creerOrdonnance: (idRdv, body) =>
    call(`/rendezvous/${idRdv}/ordonnance`, { method: 'POST', body }, () => demoDb.creerOrdonnance(me(), idRdv, body), normOrdonnance),
};
