const axios = require('axios');
const { Pool } = require('pg');

class WhatsAppService {
  constructor() {
    this.apiUrl = 'https://graph.facebook.com/v18.0';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    this.verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'your-verify-token-here';
    
    // Database connection
    this.pool = new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'crediya',
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT || 5432,
    });
  }

  /**
   * Send a text message via WhatsApp
   */
  async sendTextMessage(phoneNumber, message, sentBy = null) {
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

      console.log(`✅ WhatsApp message sent to ${phoneNumber}`);
      
      // Save to database
      await this.saveMessage({
        phoneNumber,
        messageId: response.data.messages[0].id,
        direction: 'outbound',
        messageType: 'text',
        content: message,
        status: 'sent',
        sentBy
      });

      return { success: true, messageId: response.data.messages[0].id };
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
   * Handle incoming message from webhook
   */
  async handleIncomingMessage(webhookData) {
    try {
      const message = webhookData.entry[0].changes[0].value.messages[0];
      const contact = webhookData.entry[0].changes[0].value.contacts[0];
      
      const phoneNumber = message.from;
      const contactName = contact.profile.name;
      const messageType = message.type;
      let messageContent = '';
      let mediaUrl = null;

      // Extract message content based on type
      switch (messageType) {
        case 'text':
          messageContent = message.text.body;
          break;
        case 'image':
          mediaUrl = message.image.id;
          messageContent = message.image.caption || '';
          break;
        case 'video':
          mediaUrl = message.video.id;
          messageContent = message.video.caption || '';
          break;
        case 'document':
          mediaUrl = message.document.id;
          messageContent = message.document.filename || '';
          break;
        case 'audio':
          mediaUrl = message.audio.id;
          break;
      }

      console.log(`📩 Incoming ${messageType} message from ${contactName} (${phoneNumber}): ${messageContent}`);

      // Get or create contact
      let contactResult = await this.pool.query(
        'SELECT id FROM whatsapp_contacts WHERE phone_number = $1',
        [phoneNumber]
      );

      let contactId;
      let isNewLead = false;

      if (contactResult.rows.length === 0) {
        // NEW LEAD!
        console.log(`🆕 New lead detected: ${contactName}`);
        
        const newContact = await this.pool.query(`
          INSERT INTO whatsapp_contacts (phone_number, whatsapp_name, is_subscribed, last_message_at)
          VALUES ($1, $2, true, NOW())
          RETURNING id
        `, [phoneNumber, contactName]);

        contactId = newContact.rows[0].id;
        isNewLead = true;

        // Create lead entry
        await this.pool.query(`
          INSERT INTO leads (whatsapp_contact_id, source, status, created_at, last_contact_at)
          VALUES ($1, 'whatsapp_direct', 'new', NOW(), NOW())
        `, [contactId]);

        // Log activity
        await this.pool.query(`
          INSERT INTO lead_activities (lead_id, activity_type, description, created_at)
          VALUES ((SELECT id FROM leads WHERE whatsapp_contact_id = $1), 'note_added', 'Lead iniciado por WhatsApp', NOW())
        `, [contactId]);

      } else {
        contactId = contactResult.rows[0].id;
        
        // Update contact
        await this.pool.query(`
          UPDATE whatsapp_contacts 
          SET whatsapp_name = $1, last_message_at = NOW(), unread_count = unread_count + 1
          WHERE id = $2
        `, [contactName, contactId]);
      }

      // Save message to database
      await this.pool.query(`
        INSERT INTO whatsapp_messages 
        (contact_id, message_id, direction, message_type, content, media_url, status, sent_at)
        VALUES ($1, $2, 'inbound', $3, $4, $5, 'received', NOW())
      `, [contactId, message.id, messageType, messageContent, mediaUrl]);

      // Auto-reply for new leads
      if (isNewLead) {
        await this.sendWelcomeMessage(phoneNumber, contactName);
      }

      return { success: true, contactId, isNewLead };
    } catch (error) {
      console.error('❌ Error handling incoming message:', error);
      return { success: false, error: error.message };
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



