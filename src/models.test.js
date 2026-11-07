import { describe, it, expect } from 'vitest';
import { isoDate, isoLocal, normMedecin, normOrdonnance, normRdv, normSlot } from './models.js';

describe('dates renvoyées par l’API', () => {
  it('accepte le format ISO avec T ou avec espace', () => {
    expect(isoLocal('2026-11-09T09:30:00')).toBe('2026-11-09T09:30:00');
    expect(isoLocal('2026-11-09 09:30:00')).toBe('2026-11-09T09:30:00');
    expect(isoLocal('2026-11-09T09:30')).toBe('2026-11-09T09:30:00');
  });

  it('accepte le format RFC 822 de jsonify (Flask par défaut)', () => {
    const d = isoLocal('Mon, 09 Nov 2026 09:30:00 GMT');
    expect(d).toMatch(/^2026-11-09T\d{2}:30:00$/);
  });

  it('isoDate conserve une date simple', () => {
    expect(isoDate('2026-11-09')).toBe('2026-11-09');
    expect(isoDate('')).toBe('');
  });
});

describe('normalisation', () => {
  it('normMedecin accepte une spécialité objet ou texte', () => {
    const a = normMedecin({ id: 1, nom: 'Fall', prenom: 'Cheikh', tarif: '10000.00', specialite: { id: 1, libelle: 'Cardiologie' } });
    const b = normMedecin({ id: 1, nom: 'Fall', prenom: 'Cheikh', tarif: 10000, specialite: 'Cardiologie' });
    expect(a.specialite).toBe('Cardiologie');
    expect(b.specialite).toBe('Cardiologie');
    expect(a.tarif).toBe(10000);
    expect(a.nomComplet).toBe('Dr Cheikh Fall');
  });

  it('normSlot dérive date et heures', () => {
    const s = normSlot({ id: 5, id_medecin: 2, date_heure_debut: '2026-11-09T09:00:00', date_heure_fin: '2026-11-09T09:30:00', est_reserve: false });
    expect(s).toMatchObject({ date: '2026-11-09', heure: '09:00', heureFin: '09:30', reserve: false });
  });

  it('normRdv lit les objets imbriqués patient et medecin', () => {
    const r = normRdv({
      id: 7,
      date_heure: '2026-11-09T10:00:00',
      statut: 'ACCEPTE',
      patient: { id: 1, nom: 'Diop', prenom: 'Awa' },
      medecin: { id: 10, nom: 'Fall', prenom: 'Cheikh', specialite: { libelle: 'Pédiatrie' } },
    });
    expect(r).toMatchObject({ patientNom: 'Awa Diop', medecinNom: 'Dr Cheikh Fall', specialite: 'Pédiatrie', heure: '10:00' });
  });

  it('normOrdonnance conserve les lignes', () => {
    const o = normOrdonnance({
      id: 1,
      id_rendezvous: 7,
      date_emission: '2026-11-09',
      lignes: [{ id: 1, medicament: 'Paracétamol 1 g', quantite: 2 }],
    });
    expect(o.lignes[0]).toMatchObject({ medicament: 'Paracétamol 1 g', quantite: 2, posologie: '' });
    expect(o.idRdv).toBe(7);
  });
});
