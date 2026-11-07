// Fonctions utilitaires pures (testées dans utils.test.js)

export const pad = (n) => String(n).padStart(2, '0');
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISO(new Date());

export const parseISO = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// "2026-11-09T09:30:00" -> Date locale
export const parseDT = (iso) => {
  const [d, t = '00:00'] = iso.split('T');
  const [y, m, dd] = d.split('-').map(Number);
  const [h, mi] = t.split(':').map(Number);
  return new Date(y, m - 1, dd, h, mi);
};

export const addDays = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  return toISO(new Date(y, m - 1, d + n));
};

export const formatDateLong = (iso) =>
  parseISO(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export const formatDateShort = (iso) =>
  parseISO(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

export const dayParts = (iso) => {
  const d = parseISO(iso);
  return {
    jour: d.getDate(),
    mois: d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''),
    semaine: d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', ''),
  };
};

export const formatPrix = (n) => `${new Intl.NumberFormat('fr-FR').format(n)} FCFA`;

export const initials = (nom = '') =>
  nom
    .replace(/^Dr\.?\s*/i, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join('');

// Statuts du rendez-vous : identiques à l'enum StatutRendezVous (UML) et au type PostgreSQL statut_rdv
export const STATUTS = {
  EN_ATTENTE: { label: 'En attente', tone: 'warn' },
  ACCEPTE: { label: 'Accepté', tone: 'info' },
  REFUSE: { label: 'Refusé', tone: 'danger' },
  ANNULE: { label: 'Annulé', tone: 'danger' },
  TERMINE: { label: 'Terminé', tone: 'ok' },
};
export const ACTIFS = ['EN_ATTENTE', 'ACCEPTE'];
export const isActif = (statut) => ACTIFS.includes(statut);

// Regroupe des créneaux ({ date, debut, ... }) par jour, triés chronologiquement
export function groupByDay(slots) {
  const map = new Map();
  for (const s of [...slots].sort((a, b) => a.debut.localeCompare(b.debut))) {
    if (!map.has(s.date)) map.set(s.date, []);
    map.get(s.date).push(s);
  }
  return [...map].map(([date, list]) => ({ date, slots: list }));
}

// Découpe une plage horaire en créneaux de `minutes` minutes (format API : AAAA-MM-JJTHH:MM:00)
export function slotsFromRange(date, start, end, minutes) {
  const toMin = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const fmt = (n) => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;
  const out = [];
  if (!minutes || minutes <= 0) return out;
  for (let t = toMin(start); t + minutes <= toMin(end); t += minutes) {
    out.push({ debut: `${date}T${fmt(t)}:00`, fin: `${date}T${fmt(t + minutes)}:00` });
  }
  return out;
}

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// Recherche textuelle (sans accents) et tri. Le filtre par spécialité est fait côté serveur (?specialite=).
export function searchSortMedecins(list, { q = '', tri = 'nom' } = {}) {
  const needle = norm(q.trim());
  const out = list.filter((m) => !needle || norm(`${m.nomComplet} ${m.specialite} ${m.numeroOrdre}`).includes(needle));
  const sorters = {
    nom: (a, b) => a.nomComplet.localeCompare(b.nomComplet, 'fr'),
    tarif: (a, b) => a.tarif - b.tarif,
    tarifDesc: (a, b) => b.tarif - a.tarif,
  };
  return [...out].sort(sorters[tri] || sorters.nom);
}

export function kpis(rdvs) {
  return {
    total: rdvs.filter((r) => isActif(r.statut) || r.statut === 'TERMINE').length,
    attente: rdvs.filter((r) => r.statut === 'EN_ATTENTE').length,
    acceptes: rdvs.filter((r) => r.statut === 'ACCEPTE').length,
    termines: rdvs.filter((r) => r.statut === 'TERMINE').length,
  };
}

export const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e).trim());

// 0 (vide) à 4 (très robuste)
export function passwordStrength(p = '') {
  if (!p) return 0;
  let score = 0;
  if (p.length >= 8) score++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
  if (/\d/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p) || p.length >= 12) score++;
  return Math.max(1, score);
}
