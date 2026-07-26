import { jest } from '@jest/globals';
import { createAppCommands } from '../js/features/app-commands.js';

describe('features/app-commands', () => {
  test.each([
    ['openNewEntry', 'entry'],
    ['openGoals', 'goals'],
    ['openTransactions', 'transactions'],
    ['openTxidAudit', 'audit'],
  ])('%s delega para a secao %s', (commandName, section) => {
    const activateSection = jest.fn(() => true);
    const commands = createAppCommands({ activateSection });

    expect(commands[commandName]()).toBe(true);
    expect(activateSection).toHaveBeenCalledWith(section);
  });

  test('openExport delega para o fluxo canonico existente', () => {
    const openExport = jest.fn();
    const commands = createAppCommands({ openExport });

    expect(commands.openExport()).toBe(true);
    expect(openExport).toHaveBeenCalledTimes(1);
  });

  test('comandos sem dependencia retornam false sem lancar', () => {
    const commands = createAppCommands();

    expect(commands.openNewEntry()).toBe(false);
    expect(commands.openGoals()).toBe(false);
    expect(commands.openTransactions()).toBe(false);
    expect(commands.openTxidAudit()).toBe(false);
    expect(commands.openExport()).toBe(false);
  });

  test('registry e imutavel', () => {
    expect(Object.isFrozen(createAppCommands())).toBe(true);
  });
});
