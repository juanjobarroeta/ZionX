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
    
    let query = `
      SELECT 
        n.*,
        u.name as from_user_name
      FROM notifications n
      LEFT JOIN users u ON n.from_user_id = u.id
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

module.exports = router;

