'use client';
import { Fragment, useEffect, useMemo, useState } from 'react';
import AppShell from '../../../components/AppShell';
import Icon from '../../../components/Icon';
import { Alert, EmptyState, formatDate, orgRoleLabel } from '../../../components/ui';
import { apiFetch } from '../../../lib/api';

// Байгууллагууд = БАЙГУУЛЛАГААР бүртгүүлсэн газрууд (хувь хүмүүс "Хэрэглэгчид" хуудсанд).
// Мөр бүрийг дэлгэж ажилтнуудыг нь харна.
export default function AdminOrganizationsPage() {
  const [me, setMe] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [users, setUsers] = useState([]);
  const [expanded, setExpanded] = useState(() => new Set());
  const [search, setSearch] = useState('');
  const [topUp, setTopUp] = useState({}); // { [orgId]: '1000' }
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // Шинэ байгууллага үүсгэх маягт (null = хаалттай)
  const [newOrg, setNewOrg] = useState(null);
  // Байгууллагад хэрэглэгч нэмэх маягт: { org, name, email, password, org_role } (null = хаалттай)
  const [member, setMember] = useState(null);

  async function load() {
    try {
      const [o, u] = await Promise.all([apiFetch('/admin/organizations'), apiFetch('/admin/users')]);
      setOrgs(o.filter((x) => x.type !== 'individual'));
      setUsers(u);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    setMe(JSON.parse(localStorage.getItem('user') || 'null'));
    load();
  }, []);

  // Байгууллага бүрийн ажилтнууд
  const membersByOrg = useMemo(() => {
    const map = new Map();
    for (const u of users) {
      if (!map.has(u.organization_id)) map.set(u.organization_id, []);
      map.get(u.organization_id).push(u);
    }
    return map;
  }, [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter((o) =>
      o.name.toLowerCase().includes(q) || (o.owner_email || '').includes(q) || (o.registration_no || '').includes(q)
      || (membersByOrg.get(o.id) || []).some((u) => u.email.includes(q) || u.name.toLowerCase().includes(q)));
  }, [orgs, search, membersByOrg]);

  function toggleExpand(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleRoleChange(u, role) {
    const warn = role === 'admin'
      ? `${u.name}-д системийн ADMIN эрх өгөх үү? Тэр хэрэглэгчийн хэсэгт нэвтэрч чадахгүй болно.`
      : `${u.name}-ийн admin эрхийг хасах уу?`;
    if (!confirm(warn)) return;
    setError('');
    try {
      await apiFetch(`/admin/users/${u.id}/role`, { method: 'PUT', body: JSON.stringify({ role }) });
      setSuccess(`${u.name}: эрх "${role}" боллоо`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteUser(u) {
    if (!confirm(`${u.name}-ийг устгах уу? Байгууллагын сүүлийн хүн бол байгууллага бүх өгөгдөлтэйгөө устна.`)) return;
    setError('');
    try {
      const res = await apiFetch(`/admin/users/${u.id}`, { method: 'DELETE' });
      setSuccess(res.message);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleTopUp(e, org) {
    e.preventDefault();
    setError('');
    setSuccess('');
    const amount = Number(topUp[org.id]);
    try {
      const res = await apiFetch(`/admin/organizations/${org.id}/credits`, {
        method: 'POST',
        body: JSON.stringify({ amount }),
      });
      setTopUp({ ...topUp, [org.id]: '' });
      setSuccess(`${org.name}: ${amount > 0 ? '+' : ''}${amount} кредит. Шинэ үлдэгдэл: ${res.credits}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreateOrg(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await apiFetch('/admin/organizations', {
        method: 'POST',
        body: JSON.stringify({
          name: newOrg.name,
          credits: Number(newOrg.credits) || 0,
          owner: { name: newOrg.ownerName, email: newOrg.ownerEmail, password: newOrg.ownerPassword },
        }),
      });
      setSuccess(`"${newOrg.name}" байгууллага үүслээ. Эзэн нь ${newOrg.ownerEmail}-ээр /login хуудсаар нэвтэрнэ.`);
      setNewOrg(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddMember(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await apiFetch(`/admin/organizations/${member.org.id}/members`, {
        method: 'POST',
        body: JSON.stringify({
          name: member.name, email: member.email, password: member.password, org_role: member.org_role,
        }),
      });
      setSuccess(`${member.email} хэрэглэгч "${member.org.name}"-д нэмэгдлээ. /login хуудсаар нэвтэрнэ.`);
      setMember(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleToggleActive(org) {
    const action = org.is_active ? 'түр хаах' : 'дахин идэвхжүүлэх';
    if (!confirm(`"${org.name}" байгууллагыг ${action} уу?`)) return;
    setError('');
    try {
      await apiFetch(`/admin/organizations/${org.id}/active`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !org.is_active }),
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AppShell
      area="admin" title="Байгууллагууд" subtitle={`Нийт ${orgs.length} байгууллага`}
      actions={newOrg === null && (
        <button className="btn btn-primary"
          onClick={() => setNewOrg({ name: '', credits: '', ownerName: '', ownerEmail: '', ownerPassword: '' })}>
          <Icon name="plus" size={16} /> Шинэ байгууллага
        </button>
      )}
    >
      <Alert>{error}</Alert>
      <Alert type="success">{success}</Alert>

      {newOrg && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2>Шинэ байгууллага бүртгэх</h2>
              <p>Эзэн хэрэглэгчийн имэйл, анхны нууц үгийг харилцагчдаа дамжуулна</p>
            </div>
          </div>
          <form onSubmit={handleCreateOrg}>
            <div className="form-row" style={{ marginBottom: 14 }}>
              <div className="field">
                <label>Байгууллагын нэр</label>
                <input required value={newOrg.name} onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })} />
              </div>
              <div className="field" style={{ maxWidth: 180 }}>
                <label>Анхны кредит</label>
                <input type="number" min="0" step="1" placeholder="0" value={newOrg.credits}
                  onChange={(e) => setNewOrg({ ...newOrg, credits: e.target.value })} />
              </div>
            </div>
            <div className="form-row" style={{ marginBottom: 16 }}>
              <div className="field">
                <label>Эзний нэр</label>
                <input required value={newOrg.ownerName} onChange={(e) => setNewOrg({ ...newOrg, ownerName: e.target.value })} />
              </div>
              <div className="field">
                <label>Эзний имэйл</label>
                <input type="email" required value={newOrg.ownerEmail}
                  onChange={(e) => setNewOrg({ ...newOrg, ownerEmail: e.target.value })} />
              </div>
              <div className="field">
                <label>Анхны нууц үг (8+)</label>
                <input type="text" required minLength={8} value={newOrg.ownerPassword}
                  onChange={(e) => setNewOrg({ ...newOrg, ownerPassword: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" type="submit">Үүсгэх</button>
              <button className="btn btn-ghost" type="button" onClick={() => setNewOrg(null)}>Болих</button>
            </div>
          </form>
        </div>
      )}

      {member && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2>"{member.org.name}"-д хэрэглэгч нэмэх</h2>
              <p>Шинэ хэрэглэгч энэ байгууллагын харилцагч, түүх, кредитийг ашиглана</p>
            </div>
          </div>
          <form onSubmit={handleAddMember}>
            <div className="form-row" style={{ marginBottom: 16 }}>
              <div className="field">
                <label>Нэр</label>
                <input required value={member.name} onChange={(e) => setMember({ ...member, name: e.target.value })} />
              </div>
              <div className="field">
                <label>Имэйл</label>
                <input type="email" required value={member.email}
                  onChange={(e) => setMember({ ...member, email: e.target.value })} />
              </div>
              <div className="field">
                <label>Анхны нууц үг (8+)</label>
                <input type="text" required minLength={8} value={member.password}
                  onChange={(e) => setMember({ ...member, password: e.target.value })} />
              </div>
              <div className="field" style={{ maxWidth: 160 }}>
                <label>Эрх</label>
                <select value={member.org_role} onChange={(e) => setMember({ ...member, org_role: e.target.value })}>
                  <option value="client">Харилцагч</option>
                  <option value="member">Ажилтан</option>
                  <option value="owner">Эзэн</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" type="submit">Нэмэх</button>
              <button className="btn btn-ghost" type="button" onClick={() => setMember(null)}>Болих</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div>
            <h2>Жагсаалт</h2>
            <p>Байгууллагын нэр дээр дарж ажилтнуудыг харна. Кредит цэнэглэх (сөрөг тоо = хасах).</p>
          </div>
          <div className="search" style={{ width: 260, maxWidth: '100%' }}>
            <Icon name="search" size={16} />
            <input placeholder="Нэр, РД, ажилтны имэйлээр хайх" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        {orgs.length === 0 ? (
          <EmptyState icon="building" title="Байгууллага алга байна" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Байгууллага</th><th>Ажилтан</th><th>Илгээсэн</th><th>Кредит</th><th>Цэнэглэх</th><th>Төлөв</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map((o) => {
                  const isOwn = o.id === me?.organization_id;
                  const isOpen = expanded.has(o.id);
                  const members = membersByOrg.get(o.id) || [];
                  return (
                    <Fragment key={o.id}>
                    <tr style={{ opacity: o.is_active ? 1 : 0.6 }}>
                      <td>
                        <button type="button" onClick={() => toggleExpand(o.id)}
                          style={{ all: 'unset', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <Icon name="arrowRight" size={14}
                            style={{ marginTop: 3, transition: 'transform .15s', transform: isOpen ? 'rotate(90deg)' : 'none' }} />
                          <span>
                            <span className="cell-strong">
                              {o.name}{isOwn && <span className="muted"> (admin-ийнх)</span>}
                            </span>
                            <span className="muted small" style={{ display: 'block' }}>
                              {[o.registration_no && `РД ${o.registration_no}`, o.phone, formatDate(o.created_at)]
                                .filter(Boolean).join(' · ')}
                            </span>
                          </span>
                        </button>
                      </td>
                      <td className="mono">{o.member_count}</td>
                      <td className="mono">{o.sent_count}</td>
                      <td className="mono" style={{ fontWeight: 700, fontSize: 15 }}>{o.credits}</td>
                      <td>
                        <form onSubmit={(e) => handleTopUp(e, o)} style={{ display: 'flex', gap: 6 }}>
                          <input className="input-sm" type="number" step="1" required placeholder="+1000"
                            value={topUp[o.id] || ''}
                            onChange={(e) => setTopUp({ ...topUp, [o.id]: e.target.value })}
                            style={{ width: 100 }} />
                          <button className="btn btn-primary btn-sm" type="submit">OK</button>
                        </form>
                      </td>
                      <td>
                        <button
                          className={`badge ${o.is_active ? 'active' : 'inactive'}`}
                          style={{ border: 'none', cursor: isOwn ? 'default' : 'pointer' }}
                          onClick={() => handleToggleActive(o)}
                          disabled={isOwn}
                          title={isOwn ? '' : o.is_active ? 'Дарж түр хаана' : 'Дарж идэвхжүүлнэ'}
                        >
                          {o.is_active ? 'Идэвхтэй' : 'Хаагдсан'}
                        </button>
                      </td>
                      <td className="actions">
                        <button className="btn btn-secondary btn-sm" title="Хэрэглэгч нэмэх"
                          onClick={() => setMember({ org: o, name: '', email: '', password: '', org_role: 'client' })}>
                          <Icon name="user" size={14} /> Нэмэх
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={7} style={{ background: 'var(--surface-2)', padding: '8px 22px 14px 44px' }}>
                          {members.length === 0 ? (
                            <span className="muted small">Ажилтан алга</span>
                          ) : (
                            <table style={{ background: 'var(--surface)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                              <thead><tr><th>Ажилтан</th><th>Байгууллагад</th><th>Мессеж</th><th>Нэмэгдсэн</th><th>Системийн эрх</th><th></th></tr></thead>
                              <tbody>
                                {members.map((u) => {
                                  const isMe = u.id === me?.id;
                                  return (
                                    <tr key={u.id}>
                                      <td>
                                        <div className="cell-strong">{u.name}{isMe && <span className="muted"> (та)</span>}</div>
                                        <div className="muted small">{u.email}</div>
                                      </td>
                                      <td>
                                        <span className={`badge plain ${u.org_role === 'owner' ? 'owner' : ''}`}>
                                          {orgRoleLabel(u.org_role)}
                                        </span>
                                      </td>
                                      <td className="mono">{u.message_count}</td>
                                      <td className="muted small">{formatDate(u.created_at)}</td>
                                      <td>
                                        {isMe ? <span className="badge admin">admin</span> : (
                                          <select className="input-sm" value={u.role} style={{ width: 'auto' }}
                                            onChange={(e) => handleRoleChange(u, e.target.value)}>
                                            <option value="user">Хэрэглэгч</option>
                                            <option value="admin">Admin</option>
                                          </select>
                                        )}
                                      </td>
                                      <td className="actions">
                                        {!isMe && (
                                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteUser(u)} title="Устгах">
                                            <Icon name="trash" size={15} />
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
