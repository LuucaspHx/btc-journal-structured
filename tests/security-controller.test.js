import { jest } from '@jest/globals';
import { createSecurityController } from '../js/security/controller.js';

describe('security/controller', () => {
  test('mantém estado próprio e notifica subscribers após importação', () => {
    const controller = createSecurityController();
    const listener = jest.fn();
    controller.subscribe(listener);

    expect(controller.getSnapshot().assets).toEqual([]);

    const result = controller.importText({
      scan: { target: 'btcjournal.app', timestamp: '2026-09-18T12:00:00Z' },
      assets: [{ type: 'subdomain', value: 'api.btcjournal.app' }],
    });

    expect(result.scan.target).toBe('btcjournal.app');
    expect(controller.getSnapshot().subdomains).toEqual(['api.btcjournal.app']);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(controller.getSnapshot());
  });

  test('reset não cria dependência com o estado financeiro', () => {
    const controller = createSecurityController();
    controller.importText({
      scan: { target: 'btcjournal.app' },
      assets: [{ type: 'domain', value: 'btcjournal.app' }],
    });

    const reset = controller.reset();

    expect(reset.assets).toEqual([]);
    expect(reset.scan.target).toBeNull();
    expect('txs' in reset).toBe(false);
    expect('goals' in reset).toBe(false);
    expect('vs' in reset).toBe(false);
  });
});
