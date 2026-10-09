'use client';
import { useEffect, useState } from 'react';
import AppShell from '../../components/AppShell';
import { Alert, formatDate } from '../../components/ui';
import { apiFetch } from '../../lib/api';

// Миний бүртгэл: нэр, имэйл, утас, кредит
export default function ProfilePage() {
  const [me, setMe] = useState(null);
  const [account, setAccount] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([apiFetch('/auth/me'), apiFetch('/org')])
      .then(([m, a]) => { setMe(m); setAccount(a); })
      .catch((err) => setError(err.message));
  }, []);

  if (!me || !account) {
    return (
      <AppShell title="Миний бүртгэл">
        <div className="loading">{error || 'Ачааллаж байна...'}</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Миний бүртгэл" subtitle={`${formatDate(me.created_at)}-с хойш бүртгэлтэй`}>
      <div className="grid-2">
        <div className="card">
          <div className="card-header"><h2>Бүртгэлийн мэдээлэл</h2></div>
          <div className="summary">
            <div className="summary-row"><span>Нэр</span><strong>{me.name}</strong></div>
            <div className="summary-row"><span>Имэйл</span><strong>{me.email}</strong></div>
            <div className="summary-row"><span>Утас</span><strong className="mono">{account.phone || '—'}</strong></div>
            <div className="summary-row"><span>Кредит</span><strong className="mono">{account.credits}</strong></div>
          </div>
        </div>
        <div className="card">
          <Alert type="warning">
            Нэр, утасны дугаараа өөрчлөх бол админтай холбогдоно уу.
          </Alert>
        </div>
      </div>
    </AppShell>
  );
}
