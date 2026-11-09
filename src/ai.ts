/**
 * Optional bring-your-own-key AI. Nothing in here runs unless the user configures a provider
 * in Advanced mode. Requests go straight from the device to the endpoint the user typed in —
 * there is no Local Ledger server in between.
 */
import { AISettings, Category, ParsedEntry } from './types';
import { round2, today } from './utils';

/** localhost, LAN and *.local hosts are treated as "on your own hardware". */
export function isLocalUrl(url: string): boolean {
  const m = url.trim().match(/^https?:\/\/(\[[^\]]+\]|[^/:]+)/i);
  if (!m) return false;
  const h = m[1].toLowerCase();
  if (h === 'localhost' || h === '[::1]' || h.endsWith('.local') || h.endsWith('.localhost')) return true;
  // Private IPv4 ranges — the whole host must be an IP, so "127.0.0.1.evil.com" is NOT local.
  const ip = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ip) return false;
  const [a, b] = [Number(ip[1]), Number(ip[2])];
  if (ip.slice(1).some((x) => Number(x) > 255)) return false;
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

export function isCloud(ai: AISettings): boolean {
  return ai.provider !== 'none' && !isLocalUrl(ai.baseUrl);
}

export function aiReady(ai: AISettings): boolean {
  if (ai.provider === 'none' || !ai.baseUrl || !ai.model) return false;
  if (isCloud(ai) && !ai.cloudRiskAcknowledged) return false;
  if (ai.provider !== 'ollama' && isCloud(ai) && !ai.apiKey) return false;
  return true;
}

async function chat(ai: AISettings, system: string, user: string, json: boolean): Promise<string> {
  const base = ai.baseUrl.replace(/\/+$/, '');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    let res: Response;
    if (ai.provider === 'ollama') {
      res = await fetch(`${base}/api/chat`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ai.model,
          stream: false,
          ...(json ? { format: 'json' } : {}),
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
      if (!res.ok) throw new Error(`Ollama returned ${res.status}`);
      const body = await res.json();
      return body?.message?.content ?? '';
    }
    if (ai.provider === 'anthropic') {
      res = await fetch(`${base}/v1/messages`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ai.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({ model: ai.model, max_tokens: 600, system, messages: [{ role: 'user', content: user }] }),
      });
      if (!res.ok) throw new Error(`Anthropic returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const body = await res.json();
      return (body?.content ?? []).map((c: any) => c?.text ?? '').join('');
    }
    // OpenAI-compatible (OpenAI, LM Studio, llama.cpp server, OpenRouter, …)
    res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...(ai.apiKey ? { Authorization: `Bearer ${ai.apiKey}` } : {}) },
      body: JSON.stringify({
        model: ai.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    if (!res.ok) throw new Error(`Endpoint returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = await res.json();
    return body?.choices?.[0]?.message?.content ?? '';
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('The AI endpoint timed out.');
    if (e instanceof TypeError) {
      throw new Error(
        ai.provider === 'ollama'
          ? 'Could not reach Ollama. Is it running? For the web build, start it with OLLAMA_ORIGINS="*". On a phone, use your computer\'s LAN IP instead of localhost.'
          : 'Could not reach the endpoint (network or CORS error).',
      );
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function firstJson(text: string): any {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('AI did not return JSON.');
  return JSON.parse(m[0]);
}

export async function aiParseEntry(ai: AISettings, text: string, categories: Category[]): Promise<ParsedEntry> {
  const cats = categories.map((c) => `${c.id} (${c.kind}: ${c.name})`).join(', ');
  const system =
    'You convert a short personal-finance note into JSON. Reply with ONLY a JSON object: ' +
    '{"type":"expense"|"income","amount":number,"merchant":string,"categoryId":string,"note":string,"date":"YYYY-MM-DD"}. ' +
    `Today is ${today()}. Valid categoryId values: ${cats}. If several amounts belong together (e.g. pay plus tips) add them up. ` +
    'merchant is the store/payer name or "". note is a short description of what it was for.';
  const out = firstJson(await chat(ai, system, text, true));
  const valid = categories.find((c) => c.id === out.categoryId);
  const type = out.type === 'income' ? 'income' : 'expense';
  const amount = typeof out.amount === 'number' ? out.amount : parseFloat(String(out.amount ?? '').replace(/[^0-9.]/g, ''));
  return {
    type,
    amount: isFinite(amount) && amount > 0 ? round2(amount) : null,
    merchant: String(out.merchant ?? '').slice(0, 40),
    categoryId: valid && valid.kind === type ? valid.id : type === 'income' ? 'other-income' : 'other',
    note: String(out.note ?? '').slice(0, 80),
    date: /^\d{4}-\d{2}-\d{2}$/.test(out.date) ? out.date : today(),
    confident: true,
  };
}

/** Only aggregated totals are sent — never individual transactions, notes or merchants. */
export function buildSummaryPayload(input: {
  period: string;
  currency: string;
  income: number;
  spent: number;
  dayOfCycle: number;
  daysInCycle: number;
  categories: { name: string; spent: number; budget?: number }[];
}): string {
  return JSON.stringify(input, null, 2);
}

export async function aiSummary(ai: AISettings, payload: string): Promise<string> {
  const system =
    'You are a friendly, concise budgeting coach. Given monthly totals as JSON, write 3–5 short bullet points: ' +
    'how the month is pacing, which budgets are at risk, and one practical tip. Plain text bullets starting with "• ". No preamble.';
  return (await chat(ai, system, payload, false)).trim();
}
