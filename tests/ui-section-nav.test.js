import { jest } from '@jest/globals';
import { activateSection, bindSectionNavigation } from '../js/ui/section-nav.js';

function createElement(dataset = {}) {
  const classes = new Set();
  const attributes = new Map();

  return {
    dataset: { ...dataset },
    hidden: false,
    classList: {
      contains: (name) => classes.has(name),
      toggle: (name, active) => (active ? classes.add(name) : classes.delete(name)),
    },
    setAttribute: (name, value) => attributes.set(name, value),
    getAttribute: (name) => attributes.get(name),
  };
}

function createRoot() {
  const buttons = ['chart', 'summary', 'entry', 'security'].map((section) =>
    createElement({ section })
  );
  const panels = [
    createElement({ sectionPanel: 'chart' }),
    createElement({ sectionPanel: 'summary' }),
    createElement({ sectionPanel: 'entry' }),
    createElement({ sectionPanel: 'security' }),
  ];
  const listeners = new Map();
  const targets = Object.fromEntries(
    ['chartSection', 'summarySection', 'entrySection', 'securitySection'].map((id) => [
      id,
      { scrollIntoView: jest.fn() },
    ])
  );
  const menu = {
    dataset: {},
    querySelectorAll: () => buttons,
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: (type, listener) => {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
  };
  const root = {
    getElementById: (id) => (id === 'sectionMenu' ? menu : targets[id] ?? null),
    querySelectorAll: () => panels,
  };

  return { buttons, listeners, menu, panels, root, targets };
}

describe('ui/section-nav', () => {
  test('ativa uma secao conhecida e sincroniza botoes, paineis e scroll', () => {
    const { buttons, panels, root, targets } = createRoot();

    expect(activateSection('summary', { root, behavior: 'auto' })).toBe(true);

    expect(buttons[1].classList.contains('active')).toBe(true);
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[0].getAttribute('aria-pressed')).toBe('false');
    expect(panels.map((panel) => panel.hidden)).toEqual([true, false, true, true]);
    expect(targets.summarySection.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'auto',
      block: 'start',
    });
  });

  test('ativa o Security Center pelo mesmo contrato público', () => {
    const { buttons, panels, root, targets } = createRoot();

    expect(activateSection('security', { root, behavior: 'auto' })).toBe(true);

    expect(buttons[3].classList.contains('active')).toBe(true);
    expect(panels.map((panel) => panel.hidden)).toEqual([true, true, true, false]);
    expect(targets.securitySection.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'auto',
      block: 'start',
    });
  });

  test('ignora secao desconhecida sem alterar a interface', () => {
    const { buttons, panels, root } = createRoot();

    expect(activateSection('missing', { root })).toBe(false);
    expect(buttons.every((button) => !button.classList.contains('active'))).toBe(true);
    expect(panels.every((panel) => panel.hidden === false)).toBe(true);
  });

  test('retorna false quando o menu nao esta montado', () => {
    const root = {
      getElementById: () => null,
      querySelectorAll: jest.fn(),
    };

    expect(activateSection('chart', { root })).toBe(false);
    expect(root.querySelectorAll).not.toHaveBeenCalled();
  });

  test('binder usa a API publica e devolve cleanup idempotente', () => {
    const { buttons, listeners, menu, panels, root, targets } = createRoot();
    const cleanup = bindSectionNavigation(root);

    expect(buttons[0].classList.contains('active')).toBe(true);
    expect(panels.map((panel) => panel.hidden)).toEqual([false, true, true, true]);
    expect(targets.chartSection.scrollIntoView).not.toHaveBeenCalled();

    listeners.get('click')({ target: { closest: () => buttons[2] } });
    expect(buttons[2].classList.contains('active')).toBe(true);
    expect(panels.map((panel) => panel.hidden)).toEqual([true, true, false, true]);

    expect(bindSectionNavigation(root)).toEqual(expect.any(Function));
    expect(listeners.size).toBe(1);

    cleanup();
    expect(listeners.size).toBe(0);
    expect(menu.dataset.sectionNavBound).toBeUndefined();
  });
});
