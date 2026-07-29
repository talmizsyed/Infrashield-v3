import { describe, expect, it } from 'vitest';

describe('context package', () => {
  it('exports successfully', async () => {
    const mod = await import('./index');
    expect(mod).toBeDefined();
  });
});
