import type { ReactElement } from 'react';

export default function NotFound(): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
      }}
    >
      <h1>404</h1>
      <p>Page not found.</p>
    </div>
  );
}
