import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_PASSWORD, demo, demoEmail, resetDemo } from './demoBackend.js';

const medecin = { id: 10, role: 'MEDECIN' };
const patient = { id: 1, role: 'PATIENT' };

beforeEach(() => resetDemo());

describe('authentification (séquence 1)', () => {
  it('connecte un utilisateur valide et renvoie jeton + rôle', () => {
    const res = demo.login(demoEmail('Awa', 'Diop'), DEMO_PASSWORD);
    expect(res.token).toBeTruthy();
    expect(res.utilisateur.role).toBe('PATIENT');
  });

  it('refuse des identifiants invalides avec 401', () => {
    expect(() => demo.login(demoEmail('Awa', 'Diop'), 'mauvais')).toThrow(expect.objectContaining({ status: 401 }));
  });

  it('inscrit un patient puis refuse un email déjà utilisé (409)', () => {
    const d = { nom: 'Test', prenom: 'Nouveau', email: 'nouveau@esante.sn', mot_de_passe: 'Motdepasse1' };
    expect(demo.register(d).id).toBeGreaterThan(0);
    expect(() => demo.register(d)).toThrow(expect.objectContaining({ status: 409 }));
    expect(demo.login('nouveau@esante.sn', 'Motdepasse1').utilisateur.role).toBe('PATIENT');
  });
});

describe('médecins (séquence 2)', () => {
  it('filtre par spécialité côté « serveur »', () => {
    const l = demo.medecins('Pédiatrie');
    expect(l.length).toBeGreaterThan(0);
    expect(l.every((m) => m.specialite.libelle === 'Pédiatrie')).toBe(true);
    expect(demo.medecins('Inconnue')).toEqual([]);
  });
});

describe('réservation (séquence 3, règle 5)', () => {
  it('réserve un créneau libre puis refuse une seconde réservation (409)', () => {
    const [creneau] = demo.disponibilites(11);
    const rdv = demo.reserver(patient, { id_medecin: 11, id_creneau: creneau.id, motif: 'Test' });
    expect(rdv.statut).toBe('EN_ATTENTE');
    expect(demo.disponibilites(11).some((d) => d.id === creneau.id)).toBe(false);
    expect(() => demo.reserver({ id: 2, role: 'PATIENT' }, { id_medecin: 11, id_creneau: creneau.id })).toThrow(
      expect.objectContaining({ status: 409 })
    );
  });

  it('interdit la réservation à un médecin (403)', () => {
    const [c] = demo.disponibilites(11);
    expect(() => demo.reserver(medecin, { id_medecin: 11, id_creneau: c.id })).toThrow(expect.objectContaining({ status: 403 }));
  });
});

describe('gestion par le médecin (séquence 4, règle 6)', () => {
  function nouveauRdv() {
    const [c] = demo.disponibilites(10);
    return demo.reserver(patient, { id_medecin: 10, id_creneau: c.id, motif: 'Test' });
  }

  it('accepte puis annule en libérant le créneau', () => {
    const rdv = nouveauRdv();
    expect(demo.majRdv(medecin, rdv.id, { statut: 'ACCEPTE' }).statut).toBe('ACCEPTE');
    demo.majRdv(medecin, rdv.id, { statut: 'ANNULE' });
    expect(demo.disponibilites(10).some((d) => d.id === rdv.id_disponibilite)).toBe(true);
  });

  it('refuse une transition interdite (422)', () => {
    const rdv = nouveauRdv();
    expect(() => demo.majRdv(medecin, rdv.id, { statut: 'TERMINE' })).toThrow(expect.objectContaining({ status: 422 }));
  });

  it('interdit à un autre médecin de modifier le rendez-vous (403)', () => {
    const rdv = nouveauRdv();
    expect(() => demo.majRdv({ id: 11, role: 'MEDECIN' }, rdv.id, { statut: 'ACCEPTE' })).toThrow(expect.objectContaining({ status: 403 }));
  });

  it('déplace un rendez-vous vers un autre créneau', () => {
    const rdv = nouveauRdv();
    const [, autre] = demo.disponibilites(10);
    const maj = demo.majRdv(medecin, rdv.id, { id_creneau: autre.id });
    expect(maj.id_disponibilite).toBe(autre.id);
    expect(demo.disponibilites(10).some((d) => d.id === rdv.id_disponibilite)).toBe(true);
  });
});

describe('ordonnances (séquence 5, règles 7 et 8)', () => {
  const lignes = [{ medicament: 'Paracétamol 1 g', posologie: '3 fois par jour', duree: '5 jours', quantite: 2 }];

  function rdvAccepte() {
    const [c] = demo.disponibilites(10);
    const rdv = demo.reserver(patient, { id_medecin: 10, id_creneau: c.id, motif: 'Test' });
    demo.majRdv(medecin, rdv.id, { statut: 'ACCEPTE' });
    return rdv;
  }

  it('refuse l’ordonnance tant que la consultation n’est pas terminée (422)', () => {
    const rdv = rdvAccepte();
    expect(() => demo.creerOrdonnance(medecin, rdv.id, { lignes })).toThrow(expect.objectContaining({ status: 422 }));
  });

  it('crée l’ordonnance après TERMINE, avec ses lignes', () => {
    const rdv = rdvAccepte();
    demo.majRdv(medecin, rdv.id, { statut: 'TERMINE' });
    const o = demo.creerOrdonnance(medecin, rdv.id, { instructions: 'Repos', lignes });
    expect(o.lignes).toHaveLength(1);
    expect(demo.ordonnancesPatient(1).some((x) => x.id === o.id)).toBe(true);
    expect(() => demo.creerOrdonnance(medecin, rdv.id, { lignes })).toThrow(expect.objectContaining({ status: 409 }));
  });

  it('exige au moins une ligne (règle 8)', () => {
    const rdv = rdvAccepte();
    demo.majRdv(medecin, rdv.id, { statut: 'TERMINE' });
    expect(() => demo.creerOrdonnance(medecin, rdv.id, { lignes: [] })).toThrow(expect.objectContaining({ status: 422 }));
  });
});

describe('disponibilités du médecin', () => {
  it('crée un créneau, refuse un chevauchement (409) et la suppression d’un créneau réservé', () => {
    const debut = '2030-01-07T09:00:00';
    const fin = '2030-01-07T09:30:00';
    const c = demo.creerDisponibilite(medecin, 10, { date_heure_debut: debut, date_heure_fin: fin });
    expect(c.est_reserve).toBe(false);
    expect(() => demo.creerDisponibilite(medecin, 10, { date_heure_debut: debut, date_heure_fin: fin })).toThrow(
      expect.objectContaining({ status: 409 })
    );
    expect(() => demo.creerDisponibilite(medecin, 10, { date_heure_debut: fin, date_heure_fin: debut })).toThrow(
      expect.objectContaining({ status: 422 })
    );
    expect(demo.supprimerDisponibilite(medecin, c.id)).toBeNull();

    const [libre] = demo.disponibilites(10);
    demo.reserver(patient, { id_medecin: 10, id_creneau: libre.id });
    expect(() => demo.supprimerDisponibilite(medecin, libre.id)).toThrow(expect.objectContaining({ status: 409 }));
  });
});
