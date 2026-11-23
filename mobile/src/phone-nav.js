'use strict';
// Phone navigation (Material 3 pattern): four labelled main destinations plus
// "Mehr", which opens a bottom sheet with all other modules and tools.
// Every entry clicks the original sidebar button, so login checks, routing
// and actions stay exactly as on the desktop.

const PRIMARY = [
  { route: 'view-landing', label: 'Start' },
  { route: 'view-setup', label: 'Setup' },
  { route: 'view-quickactions', label: 'Aktionen' },
  { route: 'view-modchat', label: 'Chat' }
];

const MORE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>';

function cleanLabel(button) {
  // Visible text is shorter than the tooltip ("Feedback & Wünsche").
  const title = button.textContent.trim() || button.getAttribute('title') || '';
  return title.replace(/\s*\(Alt\+\d\)\s*$/, '').trim();
}

function iconOf(button) {
  const svg = button.querySelector('svg');
  if (!svg) return null;
  const copy = svg.cloneNode(true);
  copy.removeAttribute('id');
  copy.setAttribute('aria-hidden', 'true');
  return copy;
}

function createItem(tag, className, icon, label) {
  const item = document.createElement(tag);
  item.type = 'button';
  item.className = className;
  const iconWrap = document.createElement('span');
  iconWrap.className = 'swg-phone-nav-icon';
  if (typeof icon === 'string') iconWrap.innerHTML = icon;
  else if (icon) iconWrap.appendChild(icon);
  const text = document.createElement('span');
  text.className = 'swg-phone-nav-label';
  text.textContent = label;
  item.append(iconWrap, text);
  return item;
}

function buildPhoneNav() {
  const sidebar = document.querySelector('.workspace-sidebar');
  if (!sidebar || document.querySelector('.swg-phone-nav')) return;
  const sidebarButtons = [...sidebar.querySelectorAll('button.ws-nav-item')]
    .filter(button => button.id !== 'ws-collapse');
  const byRoute = new Map(sidebarButtons.filter(b => b.dataset.wsRoute).map(b => [b.dataset.wsRoute, b]));

  const nav = document.createElement('nav');
  nav.className = 'swg-phone-nav';
  nav.setAttribute('aria-label', 'Hauptnavigation');

  const primaryItems = new Map();
  for (const entry of PRIMARY) {
    const original = byRoute.get(entry.route);
    if (!original) continue;
    const item = createItem('button', 'swg-phone-nav-item', iconOf(original), entry.label);
    item.addEventListener('click', () => original.click());
    nav.appendChild(item);
    primaryItems.set(entry.route, item);
  }

  // "Mehr" bottom sheet with every remaining sidebar entry.
  const sheet = document.createElement('dialog');
  sheet.className = 'swg-more-sheet';
  sheet.setAttribute('aria-label', 'Weitere Module und Werkzeuge');
  const grabber = document.createElement('div');
  grabber.className = 'swg-more-grabber';
  const heading = document.createElement('div');
  heading.className = 'swg-more-heading';
  heading.textContent = 'Weitere Module';
  const list = document.createElement('div');
  list.className = 'swg-more-list';
  let toolsHeadingAdded = false;
  for (const original of sidebarButtons) {
    if (original.dataset.wsRoute && primaryItems.has(original.dataset.wsRoute)) continue;
    if (!original.dataset.wsRoute && !toolsHeadingAdded) {
      toolsHeadingAdded = true;
      const toolsHeading = document.createElement('div');
      toolsHeading.className = 'swg-more-heading';
      toolsHeading.textContent = 'Werkzeuge';
      list.appendChild(toolsHeading);
    }
    const row = createItem('button', 'swg-more-row', iconOf(original), cleanLabel(original));
    if (original.dataset.wsRoute) row.dataset.route = original.dataset.wsRoute;
    row.addEventListener('click', () => {
      sheet.close();
      original.click();
    });
    list.appendChild(row);
  }
  sheet.append(grabber, heading, list);
  sheet.addEventListener('click', (event) => {
    if (event.target === sheet) sheet.close(); // tap on the backdrop
  });
  let touchStartY = null;
  sheet.addEventListener('touchstart', (event) => { touchStartY = event.touches[0].clientY; }, { passive: true });
  sheet.addEventListener('touchend', (event) => {
    if (touchStartY !== null && list.scrollTop <= 0 && event.changedTouches[0].clientY - touchStartY > 80) sheet.close();
    touchStartY = null;
  });

  const moreItem = createItem('button', 'swg-phone-nav-item', MORE_ICON, 'Mehr');
  moreItem.setAttribute('aria-haspopup', 'dialog');
  moreItem.addEventListener('click', () => sheet.showModal());
  nav.appendChild(moreItem);

  const setActive = (route) => {
    let matched = false;
    for (const [itemRoute, item] of primaryItems) {
      const active = itemRoute === route;
      item.classList.toggle('is-active', active);
      if (active) { item.setAttribute('aria-current', 'page'); matched = true; } else item.removeAttribute('aria-current');
    }
    moreItem.classList.toggle('is-active', !matched && !!route);
    for (const row of list.querySelectorAll('.swg-more-row')) row.classList.toggle('is-active', row.dataset.route === route);
  };
  window.addEventListener('swg:view-changed', (event) => setActive(event.detail));
  const visible = document.querySelector('.hub-view-pane:not(.hidden)');
  setActive(visible ? visible.id : 'view-landing');

  document.body.append(nav, sheet);
}

module.exports = { buildPhoneNav };
