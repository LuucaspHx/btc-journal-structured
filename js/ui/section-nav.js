const SECTION_TARGET_IDS = {
  chart: 'chartSection',
  summary: 'summarySection',
  entry: 'entrySection',
  transactions: 'transactionsSection',
  audit: 'auditSection',
  goals: 'goalsSection',
};

export function bindSectionNavigation(root = document) {
  const menu = root?.getElementById?.('sectionMenu');
  if (!menu || menu.dataset.sectionNavBound === 'true') return () => {};

  const buttons = Array.from(menu.querySelectorAll('[data-section]'));
  const panels = Array.from(root.querySelectorAll('[data-section-panel]'));

  function setActiveSection(section) {
    buttons.forEach((button) => {
      const active = button.dataset.section === section;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.sectionPanel !== section;
    });
  }

  function handleClick(event) {
    const button = event.target.closest('[data-section]');
    const section = button?.dataset.section;
    if (!section) return;

    setActiveSection(section);
    const targetId = SECTION_TARGET_IDS[section];
    const target = targetId ? root.getElementById(targetId) : null;
    target?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }

  menu.dataset.sectionNavBound = 'true';
  menu.addEventListener('click', handleClick);
  setActiveSection('chart');

  return () => {
    menu.removeEventListener('click', handleClick);
    delete menu.dataset.sectionNavBound;
  };
}
