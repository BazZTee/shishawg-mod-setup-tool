'use strict';
// Android WebView draws the native <datalist> popup without a background, so it
// overlaps the form on phones. This replaces it with an own suggestion list for
// every <input list="...">. The desktop renderer stays unchanged.

const MAX_ITEMS = 60;
let popup = null;
let activeInput = null;
let items = [];

function listId(input) {
  return input.getAttribute('list') || input.dataset.swgList || '';
}

function ensurePopup() {
  if (popup) return popup;
  popup = document.createElement('div');
  popup.className = 'swg-dl-popup hidden';
  popup.setAttribute('role', 'listbox');
  // Keep the focus in the input while tapping an entry.
  popup.addEventListener('pointerdown', (event) => event.preventDefault());
  popup.addEventListener('click', (event) => {
    const option = event.target.closest('.swg-dl-option');
    if (option && activeInput) choose(activeInput, option.dataset.value);
  });
  document.body.appendChild(popup);
  return popup;
}

function optionValues(input) {
  const datalist = document.getElementById(listId(input));
  if (!datalist) return [];
  return [...datalist.options].map((option) => option.value).filter(Boolean);
}

function filterValues(values, query) {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return values.slice(0, MAX_ITEMS);
  const starts = [];
  const contains = [];
  for (const value of values) {
    const lower = value.toLowerCase();
    if (!tokens.every((token) => lower.includes(token))) continue;
    if (lower === query.trim().toLowerCase()) continue;
    (lower.startsWith(tokens[0]) ? starts : contains).push(value);
    if (starts.length >= MAX_ITEMS) break;
  }
  return starts.concat(contains).slice(0, MAX_ITEMS);
}

function position() {
  if (!popup || !activeInput) return;
  const rect = activeInput.getBoundingClientRect();
  const viewport = window.visualViewport;
  const viewTop = viewport ? viewport.offsetTop : 0;
  let viewBottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
  // Stay above the phone navigation while the keyboard is closed.
  const nav = document.querySelector('.swg-phone-nav');
  if (nav && getComputedStyle(nav).display !== 'none') viewBottom = Math.min(viewBottom, nav.getBoundingClientRect().top);
  if (rect.bottom < viewTop || rect.top > viewBottom) { hide(); return; }
  const below = viewBottom - rect.bottom - 8;
  const above = rect.top - viewTop - 8;
  const openBelow = below >= 160 || below >= above;
  const maxHeight = Math.max(96, Math.min(300, openBelow ? below : above));
  popup.style.left = Math.round(rect.left) + 'px';
  popup.style.width = Math.round(rect.width) + 'px';
  popup.style.maxHeight = Math.round(maxHeight) + 'px';
  if (openBelow) {
    popup.style.top = Math.round(rect.bottom + 4) + 'px';
    popup.style.bottom = '';
  } else {
    popup.style.top = '';
    popup.style.bottom = Math.round(window.innerHeight - rect.top + 4) + 'px';
  }
}

function render() {
  if (!activeInput) return;
  items = filterValues(optionValues(activeInput), activeInput.value || '');
  const box = ensurePopup();
  if (!items.length) { hide(); return; }
  box.replaceChildren(...items.map((value) => {
    const option = document.createElement('div');
    option.className = 'swg-dl-option';
    option.setAttribute('role', 'option');
    option.dataset.value = value;
    option.textContent = value;
    return option;
  }));
  box.scrollTop = 0;
  box.classList.remove('hidden');
  position();
}

function hide() {
  if (popup) popup.classList.add('hidden');
}

function choose(input, value) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  hide();
}

function isListInput(target) {
  return target instanceof HTMLInputElement && !!listId(target);
}

function installDatalistPicker() {
  document.addEventListener('focusin', (event) => {
    const input = event.target;
    if (!isListInput(input)) return;
    // Without the list attribute the WebView shows no native popup.
    if (input.hasAttribute('list')) {
      input.dataset.swgList = input.getAttribute('list');
      input.removeAttribute('list');
    }
    activeInput = input;
    render();
  }, true);

  document.addEventListener('focusout', (event) => {
    if (event.target !== activeInput) return;
    const input = activeInput;
    activeInput = null;
    hide();
    if (input.dataset.swgList && !input.hasAttribute('list')) input.setAttribute('list', input.dataset.swgList);
  }, true);

  document.addEventListener('input', (event) => {
    if (event.target === activeInput) render();
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.target === activeInput && event.key === 'Escape') hide();
  }, true);

  document.addEventListener('scroll', (event) => {
    if (popup && event.target !== popup) position();
  }, true);
  window.addEventListener('resize', position);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', position);
    window.visualViewport.addEventListener('scroll', position);
  }
}

module.exports = { installDatalistPicker, filterValues };
