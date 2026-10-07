'use client';
import { useEffect, useState } from 'react';
import AppShell from '../../../components/AppShell';
import Icon from '../../../components/Icon';
import { StatusBadge, DeliveryBar, EmptyState, RecipientNames, formatDate } from '../../../components/ui';
import { apiFetch } from '../../../lib/api';

export default function HistoryPage() {
  const [messages, setMessages] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    apiFetch('/messages').then(setMessages).catch(console.error).finally(() => setLoaded(true));
  }, []);

  return (
    <AppShell area="admin"
      title="Илгээлтийн түүх"
      subtitle="Admin-аас илгээсэн SMS"
      actions={<a href="/admin/compose" className="btn btn-primary"><Icon name="send" size={16} /> SMS илгээх</a>}
    >
      <div className="card">
        {loaded && messages.length === 0 ? (
          <EmptyState icon="history" title="Түүх алга байна">Илгээсэн SMS энд харагдана.</EmptyState>
        ) : (
          <div className="table-wrap" style={{ margin: -22 }}>
            <table>
              <thead>
                <tr>
                  <th>Огноо</th><th>Мессеж</th>
                  <th><Icon name="building" size={13} /> Байгууллага</th>
                  <th><Icon name="user" size={13} /> Харилцагч</th>
                  <th>Хүргэлт</th><th>Төлөв</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => (
                  <tr key={m.id}>
                    <td className="muted small" style={{ whiteSpace: 'nowrap' }}>
                      {m.scheduled_at ? (
                        <span title="Хуваарьт цаг" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Icon name="clock" size={13} /> {formatDate(m.scheduled_at)}
                        </span>
                      ) : formatDate(m.created_at)}
                    </td>
                    <td>
                      <a href={`/admin/history/${m.id}`} className="truncate cell-strong" style={{ display: 'block' }}>{m.content}</a>
                    </td>
                    <td><RecipientNames names={m.org_names} count={m.org_count} /></td>
                    <td><RecipientNames names={m.client_names} count={m.client_count} /></td>
                    <td style={{ minWidth: 130 }}>
                      <DeliveryBar sent={m.sent_count} failed={m.failed_count} total={m.total} />
                      <div className="muted small mono" style={{ marginTop: 4 }}>
                        {m.sent_count} / {m.total}
                        {m.failed_count > 0 && <span style={{ color: 'var(--danger)' }}> · {m.failed_count} алдаа</span>}
                      </div>
                    </td>
                    <td><StatusBadge status={m.status} /></td>
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
