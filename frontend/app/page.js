'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Эхлэл хуудас — нэвтэрсэн бол эрхийнх нь хэсэг рүү, үгүй бол login руу
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!token || !user) router.replace('/login');
    else router.replace(user.role === 'admin' ? '/admin' : '/dashboard');
  }, [router]);

  return null;
}
