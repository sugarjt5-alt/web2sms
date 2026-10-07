'use client';
import { useCallback, useEffect, useState } from 'react';
import AppShell from '../../../../components/AppShell';
import Icon from '../../../../components/Icon';
import { Alert, StatusBadge, DeliveryBar, StatCard, formatDate } from '../../../../components/ui';
import { apiFetch } from '../../../../lib/api';

const LIVE_STATUSES = ['processing', 'scheduled'];

export default function HistoryDetailPage({ params }) {
  const { id } = params;
  const [message, setMessage] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch(`/messages/${id}`);
      setMessage(data);
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, [id]);

  useEffect(() => {
    let timer;
    async function tick() {
      const data = await load();
      // Илгээгдэж буй/хуваарьт үед 3 секунд тутам шинэчилнэ, дуусвал зогсоно
      if (data && LIVE_STATUSES.includes(data.status)) timer = setTimeout(tick, 3000);
    }
    tick();
    return () => clearTimeout(timer);
  }, [load]);

  async function handleCancel() {
    if (!confirm('Хуваарьт илгээлтийг цуцлах уу?')) return;
    setCancelling(true);
    setError('');
    try {
      await apiFetch(`/messages/${id}/cancel`, { method: 'POST' });
      setNotice('Илгээлт цуцлагдлаа.');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelling(false);
    }
  }

  const back = <a href="/admin/history" className="btn btn-secondary"><Icon name="arrowLeft" size={16} /> Түүх рүү буцах</a>;

  if (!message) {
    return (
      <AppShell area="admin" title="Илгээлтийн дэлгэрэнгүй" actions={back}>
        <div className="loading">{error || 'Ачааллаж байна...'}</div>
      </AppShell>
    );
  }

  const pending = message.total - message.sent_count - message.failed_count;
  const orgCount = message.recipients.filter((r) => r.recipient_type === 'organization').length;
  const clientCount = message.recipients.length - orgCount;
  const sender = message.source === 'api' ? `API · ${message.api_key_name || 'түлхүүр'}` : message.user_name;
  const totalSms = message.recipients.reduce((s, r) => s + (r.segments || 1), 0);

  return (
    <AppShell
      area="admin"
      title={`Илгээлт #${message.id}`}
      subtitle={`${formatDate(message.created_at)}${sender ? ` · ${sender}` : ''}`}
      actions={
        <>
          {message.status === 'scheduled' && (
            <button className="btn btn-danger" onClick={handleCancel} disabled={cancelling}>
              <Icon name="x" size={16} /> {cancelling ? 'Цуцалж байна...' : 'Цуцлах'}
            </button>
          )}
          {back}
        </>
      }
    >
      <Alert>{error}</Alert>
      <Alert type="success">{notice}</Alert>

      {message.status === 'scheduled' && (
        <Alert type="warning">
          Энэ илгээлт <strong>{formatDate(message.scheduled_at)}</strong>-д автоматаар явна.
        </Alert>
      )}

      <div className="stats">
        <StatCard icon="contacts" color="indigo" value={message.total}
          label={[orgCount && `${orgCount} байгууллага`, clientCount && `${clientCount} харилцагч`].filter(Boolean).join(' · ') || 'Хүлээн авагч'} />
        <StatCard icon="check" color="green" value={message.sent_count} label="Амжилттай" />
        <StatCard icon="x" color="red" value={message.failed_count} label="Амжилтгүй" />
        <StatCard icon="message" color="amber" value={totalSms} label="Нийт SMS" />
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Мессеж</h2>
          <StatusBadge status={message.status} />
        </div>
        <div className="bubble" style={{ maxWidth: '100%', background: 'var(--surface-2)', boxShadow: 'none' }}>
          {message.content}
        </div>
        {message.status !== 'cancelled' && (
          <div style={{ marginTop: 16 }}>
            <DeliveryBar sent={message.sent_count} failed={message.failed_count} total={message.total} />
            {message.status === 'processing' && pending > 0 && (
              <p className="muted small" style={{ marginTop: 6 }}>{pending} SMS илгээгдэж байна...</p>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header"><h2>Хүлээн авагч бүрийн төлөв</h2></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th><Icon name="building" size={13} /> Байгууллага</th>
                <th><Icon name="user" size={13} /> Харилцагч</th>
                <th>Утас</th><th>Илгээсэн текст</th><th>Төлөв</th><th>Илгээсэн</th>
              </tr>
            </thead>
            <tbody>
              {message.recipients.map((r) => (
                <tr key={r.id}>
                  {/* Байгууллага руу илгээсэн бол нэр нь Байгууллага баганад, бусад нь Харилцагч баганад */}
                  <td className="cell-strong">{r.recipient_type === 'organization' ? r.recipient_name : <span className="muted">—</span>}</td>
                  <td className="cell-strong">
                    {r.recipient_type !== 'organization' && r.recipient_name ? r.recipient_name : <span className="muted">—</span>}
                  </td>
                  <td className="mono">{r.phone}</td>
                  <td>
                    <div className="truncate small" title={r.content}>{r.content || message.content}</div>
                    <div className="muted small">{r.segments} SMS</div>
                  </td>
                  <td>
                    <StatusBadge status={r.status} />
                    {r.error && <div className="small" style={{ color: 'var(--danger)', marginTop: 4 }}>{r.error}</div>}
                  </td>
                  <td className="muted small">{r.sent_at ? formatDate(r.sent_at) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
