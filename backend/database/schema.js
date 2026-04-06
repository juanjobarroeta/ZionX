const fs = require('fs');
const path = require('path');

// Run a SQL file from the backend directory if it exists
const runSqlFile = async (pool, filename) => {
  try {
    const filepath = path.join(__dirname, '..', filename);
    if (!fs.existsSync(filepath)) return;
    const sql = fs.readFileSync(filepath, 'utf8');
    await pool.query(sql);
    console.log(`✅ Loaded ${filename}`);
  } catch (err) {
    console.log(`⚠️ ${filename} skipped: ${err.message}`);
  }
};

const createTables = async (pool) => {
  console.log("📣 Connected to DB. Creating tables...");

  // Create all core tables in a single transaction to ensure order
  try {
    await pool.query(`
      -- 0. Stores table (FIRST - referenced by users)
      CREATE TABLE IF NOT EXISTS stores (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        address TEXT,
        phone VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- 1. Users table (needs stores to exist)
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        is_active BOOLEAN DEFAULT true,
        store_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Core tables (stores, users) created");
  } catch (err) {
    console.error("❌ Error creating core tables:", err.message);
    // Try creating them separately
    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS stores (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, address TEXT, phone VARCHAR(20), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
      console.log("✅ Stores table created (fallback)");
    } catch (e) { console.log("Stores table may already exist"); }

    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(100) UNIQUE NOT NULL, password TEXT NOT NULL, role VARCHAR(50) DEFAULT 'user', is_active BOOLEAN DEFAULT true, store_id INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
      console.log("✅ Users table created (fallback)");
    } catch (e) { console.log("Users table may already exist"); }
  }
  // Ensure the 'role' column exists (safe to run even if already present)
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user';
  `);
  // Add permissions column for RBAC
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';
  `);
  // Add other useful user columns
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
  `);
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100);
  `);
  console.log("✅ Users table created with all columns");

  // 2. Customers table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      phone VARCHAR(20),
      email VARCHAR(100),
      birthdate DATE,
      curp VARCHAR(30),
      address TEXT,
      employment TEXT,
      income NUMERIC,
      ine_path TEXT,
      bureau_path TEXT,
      selfie_path TEXT,
      video_path TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log("✅ Customers table created");

  // Add business customer columns if they don't exist
  await pool.query(`
    DO $$
    BEGIN
      -- Business Information
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='business_name') THEN
        ALTER TABLE customers ADD COLUMN business_name VARCHAR(255);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='commercial_name') THEN
        ALTER TABLE customers ADD COLUMN commercial_name VARCHAR(255);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='rfc') THEN
        ALTER TABLE customers ADD COLUMN rfc VARCHAR(13);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='tax_regime') THEN
        ALTER TABLE customers ADD COLUMN tax_regime VARCHAR(100);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='business_type') THEN
        ALTER TABLE customers ADD COLUMN business_type VARCHAR(50);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='industry') THEN
        ALTER TABLE customers ADD COLUMN industry VARCHAR(100);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='website') THEN
        ALTER TABLE customers ADD COLUMN website VARCHAR(255);
      END IF;

      -- Fiscal Address
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='fiscal_address') THEN
        ALTER TABLE customers ADD COLUMN fiscal_address TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='fiscal_postal_code') THEN
        ALTER TABLE customers ADD COLUMN fiscal_postal_code VARCHAR(10);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='fiscal_city') THEN
        ALTER TABLE customers ADD COLUMN fiscal_city VARCHAR(100);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='fiscal_state') THEN
        ALTER TABLE customers ADD COLUMN fiscal_state VARCHAR(100);
      END IF;

      -- Contact Person
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='contact_first_name') THEN
        ALTER TABLE customers ADD COLUMN contact_first_name VARCHAR(100);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='contact_last_name') THEN
        ALTER TABLE customers ADD COLUMN contact_last_name VARCHAR(100);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='contact_position') THEN
        ALTER TABLE customers ADD COLUMN contact_position VARCHAR(100);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='contact_email') THEN
        ALTER TABLE customers ADD COLUMN contact_email VARCHAR(100);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='contact_phone') THEN
        ALTER TABLE customers ADD COLUMN contact_phone VARCHAR(20);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='contact_mobile') THEN
        ALTER TABLE customers ADD COLUMN contact_mobile VARCHAR(20);
      END IF;

      -- Business Details
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='business_size') THEN
        ALTER TABLE customers ADD COLUMN business_size VARCHAR(50);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='employees_count') THEN
        ALTER TABLE customers ADD COLUMN employees_count INTEGER;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='annual_revenue') THEN
        ALTER TABLE customers ADD COLUMN annual_revenue NUMERIC;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='marketing_budget') THEN
        ALTER TABLE customers ADD COLUMN marketing_budget NUMERIC;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='target_market') THEN
        ALTER TABLE customers ADD COLUMN target_market TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='current_marketing_channels') THEN
        ALTER TABLE customers ADD COLUMN current_marketing_channels TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='referral_source') THEN
        ALTER TABLE customers ADD COLUMN referral_source VARCHAR(100);
      END IF;

      -- Document Paths
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='business_license_path') THEN
        ALTER TABLE customers ADD COLUMN business_license_path TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='tax_certificate_path') THEN
        ALTER TABLE customers ADD COLUMN tax_certificate_path TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='fiscal_address_proof_path') THEN
        ALTER TABLE customers ADD COLUMN fiscal_address_proof_path TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='legal_representative_id_path') THEN
        ALTER TABLE customers ADD COLUMN legal_representative_id_path TEXT;
      END IF;

      -- Team Assignment
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='default_designer') THEN
        ALTER TABLE customers ADD COLUMN default_designer INTEGER;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='default_community_manager') THEN
        ALTER TABLE customers ADD COLUMN default_community_manager INTEGER;
      END IF;
    END $$;
  `);
  console.log("✅ Business customer columns added/verified");

  // Customer Notes, Avales, and References
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_notes (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      note TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_avals (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      phone VARCHAR(20),
      relationship VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_references (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      phone VARCHAR(20),
      relationship VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS promotions (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      discount_percentage DECIMAL(5,2),
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public_applications (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100),
      phone VARCHAR(20),
      promotion_id INTEGER REFERENCES promotions(id),
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS inventory_requests (
        id SERIAL PRIMARY KEY,
        requester_id INTEGER REFERENCES users(id),
        category VARCHAR(100),
        amount NUMERIC,
        status VARCHAR(50) DEFAULT 'pending_admin_approval',
        notes TEXT,
        quote_path TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS inventory_items (
        id SERIAL PRIMARY KEY,
        inventory_request_id INTEGER REFERENCES inventory_requests(id),
        category TEXT,
        brand TEXT,
        model TEXT,
        color TEXT,
        ram TEXT,
        storage TEXT,
        imei TEXT,
        serial_number TEXT,
        purchase_price NUMERIC,
        sale_price NUMERIC,
        status TEXT DEFAULT 'in_stock',
        store TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        store_id INTEGER,
        type VARCHAR(100),
        amount NUMERIC,
        description TEXT,
        due_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS budgets (
        id SERIAL PRIMARY KEY,
        category VARCHAR(100) NOT NULL,
        amount NUMERIC NOT NULL,
        period VARCHAR(50) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        description TEXT,
        store_id INTEGER,
        is_active BOOLEAN DEFAULT true,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Patch existing tables with missing columns (safe for repeated runs)
    await pool.query(`
      ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS method VARCHAR(50);
      ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS status VARCHAR(50);
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS due_date DATE;
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category VARCHAR(100);
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS priority VARCHAR(50);
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS budget_code VARCHAR(50);
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS approval_required BOOLEAN DEFAULT false;
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS recurring BOOLEAN DEFAULT false;
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS recurring_frequency VARCHAR(50);
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS method VARCHAR(50);
      ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
      ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'medium';
      ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS supplier VARCHAR(100);
      ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS expected_delivery DATE;
      ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS approval_required BOOLEAN DEFAULT true;
      ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

      -- Create inventory_items table for bulk requests
      CREATE TABLE IF NOT EXISTS inventory_items (
        id SERIAL PRIMARY KEY,
        request_id INTEGER REFERENCES inventory_requests(id) ON DELETE CASCADE,
        category VARCHAR(100),
        brand VARCHAR(100),
        model VARCHAR(100),
        color VARCHAR(50),
        ram VARCHAR(20),
        storage VARCHAR(20),
        quantity INTEGER DEFAULT 1,
        purchase_price NUMERIC(10,2) DEFAULT 0,
        sale_price NUMERIC(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Ensure updated_at column exists in expenses table
    await pool.query(`
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
    `);
    // Ensure method column exists in expenses table
    await pool.query(`
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS method VARCHAR(50);
    `);

    // =====================================================
    // MESSAGING & NOTIFICATIONS TABLES
    // =====================================================

    // Notifications table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        link TEXT,
        item_id INTEGER,
        item_type VARCHAR(50),
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Notifications table created");

    // Conversations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255),
        type VARCHAR(50) DEFAULT 'direct',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Conversation participants table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversation_participants (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_read_at TIMESTAMP,
        UNIQUE(conversation_id, user_id)
      );
    `);

    // Messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        content TEXT NOT NULL,
        message_type VARCHAR(50) DEFAULT 'text',
        item_id INTEGER,
        item_type VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Message read receipts
    await pool.query(`
      CREATE TABLE IF NOT EXISTS message_read_receipts (
        id SERIAL PRIMARY KEY,
        message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(message_id, user_id)
      );
    `);
    console.log("✅ Messaging tables created");

    // Social Media tables (Meta/Facebook/Instagram integration)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS social_accounts (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id),
        platform VARCHAR(50) NOT NULL,
        platform_account_id VARCHAR(255) NOT NULL,
        account_name VARCHAR(255),
        account_username VARCHAR(255),
        account_picture_url TEXT,
        account_type VARCHAR(50),
        access_token TEXT,
        token_expires_at TIMESTAMP,
        refresh_token TEXT,
        instagram_account_id VARCHAR(255),
        instagram_username VARCHAR(255),
        followers_count INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        last_synced_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(platform, platform_account_id)
      );

      CREATE TABLE IF NOT EXISTS scheduled_posts (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        social_account_id INTEGER REFERENCES social_accounts(id) ON DELETE CASCADE,
        content_type VARCHAR(50) DEFAULT 'post',
        message TEXT,
        media_urls TEXT[],
        link_url TEXT,
        scheduled_for TIMESTAMP NOT NULL,
        timezone VARCHAR(50) DEFAULT 'America/Mexico_City',
        status VARCHAR(50) DEFAULT 'scheduled',
        published_at TIMESTAMP,
        platform_post_id VARCHAR(255),
        platform_post_url TEXT,
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS post_analytics (
        id SERIAL PRIMARY KEY,
        scheduled_post_id INTEGER REFERENCES scheduled_posts(id) ON DELETE CASCADE,
        social_account_id INTEGER REFERENCES social_accounts(id) ON DELETE CASCADE,
        platform_post_id VARCHAR(255),
        impressions INTEGER DEFAULT 0,
        reach INTEGER DEFAULT 0,
        likes INTEGER DEFAULT 0,
        comments INTEGER DEFAULT 0,
        shares INTEGER DEFAULT 0,
        saves INTEGER DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        video_views INTEGER DEFAULT 0,
        engagement_rate NUMERIC(5,2) DEFAULT 0,
        fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS account_analytics (
        id SERIAL PRIMARY KEY,
        social_account_id INTEGER REFERENCES social_accounts(id) ON DELETE CASCADE,
        snapshot_date DATE NOT NULL,
        followers_count INTEGER DEFAULT 0,
        followers_gained INTEGER DEFAULT 0,
        followers_lost INTEGER DEFAULT 0,
        total_impressions INTEGER DEFAULT 0,
        total_reach INTEGER DEFAULT 0,
        profile_views INTEGER DEFAULT 0,
        website_clicks INTEGER DEFAULT 0,
        posts_published INTEGER DEFAULT 0,
        avg_engagement_rate NUMERIC(5,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(social_account_id, snapshot_date)
      );
    `);
    console.log("✅ Social media tables created");

    // Client approval tokens for public content review links
    await pool.query(`
      CREATE TABLE IF NOT EXISTS client_approval_tokens (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        month_year VARCHAR(7) NOT NULL,
        token VARCHAR(255) NOT NULL UNIQUE,
        client_name VARCHAR(255),
        client_email VARCHAR(255),
        created_by INTEGER REFERENCES users(id),
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(customer_id, month_year)
      );
    `);

    // Load external schema files (content calendar, approvals, briefs, etc.)
    await runSqlFile(pool, 'content-calendar-schema.sql');
    await runSqlFile(pool, 'approval-workflow-schema.sql');
    await runSqlFile(pool, 'creative-briefs-schema.sql');
    await runSqlFile(pool, 'marketing-files-schema.sql');
    await runSqlFile(pool, 'project-management-simple.sql');
    await runSqlFile(pool, 'income-management-schema.sql');
    await runSqlFile(pool, 'payroll-schema.sql');
    await runSqlFile(pool, 'whatsapp-schema.sql');

    // Add client review columns to content_calendar
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='content_calendar' AND column_name='client_status') THEN
          ALTER TABLE content_calendar ADD COLUMN client_status VARCHAR(50) DEFAULT NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='content_calendar' AND column_name='client_feedback_text') THEN
          ALTER TABLE content_calendar ADD COLUMN client_feedback_text TEXT DEFAULT NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='content_calendar' AND column_name='client_reviewed_at') THEN
          ALTER TABLE content_calendar ADD COLUMN client_reviewed_at TIMESTAMP DEFAULT NULL;
        END IF;
      END $$;
    `);
    console.log("✅ Client approval tables created");

    // Add missing columns to messaging tables
    await pool.query(`
      DO $$
      BEGIN
        -- Add missing columns to conversation_participants
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversation_participants' AND column_name='unread_count') THEN
          ALTER TABLE conversation_participants ADD COLUMN unread_count INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversation_participants' AND column_name='muted') THEN
          ALTER TABLE conversation_participants ADD COLUMN muted BOOLEAN DEFAULT false;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversation_participants' AND column_name='role') THEN
          ALTER TABLE conversation_participants ADD COLUMN role VARCHAR(20) DEFAULT 'member';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversation_participants' AND column_name='nickname') THEN
          ALTER TABLE conversation_participants ADD COLUMN nickname VARCHAR(100);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversation_participants' AND column_name='left_at') THEN
          ALTER TABLE conversation_participants ADD COLUMN left_at TIMESTAMP;
        END IF;

        -- Add missing columns to conversations
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversations' AND column_name='name') THEN
          ALTER TABLE conversations ADD COLUMN name VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversations' AND column_name='last_message_at') THEN
          ALTER TABLE conversations ADD COLUMN last_message_at TIMESTAMP;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversations' AND column_name='last_message_preview') THEN
          ALTER TABLE conversations ADD COLUMN last_message_preview TEXT;
        END IF;

        -- Add missing columns to messages
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='file_url') THEN
          ALTER TABLE messages ADD COLUMN file_url TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='file_name') THEN
          ALTER TABLE messages ADD COLUMN file_name VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='file_type') THEN
          ALTER TABLE messages ADD COLUMN file_type VARCHAR(50);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='is_deleted') THEN
          ALTER TABLE messages ADD COLUMN is_deleted BOOLEAN DEFAULT false;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='deleted_at') THEN
          ALTER TABLE messages ADD COLUMN deleted_at TIMESTAMP;
        END IF;
      END $$;
    `);
    console.log("✅ Messaging table columns added/verified");

    // Team members table (if not exists)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS team_members (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100),
        role VARCHAR(50),
        department VARCHAR(100),
        phone VARCHAR(20),
        avatar_url TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Team members table created");

    // Add missing columns to team_members table
    await pool.query(`
      DO $$
      BEGIN
        -- Skills and capabilities
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='skills') THEN
          ALTER TABLE team_members ADD COLUMN skills TEXT[];
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='capacity_hours_per_week') THEN
          ALTER TABLE team_members ADD COLUMN capacity_hours_per_week INTEGER DEFAULT 40;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='max_daily_tasks') THEN
          ALTER TABLE team_members ADD COLUMN max_daily_tasks INTEGER DEFAULT 5;
        END IF;

        -- Employment details
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='employee_type') THEN
          ALTER TABLE team_members ADD COLUMN employee_type VARCHAR(50) DEFAULT 'full_time';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='hire_date') THEN
          ALTER TABLE team_members ADD COLUMN hire_date DATE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='contract_type') THEN
          ALTER TABLE team_members ADD COLUMN contract_type VARCHAR(50) DEFAULT 'permanent';
        END IF;

        -- Compensation
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='hourly_rate') THEN
          ALTER TABLE team_members ADD COLUMN hourly_rate NUMERIC(10,2);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='monthly_wage') THEN
          ALTER TABLE team_members ADD COLUMN monthly_wage NUMERIC(10,2);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='payment_frequency') THEN
          ALTER TABLE team_members ADD COLUMN payment_frequency VARCHAR(50) DEFAULT 'monthly';
        END IF;

        -- Banking information
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='bank_account') THEN
          ALTER TABLE team_members ADD COLUMN bank_account VARCHAR(50);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='bank_name') THEN
          ALTER TABLE team_members ADD COLUMN bank_name VARCHAR(100);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='clabe') THEN
          ALTER TABLE team_members ADD COLUMN clabe VARCHAR(18);
        END IF;

        -- Tax and legal
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='rfc') THEN
          ALTER TABLE team_members ADD COLUMN rfc VARCHAR(13);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='curp') THEN
          ALTER TABLE team_members ADD COLUMN curp VARCHAR(18);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='imss_number') THEN
          ALTER TABLE team_members ADD COLUMN imss_number VARCHAR(20);
        END IF;

        -- Contact and emergency
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='address') THEN
          ALTER TABLE team_members ADD COLUMN address TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='emergency_contact') THEN
          ALTER TABLE team_members ADD COLUMN emergency_contact VARCHAR(100);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='emergency_phone') THEN
          ALTER TABLE team_members ADD COLUMN emergency_phone VARCHAR(20);
        END IF;

        -- Notes
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='notes') THEN
          ALTER TABLE team_members ADD COLUMN notes TEXT;
        END IF;

        -- Status tracking
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='status') THEN
          ALTER TABLE team_members ADD COLUMN status VARCHAR(20) DEFAULT 'active';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='termination_date') THEN
          ALTER TABLE team_members ADD COLUMN termination_date DATE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='termination_reason') THEN
          ALTER TABLE team_members ADD COLUMN termination_reason TEXT;
        END IF;
      END $$;
    `);
    console.log("✅ Team members columns added/verified");

    // Payroll periods table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payroll_periods (
        id SERIAL PRIMARY KEY,
        period_name VARCHAR(100) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        payment_date DATE,
        status VARCHAR(20) DEFAULT 'draft',
        total_gross NUMERIC(12,2) DEFAULT 0,
        total_deductions NUMERIC(12,2) DEFAULT 0,
        total_net NUMERIC(12,2) DEFAULT 0,
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Payroll periods table created");

    // Payroll entries table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payroll_entries (
        id SERIAL PRIMARY KEY,
        payroll_period_id INTEGER REFERENCES payroll_periods(id) ON DELETE CASCADE,
        team_member_id INTEGER REFERENCES team_members(id) ON DELETE CASCADE,

        -- Earnings
        base_salary NUMERIC(10,2) DEFAULT 0,
        overtime_hours NUMERIC(6,2) DEFAULT 0,
        overtime_pay NUMERIC(10,2) DEFAULT 0,
        bonuses NUMERIC(10,2) DEFAULT 0,
        commissions NUMERIC(10,2) DEFAULT 0,
        other_earnings NUMERIC(10,2) DEFAULT 0,
        gross_pay NUMERIC(10,2) DEFAULT 0,

        -- Deductions
        isr_tax NUMERIC(10,2) DEFAULT 0,
        imss_employee NUMERIC(10,2) DEFAULT 0,
        imss_employer NUMERIC(10,2) DEFAULT 0,
        infonavit NUMERIC(10,2) DEFAULT 0,
        loans_deduction NUMERIC(10,2) DEFAULT 0,
        other_deductions NUMERIC(10,2) DEFAULT 0,
        total_deductions NUMERIC(10,2) DEFAULT 0,

        -- Net pay
        net_pay NUMERIC(10,2) DEFAULT 0,

        -- Status
        status VARCHAR(20) DEFAULT 'pending',
        paid_at TIMESTAMP,
        payment_method VARCHAR(50),

        -- Metadata
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        UNIQUE(payroll_period_id, team_member_id)
      );
    `);
    console.log("✅ Payroll entries table created");

    // Projects table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        client_id INTEGER REFERENCES customers(id),
        status VARCHAR(50) DEFAULT 'active',
        start_date DATE,
        end_date DATE,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Projects table created");

    // Add missing columns to projects table
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='customer_id') THEN
          ALTER TABLE projects ADD COLUMN customer_id INTEGER REFERENCES customers(id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='project_manager_id') THEN
          ALTER TABLE projects ADD COLUMN project_manager_id INTEGER REFERENCES team_members(id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='budget') THEN
          ALTER TABLE projects ADD COLUMN budget NUMERIC(10,2);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='actual_cost') THEN
          ALTER TABLE projects ADD COLUMN actual_cost NUMERIC(10,2) DEFAULT 0;
        END IF;
      END $$;
    `);
    console.log("✅ Projects columns added/verified");

    // Tasks table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'todo',
        priority VARCHAR(20) DEFAULT 'medium',
        due_date DATE,
        completed_at TIMESTAMP,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Tasks table created");

    // Add missing columns to tasks table
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='estimated_hours') THEN
          ALTER TABLE tasks ADD COLUMN estimated_hours NUMERIC(6,2) DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='actual_hours') THEN
          ALTER TABLE tasks ADD COLUMN actual_hours NUMERIC(6,2) DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='custom_fields') THEN
          ALTER TABLE tasks ADD COLUMN custom_fields JSONB;
        END IF;
      END $$;
    `);
    console.log("✅ Tasks columns added/verified");

    // Task assignments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS task_assignments (
        id SERIAL PRIMARY KEY,
        task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        assignee_id INTEGER REFERENCES team_members(id) ON DELETE CASCADE,
        assignment_type VARCHAR(50) DEFAULT 'primary',
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        assigned_by INTEGER REFERENCES users(id),
        UNIQUE(task_id, assignee_id, assignment_type)
      );
    `);
    console.log("✅ Task assignments table created");

    // Project stages table (for project management)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS project_stages (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        stage_name VARCHAR(100) NOT NULL,
        stage_order INTEGER,
        status VARCHAR(50) DEFAULT 'not_started',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Project stages table created");

    // Project activity log
    await pool.query(`
      CREATE TABLE IF NOT EXISTS project_activity (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id),
        activity_type VARCHAR(50),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Project activity table created");

    // Service packages table (for subscriptions)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS service_packages (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        base_price NUMERIC(10,2) NOT NULL,
        billing_cycle VARCHAR(20) DEFAULT 'monthly',
        posts_per_month INTEGER,
        platforms_included TEXT[],
        stories_per_week INTEGER,
        reels_per_month INTEGER,
        features TEXT[],
        is_active BOOLEAN DEFAULT true,
        display_order INTEGER DEFAULT 0,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Service packages table created");

    // Customer subscriptions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customer_subscriptions (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        service_package_id INTEGER REFERENCES service_packages(id),
        status VARCHAR(50) DEFAULT 'active',
        start_date DATE NOT NULL,
        end_date DATE,
        next_billing_date DATE,
        billing_cycle VARCHAR(20) DEFAULT 'monthly',

        -- Pricing
        custom_monthly_price NUMERIC(10,2),
        discount_percentage NUMERIC(5,2),

        -- Customizations
        custom_posts_per_month INTEGER,
        custom_platforms TEXT[],
        custom_features TEXT[],

        -- Notes and tracking
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Customer subscriptions table created");

    // Service addons table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS service_addons (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(50),
        price NUMERIC(10,2) NOT NULL,
        pricing_type VARCHAR(20) DEFAULT 'fixed',
        billing_frequency VARCHAR(20) DEFAULT 'one-time',
        is_active BOOLEAN DEFAULT true,
        requires_approval BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Service addons table created");

    // Customer addon purchases table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customer_addon_purchases (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        subscription_id INTEGER REFERENCES customer_subscriptions(id),
        addon_id INTEGER REFERENCES service_addons(id),
        quantity INTEGER DEFAULT 1,
        unit_price NUMERIC(10,2) NOT NULL,
        total_price NUMERIC(10,2) NOT NULL,
        billing_period VARCHAR(20),
        is_recurring BOOLEAN DEFAULT false,
        status VARCHAR(20) DEFAULT 'pending',
        description TEXT,
        project_id INTEGER,
        task_id INTEGER,
        approved_by INTEGER REFERENCES users(id),
        approved_at TIMESTAMP,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Customer addon purchases table created");

    // Invoices table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        invoice_number VARCHAR(50) UNIQUE NOT NULL,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        subscription_id INTEGER REFERENCES customer_subscriptions(id),
        invoice_date DATE DEFAULT CURRENT_DATE,
        due_date DATE,
        billing_period_start DATE,
        billing_period_end DATE,
        subtotal NUMERIC(10,2) DEFAULT 0,
        tax_percentage NUMERIC(5,2) DEFAULT 16,
        tax_amount NUMERIC(10,2) DEFAULT 0,
        discount_amount NUMERIC(10,2) DEFAULT 0,
        total NUMERIC(10,2) NOT NULL DEFAULT 0,
        amount_paid NUMERIC(10,2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'draft',
        sent_at TIMESTAMP,
        paid_at TIMESTAMP,
        payment_method VARCHAR(50),
        payment_reference VARCHAR(255),
        invoice_file_path VARCHAR(500),
        notes TEXT,
        internal_notes TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Invoices table created");

    // Invoice items table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id SERIAL PRIMARY KEY,
        invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
        item_type VARCHAR(30) NOT NULL,
        description TEXT NOT NULL,
        quantity NUMERIC(10,2) DEFAULT 1,
        unit_price NUMERIC(10,2) NOT NULL,
        subtotal NUMERIC(10,2) NOT NULL,
        discount NUMERIC(10,2) DEFAULT 0,
        total NUMERIC(10,2) NOT NULL,
        reference_id INTEGER,
        reference_type VARCHAR(50),
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Invoice items table created");

    // Invoice payments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS invoice_payments (
        id SERIAL PRIMARY KEY,
        invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
        amount NUMERIC(10,2) NOT NULL,
        payment_method VARCHAR(50) NOT NULL,
        payment_date DATE DEFAULT CURRENT_DATE,
        reference_number VARCHAR(255),
        notes TEXT,
        journal_entry_id INTEGER,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Invoice payments table created");

    // Billable time entries table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS billable_time_entries (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        project_id INTEGER,
        task_id INTEGER,
        team_member_id INTEGER REFERENCES team_members(id),
        work_date DATE DEFAULT CURRENT_DATE,
        hours NUMERIC(5,2) NOT NULL,
        hourly_rate NUMERIC(10,2),
        total_amount NUMERIC(10,2),
        description TEXT,
        is_billable BOOLEAN DEFAULT true,
        status VARCHAR(20) DEFAULT 'unbilled',
        invoice_id INTEGER REFERENCES invoices(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Billable time entries table created");

    // Add missing columns to billable_time_entries
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='billable_time_entries' AND column_name='is_invoiced') THEN
          ALTER TABLE billable_time_entries ADD COLUMN is_invoiced BOOLEAN DEFAULT false;
        END IF;
      END $$;
    `);

    // Create client_expenses table for billable expenses
    await pool.query(`
      CREATE TABLE IF NOT EXISTS client_expenses (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        project_id INTEGER,
        expense_date DATE DEFAULT CURRENT_DATE,
        description TEXT NOT NULL,
        amount NUMERIC(10,2) NOT NULL,
        category VARCHAR(100),
        receipt_path VARCHAR(500),
        is_invoiced BOOLEAN DEFAULT false,
        invoice_id INTEGER REFERENCES invoices(id),
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Client expenses table created");

    // Content/Tasks table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS content_tasks (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id),
        title VARCHAR(200) NOT NULL,
        description TEXT,
        assigned_to INTEGER REFERENCES users(id),
        status VARCHAR(50) DEFAULT 'pending',
        priority VARCHAR(20) DEFAULT 'medium',
        due_date DATE,
        platform VARCHAR(50),
        content_type VARCHAR(50),
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Content tasks table created");

    console.log("✅ All tables ready");

  } catch (err) {
    console.error("❌ Error creating tables", err);
  }
};

module.exports = { createTables };
