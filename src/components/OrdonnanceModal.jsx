import { Modal } from './ui.jsx';
import { formatDateLong } from '../utils.js';

// Ordonnance numérique (Ordonnance + LigneOrdonnance du modèle), imprimable : @media print n'affiche que .print-area
export default function OrdonnanceModal({ ord, onClose }) {
  return (
    <Modal
      title="Ordonnance"
      wide
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Fermer
          </button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            🖨 Imprimer / Enregistrer en PDF
          </button>
        </>
      }
    >
      <div className="print-area ordo">
        <div className="ordo-head">
          <div className="ordo-id">
            <img className="brand-logo" src="/logo.svg" alt="" width="44" height="44" />
            <div>
              <strong className="ordo-brand">e-Santé Sénégal</strong>
              <div className="muted">Téléconsultation et suivi médical</div>
            </div>
          </div>
          <div className="ordo-date">{ord.date ? formatDateLong(ord.date) : ''}</div>
        </div>
        <div className="ordo-parties">
          <div>
            <span className="label">Médecin</span>
            <strong>{ord.medecinNom || '—'}</strong>
            <div className="muted">{ord.specialite}</div>
          </div>
          <div>
            <span className="label">Patient</span>
            <strong>{ord.patientNom || '—'}</strong>
          </div>
        </div>
        <h3 className="ordo-title">Prescription</h3>
        <table className="ordo-table">
          <thead>
            <tr>
              <th>Médicament</th>
              <th>Posologie</th>
              <th>Durée</th>
              <th>Qté</th>
            </tr>
          </thead>
          <tbody>
            {ord.lignes.map((l, i) => (
              <tr key={l.id ?? i}>
                <td>
                  <strong>{l.medicament}</strong>
                </td>
                <td>{l.posologie || '—'}</td>
                <td>{l.duree || '—'}</td>
                <td>{l.quantite ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {ord.instructions && (
          <>
            <h3 className="ordo-title">Instructions</h3>
            <p>{ord.instructions}</p>
          </>
        )}
        <div className="ordo-foot">Document généré électroniquement par e-Santé Sénégal (projet pédagogique).</div>
      </div>
    </Modal>
  );
}
