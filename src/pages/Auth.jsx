import { useState } from 'react';
import { api } from '../api.js';
import { DEMO_PASSWORD, demoEmail } from '../demoBackend.js';
import { useToast } from '../components/ui.jsx';
import { isValidEmail, passwordStrength, todayISO } from '../utils.js';

const ROLE_PAGE = { PATIENT: 'patient', MEDECIN: 'medecin' };

function AuthSide({ title, text }) {
  return (
    <aside className="auth-side">
      <img className="brand-logo big" src="/logo.svg" alt="" width="56" height="56" />
      <h2>{title}</h2>
      <p>{text}</p>
      <ul>
        <li>Trouvez un médecin par spécialité</li>
        <li>Réservez un créneau en quelques clics</li>
        <li>Retrouvez vos ordonnances en ligne</li>
      </ul>
    </aside>
  );
}

function PasswordField({ id, label, value, onChange, autoComplete, invalid }) {
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="pwd">
        <input
          id={id}
          className={`input ${invalid ? 'invalid' : ''}`}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
        />
        <button type="button" className="pwd-toggle" onClick={() => setShow((s) => !s)} aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
          {show ? '🙈' : '👁'}
        </button>
      </div>
    </div>
  );
}

// ───────────────────────── Connexion (UC « S'authentifier ») ─────────────────────────
export function Login({ demo, go, prefillEmail = '' }) {
  const toast = useToast();
  const [email, setEmail] = useState(prefillEmail);
  const [pwd, setPwd] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!isValidEmail(email)) return setError('Saisissez une adresse email valide.');
    if (!pwd) return setError('Saisissez votre mot de passe.');
    setBusy(true);
    try {
      const user = await api.login(email.trim(), pwd);
      if (!ROLE_PAGE[user.role]) throw new Error('Profil utilisateur non reconnu (rôle PATIENT ou MEDECIN attendu).');
      toast(`Bienvenue ${user.prenom || ''} 👋`.trim());
      go(ROLE_PAGE[user.role]);
    } catch (err) {
      setError(err.status === 401 ? 'Identifiants incorrects.' : err.message);
    } finally {
      setBusy(false);
    }
  }

  const fill = (prenom, nom) => {
    setEmail(demoEmail(prenom, nom));
    setPwd(DEMO_PASSWORD);
    setError('');
  };

  return (
    <div className="auth-wrap">
      <AuthSide title="Content de vous revoir" text="Connectez-vous pour accéder à votre espace patient ou à votre tableau de bord médecin." />
      <form className="card auth-card" onSubmit={submit} noValidate>
        <h1>Connexion</h1>
        <p className="muted">Accédez à votre espace e-Santé.</p>
        {error && (
          <div className="err" role="alert">
            {error}
          </div>
        )}
        <div className="field">
          <label className="label" htmlFor="login-email">
            Email
          </label>
          <input id="login-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoFocus />
        </div>
        <PasswordField id="login-pwd" label="Mot de passe" value={pwd} onChange={setPwd} autoComplete="current-password" />
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? 'Connexion…' : 'Se connecter'}
        </button>
        <p className="auth-alt">
          Pas encore de compte ? <a href="#/inscription">Créer un compte patient</a>
        </p>
        {demo && (
          <div className="demo-box">
            <strong>Comptes de démonstration</strong>
            <span className="muted">Mot de passe : {DEMO_PASSWORD}</span>
            <div className="demo-btns">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => fill('Awa', 'Diop')}>
                Patient : Awa Diop
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => fill('Cheikh', 'Fall')}>
                Médecin : Dr Cheikh Fall
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

// ───────────────────────── Inscription (UC « S'inscrire », patient) ─────────────────────────
export function Register({ onRegistered }) {
  const toast = useToast();
  const [f, setF] = useState({ prenom: '', nom: '', email: '', telephone: '', date_naissance: '', adresse: '', mot_de_passe: '', confirmation: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: typeof v === 'string' ? v : v.target.value }));
  const strength = passwordStrength(f.mot_de_passe);

  function validate() {
    const e = {};
    if (!f.prenom.trim()) e.prenom = 'Prénom obligatoire';
    if (!f.nom.trim()) e.nom = 'Nom obligatoire';
    if (!isValidEmail(f.email)) e.email = 'Email invalide';
    if (f.telephone && !/^[+\d][\d\s.-]{6,19}$/.test(f.telephone.trim())) e.telephone = 'Numéro invalide';
    if (f.date_naissance && f.date_naissance > todayISO()) e.date_naissance = 'Date dans le futur';
    if (f.mot_de_passe.length < 8) e.mot_de_passe = '8 caractères minimum';
    if (f.confirmation !== f.mot_de_passe) e.confirmation = 'Les mots de passe diffèrent';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(ev) {
    ev.preventDefault();
    setServerError('');
    if (!validate()) return;
    setBusy(true);
    try {
      await api.register({
        prenom: f.prenom.trim(),
        nom: f.nom.trim(),
        email: f.email.trim().toLowerCase(),
        telephone: f.telephone.trim(),
        date_naissance: f.date_naissance || null,
        adresse: f.adresse.trim(),
        mot_de_passe: f.mot_de_passe,
      });
      toast('Compte créé, veuillez vous connecter.');
      onRegistered(f.email.trim().toLowerCase());
    } catch (err) {
      setServerError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const field = (k, label, props = {}) => (
    <div className={`field ${props.full ? 'full' : ''}`}>
      <label className="label" htmlFor={`reg-${k}`}>
        {label}
      </label>
      <input id={`reg-${k}`} className={`input ${errors[k] ? 'invalid' : ''}`} value={f[k]} onChange={set(k)} {...props} full={undefined} />
      {errors[k] && <small className="field-error">{errors[k]}</small>}
    </div>
  );

  return (
    <div className="auth-wrap">
      <AuthSide title="Créez votre compte patient" text="Un compte gratuit pour réserver vos consultations et suivre vos ordonnances." />
      <form className="card auth-card" onSubmit={submit} noValidate>
        <h1>Inscription</h1>
        <p className="muted">Les champs marqués d’un * sont obligatoires.</p>
        {serverError && (
          <div className="err" role="alert">
            {serverError}
          </div>
        )}
        <div className="form-grid">
          {field('prenom', 'Prénom *', { autoComplete: 'given-name' })}
          {field('nom', 'Nom *', { autoComplete: 'family-name' })}
          {field('email', 'Email *', { type: 'email', autoComplete: 'email', full: true })}
          {field('telephone', 'Téléphone', { type: 'tel', autoComplete: 'tel', placeholder: '+221 77 000 00 00' })}
          {field('date_naissance', 'Date de naissance', { type: 'date', max: todayISO() })}
          {field('adresse', 'Adresse', { autoComplete: 'street-address', full: true })}
        </div>
        <PasswordField id="reg-pwd" label="Mot de passe *" value={f.mot_de_passe} onChange={set('mot_de_passe')} autoComplete="new-password" invalid={errors.mot_de_passe} />
        <div className={`meter m${strength}`} aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        {errors.mot_de_passe && <small className="field-error">{errors.mot_de_passe}</small>}
        <PasswordField id="reg-confirm" label="Confirmer le mot de passe *" value={f.confirmation} onChange={set('confirmation')} autoComplete="new-password" invalid={errors.confirmation} />
        {errors.confirmation && <small className="field-error">{errors.confirmation}</small>}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? 'Création…' : 'Créer mon compte'}
        </button>
        <p className="auth-alt">
          Déjà inscrit ? <a href="#/connexion">Se connecter</a>
        </p>
      </form>
    </div>
  );
}
