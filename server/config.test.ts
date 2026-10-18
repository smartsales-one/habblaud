import { describe, expect, it } from 'vitest';
import { loadConfig, parseOfficeName } from './config';

describe('HABBLAUD_OFFICE_NAME', () => {
  it('ausente ou vazia: "Habblaud", sem aviso', () => {
    expect(parseOfficeName({})).toEqual({ name: 'Habblaud' });
    expect(parseOfficeName({ HABBLAUD_OFFICE_NAME: '   ' })).toEqual({ name: 'Habblaud' });
  });

  it('o nome sem os espaços das pontas, até 40 caracteres', () => {
    expect(parseOfficeName({ HABBLAUD_OFFICE_NAME: 'SmartSales Corp.' })).toEqual({ name: 'SmartSales Corp.' });
    expect(parseOfficeName({ HABBLAUD_OFFICE_NAME: '  Escritório da Ana \n' })).toEqual({ name: 'Escritório da Ana' });
    const forty = 'x'.repeat(40);
    expect(parseOfficeName({ HABBLAUD_OFFICE_NAME: forty })).toEqual({ name: forty });
    // conta caracteres, não unidades UTF-16
    const emoji = '🏢'.repeat(40);
    expect(parseOfficeName({ HABBLAUD_OFFICE_NAME: emoji })).toEqual({ name: emoji });
  });

  it('quebra de linha, caractere de controle ou mais de 40 caracteres: "Habblaud", com o motivo no aviso', () => {
    for (const bad of ['Smart\nSales', 'Smart\r\nSales', `Smart${String.fromCharCode(0x2028)}Sales`, 'a\tb', `a${String.fromCharCode(0)}b`]) {
      const r = parseOfficeName({ HABBLAUD_OFFICE_NAME: bad });
      expect(r.name).toBe('Habblaud');
      expect(r.warning).toContain('quebra de linha');
    }
    const long = parseOfficeName({ HABBLAUD_OFFICE_NAME: 'x'.repeat(41) });
    expect(long.name).toBe('Habblaud');
    expect(long.warning).toContain('40');
  });

  it('vai para a configuração do servidor', () => {
    const env = { HOME: '/nao-existe', HABBLAUD_CLAUDE_DIRS: '/nao-existe/.claude', HABBLAUD_CODEX: '0' };
    expect(loadConfig({ ...env, HABBLAUD_OFFICE_NAME: 'SmartSales Corp.' }, []).officeName).toBe('SmartSales Corp.');
    const bad = loadConfig({ ...env, HABBLAUD_OFFICE_NAME: 'a\nb' }, []);
    expect(bad.officeName).toBe('Habblaud');
    expect(bad.officeNameWarning).toBeTruthy();
    expect(loadConfig(env, []).officeNameWarning).toBeUndefined();
  });
});
