'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../lib/api';
import AuthLayout from '../../components/AuthLayout';
import Icon from '../../components/Icon';
import { Alert } from '../../components/ui';

const EMPTY = { name: '', phone: '', email: '', password: '', organizationName: '', registrationNo: '' };

// Бүртгүүлэх: хувь хүн эсвэл байгууллага (байгууллага ажилтнаа нэмж болно)
export default function RegisterPage() {
  const router = useRouter();
  const [type, setType] = useState('individual'); // 'individual' | 'organization'
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isOrg = type === 'organization';

  // /register?type=organization линкээр шууд байгууллагын таб нээгдэнэ
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('type') === 'organization') setType('organization');
  }, []);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ ...form, accountType: type }),
      });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      router.push('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div className="segmented login-switch">
        <button type="button" className={!isOrg ? 'active' : ''} onClick={() => { setType('individual'); setError(''); }}>
          <Icon name="user" size={15} /> Хувь хүн
        </button>
        <button type="button" className={isOrg ? 'active' : ''} onClick={() => { setType('organization'); setError(''); }}>
          <Icon name="building" size={15} /> Байгууллага
        </button>
      </div>

      <h1>{isOrg ? 'Байгууллагаар бүртгүүлэх' : 'Хувь хүнээр бүртгүүлэх'}</h1>
      <p className="sub">
        {isOrg
          ? 'Ажилтнуудаа нэмж, хамтдаа SMS илгээх, API холбох боломжтой'
          : 'Өөрийн хэрэгцээнд SMS илгээх энгийн бүртгэл'}
      </p>
      <Alert>{error}</Alert>

      <form onSubmit={handleSubmit}>
        {isOrg && (
          <>
            <div className="field">
              <label htmlFor="org">Байгууллагын нэр</label>
              <input id="org" required placeholder="Жишээ: Номин ХХК" value={form.organizationName}
                onChange={set('organizationName')} />
            </div>
            <div className="field">
              <label htmlFor="reg">Регистрийн дугаар</label>
              <input id="reg" required inputMode="numeric" pattern="\d{7}" maxLength={7} placeholder="1234567"
                title="7 оронтой тоо" value={form.registrationNo} onChange={set('registrationNo')} />
            </div>
          </>
        )}

        <div className="field">
          <label htmlFor="name">{isOrg ? 'Хариуцсан хүний нэр' : 'Таны нэр'}</label>
          <input id="name" required autoComplete="name" value={form.name} onChange={set('name')} />
        </div>
        <div className="field">
          <label htmlFor="phone">{isOrg ? 'Холбогдох утас' : 'Утасны дугаар'}</label>
          <input id="phone" required type="tel" inputMode="tel" autoComplete="tel" placeholder="99112233"
            value={form.phone} onChange={set('phone')} />
        </div>
        <div className="field">
          <label htmlFor="email">Имэйл (нэвтрэх нэр)</label>
          <input id="email" type="email" required autoComplete="email"
            placeholder={isOrg ? 'name@company.mn' : 'name@gmail.com'}
            value={form.email} onChange={set('email')} />
        </div>
        <div className="field">
          <label htmlFor="password">Нууц үг</label>
          <input id="password" type="password" required minLength={8} autoComplete="new-password"
            value={form.password} onChange={set('password')} />
          <div className="hint">Дор хаяж 8 тэмдэгт</div>
        </div>

        <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={loading}>
          {loading ? 'Түр хүлээнэ үү...' : 'Бүртгүүлэх'}
        </button>
      </form>
      <p className="auth-foot">
        Бүртгэлтэй юу? <a href="/login" className="link">Нэвтрэх</a>
      </p>
    </AuthLayout>
  );
}
