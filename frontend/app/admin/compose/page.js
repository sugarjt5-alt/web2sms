'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../../../components/AppShell';
import Icon from '../../../components/Icon';
import { Alert, EmptyState } from '../../../components/ui';
import { apiFetch } from '../../../lib/api';
import { countSms, personalize, hasPlaceholder, MAX_SEGMENTS } from '../../../lib/sms';

// datetime-local input-д зориулсан локал цаг: "2026-10-05T14:30"
function toLocalInput(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const AUDIENCES = [
  { value: 'all', label: 'Бүгд' },
  { value: 'individuals', label: 'Хувь хэрэглэгчид' },
  { value: 'organizations', label: 'Байгууллагууд' },
  { value: 'selected', label: 'Сонгох' },
];

// Admin SMS илгээх: бүртгэлтэй хэрэглэгчид (хувь хүн, байгууллага) рүү. Кредит хасагдахгүй.
export default function AdminComposePage() {
  const router = useRouter();
  const textareaRef = useRef(null);
  const [templates, setTemplates] = useState([]);
  const [accounts, setAccounts] = useState([]); // бүртгэлтэй хэрэглэгчид (утастай, идэвхтэй)
  const [withoutPhone, setWithoutPhone] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [audience, setAudience] = useState('all');
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [content, setContent] = useState('');
  const [scheduleOn, setScheduleOn] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [saveName, setSaveName] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([apiFetch('/templates'), apiFetch('/admin/recipients')])
      .then(([t, r]) => {
        setTemplates(t);
        setAccounts(r.accounts);
        setWithoutPhone(r.without_phone);
        const templateId = new URLSearchParams(window.location.search).get('template');
        const tpl = t.find((x) => String(x.id) === templateId);
        if (tpl) setContent(tpl.content);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoaded(true));
  }, []);

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => (!q ? accounts
    : accounts.filter((a) => a.name.toLowerCase().includes(q) || a.phone.includes(q))), [accounts, q]);
  const allFilteredSelected = filtered.length > 0 && filtered.every((a) => selected.includes(a.id));

  function toggle(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function toggleAll() {
    const ids = filtered.map((a) => a.id);
    setSelected((prev) => (allFilteredSelected ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]));
  }

  function insertPlaceholder() {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? content.length;
    const end = el?.selectionEnd ?? content.length;
    setContent(`${content.slice(0, start)}{нэр}${content.slice(end)}`);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + 5, start + 5); });
  }

  async function saveTemplate(e) {
    e.preventDefault();
    try {
      const t = await apiFetch('/templates', { method: 'POST', body: JSON.stringify({ name: saveName, content }) });
      setTemplates([...templates, t].sort((a, b) => a.name.localeCompare(b.name)));
      setSaveName(null);
      setSuccess(`"${t.name}" загвар хадгалагдлаа`);
    } catch (err) {
      setError(err.message);
    }
  }

  const recipients = useMemo(() => {
    if (audience === 'selected') return accounts.filter((a) => selected.includes(a.id));
    if (audience === 'all') return accounts;
    const type = audience === 'individuals' ? 'individual' : 'organization';
    return accounts.filter((a) => a.type === type);
  }, [audience, accounts, selected]);

  // Нэг дугаар руу давхар явахгүй (backend ч давхардлыг хасна)
  const uniqueCount = useMemo(() => new Set(recipients.map((r) => r.phone)).size, [recipients]);

  const text = content.trim();
  const personalized = hasPlaceholder(text);
  const totalSms = useMemo(() => {
    if (!text) return 0;
    if (!personalized) return countSms(text).segments * uniqueCount;
    return recipients.reduce((s, r) => s + countSms(personalize(text, r.name)).segments, 0);
  }, [text, personalized, recipients, uniqueCount]);
  const maxSegments = personalized && recipients.length
    ? Math.max(...recipients.map((r) => countSms(personalize(text, r.name)).segments)) : countSms(text).segments;

  const sms = countSms(text);
  const previewName = recipients[0]?.name || 'Бат';
  const previewText = text ? personalize(text, previewName) : '';
  const tooLong = maxSegments > MAX_SEGMENTS;

  async function handleSend(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (uniqueCount === 0) { setError('Хүлээн авагч сонгоно уу'); return; }
    if (scheduleOn && !scheduleAt) { setError('Илгээх огноо, цагаа сонгоно уу'); return; }
    if (audience !== 'selected' && !confirm(`Бүртгэлтэй ${uniqueCount} хэрэглэгч рүү SMS илгээх үү?`)) return;

    setLoading(true);
    try {
      const body = { content };
      if (audience === 'selected') body.organizationIds = selected;
      else body.audience = audience;
      if (scheduleOn) body.scheduledAt = new Date(scheduleAt).toISOString();

      const res = await apiFetch('/messages/send', { method: 'POST', body: JSON.stringify(body) });
      setSuccess(scheduleOn ? 'Хуваарьт илгээлт үүслээ.' : 'SMS дараалалд орлоо. Илгээлтийн явц руу шилжиж байна...');
      setTimeout(() => router.push(`/admin/history/${res.data.id}`), 1000);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <AppShell area="admin" title="SMS илгээх" subtitle="Бүртгэлтэй хувь хэрэглэгчид, байгууллагууд руу">
      <form onSubmit={handleSend} className="grid-main">
        <div>
          <div className="card">
            <div className="card-header">
              <div>
                <h2>1. Хүлээн авагч</h2>
                <p>{uniqueCount} дугаар сонгогдсон</p>
              </div>
              <div className="segmented">
                {AUDIENCES.map((a) => (
                  <button key={a.value} type="button" className={audience === a.value ? 'active' : ''}
                    onClick={() => setAudience(a.value)}>{a.label}</button>
                ))}
              </div>
            </div>

            {withoutPhone > 0 && (
              <p className="muted small" style={{ marginBottom: 10 }}>
                {withoutPhone} бүртгэл утасны дугааргүй тул жагсаалтад ороогүй. Хаагдсан бүртгэлүүд ч орохгүй.
              </p>
            )}

            {loaded && accounts.length === 0 ? (
              <EmptyState icon="contacts" title="Утастай бүртгэлтэй хэрэглэгч алга байна">
                Хэрэглэгчид бүртгүүлэхдээ утсаа оруулна.
              </EmptyState>
            ) : audience === 'selected' ? (
              <>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <div className="search" style={{ flex: 1 }}>
                    <Icon name="search" size={16} />
                    <input placeholder="Нэр эсвэл утсаар хайх" value={search} onChange={(e) => setSearch(e.target.value)} />
                  </div>
                  <button type="button" className="btn btn-secondary" onClick={toggleAll}>
                    {allFilteredSelected ? 'Сонголт цуцлах' : 'Бүгдийг сонгох'}
                  </button>
                </div>
                <div className="check-list">
                  {filtered.map((a) => (
                    <label className="check-row" key={a.id}>
                      <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} />
                      <span>{a.name}</span>
                      <span className={`badge plain ${a.type === 'individual' ? 'scheduled' : 'owner'}`}>
                        {a.type === 'individual' ? 'Хувь хүн' : 'Байгууллага'}
                      </span>
                      <span className="sub">{a.phone}</span>
                    </label>
                  ))}
                  {filtered.length === 0 && <div className="empty small">Хайлтад тохирох бүртгэл алга</div>}
                </div>
              </>
            ) : (
              <div className="invoice">
                <strong>{recipients.length}</strong> бүртгэлийн утас руу илгээнэ
                {audience === 'all' && ' (хувь хэрэглэгчид + байгууллагууд)'}.
                <div className="muted small" style={{ marginTop: 4 }}>
                  {'{нэр}'} нь хувь хүний нэр эсвэл байгууллагын нэрээр солигдоно.
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <h2>2. Мессеж</h2>
              {templates.length > 0 && (
                <select className="input-sm" style={{ width: 'auto', maxWidth: 240 }} value=""
                  onChange={(e) => {
                    const t = templates.find((x) => String(x.id) === e.target.value);
                    if (t) setContent(t.content);
                  }}>
                  <option value="">Загвар ашиглах...</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
            </div>
            <div className="toolbar">
              <button type="button" className="chip" onClick={insertPlaceholder}>+ {'{нэр}'} оруулах</button>
              <span className="muted small">Хүн бүрт өөрийн нэрээр нь очно</span>
            </div>
            <textarea ref={textareaRef} required value={content} onChange={(e) => setContent(e.target.value)}
              placeholder={'Жишээ: Сайн байна уу {нэр}, ...'} />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
              <span className="small" style={{ color: tooLong ? 'var(--danger)' : 'var(--muted)' }}>
                {sms.length} тэмдэгт · {sms.segments} SMS
                {' '}({sms.encoding === 'UCS-2' ? 'кирилл: 70 тэмдэгт/SMS' : 'латин: 160 тэмдэгт/SMS'})
                {tooLong && ` — дээд тал нь ${MAX_SEGMENTS} SMS`}
              </span>
              {text && saveName === null && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSaveName('')}>
                  <Icon name="template" size={14} /> Загвар болгон хадгалах
                </button>
              )}
            </div>
            {saveName !== null && (
              <div className="form-row" style={{ marginTop: 12 }}>
                <div className="field">
                  <input placeholder="Загварын нэр" value={saveName} autoFocus
                    onChange={(e) => setSaveName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveTemplate(e); }} />
                </div>
                <button type="button" className="btn btn-secondary" onClick={saveTemplate} disabled={!saveName.trim()}>Хадгалах</button>
                <button type="button" className="btn btn-ghost" onClick={() => setSaveName(null)}>Болих</button>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header"><h2>3. Хэзээ илгээх</h2></div>
            <div className="segmented">
              <button type="button" className={!scheduleOn ? 'active' : ''} onClick={() => setScheduleOn(false)}>Одоо</button>
              <button type="button" className={scheduleOn ? 'active' : ''}
                onClick={() => {
                  setScheduleOn(true);
                  if (!scheduleAt) setScheduleAt(toLocalInput(new Date(Date.now() + 60 * 60 * 1000)));
                }}>
                <Icon name="clock" size={14} /> Хуваарьт
              </button>
            </div>
            {scheduleOn && (
              <div className="field" style={{ marginTop: 14, marginBottom: 0, maxWidth: 280 }}>
                <input type="datetime-local" value={scheduleAt}
                  min={toLocalInput(new Date(Date.now() + 2 * 60 * 1000))}
                  onChange={(e) => setScheduleAt(e.target.value)} />
              </div>
            )}
          </div>
        </div>

        <div className="sticky">
          <div className="card">
            <div className="card-header">
              <h2>Урьдчилж харах</h2>
              {personalized && <span className="muted small">{previewName}-д</span>}
            </div>
            <div className="phone">
              <div className="phone-notch" />
              <div className="phone-sender">WEB2SMS</div>
              <div className={`bubble ${previewText ? '' : 'placeholder'}`}>
                {previewText || 'Таны мессеж энд харагдана'}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="summary">
              <div className="summary-row"><span>Хүлээн авагч</span><strong>{uniqueCount}</strong></div>
              <div className="summary-row">
                <span>Нэг мессеж</span>
                <strong>{personalized && recipients.length ? `≤ ${maxSegments}` : sms.segments} SMS</strong>
              </div>
              {scheduleOn && scheduleAt && (
                <div className="summary-row">
                  <span>Илгээх цаг</span>
                  <strong>{new Date(scheduleAt).toLocaleString('mn-MN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</strong>
                </div>
              )}
              <div className="summary-row summary-total"><span>Нийт SMS</span><span>{totalSms}</span></div>
              <p className="muted small">Admin-ий илгээлтээс кредит хасагдахгүй.</p>
            </div>
            <div style={{ marginTop: 16 }}>
              <Alert>{error}</Alert>
              <Alert type="success">{success}</Alert>
              <button className="btn btn-primary btn-block btn-lg" type="submit"
                disabled={loading || tooLong || totalSms === 0}>
                <Icon name={scheduleOn ? 'clock' : 'send'} size={16} />
                {loading ? 'Түр хүлээнэ үү...' : scheduleOn ? 'Хуваарьт оруулах' : 'Илгээх'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </AppShell>
  );
}
