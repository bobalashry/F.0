import './globals.css';
import type { Metadata } from 'next';
import { Cairo } from 'next/font/google';
import { AuthProvider } from '@/components/auth/auth-provider';
import { SiteHeader } from '@/components/site-header';
import { Toaster } from '@/components/ui/sonner';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  display: 'swap',
  weight: ['400', '600', '700'],
});

export const metadata: Metadata = {
  title: 'فرصة | فرصتك تبدأ من هنا',
  description: 'منصة مصرية تجمع أصحاب الفرص بالباحثين عنها: بيع بالعمولة، خدمات تسويقية، وشراكات مشروعات.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body className="font-sans">
        <AuthProvider>
          <SiteHeader />
          <main className="min-h-[calc(100vh-4rem)]">{children}</main>
        </AuthProvider>
        <Toaster position="top-center" dir="rtl" />
      </body>
    </html>
  );
}
