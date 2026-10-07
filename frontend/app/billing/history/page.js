'use client';
import { useEffect, useState } from 'react';
import AppShell from '../../../components/AppShell';
import Icon from '../../../components/Icon';
import { Alert, EmptyState, formatDate } from '../../../components/ui';
import { apiFetch } from '../../../lib/api';

const TX_LABELS = { topup: 'Цэнэглэлт', sms: 'SMS илгээлт', refund: 'Буцаалт', adjust: 'Засвар' };

// Кредитийн бүх хөдөлгөөн: цэнэглэлт, зарцуулалт, буцаалт
export default function CreditHistoryPage() {
  const [me, setMe] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([apiFetch('/auth/me'), apiFetch('/org/transactions')])
      .then(([m, t]) => { setMe(m); setTransactions(t); })
      .catch((err) => setError(err.message))
      .finally(() => setLoaded(true));
  }, []);

  const spent = transactions.filter((t) => t.type === 'sms').reduce((s, t) => s - t.amount, 0);
  const added = transactions.filter((t) => t.type === 'topup').reduce((s, t) => s + t.amount, 0);

  return (
    <AppShell
      title="Кредитийн түүх"
      subtitle="Сүүлийн 100 гүйлгээ"
      actions={<a href="/billing" className="btn btn-primary"><Icon name="cart" size={16} /> Багц худалдан авах</a>}
    >
      <Alert>{error}</Alert>

      <div className="hero">
        <div>
          <div className="label">Одоогийн үлдэгдэл</div>
          <div className="value">{me?.credits?.toLocaleString('mn-MN') ?? '—'}</div>
          <div className="hint">
            Энэ хугацаанд: +{added.toLocaleString('mn-MN')} цэнэглэсэн, −{spent.toLocaleString('mn-MN')} зарцуулсан.
            Амжилтгүй SMS-ийн кредит автоматаар буцна.
          </div>
        </div>
      </div>

      <div className="card">
        {loaded && transactions.length === 0 ? (
          <EmptyState icon="coin" title="Гүйлгээ алга байна" />
        ) : (
          <div className="table-wrap" style={{ margin: -22 }}>
            <table>
              <thead><tr><th>Огноо</th><th>Төрөл</th><th>Дүн</th><th>Үлдэгдэл</th><th>Тайлбар</th></tr></thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="muted small" style={{ whiteSpace: 'nowrap' }}>{formatDate(t.created_at)}</td>
                    <td>{TX_LABELS[t.type] || t.type}</td>
                    <td className="mono" style={{ color: t.amount > 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                      {t.amount > 0 ? `+${t.amount}` : t.amount}
                    </td>
                    <td className="mono">{t.balance_after}</td>
                    <td className="small muted">
                      {t.message_id && <span>Илгээлт #{t.message_id}</span>}
                      {t.note && ` ${t.note}`}
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
