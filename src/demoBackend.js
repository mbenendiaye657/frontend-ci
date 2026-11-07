// Backend simulé (mode démonstration) : reproduit le modèle UML/MLD et ses règles de gestion
// lorsque l'API Flask est injoignable. Les données vivent dans le localStorage du navigateur.
// Les réponses ont exactement la forme du MLD (snake_case), comme l'API réelle.
import { addDays, pad, parseDT, parseISO, todayISO } from './utils.js';

const KEY = 'esante_demo_v2';
export const DEMO_PASSWORD = 'Passer123';
export const httpError = (status, message) => Object.assign(new Error(message), { status });

const SPECIALITES = [
  'Médecine générale',
  'Pédiatrie',
  'Cardiologie',
  'Gynécologie',
  'Dermatologie',
  'Ophtalmologie',
  'Chirurgie dentaire',
].map((libelle, i) => ({ id: i + 1, libelle, description: '' }));

const MEDECINS = [
  [10, 'Cheikh', 'Fall', 'Médecine générale', 10000, 'Suivi des maladies courantes, bilans de santé et médecine préventive pour toute la famille.'],
  [11, 'Aminata', 'Sow', 'Pédiatrie', 15000, 'Santé de l’enfant et du nourrisson, vaccination, croissance et développement.'],
  [12, 'Ousmane', 'Ndiaye', 'Cardiologie', 20000, 'Hypertension, bilans cardiaques et suivi des maladies cardiovasculaires.'],
  [13, 'Fatou', 'Diallo', 'Gynécologie', 18000, 'Suivi de grossesse, santé de la femme et planification familiale.'],
  [14, 'Mamadou', 'Ba', 'Dermatologie', 15000, 'Maladies de la peau, allergies cutanées et soins dermatologiques.'],
  [15, 'Khady', 'Sy', 'Ophtalmologie', 17000, 'Examens de la vue, troubles de la réfraction et dépistage des maladies oculaires.'],
  [16, 'Ibrahima', 'Gueye', 'Médecine générale', 5000, 'Consultations générales accessibles, suivi des étudiants et des familles.'],
  [17, 'Mariama', 'Thiam', 'Chirurgie dentaire', 12000, 'Soins dentaires, détartrage, extractions et prévention bucco-dentaire.'],
  [18, 'Seydou', 'Kane', 'Pédiatrie', 12000, 'Consultations pédiatriques, vaccination et suivi de la croissance.'],
];

const PATIENTS = [
  [1, 'Awa', 'Diop'],
  [2, 'Moussa', 'Sarr'],
  [3, 'Fatou', 'Ndiaye'],
  [4, 'Ibrahima', 'Ba'],
  [5, 'Khadija', 'Sène'],
  [6, 'Pape', 'Diouf'],
  [7, 'Mariama', 'Faye'],
  [8, 'Cheikh', 'Mbaye'],
  [9, 'Aïssatou', 'Gaye'],
];

const slug = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
export const demoEmail = (prenom, nom) => `${slug(prenom)}.${slug(nom)}@esante.sn`;

// ───────── Création des données initiales ─────────
const datesBetween = (from, to) => {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
};

function addSlots(s, dates) {
  let id = Math.max(0, ...s.disponibilites.map((d) => d.id)) + 1;
  for (const m of s.medecins) {
    for (const iso of dates) {
      if (parseISO(iso).getDay() === 0) continue; // fermé le dimanche
      for (const h of [9, 10, 11, 14, 15, 16]) {
        for (const mn of [0, 30]) {
          const fin = mn === 0 ? `${pad(h)}:30` : `${pad(h + 1)}:00`;
          s.disponibilites.push({
            id: id++,
            id_medecin: m.id,
            date_heure_debut: `${iso}T${pad(h)}:${pad(mn)}:00`,
            date_heure_fin: `${iso}T${fin}:00`,
            est_reserve: false,
          });
        }
      }
    }
  }
}

function book(s, idPatient, idMedecin, off, hhmm, motif, statut) {
  // Si le jour demandé est un dimanche (aucun créneau), on prend le jour ouvré suivant
  let debut;
  let dispo;
  for (let k = 0; k < 3 && !dispo; k++) {
    debut = `${addDays(todayISO(), off + k)}T${hhmm}:00`;
    dispo = s.disponibilites.find((d) => d.id_medecin === idMedecin && d.date_heure_debut === debut);
  }
  const occupe = !['REFUSE', 'ANNULE'].includes(statut);
  if (occupe) dispo.est_reserve = true;
  const rdv = {
    id: s.rendezvous.length + 1,
    date_heure: debut,
    motif,
    statut,
    date_creation: debut,
    id_patient: idPatient,
    id_medecin: idMedecin,
    id_disponibilite: occupe ? dispo.id : null,
  };
  s.rendezvous.push(rdv);
  return rdv;
}

function build() {
  const s = {
    specialites: SPECIALITES,
    utilisateurs: [],
    medecins: [],
    disponibilites: [],
    rendezvous: [],
    ordonnances: [],
    slotsJusqua: addDays(todayISO(), 14),
  };
  for (const [id, prenom, nom] of PATIENTS) {
    s.utilisateurs.push({ id, prenom, nom, email: demoEmail(prenom, nom), mot_de_passe: DEMO_PASSWORD, telephone: '', role: 'PATIENT' });
  }
  MEDECINS.forEach(([id, prenom, nom, spec, tarif, bio], i) => {
    s.utilisateurs.push({ id, prenom, nom, email: demoEmail(prenom, nom), mot_de_passe: DEMO_PASSWORD, telephone: '', role: 'MEDECIN' });
    s.medecins.push({
      id,
      numero_ordre: `SN-MED-${String(i + 1).padStart(4, '0')}`,
      biographie: bio,
      tarif,
      id_specialite: SPECIALITES.find((x) => x.libelle === spec).id,
    });
  });
  addSlots(s, datesBetween(addDays(todayISO(), -10), s.slotsJusqua));

  book(s, 2, 10, 0, '09:00', 'Fièvre et maux de tête depuis 2 jours', 'TERMINE');
  book(s, 3, 10, 0, '10:30', 'Contrôle de la tension', 'ACCEPTE');
  book(s, 4, 10, 0, '15:00', 'Douleurs abdominales', 'EN_ATTENTE');
  book(s, 1, 10, 1, '11:00', 'Renouvellement de traitement', 'ACCEPTE');
  book(s, 5, 10, 1, '09:30', 'Premier avis', 'EN_ATTENTE');
  book(s, 6, 10, 2, '14:30', 'Suivi diabète', 'ACCEPTE');
  book(s, 7, 10, -1, '10:00', 'Toux persistante', 'TERMINE');
  book(s, 8, 10, -1, '11:30', 'Certificat médical', 'TERMINE');
  book(s, 9, 10, -2, '09:00', 'Allergie cutanée', 'TERMINE');
  book(s, 2, 10, -3, '15:30', 'Douleurs lombaires', 'ANNULE');
  const cardio = book(s, 1, 12, -10, '10:00', 'Bilan cardiaque', 'TERMINE');
  book(s, 1, 11, 3, '16:00', 'Vaccination de rappel', 'EN_ATTENTE');

  s.ordonnances.push({
    id: 1,
    date_emission: addDays(todayISO(), -10),
    instructions: 'Contrôle dans 3 mois. Limiter le sel et pratiquer une activité physique régulière.',
    id_rendezvous: cardio.id,
    lignes: [{ id: 1, medicament: 'Amlodipine 5 mg', posologie: '1 comprimé le matin', duree: '3 mois', quantite: 3 }],
  });
  return s;
}

// ───────── Persistance ─────────
let memory = null;

function load() {
  let s = memory;
  if (!s) {
    try {
      s = JSON.parse(localStorage.getItem(KEY));
    } catch {
      s = null;
    }
  }
  if (!s || !s.rendezvous) s = build();
  // Le temps passe : on prolonge les créneaux jusqu'à J+14
  const cible = addDays(todayISO(), 14);
  if (s.slotsJusqua < cible) {
    addSlots(s, datesBetween(addDays(s.slotsJusqua, 1), cible));
    s.slotsJusqua = cible;
  }
  memory = s;
  return s;
}

function save(s) {
  memory = s;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* stockage indisponible : on reste en mémoire */
  }
}

export function resetDemo() {
  memory = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

const nextId = (list) => Math.max(0, ...list.map((x) => x.id)) + 1;
const nowISO = () => {
  const d = new Date();
  return `${todayISO()}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
};

// ───────── Vues (forme des réponses JSON de l'API) ─────────
const viewUser = (s, id) => {
  const u = s.utilisateurs.find((x) => x.id === id);
  return u ? { id: u.id, nom: u.nom, prenom: u.prenom } : { id };
};
const viewMedecin = (s, id) => {
  const m = s.medecins.find((x) => x.id === id);
  const u = viewUser(s, id);
  const sp = s.specialites.find((x) => x.id === m.id_specialite);
  return { ...u, numero_ordre: m.numero_ordre, biographie: m.biographie, tarif: m.tarif, specialite: { id: sp.id, libelle: sp.libelle } };
};
const viewRdv = (s, r) => ({ ...r, patient: viewUser(s, r.id_patient), medecin: viewMedecin(s, r.id_medecin) });
const viewOrd = (s, o) => {
  const r = s.rendezvous.find((x) => x.id === o.id_rendezvous);
  return { ...o, patient: viewUser(s, r.id_patient), medecin: viewMedecin(s, r.id_medecin) };
};

// Cycle de vie du rendez-vous (règle de gestion 6)
const TRANSITIONS = {
  EN_ATTENTE: ['ACCEPTE', 'REFUSE', 'ANNULE'],
  ACCEPTE: ['TERMINE', 'ANNULE'],
  REFUSE: [],
  ANNULE: [],
  TERMINE: [],
};

function requireRole(user, role) {
  if (!user) throw httpError(401, 'Authentification requise.');
  if (user.role !== role) throw httpError(403, 'Action non autorisée pour votre profil.');
}

// ───────── API simulée ─────────
export const demo = {
  register(d = {}) {
    const s = load();
    const email = String(d.email || '').trim().toLowerCase();
    if (!d.nom || !d.prenom || !email || !d.mot_de_passe) throw httpError(422, 'Champs obligatoires manquants.');
    if (String(d.mot_de_passe).length < 8) throw httpError(422, 'Le mot de passe doit contenir au moins 8 caractères.');
    if (s.utilisateurs.some((u) => u.email === email)) throw httpError(409, 'Un compte existe déjà avec cet email.');
    const u = {
      id: nextId(s.utilisateurs),
      nom: d.nom,
      prenom: d.prenom,
      email,
      mot_de_passe: d.mot_de_passe,
      telephone: d.telephone || '',
      role: 'PATIENT',
      date_naissance: d.date_naissance || null,
      adresse: d.adresse || '',
    };
    s.utilisateurs.push(u);
    save(s);
    return { id: u.id, email: u.email };
  },

  login(email, motDePasse) {
    const s = load();
    const u = s.utilisateurs.find((x) => x.email === String(email).trim().toLowerCase());
    if (!u || u.mot_de_passe !== motDePasse) throw httpError(401, 'Identifiants incorrects.');
    return { token: `demo-token-${u.id}`, utilisateur: { id: u.id, nom: u.nom, prenom: u.prenom, email: u.email, role: u.role } };
  },

  medecins(specialite) {
    const s = load();
    return s.medecins
      .map((m) => viewMedecin(s, m.id))
      .filter((m) => !specialite || m.specialite.libelle === specialite);
  },

  // Patient : créneaux libres et à venir. Médecin (toutes=true) : tous ses créneaux à partir d'aujourd'hui.
  disponibilites(idMedecin, toutes = false) {
    const s = load();
    const now = parseDT(nowISO());
    const today = todayISO();
    return s.disponibilites
      .filter((d) => d.id_medecin === Number(idMedecin))
      .filter((d) => (toutes ? d.date_heure_debut.slice(0, 10) >= today : !d.est_reserve && parseDT(d.date_heure_debut) > now))
      .sort((a, b) => a.date_heure_debut.localeCompare(b.date_heure_debut));
  },

  creerDisponibilite(user, idMedecin, { date_heure_debut: debut, date_heure_fin: fin } = {}) {
    requireRole(user, 'MEDECIN');
    if (user.id !== Number(idMedecin)) throw httpError(403, 'Vous ne pouvez gérer que vos propres disponibilités.');
    if (!debut || !fin || fin <= debut) throw httpError(422, 'La fin du créneau doit être postérieure au début.');
    const s = load();
    const chevauche = s.disponibilites.some((d) => d.id_medecin === user.id && debut < d.date_heure_fin && fin > d.date_heure_debut);
    if (chevauche) throw httpError(409, 'Ce créneau chevauche une disponibilité existante.');
    const d = { id: nextId(s.disponibilites), id_medecin: user.id, date_heure_debut: debut, date_heure_fin: fin, est_reserve: false };
    s.disponibilites.push(d);
    save(s);
    return d;
  },

  supprimerDisponibilite(user, id) {
    requireRole(user, 'MEDECIN');
    const s = load();
    const d = s.disponibilites.find((x) => x.id === Number(id));
    if (!d || d.id_medecin !== user.id) throw httpError(404, 'Créneau introuvable.');
    if (d.est_reserve) throw httpError(409, 'Ce créneau est réservé : annulez d’abord le rendez-vous.');
    s.disponibilites = s.disponibilites.filter((x) => x.id !== d.id);
    save(s);
    return null;
  },

  // Règle 5 : un créneau déjà réservé ne peut pas l'être une seconde fois
  reserver(user, { id_medecin: idMedecin, id_creneau: idCreneau, motif } = {}) {
    requireRole(user, 'PATIENT');
    const s = load();
    const d = s.disponibilites.find((x) => x.id === Number(idCreneau) && x.id_medecin === Number(idMedecin));
    if (!d) throw httpError(404, 'Créneau introuvable.');
    if (d.est_reserve) throw httpError(409, 'Créneau indisponible, veuillez en choisir un autre.');
    d.est_reserve = true;
    const r = {
      id: nextId(s.rendezvous),
      date_heure: d.date_heure_debut,
      motif: motif || '',
      statut: 'EN_ATTENTE',
      date_creation: nowISO(),
      id_patient: user.id,
      id_medecin: d.id_medecin,
      id_disponibilite: d.id,
    };
    s.rendezvous.push(r);
    save(s);
    return viewRdv(s, r);
  },

  rdvPatient(idPatient) {
    const s = load();
    return s.rendezvous.filter((r) => r.id_patient === Number(idPatient)).map((r) => viewRdv(s, r));
  },

  rdvMedecin(idMedecin, date) {
    const s = load();
    return s.rendezvous
      .filter((r) => r.id_medecin === Number(idMedecin) && (!date || r.date_heure.slice(0, 10) === date))
      .map((r) => viewRdv(s, r));
  },

  majRdv(user, id, { statut, id_creneau: idCreneau } = {}) {
    requireRole(user, 'MEDECIN');
    const s = load();
    const r = s.rendezvous.find((x) => x.id === Number(id));
    if (!r) throw httpError(404, 'Rendez-vous introuvable.');
    if (r.id_medecin !== user.id) throw httpError(403, 'Seul le médecin concerné peut modifier ce rendez-vous.');
    const libere = () => {
      const old = s.disponibilites.find((x) => x.id === r.id_disponibilite);
      if (old) old.est_reserve = false;
      r.id_disponibilite = null;
    };
    if (idCreneau !== undefined) {
      if (!['EN_ATTENTE', 'ACCEPTE'].includes(r.statut)) throw httpError(422, 'Ce rendez-vous ne peut plus être déplacé.');
      const d = s.disponibilites.find((x) => x.id === Number(idCreneau) && x.id_medecin === r.id_medecin);
      if (!d) throw httpError(404, 'Créneau introuvable.');
      if (d.est_reserve && d.id !== r.id_disponibilite) throw httpError(409, 'Ce créneau est déjà pris.');
      if (d.id !== r.id_disponibilite) {
        libere();
        d.est_reserve = true;
        r.id_disponibilite = d.id;
        r.date_heure = d.date_heure_debut;
      }
    }
    if (statut !== undefined && statut !== r.statut) {
      if (!(TRANSITIONS[r.statut] || []).includes(statut)) {
        throw httpError(422, `Transition impossible : ${r.statut} → ${statut}.`);
      }
      if (statut === 'ANNULE' || statut === 'REFUSE') libere(); // le créneau redevient disponible
      r.statut = statut;
    }
    save(s);
    return viewRdv(s, r);
  },

  ordonnancesPatient(idPatient) {
    const s = load();
    return s.ordonnances
      .filter((o) => s.rendezvous.find((r) => r.id === o.id_rendezvous)?.id_patient === Number(idPatient))
      .map((o) => viewOrd(s, o));
  },

  ordonnancesMedecin(idMedecin) {
    const s = load();
    return s.ordonnances
      .filter((o) => s.rendezvous.find((r) => r.id === o.id_rendezvous)?.id_medecin === Number(idMedecin))
      .map((o) => viewOrd(s, o));
  },

  // Règles 7 et 8 : consultation terminée + au moins une ligne
  creerOrdonnance(user, idRdv, { instructions, lignes } = {}) {
    requireRole(user, 'MEDECIN');
    const s = load();
    const r = s.rendezvous.find((x) => x.id === Number(idRdv));
    if (!r) throw httpError(404, 'Rendez-vous introuvable.');
    if (r.id_medecin !== user.id) throw httpError(403, 'Seul le médecin concerné peut rédiger l’ordonnance.');
    if (r.statut !== 'TERMINE') throw httpError(422, 'Consultation non terminée.');
    if (s.ordonnances.some((o) => o.id_rendezvous === r.id)) throw httpError(409, 'Une ordonnance existe déjà pour ce rendez-vous.');
    const valides = (lignes || []).filter((l) => l && String(l.medicament || '').trim());
    if (valides.length === 0) throw httpError(422, 'Une ordonnance doit contenir au moins un médicament.');
    if (valides.some((l) => l.quantite != null && !(Number(l.quantite) > 0))) throw httpError(422, 'La quantité doit être supérieure à 0.');
    let ligneId = Math.max(0, ...s.ordonnances.flatMap((o) => o.lignes.map((l) => l.id))) + 1;
    const o = {
      id: nextId(s.ordonnances),
      date_emission: todayISO(),
      instructions: instructions || '',
      id_rendezvous: r.id,
      lignes: valides.map((l) => ({
        id: ligneId++,
        medicament: String(l.medicament).trim(),
        posologie: l.posologie || '',
        duree: l.duree || '',
        quantite: l.quantite != null ? Number(l.quantite) : null,
      })),
    };
    s.ordonnances.push(o);
    save(s);
    return viewOrd(s, o);
  },
};
