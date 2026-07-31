import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Sidebar } from '@/components/sidebar';
import { AuthProvider } from '@/components/auth-provider';
import { ClientLayout } from './client-layout';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'AI 诊断管理后台',
  description: '图片AI诊断管理后台 - 数据概览、诊断记录、报告下载',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={inter.variable}>
      <body className="min-h-screen bg-[#F8FAFC] text-foreground antialiased" style={{ fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif" }}>
        <AuthProvider>
          <ClientLayout>
            {children}
          </ClientLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
