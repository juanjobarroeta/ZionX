const axios = require('axios');
const { Pool } = require('pg');
const { generateReply } = require('./ai-whatsapp-reply');

class WhatsAppService {
  constructor() {
    // Provider: 'meta' (WhatsApp Cloud API) or 'twilio' (WhatsApp via Twilio).
    // Defaults to twilio when Twilio creds are set and Meta isn't, else meta.
    this.apiUrl = 'https://graph.facebook.com/v18.0';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    this.verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'your-verify-token-here';

    // Twilio config
    this.twilioSid = process.env.TWILIO_ACCOUNT_SID;
    this.twilioToken = process.env.TWILIO_AUTH_TOKEN;
    this.twilioFrom = process.env.TWILIO_WHATSAPP_FROM; // e.g. +14155238886 (sandbox) or your number
    this.provider = (process.env.WHATSAPP_PROVIDER
      || (this.twilioSid && this.twilioToken && !this.phoneNumberId ? 'twilio' : 'meta')).toLowerCase();
    
    // Database connection — use Railway's DATABASE_URL when present, else local.
    // (Previously hardcoded to localhost, so inbound WhatsApp writes failed on
    // Railway with ECONNREFUSED and no lead was ever created.)
    this.pool = process.env.DATABASE_URL
      ? new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: process.env.DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false,
        })
      : new Pool({
          user: process.env.DB_USER || 'postgres',
          host: process.env.DB_HOST || 'localhost',
          database: process.env.DB_NAME || 'crediya',
          password: process.env.DB_PASSWORD,
          port: process.env.DB_PORT || 5432,
        });
    this.pool.on('error', (err) => console.error('⚠️ WhatsApp pool idle error:', err.message));
  }

  // Lightweight connection status for the linking check. Reports which env vars
  // are set and, if possible, validates the number against the Graph API.
  async getStatus() {
    const configured = {
      provider: this.provider,
      phone_number_id: !!this.phoneNumberId,
      access_token: !!this.accessToken,
      verify_token: !!process.env.WHATSAPP_VERIFY_TOKEN,
      twilio_sid: !!this.twilioSid,
      twilio_token: !!this.twilioToken,
      twilio_from: !!this.twilioFrom,
    };
    const ready = this.provider === 'twilio'
      ? !!(this.twilioSid && this.twilioToken && this.twilioFrom)
      : !!(this.phoneNumberId && this.accessToken);
    let graph = null;
    if (this.provider === 'meta' && ready) {
      try {
        const r = await axios.get(`${this.apiUrl}/${this.phoneNumberId}`, {
          params: { fields: 'display_phone_number,verified_name,quality_rating' },
          headers: { Authorization: `Bearer ${this.accessToken}` },
        });
        graph = { ok: true, ...r.data };
      } catch (e) {
        graph = { ok: false, error: e.response?.data?.error?.message || e.message };
      }
    }
    return { provider: this.provider, configured, ready, graph };
  }

  /**
   * Send a WhatsApp text via Twilio's REST API.
   */
  async sendViaTwilio(phoneNumber, message) {
    const to = String(phoneNumber).startsWith('whatsapp:')
      ? phoneNumber
      : `whatsapp:${String(phoneNumber).startsWith('+') ? phoneNumber : '+' + phoneNumber}`;
    const from = String(this.twilioFrom).startsWith('whatsapp:') ? this.twilioFrom : `whatsapp:${this.twilioFrom}`;
    const params = new URLSearchParams();
    params.append('From', from);
    params.append('To', to);
    params.append('Body', message);
    const r = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${this.twilioSid}/Messages.json`,
      params,
      { auth: { username: this.twilioSid, password: this.twilioToken } }
    );
    return r.data.sid;
  }

  /**
   * Send a text message via WhatsApp
   */
  async sendTextMessage(phoneNumber, message, sentBy = null) {
    try {
      let messageId;
      if (this.provider === 'twilio') {
        if (!this.twilioSid || !this.twilioToken || !this.twilioFrom) {
          console.warn('⚠️ Twilio WhatsApp credentials not configured');
          return { success: false, error: 'WhatsApp (Twilio) not configured' };
        }
        messageId = await this.sendViaTwilio(phoneNumber, message);
      } else {
        if (!this.phoneNumberId || !this.accessToken) {
          console.warn('⚠️ WhatsApp credentials not configured');
          return { success: false, error: 'WhatsApp not configured' };
        }
        const response = await axios.post(
          `${this.apiUrl}/${this.phoneNumberId}/messages`,
          {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: 'text',
            text: { body: message }
          },
          {
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        messageId = response.data.messages[0].id;
      }

      console.log(`✅ WhatsApp message sent to ${phoneNumber} via ${this.provider}`);

      // Save to database
      await this.saveMessage({
        phoneNumber,
        messageId,
        direction: 'outbound',
        messageType: 'text',
        content: message,
        status: 'sent',
        sentBy
      });

      return { success: true, messageId };
    } catch (error) {
      console.error('❌ WhatsApp send error:', error.response?.data || error.message);
      
      // Save failed message to database
      await this.saveMessage({
        phoneNumber,
        messageId: null,
        direction: 'outbound',
        messageType: 'text',
        content: message,
        status: 'failed',
        errorMessage: error.response?.data?.error?.message || error.message,
        sentBy
      });

      return { 
        success: false, 
        error: error.response?.data?.error?.message || error.message 
      };
    }
  }

  /**
   * Send a template message (pre-approved by Meta)
   */
  async sendTemplateMessage(phoneNumber, templateName, variables = []) {
    try {
      if (!this.phoneNumberId || !this.accessToken) {
        console.warn('⚠️ WhatsApp credentials not configured');
        return { success: false, error: 'WhatsApp not configured' };
      }

      // Build parameters for template
      const parameters = variables.map(variable => ({
        type: 'text',
        text: variable
      }));

      const response = await axios.post(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: phoneNumber,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'es_MX' },
            components: parameters.length > 0 ? [{
              type: 'body',
              parameters: parameters
            }] : []
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✅ WhatsApp template "${templateName}" sent to ${phoneNumber}`);
      
      // Save to database
      await this.saveMessage({
        phoneNumber,
        messageId: response.data.messages[0].id,
        direction: 'outbound',
        messageType: 'template',
        content: `Template: ${templateName}`,
        status: 'sent',
        templateName
      });

      return { success: true, messageId: response.data.messages[0].id };
    } catch (error) {
      console.error('❌ WhatsApp template send error:', error.response?.data || error.message);
      return { 
        success: false, 
        error: error.response?.data?.error?.message || error.message 
      };
    }
  }

  /**
   * Send welcome message to new lead
   */
  async sendWelcomeMessage(phoneNumber, leadName, serviceInterest = null) {
    let message = `¡Hola ${leadName}! 👋\n\nGracias por contactarnos.`;
    
    if (serviceInterest) {
      message += ` Veo que estás interesado en ${serviceInterest}.`;
    }
    
    message += `\n\n¿En qué podemos ayudarte?\n\n1️⃣ Marketing Digital\n2️⃣ Diseño Gráfico\n3️⃣ Gestión de Redes Sociales\n4️⃣ Publicidad Pagada\n\nUn asesor te contactará pronto. 😊`;

    return await this.sendTextMessage(phoneNumber, message);
  }

  /**
   * Send image with caption
   */
  async sendImageMessage(phoneNumber, imageUrl, caption = '') {
    try {
      if (!this.phoneNumberId || !this.accessToken) {
        console.warn('⚠️ WhatsApp credentials not configured');
        return { success: false, error: 'WhatsApp not configured' };
      }

      const response = await axios.post(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: phoneNumber,
          type: 'image',
          image: {
            link: imageUrl,
            caption: caption
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✅ WhatsApp image sent to ${phoneNumber}`);
      
      await this.saveMessage({
        phoneNumber,
        messageId: response.data.messages[0].id,
        direction: 'outbound',
        messageType: 'image',
        content: caption,
        mediaUrl: imageUrl,
        status: 'sent'
      });

      return { success: true, messageId: response.data.messages[0].id };
    } catch (error) {
      console.error('❌ WhatsApp image send error:', error.response?.data || error.message);
      return { 
        success: false, 
        error: error.response?.data?.error?.message || error.message 
      };
    }
  }

  /**
   * Save message to database
   */
  async saveMessage({ phoneNumber, messageId, direction, messageType, content, mediaUrl = null, status = 'sent', templateName = null, errorMessage = null, sentBy = null }) {
    try {
      // Get or create contact
      let contact = await this.pool.query(
        'SELECT id FROM whatsapp_contacts WHERE phone_number = $1',
        [phoneNumber]
      );

      let contactId;
      if (contact.rows.length === 0) {
        const newContact = await this.pool.query(
          'INSERT INTO whatsapp_contacts (phone_number) VALUES ($1) RETURNING id',
          [phoneNumber]
        );
        contactId = newContact.rows[0].id;
      } else {
        contactId = contact.rows[0].id;
      }

      // Update contact's last message time
      await this.pool.query(
        'UPDATE whatsapp_contacts SET last_message_at = NOW() WHERE id = $1',
        [contactId]
      );

      // Save message
      await this.pool.query(`
        INSERT INTO whatsapp_messages 
        (contact_id, message_id, direction, message_type, content, media_url, status, template_name, error_message, sent_by, sent_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      `, [contactId, messageId, direction, messageType, content, mediaUrl, status, templateName, errorMessage, sentBy]);

      console.log(`💾 Message saved to database`);
    } catch (error) {
      console.error('❌ Error saving message to database:', error);
    }
  }

  /**
   * The client whose funnel receives inbound WhatsApp leads, plus its AI config.
   */
  async getReceivingClient() {
    try {
      const t = await this.pool.query(`
        SELECT id,
               COALESCE(NULLIF(commercial_name,''), NULLIF(business_name,''), 'nuestra empresa') AS name,
               whatsapp_ai_enabled, whatsapp_greeting, whatsapp_business_context
          FROM customers WHERE receives_whatsapp_leads = true ORDER BY id LIMIT 1
      `);
      return t.rows[0] || null;
    } catch (_) {
      return null; // columns may not exist pre-migration
    }
  }

  /**
   * Handle an inbound message from the Meta Cloud API webhook.
   * Normalizes the Meta payload and hands off to processInbound.
   */
  async handleIncomingMessage(webhookData) {
    try {
      const message = webhookData.entry[0].changes[0].value.messages[0];
      const contact = webhookData.entry[0].changes[0].value.contacts[0];

      const messageType = message.type;
      let messageContent = '';
      let mediaUrl = null;
      switch (messageType) {
        case 'text': messageContent = message.text.body; break;
        case 'image': mediaUrl = message.image.id; messageContent = message.image.caption || ''; break;
        case 'video': mediaUrl = message.video.id; messageContent = message.video.caption || ''; break;
        case 'document': mediaUrl = message.document.id; messageContent = message.document.filename || ''; break;
        case 'audio': mediaUrl = message.audio.id; break;
      }

      return await this.processInbound({
        phoneNumber: message.from,
        contactName: contact?.profile?.name || null,
        messageType,
        messageContent,
        mediaUrl,
        providerMessageId: message.id,
        referral: message.referral || null,
      });
    } catch (error) {
      console.error('❌ Error handling incoming Meta message:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle an inbound message from Twilio's WhatsApp webhook (form-encoded body).
   */
  async handleTwilioInbound(body) {
    try {
      const rawFrom = body.From || body.from || '';
      const phoneNumber = String(rawFrom).replace(/^whatsapp:/, '');
      const hasMedia = Number(body.NumMedia || 0) > 0;
      return await this.processInbound({
        phoneNumber,
        contactName: body.ProfileName || null,
        messageType: hasMedia ? 'image' : 'text',
        messageContent: body.Body || '',
        mediaUrl: hasMedia ? (body.MediaUrl0 || null) : null,
        providerMessageId: body.MessageSid || body.SmsMessageSid || null,
        referral: null,
      });
    } catch (error) {
      console.error('❌ Error handling inbound Twilio message:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Shared inbound pipeline for both providers: upsert contact, create the lead
   * (routed to the receiving client) on first contact, store the message, then
   * run the AI qualifier and reply — capturing coverage/plan onto the lead.
   */
  async processInbound({ phoneNumber, contactName, messageType, messageContent, mediaUrl, providerMessageId, referral }) {
    console.log(`📩 Inbound ${messageType} from ${contactName} (${phoneNumber}): ${messageContent}`);

    const client = await this.getReceivingClient();

    const existing = await this.pool.query('SELECT id FROM whatsapp_contacts WHERE phone_number = $1', [phoneNumber]);
    let contactId;
    let isNewLead = false;

    if (existing.rows.length === 0) {
      console.log(`🆕 New lead detected: ${contactName}`);
      const newContact = await this.pool.query(`
        INSERT INTO whatsapp_contacts (phone_number, whatsapp_name, is_subscribed, last_message_at)
        VALUES ($1, $2, true, NOW()) RETURNING id
      `, [phoneNumber, contactName]);
      contactId = newContact.rows[0].id;
      isNewLead = true;

      const source = referral ? 'campaign' : 'whatsapp';
      const targetCustomerId = client?.id || null;
      await this.pool.query(`
        INSERT INTO leads (whatsapp_contact_id, customer_id, name, phone, source, status,
                           custom_fields, created_at, last_contact_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, 'new', $6, NOW(), NOW(), NOW())
      `, [contactId, targetCustomerId, contactName || null, phoneNumber || null, source,
          referral ? JSON.stringify({ referral }) : '{}']);

      const refLabel = referral
        ? `Lead de campaña (WhatsApp): ${referral.headline || referral.source_id || 'anuncio'}`
        : 'Lead iniciado por WhatsApp';
      await this.pool.query(`
        INSERT INTO lead_activities (lead_id, activity_type, description, created_at)
        VALUES ((SELECT id FROM leads WHERE whatsapp_contact_id = $1 ORDER BY id DESC LIMIT 1), 'note_added', $2, NOW())
      `, [contactId, refLabel]);
    } else {
      contactId = existing.rows[0].id;
      await this.pool.query(`
        UPDATE whatsapp_contacts SET whatsapp_name = COALESCE($1, whatsapp_name),
               last_message_at = NOW(), unread_count = unread_count + 1 WHERE id = $2
      `, [contactName, contactId]);
    }

    // Store the inbound message BEFORE the AI runs, so it's part of the history.
    await this.pool.query(`
      INSERT INTO whatsapp_messages (contact_id, message_id, direction, message_type, content, media_url, status, sent_at)
      VALUES ($1, $2, 'inbound', $3, $4, $5, 'received', NOW())
    `, [contactId, providerMessageId, messageType, messageContent, mediaUrl]);

    // AI qualifier (falls back to a static greeting if disabled/unavailable).
    await this.runQualifier({ phoneNumber, contactId, contactName, client });

    return { success: true, contactId, isNewLead };
  }

  /**
   * Generate + send the AI reply and persist any captured fields onto the lead.
   */
  async runQualifier({ phoneNumber, contactId, contactName, client }) {
    const aiEnabled = client ? client.whatsapp_ai_enabled !== false : false;
    if (!aiEnabled || !process.env.ANTHROPIC_API_KEY) {
      // Static fallback: a branded greeting for the receiving client.
      const name = client?.name || 'nosotros';
      const greeting = client?.whatsapp_greeting
        || `¡Hola${contactName ? ' ' + contactName : ''}! Gracias por escribir a ${name}. En un momento un asesor te atiende. ¿En qué te podemos ayudar?`;
      await this.sendTextMessage(phoneNumber, greeting);
      return;
    }

    // Load conversation history + whatever we've captured so far on the lead.
    const hist = await this.pool.query(
      `SELECT direction, content FROM whatsapp_messages WHERE contact_id = $1 ORDER BY sent_at ASC LIMIT 30`,
      [contactId]
    );
    let captured = {};
    let leadId = null;
    try {
      const l = await this.pool.query(
        `SELECT id, custom_fields FROM leads WHERE whatsapp_contact_id = $1 ORDER BY id DESC LIMIT 1`,
        [contactId]
      );
      if (l.rows.length) {
        leadId = l.rows[0].id;
        const cf = l.rows[0].custom_fields;
        captured = (cf && typeof cf === 'object') ? (cf.qualifier || {}) : {};
      }
    } catch (_) { /* leads shape may vary */ }

    const result = await generateReply({
      clientName: client?.name || 'nuestra empresa',
      businessContext: client?.whatsapp_business_context,
      history: hist.rows,
      captured,
    });

    if (result.error || !result.reply) {
      console.warn('⚠️ AI qualifier fallback:', result.error);
      const name = client?.name || 'nosotros';
      await this.sendTextMessage(phoneNumber, `¡Hola! Gracias por escribir a ${name}. En breve un asesor te atiende.`);
      return;
    }

    await this.sendTextMessage(phoneNumber, result.reply);

    // Persist captured qualifier data onto the lead for the funnel/portal.
    if (leadId && result.captured) {
      try {
        await this.pool.query(
          `UPDATE leads
              SET custom_fields = COALESCE(custom_fields, '{}'::jsonb) || $1::jsonb,
                  last_contact_at = NOW(), updated_at = NOW()
            WHERE id = $2`,
          [JSON.stringify({ qualifier: result.captured }), leadId]
        );
      } catch (e) {
        console.error('⚠️ Could not persist qualifier capture:', e.message);
      }
    }
  }

  /**
   * Update message status (delivered, read, etc.)
   */
  async updateMessageStatus(messageId, status) {
    try {
      const statusMap = {
        'delivered': { status: 'delivered', column: 'delivered_at' },
        'read': { status: 'read', column: 'read_at' }
      };

      const mapped = statusMap[status];
      if (!mapped) return;

      await this.pool.query(`
        UPDATE whatsapp_messages 
        SET status = $1, ${mapped.column} = NOW()
        WHERE message_id = $2
      `, [mapped.status, messageId]);

      console.log(`📊 Message ${messageId} status updated to ${status}`);
    } catch (error) {
      console.error('❌ Error updating message status:', error);
    }
  }

  /**
   * Get conversation history for a contact
   */
  async getConversationHistory(contactId, limit = 50) {
    try {
      const result = await this.pool.query(`
        SELECT * FROM whatsapp_messages
        WHERE contact_id = $1
        ORDER BY sent_at DESC
        LIMIT $2
      `, [contactId, limit]);

      return result.rows.reverse(); // Oldest first
    } catch (error) {
      console.error('❌ Error fetching conversation history:', error);
      return [];
    }
  }
}

module.exports = new WhatsAppService();



