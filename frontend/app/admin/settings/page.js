'use client';
import { useEffect, useState } from 'react';
import AppShell from '../../../components/AppShell';
import { Alert } from '../../../components/ui';
import { apiFetch } from '../../../lib/api';

// Хэрэглэгчид нэхэмжлэхтэй хамт харагдах төлбөрийн заавар (банк, данс)
export default function AdminSettingsPage() {
  const [instructions, setInstructions] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    apiFetch('/admin/settings')
      .then((s) => setInstructions(s.payment_instructions || ''))
      .catch((err) => setError(err.message))
      .finally(() => setLoaded(true));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await apiFetch('/admin/settings', {
        method: 'PUT', body: JSON.stringify({ payment_instructions: instructions }),
      });
      setSuccess('Хадгалагдлаа');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AppShell area="admin" title="Төлбөрийн заавар" subtitle="Хэрэглэгч багц захиалахад нэхэмжлэхийн хажууд харагдана">
      <Alert>{error}</Alert>
      <Alert type="success">{success}</Alert>
      <div className="grid-2">
        <div className="card">
          <form onSubmit={handleSave}>
            <div className="field">
              <label>Банк, дансны мэдээлэл</label>
              <textarea rows={8} value={instructions} disabled={!loaded}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder={'Банк: Хаан банк\nДансны дугаар: 5000 1234 5678\nХүлээн авагч: ...'} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={!loaded}>Хадгалах</button>
          </form>
        </div>
        <div className="card">
          <div className="card-header"><h2>Хэрэглэгчид ингэж харагдана</h2></div>
          <div className="invoice pre-wrap">{instructions || '—'}</div>
          <Alert type="warning">Гүйлгээний утга дээр <strong>W2S000012</strong> гэж заавал бичнэ үү.</Alert>
        </div>
      </div>
    </AppShell>
  );
}
