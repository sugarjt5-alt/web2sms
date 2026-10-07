'use client';
import { useEffect, useState } from 'react';
import AppShell from '../../components/AppShell';
import Icon from '../../components/Icon';
import { Alert, EmptyState, OrderBadge, formatDate, formatMoney } from '../../components/ui';
import { apiFetch } from '../../lib/api';

// Багц худалдан авах: багц сонгох -> нэхэмжлэх -> банкаар төлөх -> admin батлахад кредит орно
export default function BillingPage() {
  const [me, setMe] = useState(null);
  const [packages, setPackages] = useState([]);
  const [orders, setOrders] = useState([]);
  const [paymentInfo, setPaymentInfo] = useState('');
  const [invoice, setInvoice] = useState(null); // сая үүссэн эсвэл сонгосон хүлээгдэж буй захиалга
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isOwner = me?.org_role === 'owner';

  async function load() {
    try {
      const [m, p, o, info] = await Promise.all([
        apiFetch('/auth/me'), apiFetch('/billing/packages'), apiFetch('/billing/orders'), apiFetch('/billing/payment-info'),
      ]);
      setMe(m);
      setPackages(p);
      setOrders(o);
      setPaymentInfo(info.payment_instructions);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleOrder(pkg) {
    if (!confirm(`"${pkg.name}" багц: ${pkg.credits.toLocaleString('mn-MN')} кредит, ${formatMoney(pkg.price)}. Нэхэмжлэх үүсгэх үү?`)) return;
    setBusy(true);
    setError('');
    try {
      const order = await apiFetch('/billing/orders', { method: 'POST', body: JSON.stringify({ packageId: pkg.id }) });
      setInvoice(order);
      load();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel(order) {
    if (!confirm(`${order.invoice_no} нэхэмжлэхийг цуцлах уу?`)) return;
    setError('');
    try {
      await apiFetch(`/billing/orders/${order.id}/cancel`, { method: 'POST' });
      if (invoice?.id === order.id) setInvoice(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  // Хамгийн их кредиттэй дунд багцыг "Түгээмэл" гэж тэмдэглэнэ
  const featuredId = packages.length >= 3 ? packages[Math.floor(packages.length / 2)].id : null;

  return (
    <AppShell
      title="Багц худалдан авах"
      subtitle={me ? `Одоогийн үлдэгдэл: ${me.credits.toLocaleString('mn-MN')} кредит` : ''}
    >
      <Alert>{error}</Alert>

      {invoice && (
        <div className="card" style={{ borderColor: 'var(--primary)', boxShadow: '0 0 0 3px var(--primary-100)' }}>
          <div className="card-header">
            <div>
              <h2>Нэхэмжлэх үүслээ</h2>
              <p>Доорх заавраар төлбөрөө шилжүүлнэ үү. Төлбөр баталгаажмагц кредит автоматаар орно.</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setInvoice(null)}><Icon name="x" size={14} /></button>
          </div>
          <div className="grid-2">
            <div className="invoice">
              <div className="muted small">Нэхэмжлэхийн дугаар (гүйлгээний утга)</div>
              <div className="invoice-no">{invoice.invoice_no}</div>
              <div className="summary" style={{ marginTop: 14 }}>
                <div className="summary-row"><span>Багц</span><strong>{invoice.package_name}</strong></div>
                <div className="summary-row"><span>Кредит</span><strong>{invoice.credits.toLocaleString('mn-MN')}</strong></div>
                <div className="summary-row summary-total"><span>Төлөх дүн</span><span>{formatMoney(invoice.price)}</span></div>
              </div>
            </div>
            <div>
              <div className="label">Төлбөрийн заавар</div>
              <div className="invoice pre-wrap" style={{ background: 'var(--surface)' }}>{paymentInfo}</div>
              <Alert type="warning">
                Гүйлгээний утга дээр <strong>{invoice.invoice_no}</strong> гэж заавал бичнэ үү.
              </Alert>
            </div>
          </div>
        </div>
      )}

      {!isOwner && me && (
        <Alert type="warning">Багц захиалахыг зөвхөн байгууллагын эзэн хийнэ.</Alert>
      )}

      <div className="pkg-grid">
        {packages.map((p) => (
          <div key={p.id} className={`pkg-card ${p.id === featuredId ? 'featured' : ''}`}>
            {p.id === featuredId && <span className="ribbon">Түгээмэл</span>}
            <div className="pkg-name">{p.name}</div>
            <div className="pkg-credits">{p.credits.toLocaleString('mn-MN')} <span>SMS</span></div>
            <div className="pkg-price">{formatMoney(p.price)}</div>
            <div className="pkg-unit">1 SMS ≈ {formatMoney(Math.round((p.price / p.credits) * 10) / 10)}</div>
            {p.description && <div className="pkg-desc">{p.description}</div>}
            <button className={`btn ${p.id === featuredId ? 'btn-primary' : 'btn-secondary'} btn-block`}
              onClick={() => handleOrder(p)} disabled={!isOwner || busy}>
              <Icon name="cart" size={16} /> Захиалах
            </button>
          </div>
        ))}
      </div>
      {packages.length === 0 && (
        <div className="card"><EmptyState icon="cart" title="Одоогоор багц алга байна">Админтай холбогдоно уу.</EmptyState></div>
      )}

      <div className="card">
        <div className="card-header"><h2>Миний захиалгууд</h2></div>
        {orders.length === 0 ? (
          <EmptyState icon="invoice" title="Захиалга алга байна" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Нэхэмжлэх</th><th>Багц</th><th>Кредит</th><th>Дүн</th><th>Төлөв</th><th></th></tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <div className="cell-strong mono">{o.invoice_no}</div>
                      <div className="muted small">{formatDate(o.created_at)}</div>
                    </td>
                    <td>{o.package_name}</td>
                    <td className="mono">{o.credits.toLocaleString('mn-MN')}</td>
                    <td className="mono">{formatMoney(o.price)}</td>
                    <td>
                      <OrderBadge status={o.status} />
                      {o.admin_note && <div className="muted small" style={{ marginTop: 4 }}>{o.admin_note}</div>}
                    </td>
                    <td className="actions">
                      {o.status === 'pending' && (
                        <>
                          <button className="btn btn-secondary btn-sm" onClick={() => setInvoice(o)}>Төлөх заавар</button>{' '}
                          {isOwner && (
                            <button className="btn btn-danger btn-sm" onClick={() => handleCancel(o)}>Цуцлах</button>
                          )}
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
