import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '登录 - 地下管网高风险作业巡检后台中心',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {children}
    </div>
  );
}
