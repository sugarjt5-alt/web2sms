'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    <div className="container" style={{ maxWidth: 400 }}>
      <div className="card">
        <h1>Бүртгүүлэх</h1>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Нэр</label>
            <input required value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Имэйл</label>
            <input type="email" required value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Нууц үг</label>
            <input type="password" required minLength={6} value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="primary" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Түр хүлээнэ үү...' : 'Бүртгүүлэх'}
          </button>
        </form>
        <p style={{ marginTop: 14, fontSize: 13 }}>
          Бүртгэлтэй юу? <a href="/login" style={{ color: '#2563eb' }}>Нэвтрэх</a>
        </p>
      </div>
    </div>
  );
}
