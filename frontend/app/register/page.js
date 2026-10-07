'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../lib/api';
import AuthLayout from '../../components/AuthLayout';
import { Alert } from '../../components/ui';

const EMPTY = { name: '', phone: '', email: '', password: '' };

// Бүртгүүлэх: зөвхөн хувь хүнээр (байгууллагыг admin бүртгэнэ)
export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify(form),
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
      <h1>Бүртгүүлэх</h1>
      <p className="sub">Хэдхэн секундэд бүртгэлээ үүсгэнэ үү</p>
      <Alert>{error}</Alert>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="name">Таны нэр</label>
          <input id="name" required autoComplete="name" value={form.name} onChange={set('name')} />
        </div>
        <div className="field">
          <label htmlFor="phone">Утасны дугаар</label>
          <input id="phone" required type="tel" inputMode="tel" autoComplete="tel" placeholder="99112233"
            value={form.phone} onChange={set('phone')} />
        </div>
        <div className="field">
          <label htmlFor="email">Имэйл (нэвтрэх нэр)</label>
          <input id="email" type="email" required autoComplete="email" placeholder="name@gmail.com"
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
