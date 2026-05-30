import type { Metadata } from 'next';
import './globals.css';
import { AppProviders } from '@/components/providers';
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
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{document.documentElement.classList.remove('dark');localStorage.removeItem('bonevisqa-theme');}catch(e){}})();`,
          }}
        />
      </head>
      <body suppressHydrationWarning className="font-sans antialiased bg-background text-text-main">
        <AppProviders>
          <I18nProvider>{children}</I18nProvider>
        </AppProviders>
      </body>
    </html>
  );
}