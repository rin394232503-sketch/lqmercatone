import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'L&Q Mercatone - Negozio Online',
  description: '意大利本地百货电商 - 家居、电器、服装、美妆',
  keywords: 'L&Q Mercatone, negozio online, e-commerce Italia',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
