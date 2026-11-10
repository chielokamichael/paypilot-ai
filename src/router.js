/**
 * PayPilot AI — Hash Router
 *
 * A minimal SPA router using URL hashes (#section/param).
 * Routes look like: #overview, #create-quote, #quotes, #quotes/Q-2024-001
 *
 * Usage:
 *   import { router } from './router.js';
 *   router.register('overview', overviewPage);
 *   router.navigate('quotes');
 */

import { getState, setState } from './state/store.js';

// Map from route name to page module { mount, unmount }
const _routes = new Map();

// The currently mounted page module
let _currentPage = null;
let _currentRoute = null;

/**
 * The root element where pages are mounted.
 * Set by router.init().
 */
let _container = null;

const router = {
  /**
   * Register a route.
   * @param {string} name - e.g. 'overview', 'quotes'
   * @param {object} page - must export mount(container, params) and unmount()
   */
  register(name, page) {
    _routes.set(name, page);
  },

  /**
   * Initialise the router by attaching to the hashchange event
   * and mounting the current hash on load.
   * @param {HTMLElement} container - the #page-content element
   */
  init(container) {
    _container = container;

    // Listen for hash changes (back/forward, manual URL changes)
    window.addEventListener('hashchange', () => this._handleHashChange());

    // Mount the initial route
    this._handleHashChange();
  },

  /**
   * Navigate programmatically.
   * @param {string} route - e.g. 'quotes' or 'quotes/Q-2024-001'
   */
  navigate(route) {
    window.location.hash = '#' + route;
  },

  /** Parse the current URL hash and mount the right page. */
  _handleHashChange() {
    // Strip the leading '#'
    const hash   = window.location.hash.replace(/^#/, '').replace(/^route\//, '') || 'overview';
    // Split 'quotes/Q-2024-001' into ['quotes', 'Q-2024-001']
    const [name, ...rest] = hash.split('/');
    const params = rest.join('/');

    // Parse potential query params, e.g. 'ORD-123?inv=...'
    let id = params;
    const query = {};
    if (params && params.includes('?')) {
      const [cleanId, queryString] = params.split('?');
      id = cleanId;
      try {
        const searchParams = new URLSearchParams(queryString);
        searchParams.forEach((val, key) => { query[key] = val; });
      } catch (e) {
        console.warn('Query parse error:', e);
      }
    }

    // Unmount the previous page
    if (_currentPage && _currentPage.unmount) {
      _currentPage.unmount();
    }

    // Update active nav highlight
    setState({ activeSection: name });
    this._updateNav(name);

    // Find and mount the new page
    const page = _routes.get(name);
    if (page) {
      _container.innerHTML = '';
      page.mount(_container, { id, ...query, rawParams: params });
      _currentPage  = page;
      _currentRoute = name;
    } else {
      // 404 fallback
      _container.innerHTML = `
        <div class="empty-state" style="padding: 80px 0">
          <p class="empty-state__title">Page not found</p>
          <p class="empty-state__text">Route "${name}" is not registered.</p>
          <a href="#overview" class="btn btn-secondary" style="margin-top: 16px">Go to Overview</a>
        </div>
      `;
    }

    // Scroll to top on navigation
    window.scrollTo({ top: 0, behavior: 'instant' });
  },

  /** Update sidebar and topnav active states. */
  _updateNav(routeName) {
    document.querySelectorAll('[data-nav-link]').forEach(link => {
      const linkRoute = link.dataset.navLink;
      link.classList.toggle('is-active', linkRoute === routeName);
    });
  },
};

export default router;
