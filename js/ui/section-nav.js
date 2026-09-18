const SECTION_TARGET_IDS = {
  chart: 'chartSection',
  summary: 'summarySection',
  entry: 'entrySection',
  transactions: 'transactionsSection',
  audit: 'auditSection',
  goals: 'goalsSection',
  security: 'securitySection',
};

export function activateSection(
  section,
  { root = document, scroll = true, behavior = 'smooth' } = {}
) {
  if (!Object.prototype.hasOwnProperty.call(SECTION_TARGET_IDS, section)) return false;

  const menu = root?.getElementById?.('sectionMenu');
  if (!menu) return false;

  const buttons = Array.from(menu.querySelectorAll('[data-section]'));
  const panels = Array.from(root.querySelectorAll('[data-section-panel]'));

  buttons.forEach((button) => {
    const active = button.dataset.section === section;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  panels.forEach((panel) => {
    panel.hidden = panel.dataset.sectionPanel !== section;
  });

  if (scroll) {
    const target = root.getElementById(SECTION_TARGET_IDS[section]);
    target?.scrollIntoView?.({ behavior, block: 'start' });
  }

  return true;
}

export function bindSectionNavigation(root = document) {
  const menu = root?.getElementById?.('sectionMenu');
  if (!menu || menu.dataset.sectionNavBound === 'true') return () => {};

  function handleClick(event) {
    const button = event.target.closest('[data-section]');
    const section = button?.dataset.section;
    if (!section) return;

    activateSection(section, { root });
  }

  menu.dataset.sectionNavBound = 'true';
  menu.addEventListener('click', handleClick);
  activateSection('chart', { root, scroll: false });

  return () => {
    menu.removeEventListener('click', handleClick);
    delete menu.dataset.sectionNavBound;
  };
}
