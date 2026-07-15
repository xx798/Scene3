import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Sidebar } from '@/components/sidebar';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: '深燃-安全巡检智能体',
  description: '深燃-安全巡检智能体',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={inter.variable}>
      <body className="min-h-screen bg-[#F8FAFC] text-foreground antialiased" style={{ fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif" }}>
        <Sidebar />
        <main className="pl-60">
          <div className="min-h-screen p-6">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
