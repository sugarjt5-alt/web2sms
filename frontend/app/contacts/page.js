'use client';
import { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import { apiFetch } from '../../lib/api';

export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [error, setError] = useState('');

  async function loadContacts() {
    try {
      const data = await apiFetch('/contacts');
      setContacts(data);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { loadContacts(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/contacts', { method: 'POST', body: JSON.stringify(form) });
      setForm({ name: '', phone: '' });
      loadContacts();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Устгах уу?')) return;
    await apiFetch(`/contacts/${id}`, { method: 'DELETE' });
    loadContacts();
  }

  return (
    <div>
      <Navbar />
      <div className="container">
        <h1>Contacts</h1>

        <div className="card">
          <h2>Шинэ contact нэмэх</h2>
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: 10, alignItems: 'end' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label>Нэр</label>
              <input required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label>Утасны дугаар</label>
              <input required placeholder="99112233" value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <button className="primary" type="submit">Нэмэх</button>
          </form>
          {error && <p className="error-text">{error}</p>}
        </div>

        <div className="card">
          <h2>Жагсаалт ({contacts.length})</h2>
          <table>
            <thead>
              <tr><th>Нэр</th><th>Утас</th><th></th></tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.phone}</td>
                  <td>
                    <button className="secondary" onClick={() => handleDelete(c.id)}>Устгах</button>
                  </td>
                </tr>
              ))}
              {contacts.length === 0 && (
                <tr><td colSpan={3} style={{ color: '#999' }}>Contact алга байна</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
