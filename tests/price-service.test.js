import {
  createPriceService
} from '../js/services/price-service.js';

describe('price-service', () => {
  let service;

  afterEach(() => {
    if (service) service.stopPolling();
  });

  test('getCurrentPrice retorna null antes da primeira busca', () => {
    service = createPriceService({ fetcher: async () => 50000 });
    expect(service.getCurrentPrice('usd')).toBeNull();
  });

  test('onPriceUpdate notifica com o preço e vs corretos', async () => {
    const updates = [];
    service = createPriceService({ fetcher: async () => 50000 });
    service.onPriceUpdate(data => updates.push(data));
    await service.fetchNow('usd');
    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({ vs: 'usd', price: 50000, time: expect.any(Number) });
  });

  test('getCurrentPrice retorna o último preço após fetchNow', async () => {
    service = createPriceService({ fetcher: async () => 50000 });
    await service.fetchNow('usd');
    expect(service.getCurrentPrice('usd')).toBe(50000);
  });

  test('cache por moeda — usd e brl são independentes', async () => {
    let call = 0;
    service = createPriceService({ fetcher: async (vs) => vs === 'usd' ? 50000 : 300000 });
    await service.fetchNow('usd');
    await service.fetchNow('brl');
    expect(service.getCurrentPrice('usd')).toBe(50000);
    expect(service.getCurrentPrice('brl')).toBe(300000);
  });

  test('onPriceUpdate retorna função de unsubscribe', async () => {
    const updates = [];
    service = createPriceService({ fetcher: async () => 50000 });
    const unsub = service.onPriceUpdate(data => updates.push(data));
    unsub();
    await service.fetchNow('usd');
    expect(updates).toHaveLength(0);
  });

  test('em caso de falha no fetch, mantém cache anterior', async () => {
    let shouldFail = false;
    service = createPriceService({
      fetcher: async () => {
        if (shouldFail) throw new Error('Network error');
        return 50000;
      }
    });
    await service.fetchNow('usd');
    shouldFail = true;
    await service.fetchNow('usd');
    expect(service.getCurrentPrice('usd')).toBe(50000);
  });
});
