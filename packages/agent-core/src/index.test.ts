import { describe, expect, it } from 'vitest';

describe('agent-core', () => {
  it('exports successfully', async () => {
    const mod = await import('./index');
    expect(mod).toBeDefined();
  });
});
