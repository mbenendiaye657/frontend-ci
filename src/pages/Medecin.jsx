import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { ConfirmModal, Empty, Modal, SkeletonRows, StatusBadge, useToast } from '../components/ui.jsx';
import OrdonnanceModal from '../components/OrdonnanceModal.jsx';
import { addDays, dayParts, formatDateLong, formatDateShort, groupByDay, kpis, isActif, parseDT, slotsFromRange, todayISO } from '../utils.js';

const SUGGESTIONS = ['Paracétamol 1 g', 'Amoxicilline 500 mg', 'Ibuprofène 400 mg', 'Oméprazole 20 mg', 'Sels de réhydratation orale', 'Amlodipine 5 mg'];
const LIGNE_VIDE = { medicament: '', posologie: '', duree: '', quantite: '1' };

// ───────────────────────── Modifier un rendez-vous (UC Modifier) ─────────────────────────
function EditModal({ rdv, user, onClose, onSaved }) {
  const toast = useToast();
  const [slots, setSlots] = useState(null);
  const [creneau, setCreneau] = useState(null);
  const [date, setDate] = useState(rdv.date);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .disponibilites(user.id, true)
      .then((l) => {
        const now = new Date();
        // créneaux libres et à venir + le créneau actuel de ce rendez-vous
        setSlots(l.filter((s) => s.id === rdv.idCreneau || (!s.reserve && parseDT(s.debut) > now)));
      })
      .catch((e) => {
        setSlots([]);
        toast(e.message, 'error');
      });
  }, [user.id, rdv.idCreneau, toast]);

  const jours = useMemo(() => groupByDay(slots || []), [slots]);
  const duJour = jours.find((j) => j.date === date)?.slots || [];
  const actuel = (s) => s.id === rdv.idCreneau;

  async function save() {
    setBusy(true);
    try {
      await api.majRdv(rdv.id, { id_creneau: creneau.id });
      toast('Rendez-vous déplacé ✓');
      onSaved();
      onClose();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Modifier le rendez-vous de ${rdv.patientNom}`}
      wide
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primary" disabled={busy || !creneau || actuel(creneau)} onClick={save}>
            {busy ? 'Enregistrement…' : 'Déplacer le rendez-vous'}
          </button>
        </>
      }
    >
      <p className="muted">
        Actuellement : {formatDateLong(rdv.date)} à {rdv.heure}. Choisissez un nouveau créneau parmi vos disponibilités.
      </p>
      {!slots ? (
        <div className="slots">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: 40 }} />
          ))}
        </div>
      ) : jours.length === 0 ? (
        <Empty icon="🕒" title="Aucun créneau libre" text="Ajoutez des disponibilités depuis l’onglet « Disponibilités »." />
      ) : (
        <>
          <span className="label">Jour</span>
          <div className="day-strip">
            {jours.map(({ date: d }) => {
              const p = dayParts(d);
              return (
                <button
                  key={d}
                  className={`day ${date === d ? 'active' : ''}`}
                  onClick={() => {
                    setDate(d);
                    setCreneau(null);
                  }}
                >
                  <small>{p.semaine}</small>
                  <strong>{p.jour}</strong>
                  <small>{p.mois}</small>
                </button>
              );
            })}
          </div>
          <span className="label">Créneaux</span>
          <div className="slots">
            {duJour.length === 0 && <p className="muted">Choisissez un jour.</p>}
            {duJour.map((s) => (
              <button key={s.id} className={`slot ${creneau?.id === s.id ? 'active' : ''} ${actuel(s) ? 'current' : ''}`} onClick={() => setCreneau(s)} title={actuel(s) ? 'Créneau actuel' : ''}>
                {s.heure}
                {actuel(s) && <small> (actuel)</small>}
              </button>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

// ───────────────────────── Créer une ordonnance (UC Créer une ordonnance) ─────────────────────────
function PrescribeModal({ rdv, onClose, onSaved }) {
  const toast = useToast();
  const [lignes, setLignes] = useState([{ ...LIGNE_VIDE }]);
  const [instructions, setInstructions] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (i, k, v) => setLignes((l) => l.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const remplies = lignes.filter((l) => l.medicament.trim());
  const quantiteOk = remplies.every((l) => l.quantite === '' || Number(l.quantite) > 0);
  const valid = remplies.length > 0 && quantiteOk;

  async function submit() {
    setBusy(true);
    try {
      await api.creerOrdonnance(rdv.id, {
        instructions: instructions.trim(),
        lignes: remplies.map((l) => ({
          medicament: l.medicament.trim(),
          posologie: l.posologie.trim(),
          duree: l.duree.trim(),
          quantite: l.quantite === '' ? null : Number(l.quantite),
        })),
      });
      toast('Ordonnance enregistrée ✓');
      onSaved();
      onClose();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Ordonnance pour ${rdv.patientNom}`}
      wide
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Plus tard
          </button>
          <button className="btn btn-primary" disabled={!valid || busy} onClick={submit}>
            {busy ? 'Enregistrement…' : 'Enregistrer l’ordonnance'}
          </button>
        </>
      }
    >
      <p className="muted">
        Consultation du {formatDateShort(rdv.date)} à {rdv.heure} · {rdv.motif || 'sans motif précisé'}
      </p>
      <datalist id="meds-list">
        {SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <div className="med-head" aria-hidden="true">
        <span>Médicament</span>
        <span>Posologie</span>
        <span>Durée</span>
        <span>Qté</span>
        <span />
      </div>
      {lignes.map((l, i) => (
        <div key={i} className="med-row">
          <input className="input" list="meds-list" placeholder="Médicament" aria-label="Médicament" value={l.medicament} onChange={(e) => update(i, 'medicament', e.target.value)} />
          <input className="input" placeholder="ex. 1 cp matin et soir" aria-label="Posologie" value={l.posologie} onChange={(e) => update(i, 'posologie', e.target.value)} />
          <input className="input" placeholder="5 jours" aria-label="Durée" value={l.duree} onChange={(e) => update(i, 'duree', e.target.value)} />
          <input className="input" type="number" min="1" aria-label="Quantité" value={l.quantite} onChange={(e) => update(i, 'quantite', e.target.value)} />
          <button className="icon-btn" onClick={() => setLignes((x) => (x.length > 1 ? x.filter((_, j) => j !== i) : x))} aria-label="Retirer ce médicament" disabled={lignes.length === 1}>
            ×
          </button>
        </div>
      ))}
      <button className="btn btn-ghost btn-sm" onClick={() => setLignes((l) => [...l, { ...LIGNE_VIDE }])}>
        + Ajouter un médicament
      </button>
      {!quantiteOk && <p className="field-error">La quantité doit être supérieure à 0.</p>}
      <div className="field" style={{ marginTop: 16 }}>
        <label className="label" htmlFor="ord-instr">
          Instructions
        </label>
        <textarea id="ord-instr" className="textarea" rows={3} placeholder="Conseils, examens complémentaires, prochain contrôle…" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
      </div>
    </Modal>
  );
}

// ───────────────────────── Onglet « Disponibilités » (UC Gérer ses disponibilités) ─────────────────────────
function DisposTab({ user }) {
  const toast = useToast();
  const [slots, setSlots] = useState(null);
  const [form, setForm] = useState({ date: todayISO(), debut: '09:00', fin: '12:00', duree: '30' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .disponibilites(user.id, true)
      .then(setSlots)
      .catch((e) => {
        setSlots([]);
        toast(e.message, 'error');
      });
  }, [user.id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const apercu = useMemo(() => slotsFromRange(form.date, form.debut, form.fin, Number(form.duree)), [form]);

  async function generate() {
    setBusy(true);
    let ok = 0;
    let ignores = 0;
    try {
      for (const c of apercu) {
        try {
          await api.creerDisponibilite(user.id, c);
          ok++;
        } catch (e) {
          if (e.status === 409) ignores++; // chevauche un créneau existant
          else throw e;
        }
      }
      toast(`${ok} créneau${ok > 1 ? 'x' : ''} ajouté${ok > 1 ? 's' : ''}${ignores ? `, ${ignores} déjà existant${ignores > 1 ? 's' : ''}` : ''}.`, ok ? 'ok' : 'info');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
      load();
    }
  }

  async function remove(s) {
    try {
      await api.supprimerDisponibilite(s.id);
      toast('Créneau supprimé.', 'info');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  const jours = useMemo(() => groupByDay(slots || []), [slots]);

  return (
    <>
      <div className="card dispo-form">
        <h3>Ajouter des disponibilités</h3>
        <p className="muted">Indiquez une plage horaire : elle sera découpée en créneaux.</p>
        <div className="dispo-grid">
          <div className="field">
            <label className="label" htmlFor="d-date">
              Date
            </label>
            <input id="d-date" type="date" className="input" min={todayISO()} value={form.date} onChange={set('date')} />
          </div>
          <div className="field">
            <label className="label" htmlFor="d-debut">
              Début
            </label>
            <input id="d-debut" type="time" className="input" value={form.debut} onChange={set('debut')} />
          </div>
          <div className="field">
            <label className="label" htmlFor="d-fin">
              Fin
            </label>
            <input id="d-fin" type="time" className="input" value={form.fin} onChange={set('fin')} />
          </div>
          <div className="field">
            <label className="label" htmlFor="d-duree">
              Durée d’un créneau
            </label>
            <select id="d-duree" className="select" value={form.duree} onChange={set('duree')}>
              {[20, 30, 45, 60].map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" disabled={busy || apercu.length === 0 || !form.date} onClick={generate}>
            {busy ? 'Ajout…' : `Ajouter ${apercu.length} créneau${apercu.length > 1 ? 'x' : ''}`}
          </button>
        </div>
        {apercu.length === 0 && <p className="field-error">La fin doit être postérieure au début d’au moins une durée de créneau.</p>}
      </div>

      {!slots ? (
        <SkeletonRows />
      ) : jours.length === 0 ? (
        <Empty icon="🕒" title="Aucune disponibilité" text="Ajoutez vos premiers créneaux pour que les patients puissent réserver." />
      ) : (
        <div className="list">
          {jours.map(({ date, slots: s }) => (
            <div key={date} className="card dispo-day">
              <div className="dispo-day-head">
                <strong>{formatDateLong(date)}</strong>
                <span className="muted">
                  {s.filter((x) => !x.reserve).length} libre(s) · {s.filter((x) => x.reserve).length} réservé(s)
                </span>
              </div>
              <div className="pill-slots">
                {s.map((x) => (
                  <span key={x.id} className={`pill-slot ${x.reserve ? 'reserve' : 'libre'}`}>
                    {x.heure}–{x.heureFin}
                    {x.reserve ? (
                      <small>réservé</small>
                    ) : (
                      <button onClick={() => remove(x)} aria-label={`Supprimer le créneau de ${x.heure}`}>
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ───────────────────────── Page ─────────────────────────
export default function Medecin({ user }) {
  const toast = useToast();
  const [me, setMe] = useState(null);
  const [date, setDate] = useState(todayISO());
  const [tab, setTab] = useState('agenda');
  const [rdvs, setRdvs] = useState(null);
  const [ords, setOrds] = useState(null);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(null);
  const [prescribe, setPrescribe] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [viewOrd, setViewOrd] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const fail = useCallback((e) => toast(e.message || 'Une erreur est survenue.', 'error'), [toast]);
  const refresh = useCallback(
    () =>
      Promise.all([api.rdvMedecin(user.id).then(setRdvs), api.ordonnancesMedecin(user.id).then(setOrds)]).catch((e) => {
        setRdvs((r) => r || []);
        setOrds((o) => o || []);
        fail(e);
      }),
    [user.id, fail]
  );

  useEffect(() => {
    api
      .medecins()
      .then((l) => setMe(l.find((m) => m.id === user.id) || null))
      .catch(() => {});
    refresh();
  }, [user.id, refresh]);

  // PUT /api/rendezvous/{id} { statut } : EN_ATTENTE -> ACCEPTE / REFUSE / ANNULE -> TERMINE
  async function setStatut(r, statut, msg) {
    setBusyId(r.id);
    try {
      await api.majRdv(r.id, { statut });
      toast(msg, ['REFUSE', 'ANNULE'].includes(statut) ? 'info' : 'ok');
      await refresh();
      return true;
    } catch (e) {
      toast(e.message, 'error');
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function terminer(r) {
    // Règle 7 : l'ordonnance n'est possible qu'une fois la consultation terminée
    if (await setStatut(r, 'TERMINE', 'Consultation terminée ✓')) setPrescribe({ ...r, statut: 'TERMINE' });
  }

  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(todayISO(), i - 3)), []);
  const compte = (d) => (rdvs || []).filter((r) => r.date === d && (isActif(r.statut) || r.statut === 'TERMINE')).length;
  const counts = week.map(compte);
  const max = Math.max(1, ...counts);

  const dayRdvs = useMemo(() => (rdvs || []).filter((r) => r.date === date).sort((a, b) => a.heure.localeCompare(b.heure)), [rdvs, date]);
  const k = kpis(dayRdvs);
  const shown = dayRdvs.filter((r) => !q.trim() || r.patientNom.toLowerCase().includes(q.trim().toLowerCase()));
  const enAttenteTotal = rdvs ? rdvs.filter((r) => r.statut === 'EN_ATTENTE').length : 0;
  const ordByRdv = useMemo(() => Object.fromEntries((ords || []).map((o) => [o.idRdv, o])), [ords]);

  function actions(r) {
    const busy = busyId === r.id;
    const ord = ordByRdv[r.id];
    if (r.statut === 'EN_ATTENTE')
      return (
        <>
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => setStatut(r, 'ACCEPTE', 'Rendez-vous accepté ✓')}>
            Accepter
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setEdit(r)}>
            Modifier
          </button>
          <button className="btn btn-danger btn-sm" onClick={() => setConfirm({ rdv: r, statut: 'REFUSE' })}>
            Refuser
          </button>
        </>
      );
    if (r.statut === 'ACCEPTE')
      return (
        <>
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => terminer(r)}>
            Terminer
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setEdit(r)}>
            Modifier
          </button>
          <button className="btn btn-danger btn-sm" onClick={() => setConfirm({ rdv: r, statut: 'ANNULE' })}>
            Annuler
          </button>
        </>
      );
    if (r.statut === 'TERMINE')
      return ord ? (
        <button className="btn btn-ghost btn-sm" onClick={() => setViewOrd(ord)}>
          Voir l’ordonnance
        </button>
      ) : (
        <button className="btn btn-primary btn-sm" onClick={() => setPrescribe(r)}>
          Créer l’ordonnance
        </button>
      );
    return null;
  }

  const nomAffiche = me?.nomComplet || `Dr ${user.prenom} ${user.nom}`.trim();

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{nomAffiche}</h1>
          <p className="subtitle">
            {me ? `${me.specialite} · ` : ''}
            {enAttenteTotal > 0 ? `${enAttenteTotal} demande${enAttenteTotal > 1 ? 's' : ''} en attente de réponse` : 'Aucune demande en attente'}
          </p>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <span>Consultations</span>
          <strong>{k.total}</strong>
          <small>{date === todayISO() ? 'aujourd’hui' : formatDateShort(date)}</small>
        </div>
        <div className="kpi warn">
          <span>En attente</span>
          <strong>{k.attente}</strong>
          <small>à traiter</small>
        </div>
        <div className="kpi info">
          <span>Acceptés</span>
          <strong>{k.acceptes}</strong>
          <small>à venir</small>
        </div>
        <div className="kpi ok">
          <span>Terminés</span>
          <strong>{k.termines}</strong>
          <small>ce jour</small>
        </div>
      </div>

      <div className="card week-card">
        <div className="week-head">
          <h3>Activité sur 7 jours</h3>
          <span className="muted">Cliquez sur un jour pour afficher son agenda</span>
        </div>
        <div className="week">
          {week.map((d, i) => {
            const p = dayParts(d);
            return (
              <button
                key={d}
                className={`bar-col ${date === d ? 'active' : ''}`}
                onClick={() => {
                  setDate(d);
                  setTab('agenda');
                }}
                aria-label={`${formatDateLong(d)} : ${counts[i]} rendez-vous`}
              >
                <span className="bar-val">{counts[i]}</span>
                <span className="bar-track">
                  <span className="bar" style={{ height: `${(counts[i] / max) * 100}%` }} />
                </span>
                <small>{p.semaine}</small>
                <strong>{p.jour}</strong>
              </button>
            );
          })}
        </div>
      </div>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'agenda'} className={`tab ${tab === 'agenda' ? 'active' : ''}`} onClick={() => setTab('agenda')}>
          Rendez-vous
        </button>
        <button role="tab" aria-selected={tab === 'dispos'} className={`tab ${tab === 'dispos' ? 'active' : ''}`} onClick={() => setTab('dispos')}>
          Disponibilités
        </button>
        <button role="tab" aria-selected={tab === 'ord'} className={`tab ${tab === 'ord' ? 'active' : ''}`} onClick={() => setTab('ord')}>
          Ordonnances émises <span className="tab-count">{ords ? ords.length : '–'}</span>
        </button>
      </div>

      <div className="tab-panel" key={tab}>
        {tab === 'agenda' && (
          <>
            <div className="toolbar">
              <div className="day-nav">
                <button className="icon-btn" onClick={() => setDate(addDays(date, -1))} aria-label="Jour précédent">
                  ‹
                </button>
                <strong>{formatDateLong(date)}</strong>
                <button className="icon-btn" onClick={() => setDate(addDays(date, 1))} aria-label="Jour suivant">
                  ›
                </button>
                {date !== todayISO() && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setDate(todayISO())}>
                    Aujourd’hui
                  </button>
                )}
              </div>
              <div className="search">
                <span aria-hidden="true">🔍</span>
                <input className="input" placeholder="Rechercher un patient…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un patient" />
              </div>
            </div>

            {!rdvs ? (
              <SkeletonRows />
            ) : shown.length === 0 ? (
              <Empty icon="🗓" title="Aucun rendez-vous" text={q ? 'Aucun patient ne correspond à cette recherche.' : 'Aucune consultation prévue ce jour-là.'} />
            ) : (
              <div className="list">
                {shown.map((r) => (
                  <div key={r.id} className={`card appt ${r.statut.toLowerCase()}`}>
                    <div className="appt-time">{r.heure}</div>
                    <div className="rdv-body">
                      <h3>{r.patientNom}</h3>
                      <p className="muted">{r.motif || 'Sans motif précisé'}</p>
                    </div>
                    <div className="rdv-side">
                      <StatusBadge statut={r.statut} />
                      <div className="rdv-actions">{actions(r)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'dispos' && <DisposTab user={user} />}

        {tab === 'ord' &&
          (!ords ? (
            <SkeletonRows />
          ) : ords.length === 0 ? (
            <Empty icon="💊" title="Aucune ordonnance" text="Les ordonnances que vous émettez apparaîtront ici." />
          ) : (
            <div className="list">
              {[...ords]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((o) => (
                  <div key={o.id} className="card rdv-card">
                    <div className="rdv-date ord">
                      <span aria-hidden="true">💊</span>
                    </div>
                    <div className="rdv-body">
                      <h3>{o.patientNom}</h3>
                      <span className="doc-spec">{formatDateShort(o.date)}</span>
                      <p className="muted">{o.lignes.map((l) => l.medicament).join(', ')}</p>
                    </div>
                    <div className="rdv-side">
                      <button className="btn btn-ghost btn-sm" onClick={() => setViewOrd(o)}>
                        Consulter
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          ))}
      </div>

      {edit && <EditModal rdv={edit} user={user} onClose={() => setEdit(null)} onSaved={refresh} />}
      {prescribe && <PrescribeModal rdv={prescribe} onClose={() => setPrescribe(null)} onSaved={refresh} />}
      {viewOrd && <OrdonnanceModal ord={viewOrd} onClose={() => setViewOrd(null)} />}
      {confirm && (
        <ConfirmModal
          title={confirm.statut === 'REFUSE' ? 'Refuser cette demande ?' : 'Annuler ce rendez-vous ?'}
          message={`Le rendez-vous de ${confirm.rdv.patientNom} le ${formatDateLong(confirm.rdv.date)} à ${confirm.rdv.heure} sera ${
            confirm.statut === 'REFUSE' ? 'refusé' : 'annulé'
          } et le créneau redeviendra disponible.`}
          confirmLabel={confirm.statut === 'REFUSE' ? 'Oui, refuser' : 'Oui, annuler'}
          danger
          busy={busyId === confirm.rdv.id}
          onConfirm={async () => {
            await setStatut(confirm.rdv, confirm.statut, confirm.statut === 'REFUSE' ? 'Demande refusée.' : 'Rendez-vous annulé.');
            setConfirm(null);
          }}
          onClose={() => setConfirm(null)}
        />
      )}
    </>
  );
}
