/**
 * PayPilot AI — AI Quotation Service (Google Gemini Integration)
 *
 * Automatically drafts structured quotes from natural language client briefs.
 * Uses Google Gemini 1.5 Flash via REST API when VITE_GEMINI_API_KEY is provided,
 * with seamless fallback to deterministic template heuristics if offline or without a key.
 */

import { getState } from '../state/store.js';
import { generateQuoteDraft as generateMockDraft } from './ai.mock.js';

/**
 * Generate a quote draft using Google Gemini or the fallback mock.
 *
 * @param {object} params
 * @param {string} params.description   - Client brief / project description
 * @param {string} params.projectTitle  - Project title
 * @param {string} params.currency      - Currency code (e.g. 'USD')
 * @returns {Promise<object>} Structured quote data
 */
export async function generateQuoteDraft({ description, projectTitle, currency }) {
  const { settings } = getState();
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || settings.geminiApiKey;
  const rate = Number(settings.defaultHourlyRate) || 100;
  const cur = currency || settings.currency || 'USD';

  // If no Gemini API key configured, use the smart mock draft
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('YOUR_GEMINI_API_KEY')) {
    console.info('PayPilot: No Gemini API key detected. Using local smart drafting engine.');
    const mock = await generateMockDraft({ description, projectTitle, currency: cur });
    return {
      ...mock,
      source: 'local-engine',
    };
  }

  try {
    const prompt = `You are PayPilot AI, an elite quotation architect for independent freelancers and agencies.
Convert the following client request into an accurate, structured project quotation.

Project Title: ${projectTitle || 'Client Project'}
Project Description / Brief:
"${description}"
Currency: ${cur}
Standard Hourly Rate Benchmark: ${rate}

Instructions:
1. Break down the scope into 3 to 7 concrete, professional line items.
2. For each line item provide realistic quantities (hours or deliverables) and sensible unit rates near the benchmark.
3. Suggest milestone breakdowns with realistic delivery offsets.
4. Include professional project assumptions and scope exclusions.

Respond ONLY with valid JSON conforming to this schema:
{
  "lineItems": [
    {
      "description": "Clear deliverable description",
      "quantity": 10,
      "rate": ${rate},
      "unit": "hours"
    }
  ],
  "milestones": [
    {
      "name": "Phase 1: Architecture & Setup",
      "description": "Initial setup and approval",
      "dueDateOffsetDays": 7,
      "paymentFraction": 0.4
    }
  ],
  "assumptions": [
    "Client provides brand assets and access within 3 business days."
  ],
  "exclusions": [
    "Third-party licensing and hosting fees."
  ],
  "notes": "Estimated delivery timeline: 3-4 weeks."
}`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.warn(`PayPilot: Gemini API returned ${res.status}:`, errorText);
      throw new Error(`Gemini API error (${res.status})`);
    }

    const data = await res.json();
    const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawContent) {
      throw new Error('Empty response from Gemini API');
    }

    const parsed = JSON.parse(rawContent);

    // Normalize line items
    const lineItems = (parsed.lineItems || []).map((item, idx) => ({
      id: `li-${Date.now()}-${idx + 1}`,
      description: item.description || `Deliverable ${idx + 1}`,
      quantity: Number(item.quantity) || 1,
      rate: Number(item.rate ?? item.unitRate) || rate,
      unit: item.unit || 'hours',
      total: Number(((Number(item.quantity) || 1) * (Number(item.rate ?? item.unitRate) || rate)).toFixed(2)),
    }));

    // Normalize milestones
    const milestones = (parsed.milestones || []).map((ms, idx) => {
      const due = new Date();
      due.setDate(due.getDate() + (Number(ms.dueDateOffsetDays) || (idx + 1) * 7));
      return {
        id: `ms-${Date.now()}-${idx + 1}`,
        name: ms.name || `Milestone ${idx + 1}`,
        description: ms.description || '',
        dueDate: due.toISOString().split('T')[0],
        paymentFraction: Number(ms.paymentFraction) || 1 / (parsed.milestones.length || 1),
      };
    });

    return {
      lineItems: lineItems.length > 0 ? lineItems : (await generateMockDraft({ description, projectTitle, currency: cur })).lineItems,
      milestones,
      assumptions: parsed.assumptions || [],
      exclusions: parsed.exclusions || [],
      notes: parsed.notes || '',
      source: 'gemini-1.5-flash',
    };
  } catch (err) {
    console.warn('PayPilot: Gemini API call failed. Falling back to local drafting engine:', err.message);
    const fallback = await generateMockDraft({ description, projectTitle, currency: cur });
    return {
      ...fallback,
      source: 'fallback-engine',
      error: err.message,
    };
  }
}
