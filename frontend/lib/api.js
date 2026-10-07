// Backend руу дуудлага хийх туслах функц.
// Token байгаа бол automatically Authorization header-т нэмнэ.
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// Токен хүчингүй/хэрэглэгч устсан бол гаргаж, login руу шилжүүлнэ
function handleUnauthorized(path) {
  if (typeof window === 'undefined' || path.startsWith('/auth/')) return;
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = user?.role === 'admin' ? '/admin/login' : '/login';
}

export async function apiFetch(path, options = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 401) handleUnauthorized(path);
  if (!res.ok) {
    throw new Error(data.message || 'Алдаа гарлаа');
  }
  return data;
}

// Файл (жишээ нь CSV) upload хийхэд зориулсан функц.
// Энд Content-Type-ийг ЗААВАЛ бичихгүй — FormData ашиглахад browser
// өөрөө "multipart/form-data; boundary=..." гэдгийг автоматаар тохируулдаг.
export async function apiUpload(path, formData) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 401) handleUnauthorized(path);
  if (!res.ok) {
    throw new Error(data.message || 'Алдаа гарлаа');
  }
  return data;
}
