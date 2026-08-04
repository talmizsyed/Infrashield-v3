import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import './globals.css';
import { ThemeProvider } from '../providers/theme-provider';

export const metadata: Metadata = {
  title: 'InfraShield Developer Console',
  description: 'Enterprise developer console for agentic runtime operations.',
};

export default function RootLayout({ children }: { children: React.ReactNode }): ReactElement {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
