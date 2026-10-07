'use client';
import { useEffect, useState } from 'react';
import AppShell from '../../../components/AppShell';
import Icon from '../../../components/Icon';
import { Alert, EmptyState, OrderBadge, formatDate, formatMoney } from '../../../components/ui';
import { apiFetch } from '../../../lib/api';

const FILTERS = [
  { value: 'pending', label: 'Хүлээгдэж буй' },
  { value: 'paid', label: 'Төлөгдсөн' },
  { value: 'rejected', label: 'Татгалзсан' },
  { value: '', label: 'Бүгд' },
];

// Багцын захиалгууд: банкны хуулгаас төлбөрийг шалгаад батлах / татгалзах
export default function AdminOrdersPage() {
  const [filter, setFilter] = useState('pending');
  const [orders, setOrders] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [rejecting, setRejecting] = useState(null); // { order, note }
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function load(status = filter) {
    try {
      setOrders(await apiFetch(`/admin/orders${status ? `?status=${status}` : ''}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => { load(filter); }, [filter]);

  async function handleApprove(o) {
    if (!confirm(`${o.invoice_no}: ${formatMoney(o.price)} төлбөр дансанд орсон уу?\n"${o.organization_name}"-д ${o.credits.toLocaleString('mn-MN')} кредит нэмэгдэнэ.`)) return;
    setError('');
    setSuccess('');
    try {
      const res = await apiFetch(`/admin/orders/${o.id}/approve`, { method: 'POST', body: '{}' });
      setSuccess(`${o.invoice_no} батлагдлаа. "${o.organization_name}"-ийн шинэ үлдэгдэл: ${res.credits_balance.toLocaleString('mn-MN')}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleReject(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await apiFetch(`/admin/orders/${rejecting.order.id}/reject`, {
        method: 'POST', body: JSON.stringify({ note: rejecting.note }),
      });
      setSuccess(`${rejecting.order.invoice_no} татгалзлаа`);
      setRejecting(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const pendingTotal = orders.filter((o) => o.status === 'pending').reduce((s, o) => s + o.price, 0);

  return (
    <AppShell area="admin" title="Захиалгууд" subtitle="Банкны хуулгаас гүйлгээний утга (нэхэмжлэхийн дугаар)-аар тулгаж батална">
      <Alert>{error}</Alert>
      <Alert type="success">{success}</Alert>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="segmented">
          {FILTERS.map((f) => (
            <button key={f.value} className={filter === f.value ? 'active' : ''} onClick={() => setFilter(f.value)}>{f.label}</button>
          ))}
        </div>
        {filter === 'pending' && orders.length > 0 && (
          <span className="muted">Нийт хүлээгдэж буй: <strong>{formatMoney(pendingTotal)}</strong></span>
        )}
      </div>

      {rejecting && (
        <div className="card" style={{ borderColor: 'var(--danger)' }}>
          <form onSubmit={handleReject} className="form-row">
            <div className="field">
              <label>{rejecting.order.invoice_no} татгалзах шалтгаан (хэрэглэгчид харагдана)</label>
              <input required autoFocus placeholder="Жишээ: Төлбөр 14 хоногт орж ирээгүй" value={rejecting.note}
                onChange={(e) => setRejecting({ ...rejecting, note: e.target.value })} />
            </div>
            <button className="btn btn-danger" type="submit" style={{ border: '1px solid var(--danger)' }}>Татгалзах</button>
            <button className="btn btn-ghost" type="button" onClick={() => setRejecting(null)}>Болих</button>
          </form>
        </div>
      )}

      <div className="card">
        {loaded && orders.length === 0 ? (
          <EmptyState icon="invoice" title={filter === 'pending' ? 'Батлах захиалга алга' : 'Захиалга алга'} />
        ) : (
          <div className="table-wrap" style={{ margin: -22 }}>
            <table>
              <thead>
                <tr><th>Нэхэмжлэх</th><th>Байгууллага</th><th>Багц</th><th>Дүн</th><th>Төлөв</th><th></th></tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <div className="cell-strong mono">{o.invoice_no}</div>
                      <div className="muted small">{formatDate(o.created_at)}</div>
                    </td>
                    <td>
                      <div className="cell-strong">{o.organization_name}</div>
                      <div className="muted small">{o.created_by_email}</div>
                    </td>
                    <td>
                      {o.package_name}
                      <div className="muted small mono">{o.credits.toLocaleString('mn-MN')} кредит</div>
                    </td>
                    <td className="mono" style={{ fontWeight: 700 }}>{formatMoney(o.price)}</td>
                    <td>
                      <OrderBadge status={o.status} />
                      {o.decided_at && (
                        <div className="muted small" style={{ marginTop: 4 }}>
                          {o.decided_by_name || 'Хэрэглэгч'} · {formatDate(o.decided_at)}
                        </div>
                      )}
                      {o.admin_note && <div className="muted small">{o.admin_note}</div>}
                    </td>
                    <td className="actions">
                      {o.status === 'pending' && (
                        <>
                          <button className="btn btn-primary btn-sm" onClick={() => handleApprove(o)}>
                            <Icon name="check" size={14} /> Батлах
                          </button>{' '}
                          <button className="btn btn-danger btn-sm" onClick={() => setRejecting({ order: o, note: '' })}>
                            Татгалзах
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
