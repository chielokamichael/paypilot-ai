/**
 * PayPilot AI — Mock AI Service
 *
 * This module simulates the AI quote-generation API.
 * It accepts a project description and returns structured quote data.
 *
 * IMPORTANT: This is a MOCK. In production, replace the body of
 * generateQuoteDraft() with a real fetch() call to your backend AI endpoint.
 * The function signature and return shape must remain identical.
 *
 * Return shape:
 * {
 *   lineItems:    Array<LineItem>,
 *   milestones:   Array<Milestone>,
 *   assumptions:  string[],
 *   exclusions:   string[],
 *   notes:        string,
 * }
 */

import { getState } from '../state/store.js';

/** Simulated network delay in milliseconds */
const MOCK_DELAY_MS = 1800;

/**
 * Generate a quote draft from a natural-language project description.
 *
 * @param {object} params
 * @param {string} params.description   - The client's project brief
 * @param {string} params.projectTitle  - Project title (for context)
 * @param {string} params.currency      - Currency code (e.g. 'USD')
 * @returns {Promise<object>} Structured draft data
 */
export async function generateQuoteDraft({ description, projectTitle, currency }) {
  // Simulate a real API call with a delay
  await delay(MOCK_DELAY_MS);

  const { settings } = getState();
  const rate = settings.defaultHourlyRate;

  // Analyse the description text to produce a contextually relevant draft.
  // In production, this logic lives on the server — here we use keyword detection.
  const lower = (description + ' ' + projectTitle).toLowerCase();

  const draft = buildDraftFromKeywords(lower, rate, currency);
  return draft;
}

/** Wait for `ms` milliseconds. */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Produce a structured draft by detecting keywords in the brief.
 * Each keyword set maps to typical freelance deliverables.
 */
function buildDraftFromKeywords(text, rate, currency) {
  // Detect domain from keywords
  const isWebsite   = /web|site|landing|wordpress|shopify|e-?comm|online store/.test(text);
  const isApp       = /app|mobile|ios|android|flutter|react native/.test(text);
  const isDesign    = /design|brand|logo|ui|ux|figma|identity|visual/.test(text);
  const isMarketing = /market|seo|campaign|content|copy|social|email/.test(text);
  const isVideo     = /video|edit|film|animat|motion/.test(text);
  const isConsult   = /consult|audit|strateg|workshop|review/.test(text);

  if (isApp)       return appDraft(rate, currency);
  if (isWebsite)   return websiteDraft(rate, currency);
  if (isDesign)    return designDraft(rate, currency);
  if (isMarketing) return marketingDraft(rate, currency);
  if (isVideo)     return videoDraft(rate, currency);
  if (isConsult)   return consultDraft(rate, currency);

  // Default: a general professional services draft
  return generalDraft(rate, currency);
}

/** Create a line item object */
function li(id, description, quantity, unit, unitRate) {
  return {
    id,
    description,
    quantity:  Number(quantity),
    unit,
    unitRate:  Number(unitRate),
    total:     Number((quantity * unitRate).toFixed(2)),
  };
}

/** Create a milestone object */
function ms(id, name, description, dueOffset, paymentFraction) {
  const due = new Date();
  due.setDate(due.getDate() + dueOffset);
  return {
    id,
    name,
    description,
    dueDate: due.toISOString().split('T')[0],
    // paymentFraction is used to calculate paymentAmount later in the page
    _paymentFraction: paymentFraction,
    paymentAmount: 0, // will be set by the page based on quote total
  };
}

function websiteDraft(rate, currency) {
  const items = [
    li('li-1', 'Discovery & requirements workshop',    2,  'hours', rate),
    li('li-2', 'UX wireframes & information architecture', 8,  'hours', rate),
    li('li-3', 'Visual design (up to 5 pages)',          16, 'hours', rate),
    li('li-4', 'Frontend development',                  24, 'hours', rate),
    li('li-5', 'CMS integration & content entry',        8,  'hours', rate),
    li('li-6', 'QA testing & cross-browser review',      4,  'hours', rate),
    li('li-7', 'Deployment & go-live support',           2,  'hours', rate),
  ];
  const milestones = [
    ms('m-1', 'Kickoff & design approval', 'Discovery workshop completed; wireframes and visual designs signed off by client.', 14, 0.3),
    ms('m-2', 'Development complete',       'All pages built and CMS integrated. Site ready for client review.', 35, 0.5),
    ms('m-3', 'Final delivery',             'QA passed, site live on production. Handover documentation delivered.', 45, 0.2),
  ];
  return {
    lineItems: items,
    milestones,
    assumptions: [
      'Client provides all copywriting, images, and brand assets before project start.',
      'Up to two rounds of design revisions are included. Additional revisions billed at standard hourly rate.',
      'Hosting and domain are the client\'s responsibility.',
      'Project timeline assumes prompt client feedback within 48 hours of deliverable submission.',
    ],
    exclusions: [
      'Third-party plugin or theme licences.',
      'Ongoing maintenance or hosting.',
      'SEO content strategy or paid campaign setup.',
    ],
    notes: 'This draft was generated by PayPilot AI based on your project description. Please review all line items and adjust quantities, rates, and deliverables before approving.',
  };
}

function appDraft(rate, currency) {
  const items = [
    li('li-1', 'Product scoping & technical specification',  6,  'hours', rate),
    li('li-2', 'UX research & user flow mapping',            8,  'hours', rate),
    li('li-3', 'UI design — core screens',                  20, 'hours', rate),
    li('li-4', 'Frontend / app development',                40, 'hours', rate),
    li('li-5', 'Backend API integration',                   16, 'hours', rate),
    li('li-6', 'Testing & QA (unit + integration)',          10, 'hours', rate),
    li('li-7', 'App store submission support',               4,  'hours', rate),
  ];
  const milestones = [
    ms('m-1', 'Design sign-off',       'UX flows and all UI screens approved by client.', 21, 0.25),
    ms('m-2', 'Alpha build',           'Core app functionality working in a staging environment.', 42, 0.35),
    ms('m-3', 'Beta & QA complete',    'All features implemented; QA passed; client UAT sign-off.', 63, 0.3),
    ms('m-4', 'Release & handover',    'App submitted to store; source code and documentation delivered.', 70, 0.1),
  ];
  return {
    lineItems: items,
    milestones,
    assumptions: [
      'Client provides brand assets, copy, and API credentials before development begins.',
      'Scope covers one platform (iOS or Android). Cross-platform development is quoted separately.',
      'Up to three rounds of UI revisions are included.',
      'Client owns all source code and assets upon final payment.',
    ],
    exclusions: [
      'App store developer account fees.',
      'Third-party service costs (push notifications, analytics, etc.).',
      'Post-launch feature additions or maintenance.',
    ],
    notes: 'This draft was generated by PayPilot AI. Adjust hours, rates, and milestones to reflect your actual project scope.',
  };
}

function designDraft(rate, currency) {
  const items = [
    li('li-1', 'Brand discovery & competitive analysis',  4,  'hours', rate),
    li('li-2', 'Concept development (3 directions)',      8,  'hours', rate),
    li('li-3', 'Logo design & refinement',               6,  'hours', rate),
    li('li-4', 'Brand identity system',                 10,  'hours', rate),
    li('li-5', 'Brand guidelines document',              4,  'hours', rate),
    li('li-6', 'File delivery & asset pack',             1,  'flat',  rate * 2),
  ];
  const milestones = [
    ms('m-1', 'Concepts presented',   'Three initial logo directions presented for client feedback.', 10, 0.4),
    ms('m-2', 'Final design approved','Refined logo and brand system signed off.', 21, 0.4),
    ms('m-3', 'Files delivered',      'Full asset pack and brand guidelines document delivered.', 28, 0.2),
  ];
  return {
    lineItems: items,
    milestones,
    assumptions: [
      'Client completes a brand questionnaire before work begins.',
      'Two rounds of revisions included after each presentation stage.',
      'Final files delivered in SVG, PNG, PDF, and appropriate source formats.',
    ],
    exclusions: [
      'Print production management.',
      'Illustration or photography.',
      'Website design or development.',
    ],
    notes: 'Generated by PayPilot AI. Review all items before sending to client.',
  };
}

function marketingDraft(rate, currency) {
  const items = [
    li('li-1', 'Marketing audit & strategy document',  6,  'hours', rate),
    li('li-2', 'Content calendar (3 months)',           4,  'hours', rate),
    li('li-3', 'Copywriting — website pages',          8,  'hours', rate),
    li('li-4', 'Email campaign design & copy (x4)',    8,  'hours', rate),
    li('li-5', 'Social media content (30 posts)',      10, 'hours', rate),
    li('li-6', 'Monthly reporting setup',              2,  'hours', rate),
  ];
  const milestones = [
    ms('m-1', 'Strategy approved',   'Audit and strategy document signed off.', 7,  0.3),
    ms('m-2', 'Content delivered',   'All copy, posts, and email templates delivered.', 28, 0.5),
    ms('m-3', 'Campaign live',       'Content published; reporting dashboard active.', 35, 0.2),
  ];
  return {
    lineItems: items,
    milestones,
    assumptions: [
      'Client provides brand assets, login access to required platforms, and prompt feedback.',
      'Content is written in English. Additional languages quoted separately.',
    ],
    exclusions: [
      'Paid advertising budgets.',
      'Photography or video production.',
      'Ongoing community management.',
    ],
    notes: 'Generated by PayPilot AI. Review and adjust before sending.',
  };
}

function videoDraft(rate, currency) {
  const items = [
    li('li-1', 'Pre-production & scripting',  4,  'hours', rate),
    li('li-2', 'Filming day',                 1,  'day',   rate * 8),
    li('li-3', 'Video editing',               12, 'hours', rate),
    li('li-4', 'Motion graphics & titles',    4,  'hours', rate),
    li('li-5', 'Colour grade & audio mix',    3,  'hours', rate),
    li('li-6', 'Final export & delivery',     1,  'flat',  rate),
  ];
  const milestones = [
    ms('m-1', 'Script approved',    'Script and shot list signed off before production.', 7,  0.3),
    ms('m-2', 'Rough cut review',   'First edit delivered for feedback.', 21, 0.4),
    ms('m-3', 'Final delivery',     'Graded, mixed, and exported file delivered.', 30, 0.3),
  ];
  return {
    lineItems: items,
    milestones,
    assumptions: [
      'Filming takes place at a single location. Additional locations quoted separately.',
      'Two rounds of edit revisions are included.',
      'Music licensing cost is not included; client to supply licensed tracks or approve budget.',
    ],
    exclusions: [
      'Location hire fees.',
      'Talent/actor fees.',
      'Distribution or paid promotion.',
    ],
    notes: 'Generated by PayPilot AI. Adjust to your actual production scope.',
  };
}

function consultDraft(rate, currency) {
  const items = [
    li('li-1', 'Initial assessment & stakeholder interviews', 4,  'hours', rate),
    li('li-2', 'Research & analysis',                        8,  'hours', rate),
    li('li-3', 'Workshop facilitation (half-day)',            1,  'day',   rate * 4),
    li('li-4', 'Recommendations report',                     6,  'hours', rate),
    li('li-5', 'Presentation & Q&A session',                 2,  'hours', rate),
  ];
  const milestones = [
    ms('m-1', 'Assessment complete', 'Initial interviews and research phase finished.', 14, 0.4),
    ms('m-2', 'Workshop delivered',  'Half-day workshop facilitated with key stakeholders.', 21, 0.3),
    ms('m-3', 'Final report',        'Written recommendations and presentation delivered.', 30, 0.3),
  ];
  return {
    lineItems: items,
    milestones,
    assumptions: [
      'Client provides access to relevant team members for interviews.',
      'Workshop held at client premises or virtually (hybrid options available).',
      'Report delivered as a PDF document.',
    ],
    exclusions: [
      'Implementation of recommendations.',
      'Travel expenses beyond local area (billed at cost).',
    ],
    notes: 'Generated by PayPilot AI. Review all items before sending.',
  };
}

function generalDraft(rate, currency) {
  const items = [
    li('li-1', 'Project discovery & planning',   4,  'hours', rate),
    li('li-2', 'Core deliverable #1',            12, 'hours', rate),
    li('li-3', 'Core deliverable #2',            10, 'hours', rate),
    li('li-4', 'Review & revision rounds',        4,  'hours', rate),
    li('li-5', 'Final delivery & handover',       2,  'hours', rate),
  ];
  const milestones = [
    ms('m-1', 'Kickoff & scope confirmed', 'Project scope finalised and work begins.', 7,  0.3),
    ms('m-2', 'Mid-point review',          'Deliverables 50% complete; client checkpoint.', 21, 0.4),
    ms('m-3', 'Final delivery',            'All work delivered and accepted.', 35, 0.3),
  ];
  return {
    lineItems: items,
    milestones,
    assumptions: [
      'Client provides all necessary assets, credentials, and information on time.',
      'Two rounds of revisions are included in the quoted price.',
      'Additional work beyond this scope will be quoted separately.',
    ],
    exclusions: [
      'Out-of-scope requests will be quoted as separate change orders.',
      'Third-party costs and licences.',
    ],
    notes: 'This draft was generated by PayPilot AI from your project description. Please review and adjust all line items, deliverables, and pricing before sending to your client.',
  };
}
