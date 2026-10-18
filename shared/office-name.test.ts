import { describe, expect, it } from 'vitest';
import { DEFAULT_OFFICE_NAME, officeNameOf, officeNameProblem } from './office-name';

describe('nome do escritório', () => {
  it('officeNameOf: o nome sem os espaços das pontas; ausente, torto ou inválido = "Habblaud"', () => {
    expect(DEFAULT_OFFICE_NAME).toBe('Habblaud');
    expect(officeNameOf('SmartSales Corp.')).toBe('SmartSales Corp.');
    expect(officeNameOf('  Acme ')).toBe('Acme');
    expect(officeNameOf(undefined)).toBe('Habblaud');
    expect(officeNameOf(42)).toBe('Habblaud');
    expect(officeNameOf('')).toBe('Habblaud');
    expect(officeNameOf('a\nb')).toBe('Habblaud');
    expect(officeNameOf('x'.repeat(41))).toBe('Habblaud');
  });

  it('officeNameProblem: vazio, controle (quebras de linha do Unicode também) e tamanho', () => {
    expect(officeNameProblem('Acme')).toBeUndefined();
    expect(officeNameProblem('')).toBe('empty');
    expect(officeNameProblem('a\rb')).toBe('control');
    expect(officeNameProblem(`a${String.fromCharCode(0x2029)}b`)).toBe('control');
    expect(officeNameProblem('x'.repeat(40))).toBeUndefined();
    expect(officeNameProblem('x'.repeat(41))).toBe('long');
  });
});
