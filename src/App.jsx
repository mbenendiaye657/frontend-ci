import { useEffect, useState } from 'react';
import { checkHealth, getUser, isDemo, logout, onModeChange, onSession } from './api.js';
import { Avatar, ToastProvider } from './components/ui.jsx';
import Accueil from './pages/Accueil.jsx';
import { Login, Register } from './pages/Auth.jsx';
import Patient from './pages/Patient.jsx';
import Medecin from './pages/Medecin.jsx';

const PAGES = ['accueil', 'connexion', 'inscription', 'patient', 'medecin'];
const ROLE_PAGE = { PATIENT: 'patient', MEDECIN: 'medecin' };
const hashPage = () => {
  const h = window.location.hash.replace('#/', '').replace('#', '');
  return PAGES.includes(h) ? h : 'accueil';
};
const go = (p) => {
  window.location.hash = `#/${p}`;
};

function initialTheme() {
  try {
    const s = localStorage.getItem('esante_theme');
    if (s) return s;
  } catch {
    /* ignore */
  }
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Pages réservées : l'espace patient au rôle PATIENT, l'espace médecin au rôle MEDECIN (UC « S'authentifier »)
function allowed(page, user) {
  if (page === 'patient') return user?.role === 'PATIENT';
  if (page === 'medecin') return user?.role === 'MEDECIN';
  return true;
}

export default function App() {
  const [page, setPage] = useState(hashPage);
  const [theme, setTheme] = useState(initialTheme);
  const [demo, setDemo] = useState(isDemo());
  const [user, setUser] = useState(getUser);
  const [prefill, setPrefill] = useState('');

  useEffect(() => {
    const onHash = () => {
      setPage(hashPage());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('esante_theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => onModeChange(setDemo), []);
  useEffect(() => onSession(setUser), []);

  // Vérifie périodiquement que l'API répond
  useEffect(() => {
    checkHealth();
    const t = setInterval(checkHealth, 30000);
    return () => clearInterval(t);
  }, []);

  // Redirections : page protégée sans bon rôle -> connexion ; déjà connecté -> son espace
  useEffect(() => {
    if (!allowed(page, user)) go('connexion');
    else if (user && (page === 'connexion' || page === 'inscription')) go(ROLE_PAGE[user.role] || 'accueil');
  }, [page, user]);

  const visible = allowed(page, user) && !(user && (page === 'connexion' || page === 'inscription'));
  const nomUser = user ? `${user.role === 'MEDECIN' ? 'Dr ' : ''}${user.prenom} ${user.nom}`.trim() : '';
  const espace = user && ROLE_PAGE[user.role];

  return (
    <ToastProvider>
      <div className="app">
        <header className="navbar">
          <div className="nav-inner">
            <a className="brand" href="#/accueil" aria-label="e-Santé Sénégal, accueil">
              <img className="brand-logo" src="/logo.svg" alt="" width="38" height="38" />
              <span>
                e-Santé <b>Sénégal</b>
              </span>
            </a>
            <nav className="nav-links" aria-label="Navigation principale">
              <a href="#/accueil" className={`nav-link ${page === 'accueil' ? 'active' : ''}`}>
                Accueil
              </a>
              {espace && (
                <a href={`#/${espace}`} className={`nav-link ${page === espace ? 'active' : ''}`}>
                  {user.role === 'MEDECIN' ? 'Espace médecin' : 'Espace patient'}
                </a>
              )}
              {!user && (
                <>
                  <a href="#/connexion" className={`nav-link ${page === 'connexion' ? 'active' : ''}`}>
                    Connexion
                  </a>
                  <a href="#/inscription" className={`nav-link nav-cta ${page === 'inscription' ? 'active' : ''}`}>
                    S’inscrire
                  </a>
                </>
              )}
            </nav>
            {user && (
              <div className="user-chip" title={user.email}>
                <Avatar nom={nomUser} id={user.id} size={30} />
                <span className="user-name">{nomUser}</span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    logout();
                    go('accueil');
                  }}
                >
                  Déconnexion
                </button>
              </div>
            )}
            <button
              className="icon-btn theme-btn"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              aria-label={theme === 'dark' ? 'Activer le thème clair' : 'Activer le thème sombre'}
              title="Changer de thème"
            >
              {theme === 'dark' ? '☀' : '☾'}
            </button>
          </div>
        </header>

        {demo && (
          <div className="demo-banner" role="status">
            Mode démonstration : l’API est injoignable, les données sont enregistrées localement dans votre navigateur.
          </div>
        )}

        <main className="container page-enter" key={page}>
          {visible && page === 'accueil' && <Accueil user={user} go={go} />}
          {visible && page === 'connexion' && <Login demo={demo} go={go} prefillEmail={prefill} />}
          {visible && page === 'inscription' && (
            <Register
              onRegistered={(email) => {
                setPrefill(email);
                go('connexion');
              }}
            />
          )}
          {visible && page === 'patient' && <Patient user={user} />}
          {visible && page === 'medecin' && <Medecin user={user} />}
        </main>

        <footer className="footer">
          <span>Projet DevOps · Master 2 SI-SR · UADB</span>
          <span className="status">
            <span className={`dot ${demo ? 'dot-warn' : 'dot-ok'}`} />
            {demo ? 'Mode démo (API indisponible)' : 'API connectée'}
          </span>
        </footer>
      </div>
    </ToastProvider>
  );
}
