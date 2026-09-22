'use client';
import { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import { apiFetch } from '../../lib/api';

function StatusBadge({ status }) {
  return <span className={`badge ${status}`}>{status}</span>;
}

export default function HistoryPage() {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    apiFetch('/messages').then(setMessages).catch(console.error);
  }, []);

  return (
    <div>
      <Navbar />
      <div className="container">
        <h1>SMS түүх</h1>
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Огноо</th><th>Агуулга</th><th>Нийт</th>
                <th>Sent</th><th>Failed</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => (
                <tr key={m.id}>
                  <td>{new Date(m.created_at).toLocaleString('mn-MN')}</td>
                  <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.content}
                  </td>
                  <td>{m.total}</td>
                  <td style={{ color: '#16a34a' }}>{m.sent_count}</td>
                  <td style={{ color: '#dc2626' }}>{m.failed_count}</td>
                  <td><StatusBadge status={m.status} /></td>
                  <td><a href={`/history/${m.id}`} style={{ color: '#2563eb' }}>Дэлгэрэнгүй</a></td>
                </tr>
              ))}
              {messages.length === 0 && (
                <tr><td colSpan={7} style={{ color: '#999' }}>Түүх алга байна</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
