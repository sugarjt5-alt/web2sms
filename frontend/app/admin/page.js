'use client';
import { useEffect, useState } from 'react';
import AppShell from '../../components/AppShell';
import Icon from '../../components/Icon';
import { Alert, StatCard, StatusBadge, EmptyState, formatDate, formatMoney } from '../../components/ui';
import { apiFetch } from '../../lib/api';

const LOW_CREDIT = 100;

// Admin тойм: системийн статистик, шинэ хэрэглэгчид, кредит дуусч буй хэрэглэгчид, сүүлийн илгээлтүүд
export default function AdminOverviewPage() {
  const [stats, setStats] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([apiFetch('/admin/stats'), apiFetch('/messages'), apiFetch('/admin/users')])
      .then(([s, m, u]) => { setStats(s); setMessages(m); setUsers(u.filter((x) => x.role !== 'admin')); })
      .catch((err) => setError(err.message));
  }, []);

  const lowCredit = users.filter((u) => u.is_active && u.credits < LOW_CREDIT).sort((a, b) => a.credits - b.credits);
  const rate = stats && stats.sent + stats.failed > 0
    ? Math.round((stats.sent / (stats.sent + stats.failed)) * 100) : null;

  return (
    <AppShell area="admin" title="Системийн тойм" subtitle="Нийт хэрэглэгч, илгээлтийн үзүүлэлт">
      <Alert>{error}</Alert>

      {stats?.pending_orders > 0 && (
        <Alert type="warning">
          Төлбөр хүлээгдэж буй <strong>{stats.pending_orders}</strong> захиалга байна.{' '}
          <a href="/admin/orders" className="link">Захиалгууд руу очих</a>
        </Alert>
      )}

      {stats && (
        <div className="stats">
          <StatCard icon="invoice" color="green" value={formatMoney(stats.revenue_month)} label="Энэ сарын орлого" />
          <StatCard icon="contacts" color="indigo" value={stats.customers} label="Хэрэглэгч" />
          <StatCard icon="check" color="green" value={stats.sent} label={`Амжилттай SMS${rate !== null ? ` · ${rate}%` : ''}`} />
          <StatCard icon="x" color="red" value={stats.failed} label="Амжилтгүй SMS" />
          <StatCard icon="coin" color="amber" value={stats.outstanding_credits} label="Хэрэглэгчдийн үлдэгдэл кредит" />
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div>
            <h2>Шинэ бүртгэлүүд</h2>
            <p>{stats?.new_users ? `Сүүлийн 24 цагт ${stats.new_users} хэрэглэгч` : 'Сүүлийн хэрэглэгчид'}</p>
          </div>
          <a href="/admin/users" className="btn btn-ghost btn-sm">Бүгд <Icon name="arrowRight" size={14} /></a>
        </div>
        {users.length === 0 ? (
          <EmptyState icon="contacts" title="Хэрэглэгч алга байна" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Хэрэглэгч</th><th>Утас</th><th>Бүртгүүлсэн</th></tr></thead>
              <tbody>
                {users.slice(0, 5).map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="cell-strong">{u.name}</div>
                      <div className="muted small">{u.email}</div>
                    </td>
                    <td className="mono small">{u.phone || '—'}</td>
                    <td className="muted small">{formatDate(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div>
              <h2>Кредит дуусч буй хэрэглэгчид</h2>
              <p>{LOW_CREDIT}-аас доош үлдэгдэлтэй</p>
            </div>
            <a href="/admin/users" className="btn btn-ghost btn-sm">Цэнэглэх <Icon name="arrowRight" size={14} /></a>
          </div>
          {lowCredit.length === 0 ? (
            <EmptyState icon="check" title="Бүгд хангалттай кредиттэй" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Хэрэглэгч</th><th>Кредит</th></tr></thead>
                <tbody>
                  {lowCredit.slice(0, 8).map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="cell-strong">{u.name}</div>
                        <div className="muted small">{u.email}</div>
                      </td>
                      <td className="mono" style={{ fontWeight: 700, color: u.credits === 0 ? 'var(--danger)' : 'var(--warning)' }}>
                        {u.credits}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Сүүлийн илгээлтүүд</h2>
            <a href="/admin/history" className="btn btn-ghost btn-sm">Бүгд <Icon name="arrowRight" size={14} /></a>
          </div>
          {messages.length === 0 ? (
            <EmptyState icon="history" title="Илгээлт алга байна" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Мессеж</th><th>Хүн</th><th>Төлөв</th></tr></thead>
                <tbody>
                  {messages.slice(0, 8).map((m) => (
                    <tr key={m.id}>
                      <td>
                        <a href={`/admin/history/${m.id}`} className="truncate cell-strong" style={{ display: 'block', maxWidth: 220 }}>
                          {m.content}
                        </a>
                        <div className="muted small">{formatDate(m.scheduled_at || m.created_at)}</div>
                      </td>
                      <td className="mono">{m.total}</td>
                      <td><StatusBadge status={m.status} /></td>
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
