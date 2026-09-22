'use client';
import { useEffect, useState } from 'react';
import Navbar from '../../../components/Navbar';
import { apiFetch } from '../../../lib/api';

function StatusBadge({ status }) {
  return <span className={`badge ${status}`}>{status}</span>;
}

export default function HistoryDetailPage({ params }) {
  const { id } = params;
  const [message, setMessage] = useState(null);

  async function load() {
    try {
      const data = await apiFetch(`/messages/${id}`);
      setMessage(data);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    load();
    // 3 секунд тутам шинэчилж, queue-с ирж буй sent/failed статусыг real-time-д ойрхон харуулна
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [id]);

  if (!message) return <div><Navbar /><div className="container">Ачааллаж байна...</div></div>;

  return (
    <div>
      <Navbar />
      <div className="container">
        <h1>Мессежийн дэлгэрэнгүй #{message.id}</h1>

        <div className="card">
          <p><strong>Агуулга:</strong> {message.content}</p>
          <p><strong>Нийт status:</strong> <StatusBadge status={message.status} /></p>
          <p><strong>Нийт:</strong> {message.total} &nbsp;
             <span style={{ color: '#16a34a' }}>Sent: {message.sent_count}</span> &nbsp;
             <span style={{ color: '#dc2626' }}>Failed: {message.failed_count}</span></p>
        </div>

        <div className="card">
          <h2>Хүлээн авагч бүрийн статус</h2>
          <table>
            <thead><tr><th>Нэр</th><th>Утас</th><th>Status</th><th>Алдаа</th></tr></thead>
            <tbody>
              {message.recipients.map((r) => (
                <tr key={r.id}>
                  <td>{r.contact_name || '-'}</td>
                  <td>{r.phone}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td style={{ color: '#dc2626', fontSize: 12 }}>{r.error || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
