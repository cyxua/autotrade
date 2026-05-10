import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AutoTrade — Binance Futures Bot',
  description: 'Binance USDⓈ-M Futures 자동매매',
};

import { ToastContainer } from '@/components/notification/ToastContainer';
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}  <ToastContainer />
    </body>
    </html>
  );
}
