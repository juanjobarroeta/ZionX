const express = require('express');
const router = express.Router();

// =====================================================
// MESSAGING / CHAT ROUTES
// =====================================================

/**
 * GET /api/messages/conversations
 * Get all conversations for current user
 */
router.get('/conversations', async (req, res) => {
  try {
    const result = await req.pool.query(`
      SELECT 
        c.id,
        c.type,
        c.name,
        c.last_message_at,
        c.last_message_preview,
        cp.unread_count,
        cp.muted,
        CASE 
          WHEN c.type = 'direct' THEN (
            SELECT u.name 
            FROM conversation_participants ocp 
            JOIN users u ON ocp.user_id = u.id 
            WHERE ocp.conversation_id = c.id AND ocp.user_id != $1
            LIMIT 1
          )
          ELSE c.name
        END as display_name,
        CASE 
          WHEN c.type = 'direct' THEN (
            SELECT ocp.user_id 
            FROM conversation_participants ocp 
            WHERE ocp.conversation_id = c.id AND ocp.user_id != $1
            LIMIT 1
          )
          ELSE NULL
        END as other_user_id
      FROM conversations c
      JOIN conversation_participants cp ON c.id = cp.conversation_id
      WHERE cp.user_id = $1 AND cp.left_at IS NULL
      ORDER BY c.last_message_at DESC NULLS LAST
    `, [req.user.id]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

/**
 * GET /api/messages/conversations/:id
 * Get messages in a conversation
 */
router.get('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, before } = req.query;
    
    // Verify user is participant
    const participant = await req.pool.query(
      'SELECT id FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2 AND left_at IS NULL',
      [id, req.user.id]
    );
    
    if (!participant.rows.length) {
      return res.status(403).json({ error: 'Not a participant of this conversation' });
    }
    
    let query = `
      SELECT 
        m.*,
        u.name as sender_name
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1 AND m.is_deleted = false
    `;
    const params = [id];
    
    if (before) {
      params.push(before);
      query += ` AND m.id < $${params.length}`;
    }
    
    query += ' ORDER BY m.created_at DESC';
    
    params.push(parseInt(limit));
    query += ` LIMIT $${params.length}`;
    
    const result = await req.pool.query(query, params);
    
    // Mark messages as read
    await req.pool.query(`
      UPDATE conversation_participants 
      SET last_read_at = CURRENT_TIMESTAMP, unread_count = 0
      WHERE conversation_id = $1 AND user_id = $2
    `, [id, req.user.id]);
    
    // Return messages in chronological order
    res.json(result.rows.reverse());
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/**
 * POST /api/messages/conversations
 * Start a new conversation (or get existing direct conversation)
 */
router.post('/conversations', async (req, res) => {
  const client = await req.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { user_id, user_ids, name, type = 'direct' } = req.body;
    
    // For direct messages, check if conversation already exists
    if (type === 'direct' && user_id) {
      const existing = await client.query(`
        SELECT c.id 
        FROM conversations c
        JOIN conversation_participants cp1 ON c.id = cp1.conversation_id AND cp1.user_id = $1
        JOIN conversation_participants cp2 ON c.id = cp2.conversation_id AND cp2.user_id = $2
        WHERE c.type = 'direct'
        LIMIT 1
      `, [req.user.id, user_id]);
      
      if (existing.rows.length) {
        await client.query('COMMIT');
        return res.json({ id: existing.rows[0].id, existing: true });
      }
    }
    
    // Create new conversation
    const convResult = await client.query(`
      INSERT INTO conversations (type, name, created_by)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [type, name, req.user.id]);
    
    const conversationId = convResult.rows[0].id;
    
    // Add current user as participant
    await client.query(`
      INSERT INTO conversation_participants (conversation_id, user_id, role)
      VALUES ($1, $2, 'admin')
    `, [conversationId, req.user.id]);
    
    // Add other participants
    const participantIds = type === 'direct' ? [user_id] : (user_ids || []);
    
    for (const participantId of participantIds) {
      if (participantId !== req.user.id) {
        await client.query(`
          INSERT INTO conversation_participants (conversation_id, user_id)
          VALUES ($1, $2)
        `, [conversationId, participantId]);
        
        // Send notification to invited user
        await client.query(`
          INSERT INTO notifications (user_id, title, message, type, icon, link_type, link_id, from_user_id)
          VALUES ($1, $2, $3, 'message', '💬', 'conversation', $4, $5)
        `, [
          participantId,
          'Nueva conversación',
          `${req.user.name} te envió un mensaje`,
          conversationId,
          req.user.id
        ]);
      }
    }
    
    await client.query('COMMIT');
    
    console.log(`💬 New conversation created by user ${req.user.id}`);
    res.status(201).json({ id: conversationId, existing: false });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/messages/conversations/:id/messages
 * Send a message in a conversation
 */
router.post('/conversations/:id/messages', async (req, res) => {
  const client = await req.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { 
      content, message_type = 'text',
      shared_item_type, shared_item_id, shared_item_data,
      attachment_url, attachment_name, attachment_type, attachment_size
    } = req.body;
    
    if (!content && !shared_item_type && !attachment_url) {
      return res.status(400).json({ error: 'Message content is required' });
    }
    
    // Verify user is participant
    const participant = await client.query(
      'SELECT id FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2 AND left_at IS NULL',
      [id, req.user.id]
    );
    
    if (!participant.rows.length) {
      return res.status(403).json({ error: 'Not a participant of this conversation' });
    }
    
    // Insert message
    const messageResult = await client.query(`
      INSERT INTO messages (
        conversation_id, sender_id, content, message_type,
        shared_item_type, shared_item_id, shared_item_data,
        attachment_url, attachment_name, attachment_type, attachment_size
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      id, req.user.id, content || '', message_type,
      shared_item_type, shared_item_id, shared_item_data ? JSON.stringify(shared_item_data) : null,
      attachment_url, attachment_name, attachment_type, attachment_size
    ]);
    
    const message = messageResult.rows[0];
    
    // Update conversation last message
    const preview = content ? content.substring(0, 100) : 
                    shared_item_type ? `📎 Shared ${shared_item_type}` : 
                    '📎 Attachment';
    
    await client.query(`
      UPDATE conversations 
      SET last_message_at = CURRENT_TIMESTAMP, last_message_preview = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [preview, id]);
    
    // Update unread count for other participants
    await client.query(`
      UPDATE conversation_participants 
      SET unread_count = unread_count + 1
      WHERE conversation_id = $1 AND user_id != $2
    `, [id, req.user.id]);
    
    // Send notifications to other participants
    const otherParticipants = await client.query(
      'SELECT user_id FROM conversation_participants WHERE conversation_id = $1 AND user_id != $2 AND left_at IS NULL',
      [id, req.user.id]
    );
    
    for (const p of otherParticipants.rows) {
      await client.query(`
        INSERT INTO notifications (user_id, title, message, type, icon, link_type, link_id, from_user_id)
        VALUES ($1, $2, $3, 'message', '💬', 'conversation', $4, $5)
      `, [
        p.user_id,
        `Mensaje de ${req.user.name}`,
        preview,
        id,
        req.user.id
      ]);
    }
    
    await client.query('COMMIT');
    
    // Return message with sender name
    message.sender_name = req.user.name;
    res.status(201).json(message);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/messages/share-item
 * Share an item with a user (creates/opens conversation and sends item)
 */
router.post('/share-item', async (req, res) => {
  const client = await req.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { user_id, item_type, item_id, item_data, message } = req.body;
    
    if (!user_id || !item_type || !item_id) {
      return res.status(400).json({ error: 'user_id, item_type, and item_id are required' });
    }
    
    // Find or create direct conversation
    let conversationId;
    const existing = await client.query(`
      SELECT c.id 
      FROM conversations c
      JOIN conversation_participants cp1 ON c.id = cp1.conversation_id AND cp1.user_id = $1
      JOIN conversation_participants cp2 ON c.id = cp2.conversation_id AND cp2.user_id = $2
      WHERE c.type = 'direct'
      LIMIT 1
    `, [req.user.id, user_id]);
    
    if (existing.rows.length) {
      conversationId = existing.rows[0].id;
    } else {
      // Create new conversation
      const convResult = await client.query(`
        INSERT INTO conversations (type, created_by)
        VALUES ('direct', $1)
        RETURNING id
      `, [req.user.id]);
      
      conversationId = convResult.rows[0].id;
      
      // Add participants
      await client.query(`
        INSERT INTO conversation_participants (conversation_id, user_id, role)
        VALUES ($1, $2, 'admin'), ($1, $3, 'member')
      `, [conversationId, req.user.id, user_id]);
    }
    
    // Send the item as a message
    const preview = `📎 Compartió: ${item_type} #${item_id}`;
    
    const messageResult = await client.query(`
      INSERT INTO messages (
        conversation_id, sender_id, content, message_type,
        shared_item_type, shared_item_id, shared_item_data
      ) VALUES ($1, $2, $3, 'item', $4, $5, $6)
      RETURNING *
    `, [
      conversationId, req.user.id, message || preview,
      item_type, item_id, item_data ? JSON.stringify(item_data) : null
    ]);
    
    // Update conversation
    await client.query(`
      UPDATE conversations 
      SET last_message_at = CURRENT_TIMESTAMP, last_message_preview = $1
      WHERE id = $2
    `, [preview, conversationId]);
    
    // Update unread count and notify recipient
    await client.query(`
      UPDATE conversation_participants 
      SET unread_count = unread_count + 1
      WHERE conversation_id = $1 AND user_id = $2
    `, [conversationId, user_id]);
    
    await client.query(`
      INSERT INTO notifications (user_id, title, message, type, icon, link_type, link_id, from_user_id)
      VALUES ($1, $2, $3, 'message', '📎', 'conversation', $4, $5)
    `, [
      user_id,
      `${req.user.name} te compartió algo`,
      preview,
      conversationId,
      req.user.id
    ]);
    
    await client.query('COMMIT');
    
    console.log(`📎 Item shared: ${item_type}#${item_id} from user ${req.user.id} to user ${user_id}`);
    res.status(201).json({ 
      conversation_id: conversationId, 
      message: messageResult.rows[0] 
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error sharing item:', error);
    res.status(500).json({ error: 'Failed to share item' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/messages/users
 * Get list of users available for messaging
 */
router.get('/users', async (req, res) => {
  try {
    const result = await req.pool.query(`
      SELECT id, name, email, role
      FROM users 
      WHERE id != $1 AND is_active = true
      ORDER BY name
    `, [req.user.id]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * GET /api/messages/unread-count
 * Get total unread message count
 */
router.get('/unread-count', async (req, res) => {
  try {
    const result = await req.pool.query(`
      SELECT COALESCE(SUM(unread_count), 0) as count
      FROM conversation_participants
      WHERE user_id = $1 AND left_at IS NULL
    `, [req.user.id]);
    
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

/**
 * DELETE /api/messages/:messageId
 * Delete (soft) a message
 */
router.delete('/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    
    const result = await req.pool.query(`
      UPDATE messages 
      SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP, content = '[Mensaje eliminado]'
      WHERE id = $1 AND sender_id = $2
      RETURNING id
    `, [messageId, req.user.id]);
    
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Message not found or not authorized' });
    }
    
    res.json({ message: 'Message deleted' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

module.exports = router;

