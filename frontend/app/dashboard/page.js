'use client';
import { useEffect, useState } from 'react';
import AppShell from '../../components/AppShell';
import Icon from '../../components/Icon';
import { OrderBadge, formatDate, formatMoney, orgRoleLabel } from '../../components/ui';
import { apiFetch } from '../../lib/api';

// Хэрэглэгчийн хянах самбар: кредит, бүртгэлийн мэдээлэл, сүүлийн захиалгууд.
// SMS илгээх үйлчилгээг системийн admin гүйцэтгэнэ.
export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    Promise.all([apiFetch('/auth/me'), apiFetch('/billing/orders')])
      .then(([me, o]) => { setUser(me); setOrders(o); })
      .catch(console.error);
  }, []);

  const isIndividual = user?.organization_type === 'individual';
  const pending = orders.filter((o) => o.status === 'pending');

  return (
    <AppShell
      title={`Сайн байна уу, ${user?.name || ''}`}
      subtitle={!user ? '' : isIndividual
        ? 'Хувь хэрэглэгч'
        : `${user.organization_name} · ${orgRoleLabel(user.org_role)}`}
    >
      <div className="hero">
        <div>
          <div className="label">SMS кредитийн үлдэгдэл</div>
          <div className="value">{user?.credits?.toLocaleString('mn-MN') ?? '—'}</div>
          <div className="hint">1 кредит = 1 SMS.</div>
        </div>
        <a href="/billing" className="btn"><Icon name="cart" size={16} /> Багц худалдан авах</a>
      </div>

      {pending.length > 0 && (
        <div className="alert alert-warning">
          <Icon name="invoice" size={16} style={{ marginTop: 2 }} />
          <div>
            Төлбөр хүлээгдэж буй <strong>{pending.length}</strong> нэхэмжлэх байна.{' '}
            <a href="/billing" className="link">Төлбөрийн заавар харах</a>
          </div>
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><h2>Бүртгэлийн мэдээлэл</h2></div>
          <div className="summary">
            <div className="summary-row"><span>Нэр</span><strong>{user?.name}</strong></div>
            <div className="summary-row"><span>Имэйл</span><strong>{user?.email}</strong></div>
            <div className="summary-row"><span>Төрөл</span><strong>{isIndividual ? 'Хувь хүн' : 'Байгууллага'}</strong></div>
            {!isIndividual && (
              <div className="summary-row"><span>Байгууллага</span><strong>{user?.organization_name}</strong></div>
            )}
          </div>
          <a href="/team" className="btn btn-secondary btn-sm" style={{ marginTop: 16 }}>
            {isIndividual ? 'Миний бүртгэл' : 'Байгууллага, ажилтнууд'} <Icon name="arrowRight" size={14} />
          </a>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Сүүлийн захиалгууд</h2>
            <a href="/billing" className="btn btn-ghost btn-sm">Бүгд <Icon name="arrowRight" size={14} /></a>
          </div>
          {orders.length === 0 ? (
            <div className="empty small">Захиалга алга байна</div>
          ) : (
            <div className="table-wrap">
              <table>
                <tbody>
                  {orders.slice(0, 5).map((o) => (
                    <tr key={o.id}>
                      <td>
                        <div className="cell-strong">{o.package_name}</div>
                        <div className="muted small mono">{o.invoice_no} · {formatDate(o.created_at)}</div>
                      </td>
                      <td className="mono">{formatMoney(o.price)}</td>
                      <td><OrderBadge status={o.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
