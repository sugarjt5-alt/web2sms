'use client';
import { useEffect, useState } from 'react';
import AppShell from '../../../components/AppShell';
import Icon from '../../../components/Icon';
import { Alert, EmptyState } from '../../../components/ui';
import { apiFetch } from '../../../lib/api';
import { countSms } from '../../../lib/sms';

const EMPTY = { id: null, name: '', content: '' };

// Байнга илгээдэг мессежийн загварууд
export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  async function load() {
    try {
      setTemplates(await apiFetch('/templates'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    try {
      const body = JSON.stringify({ name: form.name, content: form.content });
      if (form.id) await apiFetch(`/templates/${form.id}`, { method: 'PUT', body });
      else await apiFetch('/templates', { method: 'POST', body });
      setForm(EMPTY);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Загварыг устгах уу?')) return;
    try {
      await apiFetch(`/templates/${id}`, { method: 'DELETE' });
      if (form.id === id) setForm(EMPTY);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const sms = countSms(form.content.trim());

  return (
    <AppShell area="admin" title="Загварууд" subtitle="Байнга илгээдэг мессежээ хадгалаад нэг товшилтоор ашиглана">
      <Alert>{error}</Alert>

      <div className="grid-main">
        <div className="card">
          <div className="card-header"><h2>Хадгалсан загварууд ({templates.length})</h2></div>
          {loaded && templates.length === 0 ? (
            <EmptyState icon="template" title="Загвар алга байна">
              Баруун талаас эхний загвараа үүсгэнэ үү.
            </EmptyState>
          ) : (
            <div className="template-grid">
              {templates.map((t) => (
                <div className="template-card" key={t.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong>{t.name}</strong>
                    <span className="muted small">{countSms(t.content).segments} SMS</span>
                  </div>
                  <div className="body">{t.content}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                    <a href={`/admin/compose?template=${t.id}`} className="btn btn-primary btn-sm">
                      <Icon name="send" size={14} /> Ашиглах
                    </a>
                    <button className="btn btn-secondary btn-sm" onClick={() => setForm(t)}>
                      <Icon name="edit" size={14} /> Засах
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id)} title="Устгах">
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card sticky">
          <div className="card-header">
            <h2>{form.id ? 'Загвар засах' : 'Шинэ загвар'}</h2>
          </div>
          <form onSubmit={handleSave}>
            <div className="field">
              <label htmlFor="t-name">Нэр</label>
              <input id="t-name" required placeholder="Жишээ: Захиалга бэлэн" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="t-content">Агуулга</label>
              <textarea id="t-content" required value={form.content}
                placeholder={'Сайн байна уу {нэр}, таны захиалга бэлэн боллоо.'}
                onChange={(e) => setForm({ ...form, content: e.target.value })} />
              <div className="hint">
                {sms.length} тэмдэгт · {sms.segments} SMS. <code className="inline">{'{нэр}'}</code> гэж бичвэл хүлээн авагчийн нэрээр солигдоно.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" type="submit">{form.id ? 'Хадгалах' : 'Үүсгэх'}</button>
              {form.id && <button type="button" className="btn btn-ghost" onClick={() => setForm(EMPTY)}>Болих</button>}
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
