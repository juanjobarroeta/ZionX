// AI WhatsApp qualifier — given the conversation so far and the receiving
// client's business context, produces the next reply AND extracts the key
// qualifying data (coverage location + desired service) so the lead arrives
// pre-qualified. Uses the same Anthropic setup as the other AI services.
// Never throws — returns { error } and the caller falls back to a static reply.
const Anthropic = require('@anthropic-ai/sdk');

function buildPrompt({ clientName, businessContext, history, captured }) {
  const convo = (history || [])
    .map((m) => `${m.direction === 'inbound' ? 'Cliente' : 'Asistente'}: ${m.content || '(sin texto)'}`)
    .join('\n');

  return `Eres el asistente de WhatsApp de "${clientName}".
Contexto del negocio: ${businessContext || 'Empresa de servicios.'}

Tu trabajo: atender a prospectos que escriben por WhatsApp, calificarlos y capturar datos clave sin sonar robótico. Reglas:
- Español mexicano, cálido y breve (máximo 2 frases por mensaje). Nunca uses listas largas.
- Objetivo de calificación: (1) confirmar qué servicio/plan busca, (2) obtener su COLONIA y dirección aproximada para verificar cobertura.
- Pide un dato a la vez. No repitas lo que ya te dieron.
- Cuando ya tengas colonia + servicio, agradece y dile que un asesor lo contactará muy pronto para confirmar cobertura y agendar.

Datos ya capturados hasta ahora (no los vuelvas a pedir): ${JSON.stringify(captured || {})}

Conversación hasta ahora:
${convo || '(el prospecto acaba de escribir por primera vez)'}

Responde SOLO con un objeto JSON válido, sin texto adicional, con esta forma exacta:
{"reply": "tu mensaje para el cliente", "captured": {"colonia": "", "direccion": "", "servicio": "", "intencion": "alta|media|baja", "listo_para_asesor": false}}
Deja en "" los campos que aún no conozcas. Usa el valor ya capturado si no hay info nueva.`;
}

function parseJson(text) {
  if (!text) return null;
  // Tolerate code fences or stray prose around the JSON object.
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (_) {
    return null;
  }
}

async function generateReply({ clientName, businessContext, history, captured }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: 'IA no configurada (falta ANTHROPIC_API_KEY)' };

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1000,
      thinking: { type: 'adaptive' },
      messages: [{ role: 'user', content: buildPrompt({ clientName, businessContext, history, captured }) }],
    });
    const text = (message.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    const parsed = parseJson(text);
    if (!parsed || !parsed.reply) return { error: 'Respuesta de IA no interpretable', raw: text };

    // Merge captured, keeping any prior non-empty value the model dropped.
    const merged = { ...(captured || {}) };
    for (const [k, v] of Object.entries(parsed.captured || {})) {
      if (v !== '' && v !== null && v !== undefined) merged[k] = v;
    }
    return { reply: parsed.reply, captured: merged };
  } catch (error) {
    return { error: error.message };
  }
}

module.exports = { generateReply };
