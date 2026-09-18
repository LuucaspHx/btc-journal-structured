import { normalizeSecurityInput } from '../js/security/bbot-normalizer.js';
import { summarizeSecurityState } from '../js/security/model.js';

describe('security/bbot-normalizer', () => {
  test('normaliza o mock do Security Center sem tocar no domínio financeiro', () => {
    const result = normalizeSecurityInput(
      {
        scan: {
          target: 'btcjournal.app',
          timestamp: '2026-09-18T12:00:00Z',
        },
        assets: [
          { type: 'domain', value: 'btcjournal.app' },
          { type: 'subdomain', value: 'api.btcjournal.app' },
          { type: 'service', host: 'api.btcjournal.app', port: 443, protocol: 'https' },
        ],
      },
      { source: 'fixture.json' }
    );

    expect(result.scan).toEqual(
      expect.objectContaining({
        target: 'btcjournal.app',
        source: 'fixture.json',
        format: 'btc-journal-security-v1',
      })
    );
    expect(result.subdomains).toEqual(['api.btcjournal.app']);
    expect(result.services).toHaveLength(1);
    expect(result.history).toEqual([]);
    expect(summarizeSecurityState(result)).toEqual(
      expect.objectContaining({
        assetsDiscovered: 3,
        subdomains: 1,
        publicServices: 1,
        newAssets: null,
      })
    );
  });

  test('aceita JSONL realista do BBOT e preserva relações para grafo futuro', () => {
    const input = [
      {
        type: 'DNS_NAME',
        id: 'DNS_NAME:root',
        uuid: 'DNS_NAME:root-uuid',
        data: 'btcjournal.app',
        host: 'btcjournal.app',
        scope_distance: 0,
        timestamp: 1789732800,
        tags: ['target', 'in-scope'],
        module: 'TARGET',
      },
      {
        type: 'DNS_NAME',
        id: 'DNS_NAME:api',
        uuid: 'DNS_NAME:api-uuid',
        data: 'api.btcjournal.app',
        host: 'api.btcjournal.app',
        scope_distance: 0,
        timestamp: 1789732810,
        tags: ['subdomain', 'in-scope'],
        module: 'certspotter',
        parent: 'DNS_NAME:root-uuid',
      },
      {
        type: 'OPEN_TCP_PORT',
        id: 'OPEN_TCP_PORT:443',
        uuid: 'OPEN_TCP_PORT:443-uuid',
        data: 'api.btcjournal.app:443',
        host: 'api.btcjournal.app',
        scope_distance: 0,
        timestamp: 1789732820,
        tags: ['https', 'open-port'],
        module: 'portscan',
        parent: 'DNS_NAME:api-uuid',
      },
      {
        type: 'HTTP_RESPONSE',
        id: 'HTTP_RESPONSE:api',
        uuid: 'HTTP_RESPONSE:api-uuid',
        data_json: {
          url: 'https://api.btcjournal.app/',
          status_code: 200,
        },
        host: 'api.btcjournal.app',
        scope_distance: 0,
        timestamp: 1789732830,
        tags: ['https'],
        module: 'httpx',
        parent: 'OPEN_TCP_PORT:443-uuid',
      },
      {
        type: 'FINDING',
        id: 'FINDING:staging',
        uuid: 'FINDING:staging-uuid',
        data_json: {
          host: 'staging.btcjournal.app',
          description: 'Staging environment observed',
          severity: 'LOW',
        },
        scope_distance: 0,
        timestamp: 1789732840,
        module: 'example',
        parent: 'DNS_NAME:root-uuid',
      },
    ]
      .map((event) => JSON.stringify(event))
      .join('\n');

    const result = normalizeSecurityInput(input, { source: 'output.json' });

    expect(result.scan.target).toBe('btcjournal.app');
    expect(result.scan.format).toBe('bbot-event-stream');
    expect(result.subdomains).toContain('api.btcjournal.app');
    expect(result.services).toEqual([
      expect.objectContaining({
        host: 'api.btcjournal.app',
        port: 443,
        protocol: 'https',
      }),
    ]);
    expect(result.findings).toEqual([
      expect.objectContaining({
        host: 'staging.btcjournal.app',
        severity: 'LOW',
      }),
    ]);
    expect(result.relations).toHaveLength(4);
  });

  test('rejeita payload desconhecido', () => {
    expect(() => normalizeSecurityInput('{"hello":"world"}')).toThrow(/Formato de scan/);
  });
});
