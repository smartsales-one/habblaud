import { describe, expect, it } from 'vitest';
import { tabTitle } from './notify';

describe('título da aba', () => {
  it('o nome do escritório, com quantos esperam você na frente', () => {
    expect(tabTitle('Habblaud', 0)).toBe('Habblaud');
    expect(tabTitle('SmartSales Corp.', 0)).toBe('SmartSales Corp.');
    expect(tabTitle('SmartSales Corp.', 2)).toBe('(2) SmartSales Corp.');
  });
});
