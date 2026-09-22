'use client';
import { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import { apiFetch } from '../../lib/api';

export default function GroupsPage() {
  const [groups, setGroups] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null); // group id, contact нэмэх горимд
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [error, setError] = useState('');

  async function loadAll() {
    try {
      const [g, c] = await Promise.all([apiFetch('/groups'), apiFetch('/contacts')]);
      setGroups(g);
      setContacts(c);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { loadAll(); }, []);

  async function handleCreateGroup(e) {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/groups', { method: 'POST', body: JSON.stringify({ name: groupName }) });
      setGroupName('');
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  function toggleContact(id) {
    setSelectedContacts((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function handleAddContacts() {
    if (!selectedGroup || selectedContacts.length === 0) return;
    try {
      await apiFetch(`/groups/${selectedGroup}/contacts`, {
        method: 'POST',
        body: JSON.stringify({ contactIds: selectedContacts }),
      });
      setSelectedContacts([]);
      setSelectedGroup(null);
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteGroup(id) {
    if (!confirm('Group-ийг устгах уу?')) return;
    await apiFetch(`/groups/${id}`, { method: 'DELETE' });
    loadAll();
  }

  return (
    <div>
      <Navbar />
      <div className="container">
        <h1>Contact Groups</h1>

        <div className="card">
          <h2>Шинэ group үүсгэх</h2>
          <form onSubmit={handleCreateGroup} style={{ display: 'flex', gap: 10 }}>
            <input
              style={{ flex: 1 }}
              placeholder="Group-ийн нэр (жишээ: VIP хэрэглэгчид)"
              required value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
            <button className="primary" type="submit">Үүсгэх</button>
          </form>
          {error && <p className="error-text">{error}</p>}
        </div>

        <div className="card">
          <h2>Group-ууд ({groups.length})</h2>
          <table>
            <thead><tr><th>Нэр</th><th>Contact тоо</th><th></th></tr></thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id}>
                  <td>{g.name}</td>
                  <td>{g.contact_count}</td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button className="secondary" onClick={() => setSelectedGroup(g.id)}>
                      Contact нэмэх
                    </button>
                    <button className="secondary" onClick={() => handleDeleteGroup(g.id)}>
                      Устгах
                    </button>
                  </td>
                </tr>
              ))}
              {groups.length === 0 && (
                <tr><td colSpan={3} style={{ color: '#999' }}>Group алга байна</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {selectedGroup && (
          <div className="card">
            <h2>Group-д contact сонгох</h2>
            {contacts.map((c) => (
              <div className="checkbox-row" key={c.id}>
                <input
                  type="checkbox"
                  checked={selectedContacts.includes(c.id)}
                  onChange={() => toggleContact(c.id)}
                />
                <span>{c.name} — {c.phone}</span>
              </div>
            ))}
            <div style={{ marginTop: 12 }}>
              <button className="primary" onClick={handleAddContacts} style={{ marginRight: 8 }}>
                Нэмэх ({selectedContacts.length})
              </button>
              <button className="secondary" onClick={() => { setSelectedGroup(null); setSelectedContacts([]); }}>
                Цуцлах
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
