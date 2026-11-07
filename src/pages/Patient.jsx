import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { Avatar, Empty, Modal, SkeletonCards, SkeletonRows, StatusBadge, useToast } from '../components/ui.jsx';
import OrdonnanceModal from '../components/OrdonnanceModal.jsx';
import { dayParts, formatDateLong, formatDateShort, formatPrix, groupByDay, isActif, parseDT, searchSortMedecins } from '../utils.js';

const MOTIFS = ['Consultation générale', 'Suivi de traitement', 'Renouvellement d’ordonnance', 'Premier avis', 'Fièvre ou douleur'];

// ───────────────────────── Onglet « Médecins » (UC Lister / Filtrer) ─────────────────────────
function DoctorsTab({ onBook }) {
  const toast = useToast();
  const [specialites, setSpecialites] = useState([]);
  const [specialite, setSpecialite] = useState('Toutes');
  const [medecins, setMedecins] = useState(null);
  const [q, setQ] = useState('');
  const [tri, setTri] = useState('nom');

  // Le filtre par spécialité est appliqué par le serveur : GET /api/medecins?specialite=...
  useEffect(() => {
    let annule = false;
    setMedecins(null);
    api
      .medecins(specialite === 'Toutes' ? undefined : specialite)
      .then((l) => {
        if (annule) return;
        setMedecins(l);
        if (specialite === 'Toutes') setSpecialites([...new Set(l.map((m) => m.specialite))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'fr')));
      })
      .catch((e) => {
        if (!annule) {
          setMedecins([]);
          toast(e.message, 'error');
        }
      });
    return () => {
      annule = true;
    };
  }, [specialite, toast]);

  const list = useMemo(() => (medecins ? searchSortMedecins(medecins, { q, tri }) : []), [medecins, q, tri]);

  return (
    <>
      <div className="toolbar">
        <div className="search">
          <span aria-hidden="true">🔍</span>
          <input className="input" placeholder="Rechercher un médecin…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un médecin" />
          {q && (
            <button className="clear" onClick={() => setQ('')} aria-label="Effacer la recherche">
              ×
            </button>
          )}
        </div>
        <select className="select" value={tri} onChange={(e) => setTri(e.target.value)} aria-label="Trier par">
          <option value="nom">Ordre alphabétique</option>
          <option value="tarif">Prix croissant</option>
          <option value="tarifDesc">Prix décroissant</option>
        </select>
      </div>

      <div className="chips" role="group" aria-label="Filtrer par spécialité">
        {['Toutes', ...specialites].map((s) => (
          <button key={s} className={`chip ${specialite === s ? 'active' : ''}`} onClick={() => setSpecialite(s)}>
            {s === 'Toutes' ? 'Toutes les spécialités' : s}
          </button>
        ))}
      </div>

      <p className="result-count" aria-live="polite">
        {medecins ? `${list.length} médecin${list.length > 1 ? 's' : ''} trouvé${list.length > 1 ? 's' : ''}` : 'Chargement…'}
      </p>

      {!medecins ? (
        <SkeletonCards n={6} />
      ) : list.length === 0 ? (
        <Empty
          icon="🩺"
          title="Aucun médecin disponible"
          text="Aucun médecin ne correspond à votre recherche."
          action={
            <button
              className="btn btn-ghost"
              onClick={() => {
                setQ('');
                setSpecialite('Toutes');
              }}
            >
              Réinitialiser les filtres
            </button>
          }
        />
      ) : (
        <div className="grid">
          {list.map((m) => (
            <article key={m.id} className="card doc-card">
              <div className="doc-top">
                <Avatar nom={m.nomComplet} id={m.id} size={56} />
                <div>
                  <h3>{m.nomComplet}</h3>
                  <span className="doc-spec">{m.specialite}</span>
                </div>
              </div>
              <p className="doc-bio">{m.biographie || 'Aucune présentation renseignée.'}</p>
              {m.numeroOrdre && (
                <div className="tags">
                  <span className="tag">N° d’ordre {m.numeroOrdre}</span>
                </div>
              )}
              <div className="doc-foot">
                <span className="price">{formatPrix(m.tarif)}</span>
                <button className="btn btn-primary" onClick={() => onBook(m)}>
                  Disponibilités
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

// ───────────────────────── Réservation (UC Consulter les disponibilités + Réserver) ─────────────────────────
function BookingModal({ medecin, onClose, onDone, onGoRdv }) {
  const [slots, setSlots] = useState(null);
  const [date, setDate] = useState(null);
  const [creneau, setCreneau] = useState(null);
  const [step, setStep] = useState(1);
  const [motif, setMotif] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadSlots = useCallback(() => {
    setSlots(null);
    setCreneau(null);
    api
      .disponibilites(medecin.id)
      .then((l) => {
        const now = new Date();
        const libres = l.filter((s) => !s.reserve && parseDT(s.debut) > now); // défense : jamais de créneau réservé ou passé
        setSlots(libres);
        const jours = groupByDay(libres);
        setDate((d) => (jours.some((j) => j.date === d) ? d : jours[0]?.date ?? null));
      })
      .catch((e) => {
        setSlots([]);
        setError(e.message);
      });
  }, [medecin.id]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const jours = useMemo(() => groupByDay(slots || []), [slots]);
  const duJour = jours.find((j) => j.date === date)?.slots || [];

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await api.reserver({ id_medecin: medecin.id, id_creneau: creneau.id, motif: motif.trim() });
      setStep(3);
      onDone();
    } catch (e) {
      setError(e.status === 409 ? e.message || 'Créneau indisponible, veuillez en choisir un autre.' : e.message);
      if (e.status === 409) {
        setStep(1);
        loadSlots(); // le créneau vient d'être pris : on recharge les créneaux libres
      }
    } finally {
      setBusy(false);
    }
  }

  const labels = ['Créneau', 'Motif', 'Confirmation'];
  const footer =
    step === 1 ? (
      <>
        <button className="btn btn-ghost" onClick={onClose}>
          Annuler
        </button>
        <button className="btn btn-primary" disabled={!creneau} onClick={() => setStep(2)}>
          Continuer
        </button>
      </>
    ) : step === 2 ? (
      <>
        <button className="btn btn-ghost" onClick={() => setStep(1)}>
          Retour
        </button>
        <button className="btn btn-primary" disabled={busy || motif.trim().length < 3} onClick={submit}>
          {busy ? 'Réservation…' : 'Confirmer la réservation'}
        </button>
      </>
    ) : (
      <>
        <button className="btn btn-ghost" onClick={onClose}>
          Fermer
        </button>
        <button className="btn btn-primary" onClick={onGoRdv}>
          Voir mes rendez-vous
        </button>
      </>
    );

  return (
    <Modal title={`Réserver avec ${medecin.nomComplet}`} onClose={onClose} footer={footer} wide>
      <ol className="stepper">
        {labels.map((l, i) => (
          <li key={l} className={`stepper-item ${step === i + 1 ? 'active' : ''} ${step > i + 1 ? 'done' : ''}`}>
            <span>{step > i + 1 ? '✓' : i + 1}</span>
            {l}
          </li>
        ))}
      </ol>

      {error && (
        <div className="err" role="alert">
          {error}
        </div>
      )}

      {step === 1 &&
        (!slots ? (
          <div className="slots" aria-busy="true">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="skeleton" style={{ height: 40 }} />
            ))}
          </div>
        ) : jours.length === 0 ? (
          <Empty icon="🕒" title="Aucun créneau libre" text="Ce médecin n’a pas de disponibilité pour le moment. Revenez plus tard ou choisissez un autre médecin." />
        ) : (
          <>
            <span className="label">Choisissez un jour</span>
            <div className="day-strip">
              {jours.map(({ date: d, slots: s }) => {
                const p = dayParts(d);
                return (
                  <button
                    key={d}
                    className={`day ${date === d ? 'active' : ''}`}
                    onClick={() => {
                      setDate(d);
                      setCreneau(null);
                    }}
                    title={`${formatDateLong(d)} : ${s.length} créneau${s.length > 1 ? 'x' : ''} libre${s.length > 1 ? 's' : ''}`}
                  >
                    <small>{p.semaine}</small>
                    <strong>{p.jour}</strong>
                    <small>{p.mois}</small>
                  </button>
                );
              })}
            </div>
            <span className="label">Créneaux libres le {formatDateShort(date)}</span>
            <div className="slots">
              {duJour.map((s) => (
                <button key={s.id} className={`slot ${creneau?.id === s.id ? 'active' : ''}`} onClick={() => setCreneau(s)}>
                  {s.heure}
                </button>
              ))}
            </div>
          </>
        ))}

      {step === 2 && creneau && (
        <>
          <div className="recap">
            <div>
              <span className="label">Médecin</span>
              <strong>{medecin.nomComplet}</strong>
              <div className="muted">{medecin.specialite}</div>
            </div>
            <div>
              <span className="label">Date et heure</span>
              <strong>{formatDateShort(creneau.date)}</strong>
              <div className="muted">
                {creneau.heure} – {creneau.heureFin}
              </div>
            </div>
            <div>
              <span className="label">Tarif</span>
              <strong>{formatPrix(medecin.tarif)}</strong>
            </div>
          </div>
          <span className="label">Motif de la consultation</span>
          <div className="chips">
            {MOTIFS.map((m) => (
              <button key={m} className={`chip ${motif === m ? 'active' : ''}`} onClick={() => setMotif(m)}>
                {m}
              </button>
            ))}
          </div>
          <textarea
            className="textarea"
            rows={4}
            maxLength={255}
            placeholder="Décrivez brièvement votre motif (symptômes, durée…)"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            aria-label="Motif de la consultation"
          />
          <div className="muted counter">{motif.length}/255</div>
        </>
      )}

      {step === 3 && creneau && (
        <div className="success">
          <svg className="check-anim" viewBox="0 0 52 52" aria-hidden="true">
            <circle cx="26" cy="26" r="24" fill="none" />
            <path fill="none" d="M14 27l8 8 16-17" />
          </svg>
          <h3>Réservation confirmée !</h3>
          <p>
            Votre rendez-vous avec <strong>{medecin.nomComplet}</strong> le <strong>{formatDateLong(creneau.date)}</strong> à <strong>{creneau.heure}</strong> est en attente d’acceptation par le médecin.
          </p>
        </div>
      )}
    </Modal>
  );
}

// ───────────────────────── Onglet « Mes rendez-vous » (UC Consulter l'historique) ─────────────────────────
function RdvTab({ rdvs, ords, onViewOrd }) {
  const [filter, setFilter] = useState('tous');

  const FILTERS = [
    ['tous', 'Tous', () => true],
    ['avenir', 'À venir', (r) => isActif(r.statut)],
    ['termine', 'Terminés', (r) => r.statut === 'TERMINE'],
    ['annule', 'Annulés / refusés', (r) => ['ANNULE', 'REFUSE'].includes(r.statut)],
  ];
  const active = FILTERS.find((x) => x[0] === filter);
  const shown = useMemo(
    () => (rdvs ? rdvs.filter(active[2]).sort((a, b) => b.dateHeure.localeCompare(a.dateHeure)) : null),
    [rdvs, active]
  );

  return (
    <>
      <div className="pills">
        {FILTERS.map(([k, label, fn]) => (
          <button key={k} className={`chip ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>
            {label} <span className="tab-count">{rdvs ? rdvs.filter(fn).length : '–'}</span>
          </button>
        ))}
      </div>

      {!shown ? (
        <SkeletonRows />
      ) : shown.length === 0 ? (
        <Empty icon="📅" title="Aucun rendez-vous" text="Vos rendez-vous apparaîtront ici." />
      ) : (
        <div className="list">
          {shown.map((r) => {
            const p = dayParts(r.date);
            const ord = ords?.find((o) => o.idRdv === r.id);
            return (
              <div key={r.id} className="card rdv-card">
                <div className="rdv-date">
                  <small>{p.mois}</small>
                  <strong>{p.jour}</strong>
                  <small>{r.heure}</small>
                </div>
                <div className="rdv-body">
                  <h3>{r.medecinNom}</h3>
                  <span className="doc-spec">{r.specialite}</span>
                  <p className="muted">{r.motif || 'Sans motif précisé'}</p>
                </div>
                <div className="rdv-side">
                  <StatusBadge statut={r.statut} />
                  {ord && (
                    <button className="btn btn-ghost btn-sm" onClick={() => onViewOrd(ord)}>
                      Voir l’ordonnance
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ───────────────────────── Onglet « Mes ordonnances » ─────────────────────────
function OrdTab({ ords, onView }) {
  if (!ords) return <SkeletonRows />;
  if (ords.length === 0) return <Empty icon="💊" title="Aucune ordonnance" text="Vos ordonnances apparaîtront ici après vos consultations." />;
  return (
    <div className="list">
      {[...ords]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((o) => (
          <div key={o.id} className="card rdv-card">
            <div className="rdv-date ord">
              <span aria-hidden="true">💊</span>
            </div>
            <div className="rdv-body">
              <h3>Ordonnance du {formatDateShort(o.date)}</h3>
              <span className="doc-spec">
                {o.medecinNom} · {o.specialite}
              </span>
              <p className="muted">{o.lignes.map((l) => l.medicament).join(', ')}</p>
            </div>
            <div className="rdv-side">
              <button className="btn btn-primary btn-sm" onClick={() => onView(o)}>
                Consulter
              </button>
            </div>
          </div>
        ))}
    </div>
  );
}

// ───────────────────────── Page ─────────────────────────
export default function Patient({ user }) {
  const toast = useToast();
  const [tab, setTab] = useState('medecins');
  const [rdvs, setRdvs] = useState(null);
  const [ords, setOrds] = useState(null);
  const [booking, setBooking] = useState(null);
  const [viewOrd, setViewOrd] = useState(null);

  const fail = useCallback((e) => toast(e.message || 'Une erreur est survenue.', 'error'), [toast]);
  const refresh = useCallback(() => {
    api.rdvPatient(user.id).then(setRdvs).catch((e) => (setRdvs([]), fail(e)));
    api.ordonnancesPatient(user.id).then(setOrds).catch((e) => (setOrds([]), fail(e)));
  }, [user.id, fail]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const prochain = useMemo(() => {
    if (!rdvs) return null;
    const now = new Date();
    return (
      rdvs
        .filter((r) => isActif(r.statut) && r.dateHeure && parseDT(r.dateHeure) >= now)
        .sort((a, b) => a.dateHeure.localeCompare(b.dateHeure))[0] || null
    );
  }, [rdvs]);

  const aVenir = rdvs ? rdvs.filter((r) => isActif(r.statut)).length : '–';

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Bonjour, {user.prenom || 'cher patient'} 👋</h1>
          <p className="subtitle">Trouvez un médecin et suivez vos rendez-vous.</p>
        </div>
      </div>

      {prochain && (
        <div className="next-banner">
          <span aria-hidden="true">⏰</span>
          <div>
            <strong>Prochain rendez-vous</strong> : {formatDateLong(prochain.date)} à {prochain.heure} avec {prochain.medecinNom}{' '}
            {prochain.statut === 'EN_ATTENTE' && '(en attente d’acceptation)'}
          </div>
          <button className="btn btn-light btn-sm" onClick={() => setTab('rdv')}>
            Détails
          </button>
        </div>
      )}

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'medecins'} className={`tab ${tab === 'medecins' ? 'active' : ''}`} onClick={() => setTab('medecins')}>
          Médecins
        </button>
        <button role="tab" aria-selected={tab === 'rdv'} className={`tab ${tab === 'rdv' ? 'active' : ''}`} onClick={() => setTab('rdv')}>
          Mes rendez-vous <span className="tab-count">{aVenir}</span>
        </button>
        <button role="tab" aria-selected={tab === 'ord'} className={`tab ${tab === 'ord' ? 'active' : ''}`} onClick={() => setTab('ord')}>
          Mes ordonnances <span className="tab-count">{ords ? ords.length : '–'}</span>
        </button>
      </div>

      <div className="tab-panel" key={tab}>
        {tab === 'medecins' && <DoctorsTab onBook={setBooking} />}
        {tab === 'rdv' && <RdvTab rdvs={rdvs} ords={ords} onViewOrd={setViewOrd} />}
        {tab === 'ord' && <OrdTab ords={ords} onView={setViewOrd} />}
      </div>

      {booking && (
        <BookingModal
          medecin={booking}
          onClose={() => setBooking(null)}
          onDone={() => {
            refresh();
            toast('Réservation enregistrée ✓');
          }}
          onGoRdv={() => {
            setBooking(null);
            setTab('rdv');
          }}
        />
      )}
      {viewOrd && <OrdonnanceModal ord={viewOrd} onClose={() => setViewOrd(null)} />}
    </>
  );
}
