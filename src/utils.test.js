import { describe, it, expect } from 'vitest';
import {
  addDays,
  formatPrix,
  groupByDay,
  initials,
  isActif,
  isValidEmail,
  kpis,
  passwordStrength,
  searchSortMedecins,
  slotsFromRange,
} from './utils.js';

describe('dates', () => {
  it('addDays gère le changement de mois', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
  });
});

describe('slotsFromRange', () => {
  it('découpe une plage en créneaux de 30 min', () => {
    const s = slotsFromRange('2026-11-09', '09:00', '11:00', 30);
    expect(s).toHaveLength(4);
    expect(s[0]).toEqual({ debut: '2026-11-09T09:00:00', fin: '2026-11-09T09:30:00' });
    expect(s[3].fin).toBe('2026-11-09T11:00:00');
  });

  it('ignore le dernier créneau incomplet', () => {
    expect(slotsFromRange('2026-11-09', '09:00', '10:20', 30)).toHaveLength(2);
  });

  it('retourne une liste vide si la plage est invalide', () => {
    expect(slotsFromRange('2026-11-09', '11:00', '09:00', 30)).toEqual([]);
    expect(slotsFromRange('2026-11-09', '09:00', '10:00', 0)).toEqual([]);
  });
});

describe('groupByDay', () => {
  it('regroupe par jour et trie chronologiquement', () => {
    const g = groupByDay([
      { id: 3, date: '2026-11-10', debut: '2026-11-10T09:00:00' },
      { id: 2, date: '2026-11-09', debut: '2026-11-09T10:00:00' },
      { id: 1, date: '2026-11-09', debut: '2026-11-09T09:00:00' },
    ]);
    expect(g.map((x) => x.date)).toEqual(['2026-11-09', '2026-11-10']);
    expect(g[0].slots.map((s) => s.id)).toEqual([1, 2]);
  });
});

describe('searchSortMedecins', () => {
  const liste = [
    { id: 1, nomComplet: 'Dr Cheikh Fall', specialite: 'Médecine générale', numeroOrdre: 'SN-1', tarif: 10000 },
    { id: 2, nomComplet: 'Dr Aminata Sow', specialite: 'Pédiatrie', numeroOrdre: 'SN-2', tarif: 15000 },
    { id: 3, nomComplet: 'Dr Ousmane Ndiaye', specialite: 'Cardiologie', numeroOrdre: 'SN-3', tarif: 20000 },
  ];

  it('ignore les accents et la casse', () => {
    expect(searchSortMedecins(liste, { q: 'PEDIATRIE' }).map((m) => m.id)).toEqual([2]);
    expect(searchSortMedecins(liste, { q: 'medecine generale' }).map((m) => m.id)).toEqual([1]);
  });

  it('trie par nom puis par tarif', () => {
    expect(searchSortMedecins(liste, { tri: 'nom' }).map((m) => m.id)).toEqual([2, 1, 3]);
    expect(searchSortMedecins(liste, { tri: 'tarifDesc' }).map((m) => m.id)).toEqual([3, 2, 1]);
  });
});

describe('divers', () => {
  it('initials ignore le préfixe Dr', () => {
    expect(initials('Dr Cheikh Fall')).toBe('CF');
  });

  it('formatPrix ajoute la devise', () => {
    expect(formatPrix(10000)).toMatch(/^10\s000 FCFA$/);
  });

  it('kpis compte les statuts de l’enum StatutRendezVous', () => {
    const r = [{ statut: 'EN_ATTENTE' }, { statut: 'ACCEPTE' }, { statut: 'TERMINE' }, { statut: 'ANNULE' }, { statut: 'REFUSE' }];
    expect(kpis(r)).toEqual({ total: 3, attente: 1, acceptes: 1, termines: 1 });
  });

  it('isActif ne retient que EN_ATTENTE et ACCEPTE', () => {
    expect(isActif('ACCEPTE')).toBe(true);
    expect(isActif('TERMINE')).toBe(false);
  });

  it('valide les emails', () => {
    expect(isValidEmail('awa.diop@esante.sn')).toBe(true);
    expect(isValidEmail('awa@')).toBe(false);
  });

  it('évalue la robustesse du mot de passe', () => {
    expect(passwordStrength('')).toBe(0);
    expect(passwordStrength('abc')).toBe(1);
    expect(passwordStrength('Passer123!')).toBe(4);
  });
});
