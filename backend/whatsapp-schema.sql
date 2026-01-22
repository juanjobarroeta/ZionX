-- WhatsApp Integration Schema
-- Run this to add WhatsApp and lead management capabilities

-- WhatsApp Contacts Table
CREATE TABLE IF NOT EXISTS whatsapp_contacts (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  whatsapp_name VARCHAR(255),
  profile_pic_url TEXT,
  is_subscribed BOOLEAN DEFAULT true,
  last_message_at TIMESTAMP,
  conversation_status VARCHAR(50) DEFAULT 'active', -- 'active', 'pending', 'closed'
  unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Leads Table
CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  whatsapp_contact_id INT REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
  email VARCHAR(255),
  source VARCHAR(100), -- 'whatsapp_direct', 'website', 'instagram', 'facebook', 'referral', 'event', 'other'
  service_interest VARCHAR(255),
  status VARCHAR(50) DEFAULT 'new', -- 'new', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'converted', 'lost'
  budget_range VARCHAR(50),
  notes TEXT,
  assigned_to INT REFERENCES team_members(id),
  converted_to_customer_id INT REFERENCES customers(id),
  lead_score INT DEFAULT 0, -- 0-100 scoring system
  last_contact_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- WhatsApp Messages Table
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id SERIAL PRIMARY KEY,
  contact_id INT REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
  message_id VARCHAR(255) UNIQUE,
  direction VARCHAR(20) NOT NULL, -- 'inbound', 'outbound'
  message_type VARCHAR(50) DEFAULT 'text', -- 'text', 'image', 'video', 'document', 'audio', 'location', 'template'
  content TEXT,
  media_url TEXT,
  status VARCHAR(50) DEFAULT 'sent', -- 'sent', 'delivered', 'read', 'failed'
  template_name VARCHAR(100),
  error_message TEXT,
  sent_by INT REFERENCES team_members(id), -- Who sent this message (for outbound)
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  delivered_at TIMESTAMP,
  read_at TIMESTAMP
);

-- WhatsApp Message Templates (pre-approved by Meta)
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  category VARCHAR(50), -- 'marketing', 'utility', 'authentication'
  language VARCHAR(10) DEFAULT 'es_MX',
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  template_body TEXT NOT NULL,
  variables JSONB, -- Array of variable names
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP
);

-- Lead Activity Log
CREATE TABLE IF NOT EXISTS lead_activities (
  id SERIAL PRIMARY KEY,
  lead_id INT REFERENCES leads(id) ON DELETE CASCADE,
  activity_type VARCHAR(50), -- 'note_added', 'status_changed', 'assigned', 'message_sent', 'call_made'
  description TEXT,
  performed_by INT REFERENCES team_members(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_phone ON whatsapp_contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_contact ON whatsapp_messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_messages_direction ON whatsapp_messages(direction);
CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON whatsapp_messages(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead ON lead_activities(lead_id);

-- Add some default templates
INSERT INTO whatsapp_templates (name, category, language, template_body, variables, status) VALUES
('lead_welcome', 'utility', 'es_MX', 'Hola {{1}}, gracias por contactarnos. ¿En qué servicio estás interesado?', '["name"]', 'approved'),
('service_info', 'marketing', 'es_MX', 'Hola {{1}}, te comparto información sobre nuestro servicio de {{2}}. ¿Te gustaría agendar una llamada?', '["name", "service"]', 'approved'),
('appointment_confirmation', 'utility', 'es_MX', 'Hola {{1}}, tu cita está confirmada para el {{2}} a las {{3}}. ¿Alguna pregunta?', '["name", "date", "time"]', 'approved')
ON CONFLICT (name) DO NOTHING;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for auto-updating timestamps
CREATE TRIGGER update_whatsapp_contacts_updated_at BEFORE UPDATE ON whatsapp_contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View for lead dashboard with contact info
CREATE OR REPLACE VIEW leads_with_contact AS
SELECT 
  l.*,
  wc.phone_number,
  wc.whatsapp_name,
  wc.is_subscribed,
  wc.last_message_at,
  wc.unread_count,
  tm.name as assigned_to_name,
  (SELECT content FROM whatsapp_messages WHERE contact_id = wc.id ORDER BY sent_at DESC LIMIT 1) as last_message
FROM leads l
LEFT JOIN whatsapp_contacts wc ON l.whatsapp_contact_id = wc.id
LEFT JOIN team_members tm ON l.assigned_to = tm.id;

COMMENT ON TABLE whatsapp_contacts IS 'Stores WhatsApp contact information for leads and customers';
COMMENT ON TABLE leads IS 'Lead management and tracking system';
COMMENT ON TABLE whatsapp_messages IS 'Message history for all WhatsApp conversations';
COMMENT ON TABLE whatsapp_templates IS 'Pre-approved WhatsApp message templates from Meta';



