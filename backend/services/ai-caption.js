const Anthropic = require('@anthropic-ai/sdk');

// =====================================================
// AI CAPTION SERVICE
//
// Drafts an on-brand Spanish caption for a content_calendar post using the
// client's creative brief + the post's idea/pilar/platform. This is an
// accelerant inside the human pipeline: the community manager gets a first
// draft to polish, not an autopublish. Degrades gracefully when the API key
// is missing so the endpoint never crashes the request.
// =====================================================

// Cap how much brief text we feed the model per field so one giant free-text
// answer can't blow up the prompt.
function clip(value, max = 600) {
  if (value === null || value === undefined) return '';
  const s = String(value).trim();
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

// Turn a labelled set of brief/post fields into a compact bulleted block,
// skipping anything empty.
function contextBlock(pairs) {
  return pairs
    .map(([label, value]) => {
      const v = clip(value);
      return v ? `- ${label}: ${v}` : null;
    })
    .filter(Boolean)
    .join('\n');
}

// Load everything we know about the post and its client. Returns null if the
// post doesn't exist.
async function loadDraftContext(pool, postId) {
  const postRes = await pool.query(
    `SELECT cc.id, cc.customer_id, cc.title, cc.description, cc.campaign,
            cc.platform, cc.pilar, cc.content_type, cc.idea_tema, cc.referencia,
            cc.copy_in, cc.copy_out, cc.hashtags,
            c.business_name, c.industry
       FROM content_calendar cc
       LEFT JOIN customers c ON c.id = cc.customer_id
      WHERE cc.id = $1`,
    [postId]
  );
  if (!postRes.rows.length) return null;
  const post = postRes.rows[0];

  // Latest creative brief for this client, if one exists. Best-effort: an
  // absent brief just means a thinner prompt.
  let brief = null;
  if (post.customer_id != null) {
    try {
      const briefRes = await pool.query(
        `SELECT * FROM creative_briefs
          WHERE customer_id = $1
          ORDER BY updated_at DESC NULLS LAST, id DESC
          LIMIT 1`,
        [post.customer_id]
      );
      brief = briefRes.rows[0] || null;
    } catch (err) {
      // creative_briefs may not carry customer_id in some deployments.
      console.error('⚠️ ai-caption brief lookup failed:', err.message);
    }
  }
  return { post, brief };
}

// Assemble the user-facing prompt from post + brief context.
function buildPrompt({ post, brief }) {
  const brand = post.business_name || (brief && brief.company_name) || 'la marca';

  const briefContext = brief
    ? contextBlock([
        ['Concepto central', brief.central_idea || brief.core_concept],
        ['Propuesta de valor', brief.value_proposition],
        ['Personalidad de marca', brief.brand_personality],
        ['Emociones deseadas', brief.desired_emotions],
        ['Palabras clave de marca', brief.brand_keywords],
        ['Palabras a evitar', brief.anti_keywords],
        ['Cliente ideal', brief.ideal_client_primary || brief.target_consumer],
        ['Objetivo principal', brief.primary_objective],
        ['Diferenciadores', brief.unique_differentiators || brief.differentiators],
        ['Promesa de entrega', brief.promise_delivery],
      ])
    : '';

  const postContext = contextBlock([
    ['Marca', brand],
    ['Industria', post.industry],
    ['Pilar de contenido', post.pilar],
    ['Tipo de contenido', post.content_type],
    ['Plataforma', post.platform],
    ['Campaña', post.campaign],
    ['Idea / tema', post.idea_tema || post.title],
    ['Descripción', post.description],
    ['Referencia', post.referencia],
    ['Notas de copy existentes', post.copy_in],
  ]);

  return [
    `Eres redactor publicitario senior de ZIONX, una agencia de marketing. Escribe el copy (caption) para una publicación de redes sociales de ${brand}.`,
    '',
    'Contexto de la publicación:',
    postContext || '- (sin detalles adicionales)',
    briefContext ? '\nLineamientos de marca (del brief creativo):' : '',
    briefContext,
    '',
    'Instrucciones:',
    '- Escribe en español, en el tono de la marca según los lineamientos.',
    `- Adapta el formato y la extensión a la plataforma (${post.platform || 'red social'}).`,
    '- No uses emojis en absoluto.',
    '- Respeta las palabras a evitar si se indicaron.',
    '- Incluye un llamado a la acción claro cuando sea natural.',
    '- Si procede, sugiere hasta 5 hashtags relevantes al final, en una línea aparte.',
    '- Devuelve únicamente el copy listo para publicar, sin encabezados, comillas ni explicaciones.',
  ]
    .filter((line) => line !== null && line !== undefined)
    .join('\n');
}

// Prompt for a content idea/tema — the concept a designer works from. Uses the
// same client + post context as the caption prompt.
function buildIdeaPrompt({ post, brief }) {
  const brand = post.business_name || (brief && brief.company_name) || 'la marca';
  const briefContext = brief
    ? contextBlock([
        ['Concepto central', brief.central_idea || brief.core_concept],
        ['Propuesta de valor', brief.value_proposition],
        ['Personalidad de marca', brief.brand_personality],
        ['Emociones deseadas', brief.desired_emotions],
        ['Palabras clave de marca', brief.brand_keywords],
        ['Palabras a evitar', brief.anti_keywords],
        ['Cliente ideal', brief.ideal_client_primary || brief.target_consumer],
        ['Objetivo principal', brief.primary_objective],
        ['Diferenciadores', brief.unique_differentiators || brief.differentiators],
      ])
    : '';
  const postContext = contextBlock([
    ['Marca', brand],
    ['Industria', post.industry],
    ['Pilar de contenido', post.pilar],
    ['Tipo de contenido', post.content_type],
    ['Plataforma', post.platform],
    ['Campaña', post.campaign],
    ['Notas existentes', post.idea_tema || post.description],
  ]);

  return [
    `Eres estratega de contenido de ZIONX. Propón UNA idea/tema concreto para una publicación de ${brand}.`,
    '',
    'Contexto:',
    postContext || '- (sin detalles adicionales)',
    briefContext ? '\nLineamientos de marca (del brief creativo):' : '',
    briefContext,
    '',
    'Instrucciones:',
    '- Responde en español.',
    `- La idea debe encajar con el pilar de contenido y la plataforma (${post.platform || 'red social'}).`,
    '- Sé concreto y accionable: un concepto que el diseñador pueda ejecutar.',
    '- No uses emojis.',
    '- Devuelve solo la idea/tema en 1–2 líneas, sin encabezados ni explicaciones.',
  ]
    .filter((line) => line !== null && line !== undefined)
    .join('\n');
}

// Shared Claude call. Returns the concatenated text or throws.
async function runClaude(apiKey, prompt, maxTokens) {
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content: prompt }],
  });
  return (message.content || [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();
}

// Generate a draft of the given kind ('copy' | 'idea'). Returns { draft } on
// success, or { draft: null, error } when unavailable. Never throws.
async function generateDraft(pool, postId, kind = 'copy') {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { draft: null, error: 'IA no configurada (falta ANTHROPIC_API_KEY)' };

  const ctx = await loadDraftContext(pool, postId);
  if (!ctx) return { draft: null, error: 'Publicación no encontrada', notFound: true };

  const prompt = kind === 'idea' ? buildIdeaPrompt(ctx) : buildPrompt(ctx);
  const maxTokens = kind === 'idea' ? 400 : 1200;

  try {
    const draft = await runClaude(apiKey, prompt, maxTokens);
    if (!draft) return { draft: null, error: 'La IA no devolvió texto' };
    return { draft };
  } catch (err) {
    console.error(`❌ ai ${kind} generation failed:`, err.message);
    return { draft: null, error: 'Error al generar el borrador con IA' };
  }
}

const generateCaptionDraft = (pool, postId) => generateDraft(pool, postId, 'copy');
const generateIdeaDraft = (pool, postId) => generateDraft(pool, postId, 'idea');

module.exports = { generateDraft, generateCaptionDraft, generateIdeaDraft, buildPrompt, buildIdeaPrompt, loadDraftContext };
