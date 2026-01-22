-- =====================================================
-- NOTIFICATIONS & MESSAGING SCHEMA
-- For in-app notifications and user-to-user messaging
-- =====================================================

-- =====================================================
-- NOTIFICATIONS TABLE
-- System notifications to users
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  
  -- Notification content
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'info', -- info, success, warning, error, task, message, system
  icon VARCHAR(50), -- emoji or icon name
  
  -- Link to related entity
  link_type VARCHAR(50), -- customer, loan, task, message, payroll, invoice, etc.
  link_id INTEGER,
  link_url VARCHAR(500),
  
  -- Status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  
  -- Sender (optional - for notifications from other users)
  from_user_id INTEGER REFERENCES users(id),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- =====================================================
-- CONVERSATIONS TABLE
-- Chat threads between users
-- =====================================================
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  
  -- Conversation type
  type VARCHAR(20) DEFAULT 'direct', -- direct (1-1), group
  name VARCHAR(255), -- For group chats
  
  -- Metadata
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_message_at TIMESTAMP,
  last_message_preview TEXT
);

CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);

-- =====================================================
-- CONVERSATION PARTICIPANTS
-- Users in each conversation
-- =====================================================
CREATE TABLE IF NOT EXISTS conversation_participants (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  
  -- Participant settings
  role VARCHAR(20) DEFAULT 'member', -- admin, member
  nickname VARCHAR(100),
  muted BOOLEAN DEFAULT false,
  
  -- Read tracking
  last_read_at TIMESTAMP,
  unread_count INTEGER DEFAULT 0,
  
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP,
  
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_participants_user ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_participants_conversation ON conversation_participants(conversation_id);

-- =====================================================
-- MESSAGES TABLE
-- Individual messages in conversations
-- =====================================================
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id INTEGER REFERENCES users(id),
  
  -- Message content
  content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text', -- text, image, file, item, system
  
  -- For sharing items
  shared_item_type VARCHAR(50), -- customer, loan, task, invoice, file, etc.
  shared_item_id INTEGER,
  shared_item_data JSONB, -- Cached item details for display
  
  -- File attachments
  attachment_url VARCHAR(500),
  attachment_name VARCHAR(255),
  attachment_type VARCHAR(100),
  attachment_size INTEGER,
  
  -- Status
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMP,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(conversation_id, created_at DESC);

-- =====================================================
-- MESSAGE READ RECEIPTS
-- Track who has read each message
-- =====================================================
CREATE TABLE IF NOT EXISTS message_read_receipts (
  id SERIAL PRIMARY KEY,
  message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_read_receipts_message ON message_read_receipts(message_id);

-- =====================================================
-- HELPER FUNCTION: Create notification
-- =====================================================
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id INTEGER,
  p_title VARCHAR(255),
  p_message TEXT,
  p_type VARCHAR(50) DEFAULT 'info',
  p_icon VARCHAR(50) DEFAULT NULL,
  p_link_type VARCHAR(50) DEFAULT NULL,
  p_link_id INTEGER DEFAULT NULL,
  p_from_user_id INTEGER DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  notification_id INTEGER;
BEGIN
  INSERT INTO notifications (user_id, title, message, type, icon, link_type, link_id, from_user_id)
  VALUES (p_user_id, p_title, p_message, p_type, p_icon, p_link_type, p_link_id, p_from_user_id)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VIEW: Conversation list with last message
-- =====================================================
CREATE OR REPLACE VIEW v_user_conversations AS
SELECT 
  c.id as conversation_id,
  c.type,
  c.name,
  c.last_message_at,
  c.last_message_preview,
  cp.user_id,
  cp.unread_count,
  cp.muted,
  cp.last_read_at,
  -- Get other participant info for direct messages
  CASE 
    WHEN c.type = 'direct' THEN (
      SELECT u.name 
      FROM conversation_participants ocp 
      JOIN users u ON ocp.user_id = u.id 
      WHERE ocp.conversation_id = c.id AND ocp.user_id != cp.user_id
      LIMIT 1
    )
    ELSE c.name
  END as display_name,
  CASE 
    WHEN c.type = 'direct' THEN (
      SELECT ocp.user_id 
      FROM conversation_participants ocp 
      WHERE ocp.conversation_id = c.id AND ocp.user_id != cp.user_id
      LIMIT 1
    )
    ELSE NULL
  END as other_user_id
FROM conversations c
JOIN conversation_participants cp ON c.id = cp.conversation_id
WHERE cp.left_at IS NULL
ORDER BY c.last_message_at DESC NULLS LAST;

-- Success message
DO $$ BEGIN RAISE NOTICE 'Messaging schema created successfully!'; END $$;

