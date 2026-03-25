// Add this after the existing DELETE route (around line 380)

/**
 * POST /api/hr/payroll/periods/:id/reverse
 * Reverse a paid payroll period (undo the payment)
 * Creates reversal journal entries to undo accounting impact
 */
router.post('/payroll/periods/:id/reverse', async (req, res) => {
  const client = await req.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { reason } = req.body;
    
    // Get payroll period details
    const period = await client.query(
      'SELECT * FROM payroll_periods WHERE id = $1',
      [id]
    );
    
    if (!period.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Payroll period not found' });
    }
    
    const payrollPeriod = period.rows[0];
    
    if (payrollPeriod.status !== 'paid') {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Can only reverse paid payroll. Use DELETE for unpaid periods.' 
      });
    }
    
    // Find all journal entries for this payroll
    const journalEntries = await client.query(`
      SELECT id, account_code, debit, credit, description
      FROM journal_entries
      WHERE source_type = 'payroll' AND source_id = $1
    `, [id]);
    
    // If no journal entries found, try source_id = 0 (old format)
    let entries = journalEntries.rows;
    if (entries.length === 0) {
      const oldFormat = await client.query(`
        SELECT id, account_code, debit, credit, description
        FROM journal_entries
        WHERE source_type = 'payroll' 
          AND description LIKE '%' || $1 || '%'
      `, [payrollPeriod.period_name]);
      entries = oldFormat.rows;
    }
    
    // Create reversal entries (swap debit and credit)
    for (const entry of entries) {
      await client.query(`
        INSERT INTO journal_entries (
          date, description, account_code, debit, credit,
          source_type, source_id
        ) VALUES (
          CURRENT_DATE, $1, $2, $3, $4, 'payroll_reversal', $5
        )
      `, [
        `REVERSA: ${payrollPeriod.period_name} - ${reason || 'Corrección'}`,
        entry.account_code,
        entry.credit, // Swap: credit becomes debit
        entry.debit,  // Swap: debit becomes credit
        id
      ]);
    }
    
    // Update payroll period status
    await client.query(`
      UPDATE payroll_periods SET
        status = 'reversed',
        notes = COALESCE(notes || E'\n\n', '') || 'REVERSED: ' || $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [reason || 'No reason provided', id]);
    
    await client.query('COMMIT');
    
    console.log(`✅ Reversed payroll period ${id} - ${payrollPeriod.period_name}`);
    console.log(`   Reversed ${entries.length} journal entries`);
    
    res.json({ 
      success: true,
      message: 'Payroll reversed successfully',
      period_id: id,
      entries_reversed: entries.length
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error reversing payroll:', error);
    res.status(500).json({ error: 'Failed to reverse payroll', details: error.message });
  } finally {
    client.release();
  }
});
