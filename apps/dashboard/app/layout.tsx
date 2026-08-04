import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'InfraShield V3',
  description: 'Enterprise Agentic Platform',
};

export default function RootLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
