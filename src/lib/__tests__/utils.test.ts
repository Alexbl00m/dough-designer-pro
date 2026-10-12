import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('keeps a text colour next to one of the type scale sizes', () => {
    // The bug this guards: tailwind-merge read `text-caption` as a colour and
    // dropped the button's `text-primary-foreground`.
    expect(cn('text-body-sm', 'text-primary-foreground', 'text-caption').split(' ')).toEqual([
      'text-primary-foreground',
      'text-caption',
    ]);
  });

  it('lets a later size or radius from the scale replace an earlier one', () => {
    expect(cn('text-body-sm', 'text-display-sm')).toBe('text-display-sm');
    expect(cn('rounded-pill', 'rounded-utility')).toBe('rounded-utility');
  });
});
