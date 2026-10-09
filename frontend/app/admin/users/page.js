'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AppShell from '../../../components/AppShell';
import Icon from '../../../components/Icon';
import { Alert, EmptyState, formatDate } from '../../../components/ui';
import { apiFetch, apiUpload } from '../../../lib/api';

const SOURCE_LABELS = {
  register: 'Өөрөө бүртгүүлсэн',
  admin: 'Admin нэмсэн',
  import: 'CSV импорт',
  team: 'Admin нэмсэн',
};
const NEW_MS = 24 * 60 * 60 * 1000;
const REFRESH_MS = 20 * 1000;

// Мөрүүдийг CSV болгож татуулах (Excel кирилл үсгийг зөв уншихын тулд BOM-той)
function downloadCsv(filename, rows) {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const text = '﻿' + rows.map((r) => r.map(escape).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Бүх хэрэглэгч (бүртгүүлсэн, нэвтэрдэг хүн бүр) + системийн admin-ууд
export default function AdminUsersPage() {
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [topUp, setTopUp] = useState({}); // { [accountId]: '100' }
  const [showImport, setShowImport] = useState(false);
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    try {
      setUsers(await apiFetch('/admin/users'));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    setMe(JSON.parse(localStorage.getItem('user') || 'null'));
    load();
    // Шинээр бүртгүүлсэн хэрэглэгчид хуудсыг шинэчлэхгүйгээр гарч ирнэ
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const admins = users.filter((u) => u.role === 'admin');
  const customers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users
      .filter((u) => u.role !== 'admin')
      .filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.includes(q) || (u.phone || '').includes(q));
  }, [users, search]);

  const isNew = (u) => Date.now() - new Date(u.created_at).getTime() < NEW_MS;
  const newCount = customers.filter(isNew).length;

  function flash(ok, msg) {
    setError(ok ? '' : msg);
    setSuccess(ok ? msg : '');
  }

  async function handleTopUp(e, u) {
    e.preventDefault();
    const amount = Number(topUp[u.organization_id]);
    try {
      const res = await apiFetch(`/admin/organizations/${u.organization_id}/credits`, {
        method: 'POST', body: JSON.stringify({ amount }),
      });
      setTopUp({ ...topUp, [u.organization_id]: '' });
      flash(true, `${u.name}: ${amount > 0 ? '+' : ''}${amount} кредит. Шинэ үлдэгдэл: ${res.credits}`);
      load();
    } catch (err) {
      flash(false, err.message);
    }
  }

  async function handleToggleActive(u) {
    if (!confirm(`${u.name}-ийн бүртгэлийг ${u.is_active ? 'түр хаах' : 'дахин нээх'} уу?`)) return;
    try {
      await apiFetch(`/admin/organizations/${u.organization_id}/active`, {
        method: 'PUT', body: JSON.stringify({ is_active: !u.is_active }),
      });
      load();
    } catch (err) {
      flash(false, err.message);
    }
  }

  async function handleRoleChange(u, role) {
    const warn = role === 'admin'
      ? `${u.name}-д системийн ADMIN эрх өгөх үү? Тэр хэрэглэгчийн хэсэгт нэвтэрч чадахгүй болно.`
      : `${u.name}-ийн admin эрхийг хасах уу?`;
    if (!confirm(warn)) return;
    try {
      await apiFetch(`/admin/users/${u.id}/role`, { method: 'PUT', body: JSON.stringify({ role }) });
      flash(true, `${u.name}: эрх "${role === 'admin' ? 'Admin' : 'Хэрэглэгч'}" боллоо`);
      load();
    } catch (err) {
      flash(false, err.message);
    }
  }

  async function handleDelete(u) {
    if (!confirm(`${u.name}-ийг устгах уу? Түүний кредит, түүх устна.`)) return;
    try {
      const res = await apiFetch(`/admin/users/${u.id}`, { method: 'DELETE' });
      flash(true, res.message);
      load();
    } catch (err) {
      flash(false, err.message);
    }
  }

  async function handleImport(e) {
    e.preventDefault();
    if (!file) return;
    setImporting(true);
    setError('');
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiUpload('/admin/users/import', formData);
      setImportResult(res);
      setFile(null);
      document.getElementById('users-csv').value = '';
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  function downloadCredentials() {
    const created = importResult.results.filter((r) => r.status === 'created');
    downloadCsv('нэвтрэх-мэдээлэл.csv', [
      ['нэр', 'имэйл', 'нууц үг', 'утас'],
      ...created.map((r) => [r.name, r.email, r.password || '(файлд өгсөн нууц үг)', r.phone || '']),
    ]);
  }

  const skipped = importResult?.results.filter((r) => r.status === 'skipped') || [];
  const withPasswords = importResult?.results.filter((r) => r.password).length || 0;

  return (
    <AppShell
      area="admin" title="Хэрэглэгчид"
      subtitle={`Нийт ${users.filter((u) => u.role !== 'admin').length} хэрэглэгч${newCount ? ` · сүүлийн 24 цагт ${newCount} шинэ` : ''}`}
      actions={!showImport && (
        <button className="btn btn-primary" onClick={() => setShowImport(true)}>
          <Icon name="upload" size={16} /> CSV-ээс оруулах
        </button>
      )}
    >
      <Alert>{error}</Alert>
      <Alert type="success">{success}</Alert>

      {showImport && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2>CSV файлаас хэрэглэгч оруулах</h2>
              <p>Мөр бүр нэг хэрэглэгч болно. Нэг файлд 300 хүртэл мөр.</p>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => downloadCsv('хэрэглэгч-загвар.csv', [
                ['нэр', 'имэйл', 'нууц үг', 'утас'],
                ['Бат', 'bat@gmail.com', '', '99112233'],
                ['Сараа', 'saraa@gmail.com', 'MyPass2026', '88112233'],
              ])}>
                <Icon name="download" size={14} /> Жишээ файл
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowImport(false); setImportResult(null); }}>
                <Icon name="x" size={14} />
              </button>
            </div>
          </div>

          <div className="grid-2">
            <form onSubmit={handleImport}>
              <div className="field">
                <input id="users-csv" type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files[0] || null)} />
                <div className="hint">Excel-ээс "CSV UTF-8" форматаар хадгална.</div>
              </div>
              <button className="btn btn-primary" type="submit" disabled={!file || importing}>
                <Icon name="upload" size={16} /> {importing ? 'Оруулж байна... (хэдэн секунд)' : 'Оруулах'}
              </button>
            </form>
            <div className="small muted">
              <div className="label">Баганууд (дарааллаараа)</div>
              <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                <li><strong>нэр</strong></li>
                <li><strong>имэйл</strong>: нэвтрэх нэр</li>
                <li><strong>нууц үг</strong>: хоосон бол систем үүсгэнэ</li>
                <li><strong>утас</strong>: SMS хүлээн авах дугаар</li>
              </ol>
            </div>
          </div>

          {importResult && (
            <div style={{ marginTop: 18 }}>
              <Alert type={importResult.created > 0 ? 'success' : 'warning'}>
                <strong>{importResult.created}</strong> хэрэглэгч нэмэгдлээ
                {importResult.skipped > 0 && `, ${importResult.skipped} мөр алгасагдлаа`}.
              </Alert>
              {importResult.created > 0 && (
                <div className="secret-box">
                  <span style={{ flex: 1, minWidth: 200 }}>
                    {withPasswords > 0
                      ? <><strong>{withPasswords}</strong> хэрэглэгчийн нууц үгийг систем үүсгэсэн. Энэ файлыг <strong>одоо татаж</strong> хэрэглэгчдэд тараана уу. Дахин харагдахгүй.</>
                      : 'Нэвтрэх мэдээллийн жагсаалтыг татаж авах боломжтой.'}
                  </span>
                  <button className="btn btn-secondary btn-sm" onClick={downloadCredentials}>
                    <Icon name="download" size={14} /> Нэвтрэх мэдээлэл татах
                  </button>
                </div>
              )}
              {skipped.length > 0 && (
                <div className="table-wrap" style={{ border: '1px solid var(--border)', borderRadius: 10 }}>
                  <table>
                    <thead><tr><th>Мөр</th><th>Имэйл</th><th>Алгассан шалтгаан</th></tr></thead>
                    <tbody>
                      {skipped.map((r) => (
                        <tr key={r.row}>
                          <td className="mono">{r.row}</td>
                          <td>{r.email || '—'}</td>
                          <td style={{ color: 'var(--danger)' }}>{r.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div>
            <h2>Жагсаалт</h2>
            <p>20 секунд тутам автоматаар шинэчлэгдэнэ</p>
          </div>
          <div className="search" style={{ width: 260, maxWidth: '100%' }}>
            <Icon name="search" size={16} />
            <input placeholder="Нэр, имэйл, утсаар хайх" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        {customers.length === 0 ? (
          <EmptyState icon="user" title={search ? 'Хайлтад тохирох хэрэглэгч алга' : 'Хэрэглэгч алга байна'} />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Хэрэглэгч</th><th>Утас</th><th>Хүлээн авсан SMS</th><th>Кредит</th><th>Цэнэглэх</th><th>Төлөв</th><th>Бүртгэл</th><th></th></tr>
              </thead>
              <tbody>
                {customers.map((u) => (
                  <tr key={u.id} style={isNew(u) ? { background: '#fffbeb' } : { opacity: u.is_active === false ? 0.6 : 1 }}>
                    <td>
                      <div className="cell-strong">
                        {u.name}
                        {isNew(u) && <span className="badge awaiting plain" style={{ marginLeft: 8 }}>Шинэ</span>}
                      </div>
                      <div className="muted small">{u.email}</div>
                    </td>
                    <td className="mono small">{u.phone || '—'}</td>
                    <td className="mono">{u.received_count}</td>
                    <td className="mono" style={{ fontWeight: 700 }}>{u.credits ?? 0}</td>
                    <td>
                      <form onSubmit={(e) => handleTopUp(e, u)} style={{ display: 'flex', gap: 6 }}>
                        <input className="input-sm" type="number" step="1" required placeholder="+100"
                          value={topUp[u.organization_id] || ''}
                          onChange={(e) => setTopUp({ ...topUp, [u.organization_id]: e.target.value })}
                          style={{ width: 86 }} />
                        <button className="btn btn-primary btn-sm" type="submit">OK</button>
                      </form>
                    </td>
                    <td>
                      <button className={`badge ${u.is_active ? 'active' : 'inactive'}`}
                        style={{ border: 'none', cursor: 'pointer' }} onClick={() => handleToggleActive(u)}
                        title={u.is_active ? 'Дарж түр хаана' : 'Дарж нээнэ'}>
                        {u.is_active ? 'Идэвхтэй' : 'Хаагдсан'}
                      </button>
                    </td>
                    <td className="small">
                      {formatDate(u.created_at)}
                      <div className="muted">{SOURCE_LABELS[u.created_via] || u.created_via}</div>
                    </td>
                    <td className="actions">
                      <select className="input-sm" value={u.role} style={{ width: 'auto', marginRight: 6 }}
                        onChange={(e) => handleRoleChange(u, e.target.value)} title="Системийн эрх">
                        <option value="user">Хэрэглэгч</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u)} title="Устгах">
                        <Icon name="trash" size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header"><h2>Системийн admin-ууд ({admins.length})</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Admin</th><th>Нэмэгдсэн</th><th>Эрх</th><th></th></tr></thead>
            <tbody>
              {admins.map((u) => {
                const isMe = u.id === me?.id;
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="cell-strong">{u.name}{isMe && <span className="muted"> (та)</span>}</div>
                      <div className="muted small">{u.email}</div>
                    </td>
                    <td className="muted small">{formatDate(u.created_at)}</td>
                    <td>
                      {isMe ? <span className="badge admin">admin</span> : (
                        <select className="input-sm" value={u.role} style={{ width: 'auto' }}
                          onChange={(e) => handleRoleChange(u, e.target.value)}>
                          <option value="admin">Admin</option>
                          <option value="user">Хэрэглэгч болгох</option>
                        </select>
                      )}
                    </td>
                    <td className="actions">
                      {!isMe && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u)} title="Устгах">
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
    </AppShell>
  );
}
