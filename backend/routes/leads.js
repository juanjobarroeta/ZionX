const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const whatsappService = require('../services/whatsappService');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'crediya',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// Middleware to authenticate requests
const authenticateToken = (req, res, next) => {
  const token = req.header("Authorization");
  if (!token) return res.status(403).json({ message: "Access denied" });

  try {
    const jwt = require('jsonwebtoken');
    const cleanToken = token.replace("Bearer ", "");
    const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET || "secretkey");
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid token" });
  }
};

/**
 * GET /leads
 * Get all leads with filters
 */
router.get('/leads', authenticateToken, async (req, res) => {
  try {
    const { status, assigned_to, source, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT 
        l.*,
        wc.phone_number,
        wc.whatsapp_name,
        wc.last_message_at,
        wc.unread_count,
        wc.is_subscribed,
        tm.name as assigned_to_name,
        (SELECT content FROM whatsapp_messages 
         WHERE contact_id = wc.id 
         ORDER BY sent_at DESC LIMIT 1) as last_message
      FROM leads l
      LEFT JOIN whatsapp_contacts wc ON l.whatsapp_contact_id = wc.id
      LEFT JOIN team_members tm ON l.assigned_to = tm.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    if (status) {
      query += ` AND l.status = $${++paramCount}`;
      params.push(status);
    }

    if (assigned_to) {
      query += ` AND l.assigned_to = $${++paramCount}`;
      params.push(assigned_to);
    }

    if (source) {
      query += ` AND l.source = $${++paramCount}`;
      params.push(source);
    }

    query += ` ORDER BY l.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Error al obtener leads' });
  }
});

/**
 * GET /leads/:id
 * Get single lead details
 */
router.get('/leads/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT 
        l.*,
        wc.phone_number,
        wc.whatsapp_name,
        wc.profile_pic_url,
        wc.last_message_at,
        wc.unread_count,
        wc.is_subscribed,
        tm.name as assigned_to_name,
        c.business_name as converted_customer_name
      FROM leads l
      LEFT JOIN whatsapp_contacts wc ON l.whatsapp_contact_id = wc.id
      LEFT JOIN team_members tm ON l.assigned_to = tm.id
      LEFT JOIN customers c ON l.converted_to_customer_id = c.id
      WHERE l.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching lead:', error);
    res.status(500).json({ error: 'Error al obtener lead' });
  }
});

/**
 * POST /leads/create
 * Create a new lead and send WhatsApp message
 */
router.post('/leads/create', authenticateToken, async (req, res) => {
  try {
    const { name, phone, email, service_interest, source, budget_range, notes, assigned_to } = req.body;

    // Validate required fields
    if (!name || !phone) {
      return res.status(400).json({ error: 'Nombre y teléfono son requeridos' });
    }

    // Format phone number
    let formattedPhone = phone.replace(/\s/g, '').replace(/-/g, '');
    if (!formattedPhone.startsWith('+')) {
      // Default to Mexico if no country code
      formattedPhone = '+52' + formattedPhone;
    }

    console.log(`📝 Creating lead: ${name} (${formattedPhone})`);

    // Check if contact already exists
    let contact = await pool.query(
      'SELECT id FROM whatsapp_contacts WHERE phone_number = $1',
      [formattedPhone]
    );

    let contactId;

    if (contact.rows.length === 0) {
      // Create new WhatsApp contact
      const newContact = await pool.query(`
        INSERT INTO whatsapp_contacts (phone_number, whatsapp_name, is_subscribed)
        VALUES ($1, $2, true)
        RETURNING id
      `, [formattedPhone, name]);

      contactId = newContact.rows[0].id;
      console.log(`✅ New contact created with ID: ${contactId}`);
    } else {
      contactId = contact.rows[0].id;
      console.log(`♻️ Using existing contact ID: ${contactId}`);
      
      // Update contact name if provided
      await pool.query(
        'UPDATE whatsapp_contacts SET whatsapp_name = $1 WHERE id = $2',
        [name, contactId]
      );
    }

    // Create lead entry
    const lead = await pool.query(`
      INSERT INTO leads (
        whatsapp_contact_id, 
        email, 
        source, 
        service_interest, 
        status, 
        budget_range,
        notes,
        assigned_to,
        last_contact_at,
        created_at
      )
      VALUES ($1, $2, $3, $4, 'new', $5, $6, $7, NOW(), NOW())
      RETURNING id
    `, [contactId, email, source || 'manual', service_interest, budget_range, notes, assigned_to || req.user.id]);

    const leadId = lead.rows[0].id;

    // Log activity
    await pool.query(`
      INSERT INTO lead_activities (lead_id, activity_type, description, performed_by, created_at)
      VALUES ($1, 'note_added', 'Lead creado manualmente', $2, NOW())
    `, [leadId, req.user.id]);

    // Send welcome WhatsApp message
    let whatsappSent = false;
    let whatsappError = null;

    try {
      const result = await whatsappService.sendWelcomeMessage(formattedPhone, name, service_interest);
      whatsappSent = result.success;
      if (!result.success) {
        whatsappError = result.error;
      }
      console.log(`${result.success ? '✅' : '❌'} WhatsApp message ${result.success ? 'sent' : 'failed'}`);
    } catch (whatsappErr) {
      console.error('WhatsApp send failed:', whatsappErr);
      whatsappError = whatsappErr.message;
    }

    res.json({
      success: true,
      lead_id: leadId,
      contact_id: contactId,
      whatsapp_sent: whatsappSent,
      whatsapp_error: whatsappError,
      message: whatsappSent 
        ? 'Lead creado y mensaje de WhatsApp enviado' 
        : 'Lead creado, pero el mensaje de WhatsApp falló (verifica credenciales)'
    });

  } catch (error) {
    console.error('❌ Error creating lead:', error);
    res.status(500).json({ error: 'Error al crear el lead', details: error.message });
  }
});

/**
 * PUT /leads/:id
 * Update lead information
 */
router.put('/leads/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, service_interest, status, budget_range, notes, assigned_to, lead_score } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 0;

    if (email !== undefined) {
      updates.push(`email = $${++paramCount}`);
      values.push(email);
    }
    if (service_interest !== undefined) {
      updates.push(`service_interest = $${++paramCount}`);
      values.push(service_interest);
    }
    if (status !== undefined) {
      updates.push(`status = $${++paramCount}`);
      values.push(status);
      
      // Log status change
      await pool.query(`
        INSERT INTO lead_activities (lead_id, activity_type, description, performed_by, created_at)
        VALUES ($1, 'status_changed', $2, $3, NOW())
      `, [id, `Estado cambiado a: ${status}`, req.user.id]);
    }
    if (budget_range !== undefined) {
      updates.push(`budget_range = $${++paramCount}`);
      values.push(budget_range);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${++paramCount}`);
      values.push(notes);
    }
    if (assigned_to !== undefined) {
      updates.push(`assigned_to = $${++paramCount}`);
      values.push(assigned_to);
      
      // Log assignment
      await pool.query(`
        INSERT INTO lead_activities (lead_id, activity_type, description, performed_by, created_at)
        VALUES ($1, 'assigned', 'Lead asignado', $2, NOW())
      `, [id, req.user.id]);
    }
    if (lead_score !== undefined) {
      updates.push(`lead_score = $${++paramCount}`);
      values.push(lead_score);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay datos para actualizar' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE leads 
      SET ${updates.join(', ')}
      WHERE id = $${++paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead no encontrado' });
    }

    res.json({ success: true, lead: result.rows[0] });
  } catch (error) {
    console.error('Error updating lead:', error);
    res.status(500).json({ error: 'Error al actualizar lead' });
  }
});

/**
 * GET /leads/:id/messages
 * Get conversation history for a lead
 */
router.get('/leads/:id/messages', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50 } = req.query;

    // Get contact_id from lead
    const lead = await pool.query(
      'SELECT whatsapp_contact_id FROM leads WHERE id = $1',
      [id]
    );

    if (lead.rows.length === 0) {
      return res.status(404).json({ error: 'Lead no encontrado' });
    }

    const contactId = lead.rows[0].whatsapp_contact_id;

    // Get messages
    const messages = await pool.query(`
      SELECT 
        wm.*,
        tm.name as sent_by_name
      FROM whatsapp_messages wm
      LEFT JOIN team_members tm ON wm.sent_by = tm.id
      WHERE wm.contact_id = $1
      ORDER BY wm.sent_at ASC
      LIMIT $2
    `, [contactId, limit]);

    // Mark as read
    await pool.query(
      'UPDATE whatsapp_contacts SET unread_count = 0 WHERE id = $1',
      [contactId]
    );

    res.json(messages.rows);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Error al obtener mensajes' });
  }
});

/**
 * POST /leads/:id/send-message
 * Send a WhatsApp message to a lead
 */
router.post('/leads/:id/send-message', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { message, message_type = 'text', media_url } = req.body;

    if (!message && !media_url) {
      return res.status(400).json({ error: 'Mensaje o media requerido' });
    }

    // Get lead and contact info
    const lead = await pool.query(`
      SELECT l.id, wc.phone_number, wc.whatsapp_name
      FROM leads l
      JOIN whatsapp_contacts wc ON l.whatsapp_contact_id = wc.id
      WHERE l.id = $1
    `, [id]);

    if (lead.rows.length === 0) {
      return res.status(404).json({ error: 'Lead no encontrado' });
    }

    const phoneNumber = lead.rows[0].phone_number;

    // Send message based on type
    let result;
    if (message_type === 'image' && media_url) {
      result = await whatsappService.sendImageMessage(phoneNumber, media_url, message);
    } else {
      result = await whatsappService.sendTextMessage(phoneNumber, message, req.user.id);
    }

    if (result.success) {
      // Update last contact time
      await pool.query(
        'UPDATE leads SET last_contact_at = NOW() WHERE id = $1',
        [id]
      );

      // Log activity
      await pool.query(`
        INSERT INTO lead_activities (lead_id, activity_type, description, performed_by, created_at)
        VALUES ($1, 'message_sent', $2, $3, NOW())
      `, [id, `Mensaje enviado via WhatsApp`, req.user.id]);

      res.json({ success: true, message_id: result.messageId });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Error al enviar mensaje' });
  }
});

/**
 * POST /leads/:id/convert
 * Convert lead to customer
 */
router.post('/leads/:id/convert', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const customerData = req.body;

    // Get lead info
    const lead = await pool.query(
      'SELECT * FROM leads WHERE id = $1',
      [id]
    );

    if (lead.rows.length === 0) {
      return res.status(404).json({ error: 'Lead no encontrado' });
    }

    // Create customer (you'll need to adjust this based on your customers table structure)
    const customer = await pool.query(`
      INSERT INTO customers (business_name, email, phone, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING id
    `, [customerData.business_name, lead.rows[0].email, customerData.phone]);

    const customerId = customer.rows[0].id;

    // Update lead
    await pool.query(`
      UPDATE leads 
      SET status = 'converted', converted_to_customer_id = $1, updated_at = NOW()
      WHERE id = $2
    `, [customerId, id]);

    // Log activity
    await pool.query(`
      INSERT INTO lead_activities (lead_id, activity_type, description, performed_by, created_at)
      VALUES ($1, 'note_added', 'Lead convertido a cliente', $2, NOW())
    `, [id, req.user.id]);

    res.json({ success: true, customer_id: customerId });
  } catch (error) {
    console.error('Error converting lead:', error);
    res.status(500).json({ error: 'Error al convertir lead' });
  }
});

/**
 * GET /leads/:id/activities
 * Get activity log for a lead
 */
router.get('/leads/:id/activities', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const activities = await pool.query(`
      SELECT 
        la.*,
        tm.name as performed_by_name
      FROM lead_activities la
      LEFT JOIN team_members tm ON la.performed_by = tm.id
      WHERE la.lead_id = $1
      ORDER BY la.created_at DESC
    `, [id]);

    res.json(activities.rows);
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ error: 'Error al obtener actividades' });
  }
});

/**
 * GET /leads/stats
 * Get lead statistics
 */
router.get('/leads/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_leads,
        COUNT(*) FILTER (WHERE status = 'new') as new_leads,
        COUNT(*) FILTER (WHERE status = 'contacted') as contacted_leads,
        COUNT(*) FILTER (WHERE status = 'qualified') as qualified_leads,
        COUNT(*) FILTER (WHERE status = 'converted') as converted_leads,
        COUNT(*) FILTER (WHERE status = 'lost') as lost_leads,
        COUNT(*) FILTER (WHERE assigned_to = $1) as my_leads,
        ROUND(AVG(lead_score)) as avg_lead_score
      FROM leads
    `, [req.user.id]);

    res.json(stats.rows[0]);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

module.exports = router;



