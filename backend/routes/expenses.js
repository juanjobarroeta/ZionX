const express = require('express');
const router = express.Router();

/**
 * Marketing Agency Expense Management
 * Creates journal entries for proper accounting
 */

/**
 * POST /api/expenses/create
 * Create a new expense (and optionally pay it immediately)
 */
router.post('/create', async (req, res) => {
  const client = await req.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const {
      category,
      description,
      amount,
      expense_date,
      vendor,
      payment_method, // If provided, mark as paid immediately
      notes
    } = req.body;
    
    if (!category || !amount || !description) {
      return res.status(400).json({ error: 'category, amount, and description are required' });
    }
    
    const expenseAmount = parseFloat(amount);
    
    if (expenseAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }
    
    // Map category to account_code
    const categoryAccountMap = {
      payroll: '6000',
      meta_ads: '6001',
      google_ads: '6002',
      tiktok_ads: '6003',
      tools: '6004',
      assets: '6005',
      freelancers: '6006',
      marketing_own: '6100',
      rent: '6200',
      internet: '6230',
      software_subscriptions: '6240',
      other: '6999'
    };
    
    const account_code = categoryAccountMap[category] || '6999';
    
    // Insert into expenses table (match actual table structure)
    const expenseResult = await client.query(`
      INSERT INTO expenses (
        category, amount, description, due_date,
        status, type, method
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      category,
      expenseAmount,
      description,
      expense_date || new Date(),
      payment_method ? 'paid' : 'pending',
      category, // Use category as type as well
      payment_method
    ]);
    
    const expense = expenseResult.rows[0];
    
    // If payment_method provided, create journal entries immediately
    if (payment_method) {
      // Determine cash account (Bank or Cash)
      const cashAccountCode = payment_method === 'efectivo' ? '1101' : '1102';
      const cashAccountName = payment_method === 'efectivo' ? 'Caja' : 'Banco';
      
      // Create journal entries for expense payment
      // Debit: Expense Account (increases expense)
      await client.query(`
        INSERT INTO journal_entries (
          date, description, account_code, debit, credit, 
          source_type, source_id
        ) VALUES ($1, $2, $3, $4, 0, 'expense', $5)
      `, [
        expense_date || new Date(),
        `${description} - ${vendor || 'Gasto'}`,
        account_code,
        expenseAmount,
        expense.id
      ]);
      
      // Credit: Bank/Cash (decreases cash)
      await client.query(`
        INSERT INTO journal_entries (
          date, description, account_code, debit, credit,
          source_type, source_id
        ) VALUES ($1, $2, $3, 0, $4, 'expense', $5)
      `, [
        expense_date || new Date(),
        `Pago ${description} - ${payment_method}`,
        cashAccountCode,
        expenseAmount,
        expense.id
      ]);
      
      console.log(`✅ Created expense ${expense.id} and journal entries: Debit ${account_code}, Credit ${cashAccountCode} - $${expenseAmount}`);
    } else {
      console.log(`✅ Created expense ${expense.id} (pending payment)`);
    }
    
    await client.query('COMMIT');
    
    res.status(201).json({
      success: true,
      expense: expense,
      message: payment_method 
        ? 'Gasto registrado y pagado correctamente' 
        : 'Gasto registrado (pendiente de pago)'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating expense:', error);
    res.status(500).json({ error: 'Failed to create expense', details: error.message });
  } finally {
    client.release();
  }
});

/**
 * POST /api/expenses/:id/pay
 * Mark expense as paid and create journal entries
 */
router.post('/:id/pay', async (req, res) => {
  const client = await req.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const expense_id = parseInt(req.params.id);
    const {
      payment_method,
      reference,
      payment_date
    } = req.body;
    
    if (!payment_method) {
      return res.status(400).json({ error: 'payment_method is required' });
    }
    
    // Get expense details
    const expenseResult = await client.query(
      'SELECT * FROM expenses WHERE id = $1',
      [expense_id]
    );
    
    if (!expenseResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    const expense = expenseResult.rows[0];
    
    if (expense.status === 'paid') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Expense is already paid' });
    }
    
    // Update expense status
    await client.query(`
      UPDATE expenses SET
        status = 'paid',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [expense_id]);
    
    // Map category to account code
    const categoryAccountMap = {
      payroll: '6000',
      meta_ads: '6001',
      google_ads: '6002',
      tiktok_ads: '6003',
      tools: '6004',
      assets: '6005',
      freelancers: '6006',
      marketing_own: '6100',
      rent: '6200',
      internet: '6230',
      software_subscriptions: '6240',
      other: '6999'
    };
    
    const account_code = categoryAccountMap[expense.category] || '6999';
    const cashAccountCode = payment_method === 'efectivo' ? '1101' : '1102';
    const expenseAmount = parseFloat(expense.amount);
    
    // Create journal entries
    // Debit: Expense Account
    await client.query(`
      INSERT INTO journal_entries (
        date, description, account_code, debit, credit,
        source_type, source_id
      ) VALUES ($1, $2, $3, $4, 0, 'expense_payment', $5)
    `, [
      payment_date || new Date(),
      `Gasto: ${expense.description}`,
      account_code,
      expenseAmount,
      expense_id
    ]);
    
    // Credit: Bank/Cash
    await client.query(`
      INSERT INTO journal_entries (
        date, description, account_code, debit, credit,
        source_type, source_id
      ) VALUES ($1, $2, $3, 0, $4, 'expense_payment', $5)
    `, [
      payment_date || new Date(),
      `Pago: ${expense.description} - ${payment_method}`,
      cashAccountCode,
      expenseAmount,
      expense_id
    ]);
    
    await client.query('COMMIT');
    
    console.log(`✅ Paid expense ${expense_id}: Debit ${account_code}, Credit ${cashAccountCode} - $${expenseAmount}`);
    
    res.json({
      success: true,
      expense_id,
      amount: expenseAmount,
      payment_method,
      message: 'Pago registrado correctamente con asientos contables'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error paying expense:', error);
    res.status(500).json({ error: 'Failed to pay expense', details: error.message });
  } finally {
    client.release();
  }
});

/**
 * POST /api/expenses/:id/reverse
 * Reverse a paid expense (undo the payment and journal entries)
 */
router.post('/:id/reverse', async (req, res) => {
  const client = await req.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const expense_id = parseInt(req.params.id);
    const { reason } = req.body;
    
    // Get expense details
    const expenseResult = await client.query(
      'SELECT * FROM expenses WHERE id = $1',
      [expense_id]
    );
    
    if (!expenseResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    const expense = expenseResult.rows[0];
    
    if (expense.status !== 'paid') {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Can only reverse paid expenses. Use DELETE for unpaid expenses.' 
      });
    }
    
    // Find all journal entries for this expense
    const journalEntries = await client.query(`
      SELECT id, account_code, debit, credit, description
      FROM journal_entries
      WHERE source_type IN ('expense', 'expense_payment') 
        AND source_id = $1
    `, [expense_id]);
    
    if (journalEntries.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'No journal entries found for this expense' 
      });
    }
    
    // Create reversal entries (swap debit and credit)
    for (const entry of journalEntries.rows) {
      await client.query(`
        INSERT INTO journal_entries (
          date, description, account_code, debit, credit,
          source_type, source_id
        ) VALUES (
          CURRENT_DATE, $1, $2, $3, $4, 'expense_reversal', $5
        )
      `, [
        `REVERSA: ${expense.description} - ${reason || 'Corrección'}`,
        entry.account_code,
        entry.credit, // Swap: credit becomes debit
        entry.debit,  // Swap: debit becomes credit
        expense_id
      ]);
    }
    
    // Update expense status
    await client.query(`
      UPDATE expenses SET
        status = 'reversed',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [expense_id]);
    
    await client.query('COMMIT');
    
    console.log(`✅ Reversed expense ${expense_id}: ${expense.description}`);
    console.log(`   Reversed ${journalEntries.rows.length} journal entries`);
    
    res.json({
      success: true,
      expense_id,
      entries_reversed: journalEntries.rows.length,
      message: 'Gasto reversado exitosamente'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error reversing expense:', error);
    res.status(500).json({ error: 'Failed to reverse expense', details: error.message });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/expenses/:id
 * Delete an unpaid expense (only works for pending/draft expenses)
 */
router.delete('/:id', async (req, res) => {
  try {
    const expense_id = parseInt(req.params.id);
    
    // Check if expense is paid
    const expenseResult = await req.pool.query(
      'SELECT status FROM expenses WHERE id = $1',
      [expense_id]
    );
    
    if (!expenseResult.rows.length) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    if (expenseResult.rows[0].status === 'paid') {
      return res.status(400).json({ 
        error: 'Cannot delete paid expense. Use /reverse endpoint instead.' 
      });
    }
    
    // Delete expense
    await req.pool.query('DELETE FROM expenses WHERE id = $1', [expense_id]);
    
    console.log(`🗑️ Deleted unpaid expense ${expense_id}`);
    res.json({ message: 'Gasto eliminado exitosamente' });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

module.exports = router;
