import { describe, expect, it } from 'vitest';
import { getStyleById } from '@/data/styles';
import { paramsForStyle, paramsToQuery, queryToParams } from '@/lib/recipe/state';

describe('recipe links', () => {
  it('carry the preferment build and a fixed yeast dose, and nothing they do not need', () => {
    const style = getStyleById('pizza_poolish')!;
    const params = {
      ...paramsForStyle(style),
      prefermentHours: 22,
      prefermentTemp: 19,
      prefermentColdHours: 20,
      yeastPct: 0.15,
      driver: 'dose' as const,
    };
    const query = paramsToQuery(params);
    expect(query).toContain('ph=22');
    expect(query).toContain('pt=19');
    expect(query).toContain('pc=20');
    expect(query).toContain('yp=0.15');
    expect(queryToParams(query)).toEqual(params);
  });

  it('keep a default recipe short', () => {
    const style = getStyleById('pizza_poolish')!;
    expect(paramsToQuery(paramsForStyle(style))).toBe('s=pizza_poolish');
  });

  it('start a style from its own preferment, which follows the room until changed', () => {
    const style = getStyleById('pizza_poolish')!;
    const params = paramsForStyle(style);
    expect(params.prefermentHours).toBe(style.preferment!.hours);
    expect(params.prefermentColdHours).toBe(style.preferment!.cold_hours);
    expect(params.prefermentTemp).toBeNull();
    expect(params.yeastPct).toBeNull();
  });

  it('still open the links bakers already shared', () => {
    const params = queryToParams('s=pizza_poolish&bc=6&h=68&t=3&dt=20&m=dlx')!;
    expect(params.ballCount).toBe(6);
    expect(params.totalTime).toBe(3);
    expect(params.mixing).toBe('dlx');
    expect(params.prefermentHours).toBe(18);
  });

  it('shrug off a mangled number instead of breaking the recipe', () => {
    const params = queryToParams('s=pizza_poolish&pt=abc&yp=x')!;
    expect(params.prefermentTemp).toBeNull();
    expect(params.yeastPct).toBeNull();
  });
});
