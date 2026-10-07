'use client';
import { useEffect, useState } from 'react';
import AppShell from '../../components/AppShell';
import Icon from '../../components/Icon';
import { Alert, EmptyState, formatDate, orgRoleLabel } from '../../components/ui';
import { apiFetch } from '../../lib/api';

// Байгууллагын мэдээлэл, ажилтнууд, кредитийн түүх
export default function TeamPage() {
  const [me, setMe] = useState(null);
  const [org, setOrg] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isOwner = me?.org_role === 'owner';

  async function loadAll() {
    try {
      const o = await apiFetch('/org');
      setOrg(o);
      setOrgName(o.name);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) setMe(JSON.parse(u));
    loadAll();
  }, []);

  async function run(action, okMessage) {
    setError('');
    setSuccess('');
    try {
      await action();
      if (okMessage) setSuccess(okMessage);
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleAddMember(e) {
    e.preventDefault();
    run(async () => {
      await apiFetch('/org/members', { method: 'POST', body: JSON.stringify(form) });
      setForm({ name: '', email: '', password: '' });
    }, 'Ажилтан нэмэгдлээ. Имэйл, нууц үгийг нь өөрт нь дамжуулна уу.');
  }

  function handleRename(e) {
    e.preventDefault();
    run(async () => {
      await apiFetch('/org', { method: 'PUT', body: JSON.stringify({ name: orgName }) });
      const updated = { ...me, organization_name: orgName };
      localStorage.setItem('user', JSON.stringify(updated));
      setMe(updated);
    }, 'Нэр шинэчлэгдлээ');
  }

  function handleRoleChange(id, org_role) {
    run(() => apiFetch(`/org/members/${id}/role`, { method: 'PUT', body: JSON.stringify({ org_role }) }));
  }

  function handleRemove(id) {
    if (!confirm('Ажилтныг хасах уу? Түүний үүсгэсэн харилцагч, мессеж байгууллагад үлдэнэ.')) return;
    run(() => apiFetch(`/org/members/${id}`, { method: 'DELETE' }), 'Ажилтан хасагдлаа');
  }

  if (!org) {
    return (
      <AppShell title="Байгууллага">
        <div className="loading">{error || 'Ачааллаж байна...'}</div>
      </AppShell>
    );
  }

  // Хувь хүний бүртгэл: ажилтангүй, зөвхөн бүртгэлийн мэдээлэл
  if (org.type === 'individual') {
    const self = org.members[0];
    return (
      <AppShell title="Миний бүртгэл" subtitle={`Хувь хэрэглэгч · ${formatDate(org.created_at)}-с хойш`}>
        <div className="grid-2">
          <div className="card">
            <div className="card-header"><h2>Бүртгэлийн мэдээлэл</h2></div>
            <div className="summary">
              <div className="summary-row"><span>Нэр</span><strong>{self?.name}</strong></div>
              <div className="summary-row"><span>Имэйл</span><strong>{self?.email}</strong></div>
              <div className="summary-row"><span>Утас</span><strong className="mono">{org.phone || '—'}</strong></div>
              <div className="summary-row"><span>Кредит</span><strong className="mono">{org.credits}</strong></div>
            </div>
          </div>
          <div className="card">
            <EmptyState icon="building" title="Ажилтантай ажиллах уу?">
              Хувь хүний бүртгэлд ажилтан нэмэх боломжгүй. Багаараа ажиллах бол{' '}
              <a href="/register?type=organization" className="link">байгууллагаар бүртгүүлнэ</a> үү.
            </EmptyState>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={org.name}
      subtitle={[
        `${org.members.length} ажилтан`,
        org.registration_no && `РД ${org.registration_no}`,
        org.phone && `☎ ${org.phone}`,
        `${formatDate(org.created_at)}-с хойш`,
      ].filter(Boolean).join(' · ')}
    >
      <Alert>{error}</Alert>
      <Alert type="success">{success}</Alert>

      <div className="grid-main">
        <div className="card">
          <div className="card-header"><h2>Ажилтнууд</h2></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Нэр</th><th>Имэйл</th><th>Эрх</th><th></th></tr></thead>
              <tbody>
                {org.members.map((m) => {
                  const isMe = m.id === me?.id;
                  return (
                    <tr key={m.id}>
                      <td className="cell-strong">{m.name}{isMe && <span className="muted"> (та)</span>}</td>
                      <td className="muted">{m.email}</td>
                      <td>
                        {isOwner && !isMe ? (
                          <select className="input-sm" value={m.org_role} style={{ width: 'auto' }}
                            onChange={(e) => handleRoleChange(m.id, e.target.value)}>
                            <option value="member">Ажилтан</option>
                            <option value="client">Харилцагч</option>
                            <option value="owner">Эзэн</option>
                          </select>
                        ) : (
                          <span className={`badge ${m.org_role === 'owner' ? 'owner' : 'plain'}`}>
                            {orgRoleLabel(m.org_role)}
                          </span>
                        )}
                      </td>
                      <td className="actions">
                        {isOwner && !isMe && (
                          <button className="btn btn-danger btn-sm" onClick={() => handleRemove(m.id)} title="Хасах">
                            <Icon name="trash" size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          {isOwner ? (
            <>
              <div className="card">
                <div className="card-header">
                  <div>
                    <h2>Ажилтан нэмэх</h2>
                    <p>Анхны нууц үгийг та өгч, ажилтандаа дамжуулна</p>
                  </div>
                </div>
                <form onSubmit={handleAddMember}>
                  <div className="field">
                    <label htmlFor="m-name">Нэр</label>
                    <input id="m-name" required value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="field">
                    <label htmlFor="m-email">Имэйл</label>
                    <input id="m-email" type="email" required value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div className="field">
                    <label htmlFor="m-pass">Анхны нууц үг</label>
                    <input id="m-pass" type="password" required minLength={8} value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })} />
                    <div className="hint">Дор хаяж 8 тэмдэгт</div>
                  </div>
                  <button className="btn btn-primary btn-block" type="submit"><Icon name="plus" size={16} /> Нэмэх</button>
                </form>
              </div>

              <div className="card">
                <div className="card-header"><h2>Байгууллагын нэр</h2></div>
                <form onSubmit={handleRename} style={{ display: 'flex', gap: 10 }}>
                  <input required value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                  <button className="btn btn-secondary" type="submit">Хадгалах</button>
                </form>
              </div>
            </>
          ) : (
            <div className="card">
              <EmptyState icon="lock" title="Ажилтны эрх">
                Ажилтан нэмэх, байгууллагын тохиргоог зөвхөн эзэн өөрчилнө.
              </EmptyState>
            </div>
          )}
        </div>
      </div>

    </AppShell>
  );
}
