'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Icon from './Icon';
import { apiFetch } from '../lib/api';

// Хэрэглэгчийн цэс. SMS илгээх хэсгүүд зөвхөн admin-д.
const USER_NAV = [
  { items: [{ href: '/dashboard', label: 'Хянах самбар', icon: 'dashboard' }] },
  {
    section: 'Төлбөр',
    items: [
      { href: '/billing', label: 'Багц худалдан авах', icon: 'cart', exact: true },
      { href: '/billing/history', label: 'Кредитийн түүх', icon: 'coin' },
    ],
  },
  {
    section: 'Тохиргоо',
    items: [{ href: '/team', label: 'Миний бүртгэл', icon: 'user' }],
  },
];

// Системийн admin-ий цэс — бүлгээр
const ADMIN_NAV = [
  { items: [{ href: '/admin', label: 'Тойм', icon: 'dashboard', exact: true }] },
  {
    section: 'Мессеж',
    items: [
      { href: '/admin/compose', label: 'SMS илгээх', icon: 'send' },
      { href: '/admin/history', label: 'Илгээлтийн түүх', icon: 'history' },
      { href: '/admin/templates', label: 'Загварууд', icon: 'template' },
    ],
  },
  {
    section: 'Хэрэглэгч',
    items: [{ href: '/admin/users', label: 'Хэрэглэгчид', icon: 'contacts', badge: 'new_users' }],
  },
  {
    section: 'Төлбөр',
    items: [
      { href: '/admin/orders', label: 'Захиалгууд', icon: 'invoice', badge: 'pending_orders' },
      { href: '/admin/packages', label: 'Багц, үнэ', icon: 'cart' },
    ],
  },
  {
    section: 'Тохиргоо',
    items: [{ href: '/admin/settings', label: 'Төлбөрийн заавар', icon: 'settings' }],
  },
];

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

// Нэвтэрсэн хуудсуудын үндсэн хүрээ: зүүн цэс + гарчиг + агуулга.
// area="user" (анхдагч) — хэрэглэгч; area="admin" — системийн admin.
// Буруу хэсэгт орсон хэрэглэгчийг өөрийнх нь хэсэг рүү шилжүүлнэ.
export default function AppShell({ area = 'user', title, subtitle, actions, children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [counts, setCounts] = useState({}); // цэсний тэмдэглэгээ: { pending_orders: 3 }
  const [open, setOpen] = useState(false);
  const isAdminArea = area === 'admin';

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!localStorage.getItem('token') || !stored) {
      router.replace(isAdminArea ? '/admin/login' : '/login');
      return;
    }
    const parsed = JSON.parse(stored);
    const isAdmin = parsed.role === 'admin';
    if (isAdminArea && !isAdmin) { router.replace('/dashboard'); return; }
    if (!isAdminArea && isAdmin) { router.replace('/admin'); return; }

    setUser(parsed);
    // Кредит, байгууллагын нэр, эрх өөрчлөгдсөн байж болох тул шинэчилнэ
    apiFetch('/auth/me')
      .then((me) => {
        localStorage.setItem('user', JSON.stringify(me));
        setUser(me);
      })
      .catch(() => {});
    // Admin: батлах шаардлагатай захиалгын тоог цэсэнд харуулна
    if (isAdminArea) {
      apiFetch('/admin/stats')
        .then((s) => setCounts({ pending_orders: s.pending_orders, new_users: s.new_users }))
        .catch(() => {});
    }
  }, [router, pathname, isAdminArea]);

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push(isAdminArea ? '/admin/login' : '/login');
  }

  // Эрх шалгагдаж дуустал (эсвэл өөр хэсэг рүү шилжиж байхад) агуулгыг харуулахгүй
  if (!user) return null;

  const nav = isAdminArea ? ADMIN_NAV : USER_NAV;
  const isActive = (item) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
  const lowCredits = typeof user.credits === 'number' && user.credits < 50;
  const home = isAdminArea ? '/admin' : '/dashboard';

  return (
    <>
      <aside className={`sidebar ${isAdminArea ? 'admin' : ''} ${open ? 'open' : ''}`}>
        <a href={home} className="brand">
          <span className="brand-logo"><Icon name={isAdminArea ? 'shield' : 'message'} size={18} /></span>
          <span className="brand-name">WEB2SMS</span>
          {isAdminArea && <span className="area-tag">ADMIN</span>}
        </a>

        <nav className="nav">
          {nav.map((group, i) => (
            <div key={group.section || i} className="nav-group">
              {group.section && <div className="nav-label">{group.section}</div>}
              {group.items.map((item) => (
                <a key={item.href} href={item.href} className={isActive(item) ? 'active' : ''}>
                  <Icon name={item.icon} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge && counts[item.badge] > 0 && <span className="nav-badge">{counts[item.badge]}</span>}
                </a>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          {isAdminArea ? (
            <div className="credit-pill">
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="shield" size={16} /> Системийн admin
              </span>
            </div>
          ) : (
            <a href="/billing" className={`credit-pill ${lowCredits ? 'low' : ''}`} title="Багц худалдан авах">
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="coin" size={16} /> Кредит
              </span>
              <strong className="mono">{user.credits ?? '—'}</strong>
            </a>
          )}
          <div className="user-row">
            <span className="avatar">{initials(user.name)}</span>
            <div className="user-meta">
              <div className="name">{user.name}</div>
              <div className="org">
                {isAdminArea ? user.email : 'Хэрэглэгч'}
              </div>
            </div>
            <button className="icon-btn" onClick={handleLogout} title="Гарах" aria-label="Гарах">
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </aside>
      <div className={`backdrop ${open ? 'show' : ''}`} onClick={() => setOpen(false)} />

      <div className="main">
        <div className="topbar">
          <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Цэс">
            <Icon name="menu" size={22} />
          </button>
          <span style={{ fontWeight: 700 }}>WEB2SMS</span>
          {isAdminArea && <span className="area-tag">ADMIN</span>}
        </div>
        <main className="page">
          {(title || actions) && (
            <div className="page-header">
              <div>
                {title && <h1>{title}</h1>}
                {subtitle && <p>{subtitle}</p>}
              </div>
              {actions && <div className="page-actions">{actions}</div>}
            </div>
          )}
          {children}
        </main>
      </div>
    </>
  );
}
