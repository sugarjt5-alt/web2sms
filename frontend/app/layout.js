import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'cyrillic'], display: 'swap', variable: '--font-sans' });

export const metadata = {
  title: 'WEB2SMS — Байгууллагын бөөний SMS',
  description: 'Байгууллагуудад зориулсан бөөний SMS илгээх систем',
};

export default function RootLayout({ children }) {
  return (
    <html lang="mn" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
