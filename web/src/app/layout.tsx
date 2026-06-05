import type { Metadata } from 'next';
import './globals.css';
import { AppProviders } from '@/components/providers';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import I18nProvider from '@/components/providers/I18nProvider';

export const metadata: Metadata = {
  title: "BoneVisQA - Radiology Education",
  description: "AI-powered interactive visual question answering for radiology education",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('bonevisqa-theme');if(t==='dark'){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body suppressHydrationWarning className="font-sans antialiased bg-background text-text-main">
        <ThemeProvider>
          <AppProviders>
            <I18nProvider>{children}</I18nProvider>
          </AppProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}