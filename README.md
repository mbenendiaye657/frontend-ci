# frontend-ci : e-Santé Sénégal (interface React)

Interface web de la plateforme de téléconsultation **e-Santé Sénégal**, conforme au document de modélisation UML (cas d'utilisation, classes, séquences, MCD/MLD).

| Dépôt | Rôle |
|---|---|
| `backend-ci` | API REST Flask + tests + pipeline CI |
| **`frontend-ci`** (ce dépôt) | Interface React + pipeline CI |
| `deployment-cd` | `docker-compose.yml`, `.env`, pipeline CD |

## Fonctionnalités (cas d'utilisation du modèle)

**Visiteur** : S'inscrire (compte patient), S'authentifier (JWT). Les espaces sont protégés par rôle (`PATIENT` / `MEDECIN`).

**Espace patient**
- Lister les médecins et **filtrer par spécialité** (filtre appliqué par le serveur, `?specialite=`)
- Consulter les disponibilités d'un médecin et **réserver un créneau** (3 étapes : créneau, motif, confirmation ; gestion du conflit 409 si le créneau vient d'être pris)
- Consulter l'**historique des rendez-vous** (statuts EN_ATTENTE, ACCEPTE, REFUSE, ANNULE, TERMINE)
- Consulter et imprimer ses **ordonnances**

**Espace médecin**
- **Tableau de bord** : consultations du jour, graphique d'activité sur 7 jours
- **Rendez-vous du jour** : accepter, refuser, **modifier** (déplacer vers un autre créneau), annuler, terminer
- **Gérer ses disponibilités** : ajouter une plage découpée en créneaux, supprimer un créneau libre
- **Créer une ordonnance** (au moins une ligne, uniquement après consultation TERMINÉE) et consulter les ordonnances émises

**Général** : thème clair/sombre, responsive, notifications, squelettes de chargement, accessibilité clavier (Échap, `aria-*`), indicateur d'état de l'API.

## Stack et structure

React 18, Vite 5, Vitest, CSS natif, nginx en production.

```
frontend-ci/
├── Dockerfile · nginx.conf · Jenkinsfile · package.json · vite.config.js · index.html
├── public/favicon.svg
└── src/
    ├── main.jsx · App.jsx · styles.css
    ├── api.js            client REST (jeton JWT, routes /api/...)
    ├── models.js         normalisation des réponses (champs du MLD)
    ├── demoBackend.js    backend simulé, mêmes règles de gestion (mode démo)
    ├── utils.js          fonctions pures (créneaux, tri, dates, statuts)
    ├── *.test.js         tests unitaires (Vitest)
    ├── components/       ui.jsx (modale, toasts, badges…), OrdonnanceModal.jsx
    └── pages/            Accueil · Auth (connexion, inscription) · Patient · Medecin
```

## Lancer en local

Prérequis : Node.js 20 ou plus.

```powershell
npm install
npm run dev        # http://localhost:5173
npm test           # tests unitaires
npm run build      # build de production dans dist/
```

`/api` est relayé vers `http://localhost:5000` (Flask) **sans retirer le préfixe**, comme dans les diagrammes de séquence.

**Mode démo** : si le backend est injoignable, l'application bascule seule sur un backend simulé (bandeau jaune, données dans le `localStorage`). Il applique les mêmes règles : double réservation refusée (409), transitions de statut contrôlées (422), ordonnance seulement après TERMINE (422), au moins une ligne. Comptes (mot de passe `Passer123`) : patient `awa.diop@esante.sn`, médecin `cheikh.fall@esante.sn`.

## Contrat d'API attendu du backend

Routes issues des diagrammes de séquence (**S**) ; les routes marquées **(à valider)** ne figurent pas dans le document et sont à convenir avec le membre backend.

| Méthode | Route | Corps / paramètres | Réponse |
|---|---|---|---|
| POST | `/api/auth/register` (S1) | `nom, prenom, email, mot_de_passe, telephone, date_naissance, adresse` | 201 ; 409 si email déjà utilisé |
| POST | `/api/auth/login` (S1) | `email, mot_de_passe` | 200 `{ token, utilisateur: { id, nom, prenom, email, role } }` ; 401 |
| GET | `/api/medecins?specialite=` (S2) | | `[{ id, nom, prenom, numero_ordre, biographie, tarif, specialite: { id, libelle } }]` |
| GET | `/api/medecins/{id}/disponibilites` (S3) | | créneaux libres `[{ id, id_medecin, date_heure_debut, date_heure_fin, est_reserve }]` |
| GET | `/api/medecins/{id}/disponibilites?toutes=true` **(à valider)** | | tous les créneaux du médecin connecté |
| POST | `/api/medecins/{id}/disponibilites` **(à valider)** | `date_heure_debut, date_heure_fin` | 201 ; 409 si chevauchement |
| DELETE | `/api/disponibilites/{id}` **(à valider)** | | 204 ; 409 si réservé |
| POST | `/api/rendezvous` (S3) | `id_medecin, id_creneau, motif` | 201 ; **409** si créneau pris |
| GET | `/api/patients/{id}/rendezvous` **(à valider)** | | liste de rendez-vous |
| GET | `/api/medecins/{id}/rendezvous?date=` (S4) | `date` facultative | liste de rendez-vous |
| PUT | `/api/rendezvous/{id}` (S4) | `{ statut }` ou `{ id_creneau }` (modifier) | 200 ; 422 transition interdite ; 403 |
| GET | `/api/patients/{id}/ordonnances` · `/api/medecins/{id}/ordonnances` **(à valider)** | | liste d'ordonnances |
| POST | `/api/rendezvous/{id}/ordonnance` (S5) | `instructions, lignes: [{ medicament, posologie, duree, quantite }]` | 201 ; **422** si RDV non terminé |

Forme d'un rendez-vous : `{ id, date_heure, motif, statut, id_disponibilite, patient: { id, nom, prenom }, medecin: { id, nom, prenom, specialite: { libelle } } }`.
Forme d'une ordonnance : `{ id, date_emission, instructions, id_rendezvous, lignes: [...], medecin: {...}, patient: {...} }`.

Points d'attention pour le backend :
- Dates en **ISO 8601** (`2026-11-09T09:30:00`). Le `jsonify` de Flask sérialise les `datetime` au format HTTP par défaut : le frontend sait le lire, mais l'ISO est préférable.
- Statuts en majuscules : `EN_ATTENTE`, `ACCEPTE`, `REFUSE`, `ANNULE`, `TERMINE` (enum `statut_rdv`).
- Le jeton est envoyé en `Authorization: Bearer <jwt>`. Le rôle (`PATIENT` ou `MEDECIN`) doit figurer dans la réponse du login ou dans les claims du jeton.
- Erreurs au format `{ "message": "..." }` : le texte est affiché à l'utilisateur.
- `GET /api/medecins` doit rester accessible sans jeton (page d'accueil).
- Annuler ou refuser un rendez-vous doit remettre `est_reserve = false` sur son créneau (séquence 4).

## Docker

```bash
docker build -t esante-frontend .
docker run -p 8080:80 esante-frontend      # http://localhost:8080
```

- Port **80** ; `/healthz` pour le `HEALTHCHECK`.
- `/api/` est relayé vers l'hôte **`backend`** sur le port **5000**, chemin conservé. Dans `deployment-cd/docker-compose.yml`, le service de l'API doit s'appeler `backend` et partager le réseau du frontend. Si les routes Flask n'ont pas le préfixe `/api`, décommentez la ligne `rewrite` indiquée dans `nginx.conf`.

```yaml
frontend:
  image: ${DOCKERHUB_USER}/esante-frontend:${FRONTEND_TAG:-latest}
  ports:
    - "80:80"
  depends_on:
    - backend
  restart: unless-stopped
```

## Pipeline Jenkins (CI)

1. **Checkout**
2. **Tests unitaires** : `docker build --target test` (`npm ci`, puis `vitest`)
3. **Scan du code** : `npm audit` (rapport archivé) ; analyse **SonarQube** disponible (étape commentée dans le `Jenkinsfile`, à activer si un serveur est configuré)
4. **Build de l'image** (tags : numéro de build et `latest`)
5. **Scan Trivy** de l'image : rapport HIGH/CRITICAL archivé, échec s'il reste une CRITICAL corrigeable
6. **Push Docker Hub**

Configuration : remplacer `VOTRE_USER_DOCKERHUB` dans le `Jenkinsfile`, créer l'identifiant Jenkins `dockerhub-creds`, ajouter le webhook GitHub (`http://<jenkins>/github-webhook/`, événement *push*), donner à l'agent l'accès au démon Docker.
