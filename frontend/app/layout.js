import './globals.css';

export const metadata = {
  title: 'WEB2SMS',
  description: 'Bulk SMS илгээх систем',
};

export default function RootLayout({ children }) {
  return (
    <html lang="mn">
      <body>{children}</body>
    </html>
  );
}
