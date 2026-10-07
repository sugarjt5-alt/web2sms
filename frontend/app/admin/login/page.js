'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../../lib/api';
import AuthLayout, { LoginSwitch } from '../../../components/AuthLayout';
import { Alert } from '../../../components/ui';

// Зөвхөн admin эрхтэй хэрэглэгч нэвтрэх хуудас
export default function AdminLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiFetch('/auth/admin/login', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      router.push('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout variant="admin">
      <LoginSwitch active="admin" />
      <h1>Admin нэвтрэх</h1>
      <p className="sub">Зөвхөн системийн администраторт</p>
      <Alert>{error}</Alert>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">Имэйл</label>
          <input id="email" type="email" required autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="password">Нууц үг</label>
          <input id="password" type="password" required autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={loading}>
          {loading ? 'Түр хүлээнэ үү...' : 'Нэвтрэх'}
        </button>
      </form>
      <p className="auth-foot">
        Энгийн хэрэглэгч үү? <a href="/login" className="link">Хэрэглэгчээр нэвтрэх</a>
      </p>
    </AuthLayout>
  );
}
