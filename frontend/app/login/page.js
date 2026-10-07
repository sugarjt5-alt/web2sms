'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../lib/api';
import AuthLayout, { LoginSwitch } from '../../components/AuthLayout';
import { Alert } from '../../components/ui';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiFetch('/auth/login', {
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
      <LoginSwitch active="user" />
      <h1>Тавтай морил</h1>
      <p className="sub">Байгууллагын бүртгэлээрээ нэвтэрнэ үү</p>
      {error && (
        <Alert>
          {error}
          {error.startsWith('Admin бүртгэл') && (
            <> — <a href="/admin/login" className="link">Admin нэвтрэх</a></>
          )}
        </Alert>
      )}
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">Имэйл</label>
          <input
            id="email" type="email" required autoComplete="email" placeholder="name@company.mn"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Нууц үг</label>
          <input
            id="password" type="password" required autoComplete="current-password" placeholder="••••••••"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
        <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={loading}>
          {loading ? 'Түр хүлээнэ үү...' : 'Нэвтрэх'}
        </button>
      </form>
      <p className="auth-foot">
        Бүртгэлгүй юу? <a href="/register" className="link">Хувь хүн</a> эсвэл{' '}
        <a href="/register?type=organization" className="link">байгууллагаар</a> бүртгүүлэх
      </p>
    </AuthLayout>
  );
}
