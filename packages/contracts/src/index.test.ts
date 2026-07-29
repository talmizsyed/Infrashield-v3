import { describe, expect, it } from 'vitest';

describe('contracts', () => {
  it('exports successfully', async () => {
    const mod = await import('./index');
    expect(mod).toBeDefined();
  });
});
