import { useEffect, useState } from 'react';
import { api } from '../api.js';

function useCountUp(target, ms = 1100) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf;
    let start;
    const step = (ts) => {
      if (start === undefined) start = ts;
      const p = Math.min((ts - start) / ms, 1);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function Stat({ value, label }) {
  const v = useCountUp(value);
  return (
    <div className="stat">
      <strong>{v}</strong>
      <span>{label}</span>
    </div>
  );
}

const FEATURES = [
  { icon: '🔎', titre: 'Trouver le bon médecin', texte: 'Listez les médecins disponibles et filtrez-les par spécialité.' },
  { icon: '📅', titre: 'Réserver en 3 clics', texte: 'Choisissez un jour, un créneau libre, indiquez votre motif : la demande part au médecin.' },
  { icon: '🗂', titre: 'Historique centralisé', texte: 'Retrouvez tous vos rendez-vous et leur statut au même endroit.' },
  { icon: '💊', titre: 'Ordonnances numériques', texte: 'Consultez et imprimez vos ordonnances sans papier à conserver.' },
  { icon: '📊', titre: 'Tableau de bord médecin', texte: 'Consultations du jour, acceptation, report ou annulation des rendez-vous.' },
  { icon: '🕒', titre: 'Disponibilités maîtrisées', texte: 'Le médecin publie ses créneaux : un créneau réservé ne peut jamais l’être deux fois.' },
];

const ETAPES = [
  { n: 1, titre: 'Recherchez', texte: 'Choisissez une spécialité et consultez les médecins disponibles.' },
  { n: 2, titre: 'Réservez', texte: 'Sélectionnez un créneau libre, le médecin accepte la demande.' },
  { n: 3, titre: 'Consultez', texte: 'Recevez votre ordonnance numérique après la consultation.' },
];

export default function Accueil({ user, go }) {
  const [stats, setStats] = useState({ medecins: 0, specialites: 0 });

  useEffect(() => {
    api
      .medecins()
      .then((l) => setStats({ medecins: l.length, specialites: new Set(l.map((m) => m.specialite)).size }))
      .catch(() => {});
  }, []);

  const espace = user ? (user.role === 'MEDECIN' ? 'medecin' : 'patient') : null;

  return (
    <>
      <section className="hero">
        <div className="hero-text">
          <span className="eyebrow">🇸🇳 La santé connectée au Sénégal</span>
          <h1>
            Consultez un médecin, <span className="grad">sans faire la queue.</span>
          </h1>
          <p className="lead">
            e-Santé Sénégal digitalise le parcours de soin : trouvez un professionnel, réservez votre rendez-vous et retrouvez vos ordonnances en ligne.
          </p>
          <div className="cta-row">
            {espace ? (
              <button className="btn btn-primary btn-lg" onClick={() => go(espace)}>
                Accéder à mon espace
              </button>
            ) : (
              <>
                <button className="btn btn-primary btn-lg" onClick={() => go('inscription')}>
                  Créer un compte patient
                </button>
                <button className="btn btn-ghost btn-lg" onClick={() => go('connexion')}>
                  Se connecter
                </button>
              </>
            )}
          </div>
          <div className="stats">
            <Stat value={stats.medecins} label="médecins" />
            <Stat value={stats.specialites} label="spécialités" />
          </div>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="float-card fc-1">
            <div className="fc-dot ok" />
            <div>
              <strong>Rendez-vous accepté</strong>
              <span>Dr Cheikh Fall · 11:00</span>
            </div>
          </div>
          <div className="float-card fc-2">
            <div className="fc-icon">💊</div>
            <div>
              <strong>Ordonnance disponible</strong>
              <span>Prête à imprimer</span>
            </div>
          </div>
          <div className="float-card fc-3">
            <div className="fc-icon">📅</div>
            <div>
              <strong>Créneau réservé</strong>
              <span>En attente de confirmation</span>
            </div>
          </div>
          <div className="hero-orb" />
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Tout pour simplifier le parcours de soin</h2>
        <div className="features">
          {FEATURES.map((f) => (
            <div className="feature" key={f.titre}>
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.titre}</h3>
              <p>{f.texte}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Comment ça marche ?</h2>
        <div className="steps">
          {ETAPES.map((e) => (
            <div className="step" key={e.n}>
              <span className="step-n">{e.n}</span>
              <h3>{e.titre}</h3>
              <p>{e.texte}</p>
            </div>
          ))}
        </div>
      </section>

      {!user && (
        <section className="cta-band">
          <div>
            <h2>Prêt à essayer ?</h2>
            <p>Créez un compte patient en moins d’une minute.</p>
          </div>
          <div className="cta-row">
            <button className="btn btn-light" onClick={() => go('inscription')}>
              S’inscrire
            </button>
            <button className="btn btn-outline-light" onClick={() => go('connexion')}>
              Se connecter
            </button>
          </div>
        </section>
      )}
    </>
  );
}
