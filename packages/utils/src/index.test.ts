import { describe, expect, it } from 'vitest';
import { generateUuid, retry, to } from './index';
import { compact, merge } from './index';
import { trim, isNonEmptyString, normalizeWhitespace } from './index';
import { now, secondsToMs, formatMs } from './index';

describe('utils package', () => {
  it('generates a uuid string', () => {
    expect(typeof generateUuid()).toBe('string');
  });

  it('retries an async operation', async () => {
    let attempts = 0;
    const result = await retry(
      async () => {
        attempts += 1;
        if (attempts < 2) {
          throw new Error('fail');
        }
        return 'ok';
      },
      { attempts: 2, delayMs: 1 },
    );
    expect(result).toBe('ok');
  });

  it('wraps promise resolution using to()', async () => {
    const [error, value] = await to(Promise.resolve(123));
    expect(error).toBeNull();
    expect(value).toBe(123);
  });

  it('compacts an object', () => {
    expect(compact({ a: 1, b: undefined })).toEqual({ a: 1 });
  });

  it('merges objects shallowly', () => {
    expect(merge({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it('trims and normalizes strings', () => {
    expect(trim('  hello ')).toBe('hello');
    expect(isNonEmptyString('  world ')).toBe(true);
    expect(normalizeWhitespace('foo   bar')).toBe('foo bar');
  });

  it('formats time utilities', () => {
    expect(typeof now()).toBe('number');
    expect(secondsToMs(1)).toBe(1000);
    expect(formatMs(1500)).toBe('1500ms');
  });
});
