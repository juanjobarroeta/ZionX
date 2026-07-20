// AI lead triage — reads a client's open funnel and, per lead, returns where it
// stands (temperature + one-line summary) and the suggested next action. Uses
// the same Anthropic setup as ai-caption.js. Never throws — returns { error }.
const Anthropic = require('@anthropic-ai/sdk');

async function runClaude(apiKey, prompt, maxTokens) {
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content: prompt }],
  });
  return (message.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

const daysAgo = (d) => {
  if (!d) return null;
  const ms = Date.now() - new Date(d).getTime();
  return Math.max(0, Math.round(ms / 86400000));
};

function buildPrompt(customerName, leads) {
  const rows = leads.map((l) => ({
    id: l.id,
    nombre: l.name || l.display_name || null,
    ciudad: l.city || null,
    interes: l.service_interest || null,
    fuente: l.source || null,
    valor_estimado: l.estimated_value != null ? Number(l.estimated_value) : null,
    etapa: l.status,
    prioridad: l.priority || null,
    dias_desde_creacion: daysAgo(l.created_at),
    dias_desde_ultimo_contacto: daysAgo(l.last_contact_at),
    notas: l.notes || null,
  }));

  return [
    `Eres un asesor de ventas experto para "${customerName || 'este negocio'}".`,
    `Analiza los siguientes prospectos (leads) de su embudo de ventas y, para CADA uno, devuelve:`,
    `- "temperature": "hot" | "warm" | "cold" (qué tan probable es cerrar pronto)`,
    `- "score": entero 0-100 (probabilidad/prioridad)`,
    `- "summary": una frase breve (máx 12 palabras) de dónde está el prospecto`,
    `- "next_action": la SIGUIENTE mejor acción concreta y accionable (máx 14 palabras, en español, empezando con un verbo)`,
    ``,
    `Reglas: prioriza leads con más días sin contacto y mayor valor. Sé específico y práctico.`,
    `Responde ÚNICAMENTE con un arreglo JSON válido, sin texto adicional, con la forma:`,
    `[{"id":123,"temperature":"hot","score":85,"summary":"...","next_action":"..."}]`,
    ``,
    `Prospectos:`,
    JSON.stringify(rows),
  ].join('\n');
}

function parseJsonArray(text) {
  if (!text) return null;
  // Tolerate code fences or stray prose around the JSON array.
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

// Triage up to `limit` open leads for a customer. Writes the AI fields back and
// returns the enriched suggestions (most urgent first).
async function triageLeads(pool, customerId, { limit = 40 } = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: 'IA no configurada (falta ANTHROPIC_API_KEY)' };

  const cust = await pool.query(
    `SELECT COALESCE(NULLIF(commercial_name,''), NULLIF(business_name,''), 'Cliente') AS name
       FROM customers WHERE id = $1`,
    [customerId]
  );
  const customerName = cust.rows[0]?.name;

  // Open pipeline only (not won/lost). Oldest-untriaged first so repeated runs
  // sweep the whole funnel over time.
  const { rows: leads } = await pool.query(`
    SELECT id, name, city, service_interest, source, estimated_value, status,
           priority, notes, created_at, last_contact_at
      FROM leads
     WHERE customer_id = $1 AND status NOT IN ('converted','lost')
     ORDER BY ai_triaged_at ASC NULLS FIRST, created_at ASC
     LIMIT $2
  `, [customerId, limit]);

  if (!leads.length) return { triaged: 0, suggestions: [] };

  let text;
  try {
    text = await runClaude(apiKey, buildPrompt(customerName, leads), 4000);
  } catch (e) {
    return { error: `Error de IA: ${e.message}` };
  }
  const parsed = parseJsonArray(text);
  if (!Array.isArray(parsed)) return { error: 'La IA no devolvió un resultado válido.' };

  const validIds = new Set(leads.map((l) => l.id));
  const clean = (s, n) => (s == null ? null : String(s).slice(0, n));
  let triaged = 0;
  const suggestions = [];
  for (const s of parsed) {
    const id = Number(s.id);
    if (!validIds.has(id)) continue;
    const temp = ['hot', 'warm', 'cold'].includes(s.temperature) ? s.temperature : 'warm';
    const score = Math.max(0, Math.min(100, Math.round(Number(s.score) || 0)));
    const summary = clean(s.summary, 240);
    const nextAction = clean(s.next_action, 240);
    await pool.query(`
      UPDATE leads SET ai_temperature = $1, ai_summary = $2, ai_next_action = $3,
                       lead_score = $4, ai_triaged_at = NOW(), updated_at = NOW()
       WHERE id = $5
    `, [temp, summary, nextAction, score, id]);
    triaged++;
    suggestions.push({ id, temperature: temp, score, summary, next_action: nextAction });
  }
  suggestions.sort((a, b) => b.score - a.score);
  return { triaged, suggestions };
}

module.exports = { triageLeads };
