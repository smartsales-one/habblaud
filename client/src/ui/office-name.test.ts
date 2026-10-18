import { describe, expect, it } from 'vitest';
import type { OfficeSnapshot } from '../../../shared/types';
import { officeNameFor, pageOfficeName } from './office-name';

const snap = (officeName?: string) => ({ meta: { demo: false, sources: [], startedAt: 0, version: 't', ...(officeName !== undefined ? { officeName } : {}) } }) as unknown as OfficeSnapshot;

describe('nome do escritório na página', () => {
  it('o do snapshot vale; sem ele, o do index.html; sem nada, "Habblaud"', () => {
    expect(officeNameFor(snap('SmartSales Corp.'), 'Outro')).toBe('SmartSales Corp.');
    expect(officeNameFor(snap(), 'SmartSales Corp.')).toBe('SmartSales Corp.');
    expect(officeNameFor(null, 'SmartSales Corp.')).toBe('SmartSales Corp.');
    expect(officeNameFor(null, undefined)).toBe('Habblaud');
    expect(officeNameFor(null, 'a\nb')).toBe('Habblaud');
  });

  it('fora do navegador não há meta', () => {
    expect(pageOfficeName()).toBeUndefined();
    expect(officeNameFor(null)).toBe('Habblaud');
  });
});
