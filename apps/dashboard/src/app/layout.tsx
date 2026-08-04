import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import './globals.css';
import { ThemeProvider } from '../providers/theme-provider';
import { AppStateProvider } from '../providers/app-state-provider';

export const metadata: Metadata = {
  title: 'InfraShield Developer Console',
  description: 'Enterprise developer console for agentic runtime operations.',
};

export default function RootLayout({ children }: { children: React.ReactNode }): ReactElement {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AppStateProvider>{children}</AppStateProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
