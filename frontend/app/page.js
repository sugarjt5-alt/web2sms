'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Эхлэл хуудас — token байгаа бол dashboard, үгүй бол login руу шилжинэ
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    router.replace(token ? '/dashboard' : '/login');
  }, [router]);

  return null;
}
