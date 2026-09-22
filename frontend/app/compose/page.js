'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import { apiFetch } from '../../lib/api';

export default function ComposePage() {
  const router = useRouter();
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [mode, setMode] = useState('contacts'); // 'contacts' | 'group'
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [c, g] = await Promise.all([apiFetch('/contacts'), apiFetch('/groups')]);
        setContacts(c);
        setGroups(g);
      } catch (err) {
        setError(err.message);
      }
    }
    load();
  }, []);

  function toggleContact(id) {
    setSelectedContacts((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function handleSend(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (mode === 'contacts' && selectedContacts.length === 0) {
      setError('Дор хаяж нэг contact сонгоно уу');
      return;
    }
    if (mode === 'group' && !selectedGroup) {
      setError('Group сонгоно уу');
      return;
    }

    setLoading(true);
    try {
      const body = { content };
      if (mode === 'contacts') body.contactIds = selectedContacts;
      else body.groupId = Number(selectedGroup);

      const res = await apiFetch('/messages/send', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setSuccess('SMS амжилттай дараалалд орлоо! Түүх хэсгээс явцыг харна уу.');
      setTimeout(() => router.push(`/history/${res.data.id}`), 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Navbar />
      <div className="container">
        <h1>SMS бичих / Bulk илгээх</h1>

        <form onSubmit={handleSend}>
          <div className="card">
            <h2>Хүлээн авагч сонгох</h2>
            <div style={{ marginBottom: 12 }}>
              <label>
                <input type="radio" checked={mode === 'contacts'}
                  onChange={() => setMode('contacts')} /> Contact-аар шууд сонгох
              </label>
              <label style={{ marginLeft: 20 }}>
                <input type="radio" checked={mode === 'group'}
                  onChange={() => setMode('group')} /> Group-оор илгээх
              </label>
            </div>

            {mode === 'contacts' && (
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                {contacts.map((c) => (
                  <div className="checkbox-row" key={c.id}>
                    <input type="checkbox" checked={selectedContacts.includes(c.id)}
                      onChange={() => toggleContact(c.id)} />
                    <span>{c.name} — {c.phone}</span>
                  </div>
                ))}
                {contacts.length === 0 && <p style={{ color: '#999' }}>Contact алга байна</p>}
              </div>
            )}

            {mode === 'group' && (
              <select value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)}>
                <option value="">-- Group сонгох --</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name} ({g.contact_count})</option>
                ))}
              </select>
            )}
          </div>

          <div className="card">
            <h2>Мессежийн агуулга</h2>
            <textarea required maxLength={480} value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="SMS-ийн текстээ энд бичнэ үү..." />
            <p style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{content.length}/480</p>
          </div>

          {error && <p className="error-text">{error}</p>}
          {success && <p style={{ color: '#16a34a', fontSize: 13 }}>{success}</p>}

          <button className="primary" type="submit" disabled={loading}>
            {loading ? 'Илгээж байна...' : '📨 Илгээх'}
          </button>
        </form>
      </div>
    </div>
  );
}
