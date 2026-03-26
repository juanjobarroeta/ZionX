const express = require('express');
const router = express.Router();

/**
 * Creative Briefs Management
 * Multi-step questionnaire for prospects/clients
 */

/**
 * GET /api/briefs
 * Get all creative briefs
 */
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = 'SELECT * FROM creative_briefs WHERE 1=1';
    const params = [];
    
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await req.pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching briefs:', error);
    res.status(500).json({ error: 'Failed to fetch briefs' });
  }
});

/**
 * GET /api/briefs/:id
 * Get single brief
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await req.pool.query('SELECT * FROM creative_briefs WHERE id = $1', [id]);
    
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Brief not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching brief:', error);
    res.status(500).json({ error: 'Failed to fetch brief' });
  }
});

/**
 * POST /api/briefs
 * Create new brief
 */
router.post('/', async (req, res) => {
  try {
    const briefData = req.body;
    
    const result = await req.pool.query(`
      INSERT INTO creative_briefs (
        prospect_name, company_name, email, phone, address, website, social_profiles,
        why_this_business, what_you_love, what_you_dont_do, how_perceived,
        brand_personality, differentiators, concerns_about_exposure,
        company_description, history_origin, project_reason, core_concept,
        value_proposition, value_offer, services_list, main_service,
        primary_objective, secondary_objective, problem_to_solve,
        target_consumer, ideal_client_primary, ideal_client_secondary,
        specializations, confident_procedures, unique_differentiators,
        not_ready_for, clients_served, proud_results, key_selling_points,
        promise_delivery, central_idea, desired_emotions,
        brand_keywords, anti_keywords, success_definition, success_metrics,
        strategic_allies, direct_competition, indirect_competition,
        brand_references, inspiration_notes,
        budget_range, timeline, special_requirements, notes,
        status, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
        $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44,
        $45, $46, $47, $48, $49, $50, $51, $52
      )
      RETURNING *
    `, [
      briefData.prospect_name, briefData.company_name, briefData.email,
      briefData.phone, briefData.address, briefData.website, briefData.social_profiles,
      briefData.why_this_business, briefData.what_you_love, briefData.what_you_dont_do,
      briefData.how_perceived, briefData.brand_personality, briefData.differentiators,
      briefData.concerns_about_exposure, briefData.company_description,
      briefData.history_origin, briefData.project_reason, briefData.core_concept,
      briefData.value_proposition, briefData.value_offer, briefData.services_list,
      briefData.main_service, briefData.primary_objective, briefData.secondary_objective,
      briefData.problem_to_solve, briefData.target_consumer, briefData.ideal_client_primary,
      briefData.ideal_client_secondary, briefData.specializations, briefData.confident_procedures,
      briefData.unique_differentiators, briefData.not_ready_for, briefData.clients_served,
      briefData.proud_results, briefData.key_selling_points, briefData.promise_delivery,
      briefData.central_idea, briefData.desired_emotions, briefData.brand_keywords,
      briefData.anti_keywords, briefData.success_definition, briefData.success_metrics,
      briefData.strategic_allies, briefData.direct_competition, briefData.indirect_competition,
      briefData.brand_references, briefData.inspiration_notes, briefData.budget_range,
      briefData.timeline, briefData.special_requirements, briefData.notes,
      briefData.status || 'draft', req.user?.id
    ]);
    
    console.log(`✅ Created creative brief ${result.rows[0].id} for ${briefData.prospect_name}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating brief:', error);
    res.status(500).json({ error: 'Failed to create brief', details: error.message });
  }
});

/**
 * PUT /api/briefs/:id
 * Update existing brief
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const briefData = req.body;
    
    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 0;
    
    Object.keys(briefData).forEach(key => {
      if (briefData[key] !== undefined && key !== 'id') {
        paramCount++;
        updates.push(`${key} = $${paramCount}`);
        values.push(briefData[key]);
      }
    });
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    paramCount++;
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    
    const query = `
      UPDATE creative_briefs SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    
    const result = await req.pool.query(query, values);
    
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Brief not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating brief:', error);
    res.status(500).json({ error: 'Failed to update brief' });
  }
});

/**
 * POST /api/briefs/:id/send
 * Mark brief as sent to prospect
 */
router.post('/:id/send', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await req.pool.query(`
      UPDATE creative_briefs SET
        status = 'sent',
        sent_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id]);
    
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Brief not found' });
    }
    
    console.log(`✅ Marked brief ${id} as sent`);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error sending brief:', error);
    res.status(500).json({ error: 'Failed to send brief' });
  }
});

/**
 * POST /api/briefs/:id/convert
 * Convert prospect to customer
 */
router.post('/:id/convert', async (req, res) => {
  const client = await req.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    
    // Get brief data
    const briefResult = await client.query('SELECT * FROM creative_briefs WHERE id = $1', [id]);
    
    if (!briefResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Brief not found' });
    }
    
    const brief = briefResult.rows[0];
    
    // Create customer from brief data
    const customerResult = await client.query(`
      INSERT INTO customers (
        first_name, last_name, email, phone, address
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      brief.prospect_name.split(' ')[0] || brief.prospect_name,
      brief.prospect_name.split(' ').slice(1).join(' ') || brief.company_name,
      brief.email,
      brief.phone,
      brief.address
    ]);
    
    const customer = customerResult.rows[0];
    
    // Link brief to customer
    await client.query(`
      UPDATE creative_briefs SET
        customer_id = $1,
        status = 'converted',
        converted_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [customer.id, id]);
    
    await client.query('COMMIT');
    
    console.log(`✅ Converted brief ${id} to customer ${customer.id}`);
    res.json({ 
      success: true,
      customer: customer,
      message: 'Prospect converted to customer successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error converting brief:', error);
    res.status(500).json({ error: 'Failed to convert brief' });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/briefs/:id
 * Delete a brief
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await req.pool.query('DELETE FROM creative_briefs WHERE id = $1 RETURNING id', [id]);
    
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Brief not found' });
    }
    
    console.log(`🗑️ Deleted brief ${id}`);
    res.json({ message: 'Brief deleted successfully' });
  } catch (error) {
    console.error('Error deleting brief:', error);
    res.status(500).json({ error: 'Failed to delete brief' });
  }
});

/**
 * POST /api/briefs/:id/generate-link
 * Generate shareable public link for a brief
 */
router.post('/:id/generate-link', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Generate unique token
    const crypto = require('crypto');
    const publicToken = crypto.randomBytes(32).toString('hex');
    
    // Store token in brief
    await req.pool.query(`
      ALTER TABLE creative_briefs ADD COLUMN IF NOT EXISTS public_token VARCHAR(255);
      UPDATE creative_briefs SET public_token = $1 WHERE id = $2
    `, [publicToken, id]);
    
    const publicLink = `${req.protocol}://${req.get('host')}/public-brief/${publicToken}`;
    
    console.log(`✅ Generated public link for brief ${id}`);
    res.json({ 
      success: true,
      public_link: publicLink,
      token: publicToken
    });
  } catch (error) {
    console.error('Error generating link:', error);
    res.status(500).json({ error: 'Failed to generate link' });
  }
});

// =====================================================
// PUBLIC ENDPOINTS (No authentication required)
// =====================================================

/**
 * GET /api/briefs/public/:token
 * Get brief by public token (no auth required)
 * If brief doesn't exist, creates a new one with this token
 */
router.get('/public/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    let result = await req.pool.query(
      'SELECT * FROM creative_briefs WHERE public_token = $1',
      [token]
    );
    
    // If brief doesn't exist yet, create it
    if (!result.rows.length) {
      console.log(`Creating new public brief with token ${token}`);
      
      result = await req.pool.query(`
        INSERT INTO creative_briefs (
          public_token, status, prospect_name
        ) VALUES ($1, 'draft', 'Nuevo Prospecto')
        RETURNING *
      `, [token]);
    }
    
    // Return brief data (excluding sensitive fields)
    const brief = result.rows[0];
    delete brief.created_by;
    
    res.json(brief);
  } catch (error) {
    console.error('Error fetching public brief:', error);
    res.status(500).json({ error: 'Failed to fetch brief' });
  }
});

/**
 * PUT /api/briefs/public/:token
 * Update brief via public link (no auth required)
 */
router.put('/public/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const briefData = req.body;
    
    // Check if brief exists
    const checkResult = await req.pool.query(
      'SELECT id FROM creative_briefs WHERE public_token = $1',
      [token]
    );
    
    if (!checkResult.rows.length) {
      return res.status(404).json({ error: 'Brief not found' });
    }
    
    // Build update query
    const updates = [];
    const values = [];
    let paramCount = 0;
    
    Object.keys(briefData).forEach(key => {
      if (briefData[key] !== undefined && key !== 'id' && key !== 'public_token') {
        paramCount++;
        updates.push(`${key} = $${paramCount}`);
        values.push(briefData[key]);
      }
    });
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    paramCount++;
    values.push(token);
    
    const query = `
      UPDATE creative_briefs SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE public_token = $${paramCount}
      RETURNING *
    `;
    
    const result = await req.pool.query(query, values);
    
    console.log(`✅ Updated public brief via token`);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating public brief:', error);
    res.status(500).json({ error: 'Failed to update brief' });
  }
});

/**
 * POST /api/briefs/public/:token/submit
 * Submit completed brief (no auth required)
 */
router.post('/public/:token/submit', async (req, res) => {
  try {
    const { token } = req.params;
    const briefData = req.body;
    
    // Update brief with all data and mark as completed
    const updates = [];
    const values = [];
    let paramCount = 0;
    
    Object.keys(briefData).forEach(key => {
      if (briefData[key] !== undefined) {
        paramCount++;
        updates.push(`${key} = $${paramCount}`);
        values.push(briefData[key]);
      }
    });
    
    paramCount++;
    values.push(token);
    
    const query = `
      UPDATE creative_briefs SET 
        ${updates.join(', ')},
        status = 'completed',
        completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE public_token = $${paramCount}
      RETURNING *
    `;
    
    const result = await req.pool.query(query, values);
    
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Brief not found' });
    }
    
    console.log(`✅ Brief completed via public submission`);
    
    // TODO: Send notification to team
    
    res.json({ 
      success: true,
      message: 'Brief submitted successfully',
      brief_id: result.rows[0].id
    });
  } catch (error) {
    console.error('Error submitting public brief:', error);
    res.status(500).json({ error: 'Failed to submit brief' });
  }
});

module.exports = router;
