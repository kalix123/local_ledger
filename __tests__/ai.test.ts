import { aiParseEntry, aiReady, aiSummary, buildSummaryPayload, isCloud, isLocalUrl } from '../src/ai';
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from '../src/defaults';
import { AISettings } from '../src/types';

const ai = (over: Partial<AISettings> = {}): AISettings => ({ ...DEFAULT_SETTINGS.ai, ...over });
const fetchMock = global.fetch as jest.Mock;
const respond = (body: unknown, status = 200) =>
  fetchMock.mockResolvedValueOnce({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) });

beforeEach(() => fetchMock.mockReset().mockImplementation(() => Promise.reject(new Error('Unexpected network request in test'))));

describe('isLocalUrl', () => {
  test.each([
    'http://localhost:11434',
    'http://LOCALHOST:11434/',
    'http://127.0.0.1:1234',
    'http://[::1]:11434',
    'http://192.168.1.20:11434',
    'http://10.0.0.5',
    'http://172.16.0.1',
    'http://172.31.255.255',
    'http://mybox.local:11434',
    'http://ollama.localhost',
  ])('local: %s', (u) => expect(isLocalUrl(u)).toBe(true));

  test.each([
    'https://api.openai.com/v1',
    'https://api.anthropic.com',
    'http://172.32.0.1', // just outside the private range
    'http://172.15.0.1',
    'http://192.169.0.1',
    'http://localhost.evil.com',
    'http://127.0.0.1.evil.com',
    'http://10.0.0.1.nip.io',
    'http://evil.com/localhost',
    'http://evil.com?x=localhost',
    'http://user@evil.com',
    'http://localhost@evil.com',
    'localhost:11434', // no scheme
    '',
    'ftp://localhost',
  ])('not local: %s', (u) => expect(isLocalUrl(u)).toBe(false));
});

describe('aiReady / isCloud', () => {
  test('off by default', () => {
    expect(aiReady(DEFAULT_SETTINGS.ai)).toBe(false);
    expect(isCloud(DEFAULT_SETTINGS.ai)).toBe(false);
  });

  test('local Ollama needs no key or acknowledgement', () => {
    expect(aiReady(ai({ provider: 'ollama', baseUrl: 'http://localhost:11434', model: 'llama3.2' }))).toBe(true);
  });

  test('cloud needs the privacy acknowledgement AND a key', () => {
    const base = ai({ provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' });
    expect(isCloud(base)).toBe(true);
    expect(aiReady({ ...base, apiKey: 'sk-test' })).toBe(false);
    expect(aiReady({ ...base, cloudRiskAcknowledged: true })).toBe(false);
    expect(aiReady({ ...base, apiKey: 'sk-test', cloudRiskAcknowledged: true })).toBe(true);
  });

  test('Ollama pointed at a remote host counts as cloud', () => {
    const remote = ai({ provider: 'ollama', baseUrl: 'https://ollama.example.com', model: 'x' });
    expect(isCloud(remote)).toBe(true);
    expect(aiReady(remote)).toBe(false);
  });

  test('missing model or URL is not ready', () => {
    expect(aiReady(ai({ provider: 'ollama', baseUrl: 'http://localhost:11434', model: '' }))).toBe(false);
    expect(aiReady(ai({ provider: 'ollama', baseUrl: '', model: 'x' }))).toBe(false);
  });
});

describe('aiParseEntry', () => {
  const ollama = ai({ provider: 'ollama', baseUrl: 'http://localhost:11434/', model: 'llama3.2' });

  test('calls the configured endpoint only, and maps the reply', async () => {
    respond({ message: { content: '{"type":"expense","amount":12.345,"merchant":"Lupe\'s","categoryId":"dining","note":"tacos","date":"2026-11-02"}' } });
    const r = await aiParseEntry(ollama, 'tacos 12', DEFAULT_CATEGORIES);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:11434/api/chat');
    expect(r).toMatchObject({ type: 'expense', amount: 12.35, merchant: "Lupe's", categoryId: 'dining', note: 'tacos', date: '2026-11-02' });
  });

  test('tolerates chatter around the JSON', async () => {
    respond({ message: { content: 'Sure! Here you go:\n```json\n{"type":"income","amount":"$1,200","categoryId":"paycheck"}\n```' } });
    const r = await aiParseEntry(ollama, 'paid', DEFAULT_CATEGORIES);
    expect(r).toMatchObject({ type: 'income', amount: 1200, categoryId: 'paycheck' });
  });

  test('never trusts the model: bad category, wrong kind, bad date, negative amount', async () => {
    respond({ message: { content: '{"type":"income","amount":-5,"categoryId":"groceries","date":"tomorrow","merchant":"' + 'x'.repeat(500) + '"}' } });
    const r = await aiParseEntry(ollama, '?', DEFAULT_CATEGORIES);
    expect(r.amount).toBeNull();
    expect(r.categoryId).toBe('other-income');
    expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.merchant.length).toBeLessThanOrEqual(40);
  });

  test('non-JSON reply is a clear error', async () => {
    respond({ message: { content: 'I cannot help with that.' } });
    await expect(aiParseEntry(ollama, 'x', DEFAULT_CATEGORIES)).rejects.toThrow(/JSON/);
  });

  test('HTTP errors are reported', async () => {
    respond({ error: 'model not found' }, 404);
    await expect(aiParseEntry(ollama, 'x', DEFAULT_CATEGORIES)).rejects.toThrow(/404/);
  });

  test('network failure gives a helpful Ollama message', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(aiParseEntry(ollama, 'x', DEFAULT_CATEGORIES)).rejects.toThrow(/Ollama/);
  });

  test('OpenAI-compatible sends the key as a bearer token', async () => {
    respond({ choices: [{ message: { content: '{"type":"expense","amount":3,"categoryId":"dining"}' } }] });
    await aiParseEntry(ai({ provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'm', apiKey: 'sk-test', cloudRiskAcknowledged: true }), 'x', DEFAULT_CATEGORIES);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer sk-test');
  });

  test('Anthropic uses x-api-key', async () => {
    respond({ content: [{ type: 'text', text: '{"type":"expense","amount":3,"categoryId":"dining"}' }] });
    await aiParseEntry(ai({ provider: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'm', apiKey: 'sk-ant-test', cloudRiskAcknowledged: true }), 'x', DEFAULT_CATEGORIES);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers['x-api-key']).toBe('sk-ant-test');
  });
});

describe('summary privacy', () => {
  test('the summary payload contains totals only', () => {
    const payload = buildSummaryPayload({
      period: 'November 2026',
      currency: '$',
      income: 1000,
      spent: 420.5,
      dayOfCycle: 9,
      daysInCycle: 30,
      categories: [{ name: 'Groceries', spent: 120, budget: 400 }],
    });
    const parsed = JSON.parse(payload);
    expect(Object.keys(parsed).sort()).toEqual(['categories', 'currency', 'dayOfCycle', 'daysInCycle', 'income', 'period', 'spent']);
    expect(Object.keys(parsed.categories[0]).sort()).toEqual(['budget', 'name', 'spent']);
  });

  test('aiSummary returns trimmed text', async () => {
    respond({ message: { content: '  • Looking good\n' } });
    await expect(aiSummary(ai({ provider: 'ollama', baseUrl: 'http://localhost:11434', model: 'm' }), '{}')).resolves.toBe('• Looking good');
  });
});
