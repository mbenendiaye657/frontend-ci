// Normalisation des réponses de l'API (noms de champs du MLD) vers des objets simples pour l'interface.
// Tolérant : accepte des objets imbriqués (medecin, patient, specialite) et des dates ISO ou RFC 822.
import { pad, toISO } from './utils.js';

export const nomComplet = (p) => (p ? [p.prenom, p.nom].filter(Boolean).join(' ') : '');
export const nomMedecin = (p) => (p && (p.nom || p.prenom) ? `Dr ${nomComplet(p)}` : '');
const libelle = (s) => ((s && typeof s === 'object' ? s.libelle : s) || '');

// -> "AAAA-MM-JJTHH:MM:SS" (heure locale, TIMESTAMP sans fuseau comme dans le schéma PostgreSQL)
export function isoLocal(v) {
  if (!v) return '';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(v)) {
    const s = v.replace(' ', 'T');
    return s.length === 16 ? `${s}:00` : s.slice(0, 19);
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${toISO(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

// -> "AAAA-MM-JJ"
export function isoDate(v) {
  if (!v) return '';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return isoLocal(v).slice(0, 10);
}

export function normMedecin(m) {
  return {
    id: m.id,
    nom: m.nom || '',
    prenom: m.prenom || '',
    nomComplet: nomMedecin(m),
    specialite: libelle(m.specialite),
    numeroOrdre: m.numero_ordre || '',
    biographie: m.biographie || '',
    tarif: Number(m.tarif) || 0,
  };
}

export function normSlot(s) {
  const debut = isoLocal(s.date_heure_debut);
  const fin = isoLocal(s.date_heure_fin);
  return {
    id: s.id,
    idMedecin: s.id_medecin,
    debut,
    fin,
    date: debut.slice(0, 10),
    heure: debut.slice(11, 16),
    heureFin: fin.slice(11, 16),
    reserve: Boolean(s.est_reserve),
  };
}

export function normRdv(r) {
  const medecin = r.medecin || {};
  const patient = r.patient || {};
  const dateHeure = isoLocal(r.date_heure);
  return {
    id: r.id,
    dateHeure,
    date: dateHeure.slice(0, 10),
    heure: dateHeure.slice(11, 16),
    motif: r.motif || '',
    statut: r.statut,
    idCreneau: r.id_disponibilite ?? null,
    idMedecin: medecin.id ?? r.id_medecin,
    medecinNom: nomMedecin(medecin),
    specialite: libelle(medecin.specialite),
    idPatient: patient.id ?? r.id_patient,
    patientNom: nomComplet(patient),
  };
}

export function normOrdonnance(o) {
  const medecin = o.medecin || {};
  const patient = o.patient || {};
  return {
    id: o.id,
    idRdv: o.id_rendezvous,
    date: isoDate(o.date_emission),
    instructions: o.instructions || '',
    lignes: (o.lignes || []).map((l) => ({
      id: l.id,
      medicament: l.medicament,
      posologie: l.posologie || '',
      duree: l.duree || '',
      quantite: l.quantite ?? null,
    })),
    medecinNom: nomMedecin(medecin),
    specialite: libelle(medecin.specialite),
    patientNom: nomComplet(patient),
  };
}
