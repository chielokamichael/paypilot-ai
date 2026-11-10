/**
 * PayPilot AI — Navigation Component
 *
 * Renders the sidebar (desktop) and top nav + mobile drawer (mobile).
 * Automatically highlights the active route using data-nav-link attributes.
 */

import { subscribe, getState, setState } from '../state/store.js';
import { firebaseSignOut } from '../firebase/init.js';
import router from '../router.js';

// SVG icons (inline — no external dependency for these core icons)
const ICONS = {
  logo: `<img src="/favicon.svg" alt="" aria-hidden="true">`,
  overview: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>`,
  createQuote: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14,2 14,8 20,8"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
  </svg>`,
  quotes: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/>
  </svg>`,
  payments: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
    <line x1="1" y1="10" x2="23" y2="10"/>
  </svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>`,
  menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
  </svg>`,
  logout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>`,
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>`,
};

const NAV_ITEMS = [
  { route: 'overview',      label: 'Overview',      icon: ICONS.overview },
  { route: 'create-quote',  label: 'Create Quote',  icon: ICONS.createQuote },
  { route: 'quotes',        label: 'Quotes',        icon: ICONS.quotes },
  { route: 'payments',      label: 'Payments',      icon: ICONS.payments },
  { route: 'settings',      label: 'Settings',      icon: ICONS.settings },
];

/** Render and mount the full navigation into #nav-sidebar and #topnav */
export function mountNav() {
  renderSidebar();
  renderTopNav();
  attachMobileToggle();

  // Keep sidebar footer in sync with state changes
  subscribe('settings', () => updateSidebarFooter());
  subscribe('theme', () => updateSidebarFooter());
  subscribe('authUser', () => updateSidebarFooter());
}

function renderSidebar() {
  const el = document.getElementById('nav-sidebar');
  if (!el) return;

  const { activeSection } = getState();

  el.innerHTML = `
    <div class="sidebar__brand">
      <a href="#overview" class="sidebar__logo">
        <span class="sidebar__logo-mark">${ICONS.logo}</span>
        <span class="sidebar__logo-text">
          <span class="sidebar__logo-name">PayPilot AI</span>
          <span class="sidebar__logo-tagline">Quote &amp; Pay</span>
        </span>
      </a>
    </div>

    <nav class="sidebar__nav" aria-label="Main navigation">
      <span class="sidebar__section-label">Workspace</span>
      ${NAV_ITEMS.map(item => `
        <button
          class="sidebar__link ${activeSection === item.route ? 'is-active' : ''}"
          data-nav-link="${item.route}"
          aria-current="${activeSection === item.route ? 'page' : 'false'}"
        >
          ${item.icon}
          ${item.label}
        </button>
      `).join('')}
    </nav>

    <div class="sidebar__footer" id="sidebar-footer">
      ${buildFooterContent()}
    </div>
  `;

  // Attach click handlers for nav links
  el.querySelectorAll('[data-nav-link]').forEach(btn => {
    btn.addEventListener('click', () => {
      router.navigate(btn.dataset.navLink);
      closeMobileNav();
    });
  });

  // Attach footer actions (theme toggle, signout)
  attachFooterListeners();
}

function buildFooterContent() {
  const { settings, theme, authUser } = getState();
  const userName = authUser?.displayName || settings.businessName || 'Your Business';
  const userEmail = authUser?.email || settings.businessEmail || '';
  const isDark = theme === 'dark';

  return `
    <div class="sidebar__footer-user">
      <strong>${userName}</strong>
      <small>${userEmail}</small>
    </div>
    <div class="sidebar__footer-actions">
      <button class="btn btn-ghost btn-sm" id="theme-toggle" aria-label="Toggle theme" title="${isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}">
        ${isDark ? ICONS.sun : ICONS.moon}
        <span>${isDark ? 'Light' : 'Dark'}</span>
      </button>
      <button class="btn btn-ghost btn-sm" id="btn-sidebar-signout" aria-label="Sign out" title="Sign Out">
        ${ICONS.logout}
        <span>Sign Out</span>
      </button>
    </div>
  `;
}

function updateSidebarFooter() {
  const footer = document.getElementById('sidebar-footer');
  if (footer) {
    footer.innerHTML = buildFooterContent();
    attachFooterListeners();
  }
}

function attachFooterListeners() {
  const footer = document.getElementById('sidebar-footer');
  if (!footer) return;

  const themeToggle = footer.querySelector('#theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const { theme } = getState();
      const nextTheme = theme === 'dark' ? 'light' : 'dark';
      document.body.classList.toggle('theme-dark', nextTheme === 'dark');
      setState({ theme: nextTheme }, ['theme']);
    });
  }

  const signoutBtn = footer.querySelector('#btn-sidebar-signout');
  if (signoutBtn) {
    signoutBtn.addEventListener('click', async () => {
      try {
        await firebaseSignOut();
      } catch (err) {
        console.error('Sign out error:', err);
      }
    });
  }
}

function renderTopNav() {
  const el = document.getElementById('topnav');
  if (!el) return;

  el.innerHTML = `
    <div class="topnav__brand">
      <span class="topnav__mark">
        <img src="/favicon.svg" alt="" aria-hidden="true">
      </span>
      PayPilot AI
    </div>
    <button class="topnav__hamburger btn-ghost" id="nav-toggle" aria-label="Toggle navigation" aria-controls="nav-sidebar" aria-expanded="false">
      ${ICONS.menu}
    </button>
  `;
}

function attachMobileToggle() {
  document.addEventListener('click', e => {
    const toggle = e.target.closest('#nav-toggle');
    if (toggle) openMobileNav();

    const overlay = e.target.closest('#nav-overlay');
    if (overlay) closeMobileNav();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeMobileNav();
  });

  if (!document.getElementById('nav-overlay')) {
    const overlay = document.createElement('button');
    overlay.type = 'button';
    overlay.id        = 'nav-overlay';
    overlay.className = 'nav-overlay';
    overlay.setAttribute('aria-label', 'Close navigation');
    document.body.appendChild(overlay);
  }
}

function openMobileNav() {
  document.getElementById('nav-sidebar')?.classList.add('sidebar--mobile-open');
  document.getElementById('nav-overlay')?.classList.add('is-open');
  document.getElementById('nav-toggle')?.setAttribute('aria-expanded', 'true');
  document.body.classList.add('nav-open');
}

function closeMobileNav() {
  document.getElementById('nav-sidebar')?.classList.remove('sidebar--mobile-open');
  document.getElementById('nav-overlay')?.classList.remove('is-open');
  document.getElementById('nav-toggle')?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('nav-open');
}
