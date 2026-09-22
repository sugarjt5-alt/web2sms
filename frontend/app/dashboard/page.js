'use client';
import { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import { apiFetch } from '../../lib/api';

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0, contacts: 0 });

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) setUser(JSON.parse(u));

    async function loadStats() {
      try {
        const [messages, contacts] = await Promise.all([
          apiFetch('/messages'),
          apiFetch('/contacts'),
        ]);
        const sent = messages.reduce((sum, m) => sum + m.sent_count, 0);
        const failed = messages.reduce((sum, m) => sum + m.failed_count, 0);
        setStats({ total: messages.length, sent, failed, contacts: contacts.length });
      } catch (err) {
        console.error(err);
      }
    }
    loadStats();
  }, []);

  return (
    <div>
      <Navbar />
      <div className="container">
        <h1>Сайн байна уу, {user?.name || ''} 👋</h1>
        <p style={{ color: '#666', marginBottom: 20 }}>
          Role: <strong>{user?.role}</strong>
        </p>

        <div className="grid-stats">
          <div className="stat-box">
            <div className="num">{stats.total}</div>
            <div className="label">Нийт илгээлт (batch)</div>
          </div>
          <div className="stat-box">
            <div className="num" style={{ color: '#16a34a' }}>{stats.sent}</div>
            <div className="label">Амжилттай илгээгдсэн SMS</div>
          </div>
          <div className="stat-box">
            <div className="num" style={{ color: '#dc2626' }}>{stats.failed}</div>
            <div className="label">Амжилтгүй болсон SMS</div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 20 }}>
          <h2>Хурдан үйлдэл</h2>
          <a href="/compose"><button className="primary" style={{ marginRight: 10 }}>SMS бичих</button></a>
          <a href="/contacts"><button className="secondary" style={{ marginRight: 10 }}>Contact нэмэх</button></a>
          <a href="/groups"><button className="secondary">Group үүсгэх</button></a>
        </div>
      </div>
    </div>
  );
}
