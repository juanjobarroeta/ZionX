const express = require('express');
const router = express.Router();
const whatsappService = require('../services/whatsappService');

/**
 * GET /webhooks/whatsapp
 * Webhook verification endpoint (required by Meta)
 */
router.get('/webhooks/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('🔍 Webhook verification request received');
  console.log('Mode:', mode);
  console.log('Token:', token);

  if (mode === 'subscribe' && token === whatsappService.verifyToken) {
    console.log('✅ Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.error('❌ Webhook verification failed');
    res.sendStatus(403);
  }
});

/**
 * POST /webhooks/whatsapp
 * Receives WhatsApp messages and status updates
 */
router.post('/webhooks/whatsapp', async (req, res) => {
  try {
    const body = req.body;

    console.log('📨 Webhook received:', JSON.stringify(body, null, 2));

    // Always respond quickly to Meta
    res.status(200).send('EVENT_RECEIVED');

    // Process the webhook asynchronously
    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry) {
        const changes = entry.changes[0];
        const value = changes.value;

        // Handle incoming messages
        if (value.messages && value.messages[0]) {
          console.log('📩 Processing incoming message...');
          await whatsappService.handleIncomingMessage(body);
        }

        // Handle message status updates (delivered, read, failed)
        if (value.statuses && value.statuses[0]) {
          const status = value.statuses[0];
          console.log(`📊 Message status update: ${status.id} → ${status.status}`);
          await whatsappService.updateMessageStatus(status.id, status.status);
        }
      }
    }
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    // Don't return error to Meta, we already responded with 200
  }
});

/**
 * GET /api/whatsapp/status
 * Admin: confirm the WhatsApp link — which credentials are set and whether the
 * number validates against the Graph API. Used to check "linking" worked.
 */
const { authenticateToken, isAdmin } = require('../middleware/auth');
router.get('/api/whatsapp/status', authenticateToken, isAdmin, async (req, res) => {
  try {
    res.json(await whatsappService.getStatus());
  } catch (err) {
    console.error('Error getting whatsapp status:', err);
    res.status(500).json({ error: 'Error al obtener el estado de WhatsApp' });
  }
});

module.exports = router;



