'use client';
import { useEffect, useState } from 'react';
import AppShell from '../../../components/AppShell';
import Icon from '../../../components/Icon';
import { Alert, EmptyState, formatMoney } from '../../../components/ui';
import { apiFetch } from '../../../lib/api';

const EMPTY = { id: null, name: '', credits: '', price: '', description: '', sort_order: 0, is_active: true };

// Багц, үнийн тохиргоо. Үнэ өөрчлөхөд өмнөх захиалгууд хуучин үнээрээ үлдэнэ.
export default function AdminPackagesPage() {
  const [packages, setPackages] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function load() {
    try {
      setPackages(await apiFetch('/admin/packages'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const body = JSON.stringify({
        name: form.name,
        credits: Number(form.credits),
        price: Number(form.price),
        description: form.description,
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active,
      });
      if (form.id) await apiFetch(`/admin/packages/${form.id}`, { method: 'PUT', body });
      else await apiFetch('/admin/packages', { method: 'POST', body });
      setSuccess(form.id ? 'Багц шинэчлэгдлээ' : 'Багц нэмэгдлээ');
      setForm(EMPTY);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleActive(p) {
    try {
      await apiFetch(`/admin/packages/${p.id}`, { method: 'PUT', body: JSON.stringify({ ...p, is_active: !p.is_active }) });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const unit = Number(form.credits) > 0 && Number(form.price) >= 0
    ? Math.round((Number(form.price) / Number(form.credits)) * 10) / 10 : null;

  return (
    <AppShell area="admin" title="Багц, үнэ" subtitle="Хэрэглэгчдэд харагдах кредитийн багцууд">
      <Alert>{error}</Alert>
      <Alert type="success">{success}</Alert>

      <div className="grid-main">
        <div className="card">
          <div className="card-header"><h2>Багцууд</h2></div>
          {loaded && packages.length === 0 ? (
            <EmptyState icon="cart" title="Багц алга байна" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Багц</th><th>Кредит</th><th>Үнэ</th><th>1 SMS</th><th>Зарагдсан</th><th>Төлөв</th><th></th></tr></thead>
                <tbody>
                  {packages.map((p) => (
                    <tr key={p.id} style={{ opacity: p.is_active ? 1 : 0.55 }}>
                      <td>
                        <div className="cell-strong">{p.name}</div>
                        {p.description && <div className="muted small truncate">{p.description}</div>}
                      </td>
                      <td className="mono">{p.credits.toLocaleString('mn-MN')}</td>
                      <td className="mono" style={{ fontWeight: 600 }}>{formatMoney(p.price)}</td>
                      <td className="mono muted">{formatMoney(Math.round((p.price / p.credits) * 10) / 10)}</td>
                      <td className="mono">{p.sold}</td>
                      <td>
                        <button className={`badge ${p.is_active ? 'active' : 'cancelled'}`}
                          style={{ border: 'none', cursor: 'pointer' }} onClick={() => toggleActive(p)}
                          title={p.is_active ? 'Дарж нууна' : 'Дарж харуулна'}>
                          {p.is_active ? 'Харагдана' : 'Нуусан'}
                        </button>
                      </td>
                      <td className="actions">
                        <button className="btn btn-secondary btn-sm" onClick={() => setForm({ ...p, description: p.description || '' })}>
                          <Icon name="edit" size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card sticky">
          <div className="card-header"><h2>{form.id ? 'Багц засах' : 'Шинэ багц'}</h2></div>
          <form onSubmit={handleSave}>
            <div className="field">
              <label>Нэр</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-row" style={{ marginBottom: 16 }}>
              <div className="field" style={{ minWidth: 100 }}>
                <label>Кредит (SMS)</label>
                <input type="number" min="1" step="1" required value={form.credits}
                  onChange={(e) => setForm({ ...form, credits: e.target.value })} />
              </div>
              <div className="field" style={{ minWidth: 100 }}>
                <label>Үнэ (₮)</label>
                <input type="number" min="0" step="1" required value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
            </div>
            {unit !== null && <p className="muted small" style={{ marginTop: -8, marginBottom: 12 }}>1 SMS ≈ {formatMoney(unit)}</p>}
            <div className="field">
              <label>Тайлбар</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="field">
              <label>Дараалал (бага нь эхэнд)</label>
              <input type="number" step="1" value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" type="submit">{form.id ? 'Хадгалах' : 'Нэмэх'}</button>
              {form.id && <button className="btn btn-ghost" type="button" onClick={() => setForm(EMPTY)}>Болих</button>}
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
