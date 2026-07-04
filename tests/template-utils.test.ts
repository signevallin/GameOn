import { describe, it, expect } from 'vitest';
import { isTemplateActive } from '@/lib/template-utils';
import { parseActiveWindow } from '@/lib/parse-active-window';

describe('isTemplateActive', () => {
  it('is always active when either bound is missing', () => {
    expect(isTemplateActive(null, '12-31', new Date('2026-06-01'))).toBe(true);
    expect(isTemplateActive('01-01', null, new Date('2026-06-01'))).toBe(true);
  });

  it('handles a same-year range', () => {
    expect(isTemplateActive('10-01', '10-31', new Date('2026-10-15'))).toBe(true);
    expect(isTemplateActive('10-01', '10-31', new Date('2026-11-01'))).toBe(false);
  });

  it('handles a range that crosses the new year', () => {
    expect(isTemplateActive('12-20', '01-05', new Date('2026-12-25'))).toBe(true);
    expect(isTemplateActive('12-20', '01-05', new Date('2026-01-03'))).toBe(true);
    expect(isTemplateActive('12-20', '01-05', new Date('2026-06-01'))).toBe(false);
  });
});

describe('parseActiveWindow', () => {
  it('treats null/undefined/empty as an open bound', () => {
    expect(parseActiveWindow(null)).toEqual({ ok: true, value: null });
    expect(parseActiveWindow(undefined)).toEqual({ ok: true, value: null });
    expect(parseActiveWindow('')).toEqual({ ok: true, value: null });
  });

  it('normalizes a valid date string to ISO', () => {
    const res = parseActiveWindow('2026-07-04');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toBe(new Date('2026-07-04').toISOString());
  });

  it('rejects an unparseable string', () => {
    expect(parseActiveWindow('not-a-date')).toEqual({ ok: false });
  });

  it('rejects a non-string input', () => {
    expect(parseActiveWindow(42)).toEqual({ ok: false });
  });
});
