'use client';
import { useRouter } from 'next/navigation';

// Толгойн навигаци — нэвтэрсэн бол л харагдана (dashboard, contacts гэх мэт хуудсуудад ашиглана)
export default function Navbar() {
  const router = useRouter();

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  }

  return (
    <div className="navbar">
      <div>
        <span className="brand">WEB2SMS</span>
        <a href="/dashboard" style={{ marginLeft: 24 }}>Dashboard</a>
        <a href="/contacts">Contacts</a>
        <a href="/groups">Groups</a>
        <a href="/compose">SMS бичих</a>
        <a href="/history">Түүх</a>
      </div>
      <button onClick={handleLogout}>Гарах</button>
    </div>
  );
}
