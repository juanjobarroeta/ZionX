const express = require('express');
const router = express.Router();
const { NotificationTemplates } = require('../utils/notifications');

// =====================================================
// NOTIFICATIONS ROUTES
// =====================================================

/**
 * GET /api/notifications
 * Get notifications for current user
 */
router.get('/', async (req, res) => {
  try {
    const { unread_only, limit = 50, offset = 0 } = req.query;
    
    // notifications has no from_user_id column (all inserts use user_id/type/
    // message/link/item_id/item_type), so the old join errored out. Select the
    // row directly.
    let query = `
      SELECT n.*
      FROM notifications n
      WHERE n.user_id = $1
    `;
    const params = [req.user.id];
    
    if (unread_only === 'true') {
      query += ' AND n.is_read = false';
    }
    
    query += ' ORDER BY n.created_at DESC';
    
    params.push(parseInt(limit));
    query += ` LIMIT $${params.length}`;
    
    params.push(parseInt(offset));
    query += ` OFFSET $${params.length}`;
    
    const result = await req.pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * GET /api/notifications/unread-count
 * Get unread notification count
 */
router.get('/unread-count', async (req, res) => {
  try {
    const result = await req.pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

/**
 * POST /api/notifications
 * Create a notification (for system use or sending to others)
 */
router.post('/', async (req, res) => {
  try {
    const { 
      user_id, title, message, type = 'info', 
      icon, link_type, link_id, link_url 
    } = req.body;
    
    if (!user_id || !title || !message) {
      return res.status(400).json({ error: 'user_id, title, and message are required' });
    }
    
    const result = await req.pool.query(`
      INSERT INTO notifications (user_id, title, message, type, icon, link_type, link_id, link_url, from_user_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [user_id, title, message, type, icon, link_type, link_id, link_url, req.user.id]);
    
    console.log(`🔔 Notification sent to user ${user_id}: ${title}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

/**
 * POST /api/notifications/broadcast
 * Send notification to multiple users
 */
router.post('/broadcast', async (req, res) => {
  try {
    const { user_ids, title, message, type = 'info', icon, link_type, link_id } = req.body;
    
    if (!user_ids?.length || !title || !message) {
      return res.status(400).json({ error: 'user_ids array, title, and message are required' });
    }
    
    const insertPromises = user_ids.map(userId => 
      req.pool.query(`
        INSERT INTO notifications (user_id, title, message, type, icon, link_type, link_id, from_user_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [userId, title, message, type, icon, link_type, link_id, req.user.id])
    );
    
    await Promise.all(insertPromises);
    
    console.log(`📢 Broadcast notification to ${user_ids.length} users: ${title}`);
    res.json({ message: `Notification sent to ${user_ids.length} users` });
  } catch (error) {
    console.error('Error broadcasting notification:', error);
    res.status(500).json({ error: 'Failed to broadcast notification' });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Mark notification as read
 */
router.put('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await req.pool.query(`
      UPDATE notifications 
      SET is_read = true, read_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, [id, req.user.id]);
    
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

/**
 * PUT /api/notifications/mark-all-read
 * Mark all notifications as read
 */
router.put('/mark-all-read', async (req, res) => {
  try {
    const result = await req.pool.query(`
      UPDATE notifications 
      SET is_read = true, read_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND is_read = false
    `, [req.user.id]);
    
    res.json({ message: 'All notifications marked as read', count: result.rowCount });
  } catch (error) {
    console.error('Error marking all as read:', error);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await req.pool.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

/**
 * DELETE /api/notifications/clear-all
 * Clear all notifications
 */
router.delete('/clear-all', async (req, res) => {
  try {
    await req.pool.query(
      'DELETE FROM notifications WHERE user_id = $1',
      [req.user.id]
    );
    
    res.json({ message: 'All notifications cleared' });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

/**
 * POST /api/notifications/test
 * Create sample notifications for testing
 */
router.post('/test', async (req, res) => {
  try {
    const userId = req.user.id;
    
    const sampleNotifications = [
      { ...NotificationTemplates.newCustomer('Empresa ABC', 1), userId },
      { ...NotificationTemplates.paymentReceived(15000, 'Cliente Demo'), userId },
      { ...NotificationTemplates.taskAssigned('Diseño de logo', 'María García'), userId },
      { ...NotificationTemplates.newLead('Juan Pérez', 'Facebook Ads'), userId },
      { ...NotificationTemplates.invoiceOverdue('INV-2024-005', 'Cliente Moroso'), userId },
    ];
    
    for (const notif of sampleNotifications) {
      await req.pool.query(`
        INSERT INTO notifications (user_id, title, message, type, icon, link_type, link_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [userId, notif.title, notif.message, notif.type, notif.icon, notif.linkType, notif.linkUrl]);
    }
    
    console.log(`🧪 Created ${sampleNotifications.length} test notifications for user ${userId}`);
    res.json({ message: `Created ${sampleNotifications.length} test notifications` });
  } catch (error) {
    console.error('Error creating test notifications:', error);
    res.status(500).json({ error: 'Failed to create test notifications' });
  }
});

/**
 * Web push subscription management.
 *
 * The browser hands us an endpoint and two keys; we store them against the
 * person. Nothing here decides *when* to notify — that stays in services/notify.
 */

// What the browser needs to subscribe, plus whether push is configured at all
// (so the UI can stay quiet instead of offering a button that cannot work).
router.get('/push/key', (req, res) => {
  const { pushEnabled, VAPID_PUBLIC_KEY } = require('../services/notify');
  res.json({ enabled: pushEnabled(), key: VAPID_PUBLIC_KEY || null });
});

router.post('/push/subscribe', async (req, res) => {
  try {
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Suscripción incompleta' });
    }
    await req.pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, last_used_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (endpoint) DO UPDATE SET
         user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh,
         auth = EXCLUDED.auth, last_used_at = NOW()`,
      [req.user.id, endpoint, keys.p256dh, keys.auth, (req.headers['user-agent'] || '').slice(0, 300)]
    );
    res.json({ success: true });
  } catch (e) {
    console.error('Error saving push subscription:', e);
    res.status(500).json({ error: 'No se pudo activar los avisos' });
  }
});

router.post('/push/unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: 'endpoint es obligatorio' });
    await req.pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2', [endpoint, req.user.id]);
    res.json({ success: true });
  } catch (e) {
    console.error('Error removing push subscription:', e);
    res.status(500).json({ error: 'No se pudo desactivar los avisos' });
  }
});

/** Send a test push to the caller's own devices, so setup is verifiable. */
router.post('/push/test', async (req, res) => {
  try {
    const { notifyUser } = require('../services/notify');
    await notifyUser(req.pool, req.user.id, {
      type: 'push_test',
      title: 'ZIONX',
      message: 'Los avisos están activos en este dispositivo.',
      link: '/notifications',
    });
    res.json({ success: true });
  } catch (e) {
    console.error('Error sending test push:', e);
    res.status(500).json({ error: 'No se pudo enviar la prueba' });
  }
});

module.exports = router;

