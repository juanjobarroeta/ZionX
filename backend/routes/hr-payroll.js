const express = require('express');
const router = express.Router();
const { createNotification, notifyAllUsers, NotificationTemplates } = require('../utils/notifications');

// Debug route to test HR endpoints
router.get('/test', (req, res) => {
  console.log('✅ HR test route hit!');
  res.json({ message: 'HR routes working!', timestamp: new Date() });
});

// =====================================================
// EMPLOYEE MANAGEMENT ROUTES
// =====================================================

/**
 * GET /api/hr/employees
 * Get all employees with optional filters
 */
router.get('/employees', async (req, res) => {
  try {
    const { department, employee_type, is_active } = req.query;
    
    let query = `
      SELECT 
        tm.*,
        COALESCE(ytd.ytd_gross, 0) as ytd_gross_pay,
        COALESCE(ytd.payments_count, 0) as payments_this_year
      FROM team_members tm
      LEFT JOIN (
        SELECT 
          pe.team_member_id,
          SUM(pe.gross_pay) as ytd_gross,
          COUNT(*) as payments_count
        FROM payroll_entries pe
        JOIN payroll_periods pp ON pe.payroll_period_id = pp.id
        WHERE EXTRACT(YEAR FROM pp.end_date) = EXTRACT(YEAR FROM CURRENT_DATE)
          AND pp.status = 'paid'
        GROUP BY pe.team_member_id
      ) ytd ON tm.id = ytd.team_member_id
      WHERE 1=1
    `;
    const params = [];
    
    if (department) {
      params.push(department);
      query += ` AND tm.department = $${params.length}`;
    }
    
    if (employee_type) {
      params.push(employee_type);
      query += ` AND tm.employee_type = $${params.length}`;
    }
    
    if (is_active !== undefined) {
      params.push(is_active === 'true');
      query += ` AND tm.is_active = $${params.length}`;
    }
    
    query += ' ORDER BY tm.name';
    
    const result = await req.pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

/**
 * GET /api/hr/employees/:id
 * Get single employee with full details
 */
router.get('/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await req.pool.query(`
      SELECT * FROM team_members WHERE id = $1
    `, [id]);
    
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    // Get payroll history
    const payrollHistory = await req.pool.query(`
      SELECT 
        pe.*,
        pp.period_name,
        pp.start_date,
        pp.end_date
      FROM payroll_entries pe
      JOIN payroll_periods pp ON pe.payroll_period_id = pp.id
      WHERE pe.team_member_id = $1
      ORDER BY pp.end_date DESC
      LIMIT 12
    `, [id]);
    
    res.json({
      ...result.rows[0],
      payroll_history: payrollHistory.rows
    });
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
});

/**
 * POST /api/hr/employees
 * Create new employee
 */
router.post('/employees', async (req, res) => {
  try {
    const {
      name, email, role, department, skills,
      hourly_rate, monthly_wage, employee_type,
      hire_date, contract_type, payment_frequency,
      bank_account, bank_name, clabe, rfc, curp,
      imss_number, phone, address, notes,
      capacity_hours_per_week, max_daily_tasks
    } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }
    
    const result = await req.pool.query(`
      INSERT INTO team_members (
        name, email, role, department, skills,
        hourly_rate, monthly_wage, employee_type,
        hire_date, contract_type, payment_frequency,
        bank_account, bank_name, clabe, rfc, curp,
        imss_number, phone, address, notes,
        capacity_hours_per_week, max_daily_tasks
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING *
    `, [
      name, email, role, department, skills,
      hourly_rate, monthly_wage, employee_type || 'full_time',
      hire_date, contract_type || 'permanent', payment_frequency || 'monthly',
      bank_account, bank_name, clabe, rfc, curp,
      imss_number, phone, address, notes,
      capacity_hours_per_week || 40, max_daily_tasks || 5
    ]);
    
    console.log(`✅ Created employee: ${name}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating employee:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

/**
 * PUT /api/hr/employees/:id
 * Update employee
 */
router.put('/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fields = req.body;
    
    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 0;
    
    const allowedFields = [
      'name', 'email', 'role', 'department', 'skills',
      'hourly_rate', 'monthly_wage', 'employee_type',
      'hire_date', 'contract_type', 'payment_frequency',
      'bank_account', 'bank_name', 'clabe', 'rfc', 'curp',
      'imss_number', 'phone', 'address', 'notes', 'is_active',
      'capacity_hours_per_week', 'max_daily_tasks', 'emergency_contact', 'emergency_phone'
    ];
    
    for (const field of allowedFields) {
      // Skip undefined and empty strings (but allow 0, false, null explicitly)
      if (fields[field] !== undefined && fields[field] !== '') {
        paramCount++;
        updates.push(`${field} = $${paramCount}`);
        
        // Round monetary fields to 2 decimal places to avoid floating point issues
        if (field === 'monthly_wage' || field === 'hourly_rate') {
          values.push(Math.round(parseFloat(fields[field]) * 100) / 100);
        } else {
          values.push(fields[field]);
        }
      }
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(id);
    // Note: updated_at may not exist in all environments
    const query = `
      UPDATE team_members SET ${updates.join(', ')}
      WHERE id = $${paramCount + 1}
      RETURNING *
    `;
    
    const result = await req.pool.query(query, values);
    
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

/**
 * DELETE /api/hr/employees/:id
 * Deactivate employee (soft delete)
 */
router.delete('/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await req.pool.query(`
      UPDATE team_members SET is_active = false WHERE id = $1 RETURNING id, name
    `, [id]);
    
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    console.log(`🗑️ Deactivated employee: ${result.rows[0].name}`);
    res.json({ message: 'Employee deactivated', employee: result.rows[0] });
  } catch (error) {
    console.error('Error deactivating employee:', error);
    res.status(500).json({ error: 'Failed to deactivate employee' });
  }
});

// =====================================================
// PAYROLL MANAGEMENT ROUTES
// =====================================================

/**
 * GET /api/hr/payroll/periods
 * Get all payroll periods
 */
router.get('/payroll/periods', async (req, res) => {
  try {
    const { status, year } = req.query;
    
    let query = `
      SELECT 
        pp.*,
        COUNT(pe.id) as entry_count,
        SUM(pe.gross_pay) as calculated_gross,
        SUM(pe.net_pay) as calculated_net
      FROM payroll_periods pp
      LEFT JOIN payroll_entries pe ON pp.id = pe.payroll_period_id
      WHERE 1=1
    `;
    const params = [];
    
    if (status) {
      params.push(status);
      query += ` AND pp.status = $${params.length}`;
    }
    
    if (year) {
      params.push(year);
      query += ` AND EXTRACT(YEAR FROM pp.end_date) = $${params.length}`;
    }
    
    query += ' GROUP BY pp.id ORDER BY pp.end_date DESC';
    
    const result = await req.pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching payroll periods:', error);
    res.status(500).json({ error: 'Failed to fetch payroll periods' });
  }
});

/**
 * POST /api/hr/payroll/periods
 * Create new payroll period
 */
router.post('/payroll/periods', async (req, res) => {
  try {
    const { period_name, start_date, end_date, payment_date, notes } = req.body;
    
    if (!period_name || !start_date || !end_date) {
      return res.status(400).json({ error: 'Period name, start_date, and end_date are required' });
    }
    
    const result = await req.pool.query(`
      INSERT INTO payroll_periods (period_name, start_date, end_date, payment_date, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [period_name, start_date, end_date, payment_date, notes, req.user.id]);
    
    console.log(`✅ Created payroll period: ${period_name}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating payroll period:', error);
    res.status(500).json({ error: 'Failed to create payroll period' });
  }
});

/**
 * GET /api/hr/payroll/periods/:id
 * Get payroll period with all entries
 */
router.get('/payroll/periods/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const periodResult = await req.pool.query('SELECT * FROM payroll_periods WHERE id = $1', [id]);
    
    if (!periodResult.rows.length) {
      return res.status(404).json({ error: 'Payroll period not found' });
    }
    
    const entriesResult = await req.pool.query(`
      SELECT 
        pe.*,
        tm.name as employee_name,
        tm.role,
        tm.department,
        tm.monthly_wage as base_monthly_wage
      FROM payroll_entries pe
      JOIN team_members tm ON pe.team_member_id = tm.id
      WHERE pe.payroll_period_id = $1
      ORDER BY tm.name
    `, [id]);
    
    res.json({
      ...periodResult.rows[0],
      entries: entriesResult.rows
    });
  } catch (error) {
    console.error('Error fetching payroll period:', error);
    res.status(500).json({ error: 'Failed to fetch payroll period' });
  }
});

/**
 * DELETE /api/hr/payroll/periods/:id
 * Delete a payroll period (only if not paid)
 */
router.delete('/payroll/periods/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if period exists and is not paid
    const period = await req.pool.query('SELECT status FROM payroll_periods WHERE id = $1', [id]);
    if (!period.rows.length) {
      return res.status(404).json({ error: 'Período no encontrado' });
    }
    if (period.rows[0].status === 'paid') {
      return res.status(400).json({ error: 'No se puede eliminar un período ya pagado' });
    }
    
    // Delete entries first (cascade should handle this, but be explicit)
    await req.pool.query('DELETE FROM payroll_entries WHERE payroll_period_id = $1', [id]);
    await req.pool.query('DELETE FROM payroll_periods WHERE id = $1', [id]);
    
    console.log(`🗑️ Deleted payroll period ${id}`);
    res.json({ message: 'Período eliminado exitosamente' });
  } catch (error) {
    console.error('Error deleting payroll period:', error);
    res.status(500).json({ error: 'Error al eliminar el período' });
  }
});

/**
 * POST /api/hr/payroll/periods/:id/generate
 * Auto-generate payroll entries for all active employees
 */
router.post('/payroll/periods/:id/generate', async (req, res) => {
  const client = await req.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    console.log(`📋 Generating payroll for period ${id}...`);
    
    // Get all active employees with monthly wages
    const employees = await client.query(`
      SELECT id, name, monthly_wage, hourly_rate, employee_type, payment_frequency
      FROM team_members 
      WHERE is_active = true AND monthly_wage IS NOT NULL AND monthly_wage > 0
    `);
    
    console.log(`👥 Found ${employees.rows.length} eligible employees:`, employees.rows.map(e => `${e.name}: $${e.monthly_wage}`));
    
    let generatedCount = 0;
    
    for (const emp of employees.rows) {
      // Check if entry already exists
      const existing = await client.query(
        'SELECT id FROM payroll_entries WHERE payroll_period_id = $1 AND team_member_id = $2',
        [id, emp.id]
      );
      
      if (existing.rows.length) {
        console.log(`⏭️ Skipping ${emp.name} - entry already exists`);
        continue;
      }
      
      // Calculate base salary - always divide by 2 for quincenal payroll
      // (employees' monthly_wage is stored as full month, quincena = half)
      let baseSalary = Math.round((parseFloat(emp.monthly_wage) / 2) * 100) / 100;
      
      // Simple ISR estimation (this would be more complex in reality)
      const isrRate = baseSalary > 20000 ? 0.25 : baseSalary > 10000 ? 0.20 : 0.10;
      const isrTax = Math.round(baseSalary * isrRate * 100) / 100;
      
      // IMSS employee contribution (approximately 2.5%)
      const imssEmployee = Math.round(baseSalary * 0.025 * 100) / 100;
      
      const totalDeductions = isrTax + imssEmployee;
      const netPay = Math.round((baseSalary - totalDeductions) * 100) / 100;
      
      console.log(`💵 ${emp.name}: Base=$${baseSalary}, ISR=$${isrTax}, IMSS=$${imssEmployee}, Net=$${netPay}`);
      
      await client.query(`
        INSERT INTO payroll_entries (
          payroll_period_id, team_member_id,
          base_salary, gross_pay,
          isr_tax, imss_employee, total_deductions,
          net_pay, status
        ) VALUES ($1, $2, $3, $3, $4, $5, $6, $7, 'pending')
      `, [id, emp.id, baseSalary, isrTax, imssEmployee, totalDeductions, netPay]);
      
      generatedCount++;
    }
    
    // Update period totals
    await client.query(`
      UPDATE payroll_periods SET
        total_gross = (SELECT COALESCE(SUM(gross_pay), 0) FROM payroll_entries WHERE payroll_period_id = $1),
        total_deductions = (SELECT COALESCE(SUM(total_deductions), 0) FROM payroll_entries WHERE payroll_period_id = $1),
        total_net = (SELECT COALESCE(SUM(net_pay), 0) FROM payroll_entries WHERE payroll_period_id = $1)
      WHERE id = $1
    `, [id]);
    
    await client.query('COMMIT');
    
    console.log(`✅ Generated ${generatedCount} payroll entries for period ${id}`);
    res.json({ message: `Generated ${generatedCount} payroll entries`, count: generatedCount });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error generating payroll:', error);
    res.status(500).json({ error: 'Failed to generate payroll', details: error.message });
  } finally {
    client.release();
  }
});

/**
 * POST /api/hr/payroll/entries
 * Create/update individual payroll entry
 */
router.post('/payroll/entries', async (req, res) => {
  try {
    const {
      payroll_period_id, team_member_id,
      base_salary, overtime_hours, overtime_pay,
      bonuses, commissions, other_earnings,
      isr_tax, imss_employee, infonavit,
      loans_deduction, other_deductions, notes
    } = req.body;
    
    const gross_pay = (parseFloat(base_salary) || 0) + 
                      (parseFloat(overtime_pay) || 0) + 
                      (parseFloat(bonuses) || 0) + 
                      (parseFloat(commissions) || 0) + 
                      (parseFloat(other_earnings) || 0);
    
    const total_deductions = (parseFloat(isr_tax) || 0) + 
                             (parseFloat(imss_employee) || 0) + 
                             (parseFloat(infonavit) || 0) + 
                             (parseFloat(loans_deduction) || 0) + 
                             (parseFloat(other_deductions) || 0);
    
    const net_pay = gross_pay - total_deductions;
    
    // Upsert entry
    const result = await req.pool.query(`
      INSERT INTO payroll_entries (
        payroll_period_id, team_member_id,
        base_salary, overtime_hours, overtime_pay,
        bonuses, commissions, other_earnings, gross_pay,
        isr_tax, imss_employee, infonavit,
        loans_deduction, other_deductions, total_deductions,
        net_pay, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (payroll_period_id, team_member_id) 
      DO UPDATE SET
        base_salary = $3, overtime_hours = $4, overtime_pay = $5,
        bonuses = $6, commissions = $7, other_earnings = $8, gross_pay = $9,
        isr_tax = $10, imss_employee = $11, infonavit = $12,
        loans_deduction = $13, other_deductions = $14, total_deductions = $15,
        net_pay = $16, notes = $17, updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      payroll_period_id, team_member_id,
      base_salary, overtime_hours, overtime_pay,
      bonuses, commissions, other_earnings, gross_pay,
      isr_tax, imss_employee, infonavit,
      loans_deduction, other_deductions, total_deductions,
      net_pay, notes
    ]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error saving payroll entry:', error);
    res.status(500).json({ error: 'Failed to save payroll entry' });
  }
});

/**
 * POST /api/hr/payroll/periods/:id/process
 * Process payroll (mark as paid and create accounting entries)
 */
router.post('/payroll/periods/:id/process', async (req, res) => {
  const client = await req.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { payment_date } = req.body;
    
    // Get period and entries
    const period = await client.query('SELECT * FROM payroll_periods WHERE id = $1', [id]);
    if (!period.rows.length) {
      return res.status(404).json({ error: 'Payroll period not found' });
    }
    
    const entries = await client.query(`
      SELECT * FROM payroll_entries WHERE payroll_period_id = $1 AND status = 'pending'
    `, [id]);
    
    if (!entries.rows.length) {
      return res.status(400).json({ error: 'No pending entries to process' });
    }
    
    // Calculate totals and track deductions breakdown
    let totalGross = 0;
    let totalNet = 0;
    let totalISR = 0;
    let totalIMSS = 0;
    let totalOtherDeductions = 0;
    
    for (const entry of entries.rows) {
      totalGross += parseFloat(entry.gross_pay || 0);
      totalNet += parseFloat(entry.net_pay || 0);
      totalISR += parseFloat(entry.isr || 0);
      totalIMSS += parseFloat(entry.imss || 0);
      totalOtherDeductions += parseFloat(entry.other_deductions || 0);
      
      // Mark entry as paid
      await client.query(`
        UPDATE payroll_entries SET status = 'paid', paid_at = $1 WHERE id = $2
      `, [payment_date || new Date(), entry.id]);
    }
    
    const periodName = period.rows[0].period_name;
    const payDate = payment_date || new Date();
    
    // Create journal entries for payroll using the correct schema format:
    // Debit: Salary Expense (6000) - gross amount
    // Credit: Bank (1102) - net paid
    // Credit: ISR Payable (2106) - taxes withheld
    // Credit: IMSS Payable (2107) - social security withheld
    
    // Entry 1: Debit Salary Expense
    await client.query(`
      INSERT INTO journal_entries (date, description, account_code, debit, credit, source_type, source_id, created_by)
      VALUES ($1, $2, '6000', $3, 0, 'payroll', $4, $5)
    `, [payDate, `Nómina ${periodName} - Gasto de Sueldos`, totalGross, id, req.user.id]);
    
    // Entry 2: Credit Bank (net paid)
    await client.query(`
      INSERT INTO journal_entries (date, description, account_code, debit, credit, source_type, source_id, created_by)
      VALUES ($1, $2, '1102', 0, $3, 'payroll', $4, $5)
    `, [payDate, `Nómina ${periodName} - Pago Neto a Empleados`, totalNet, id, req.user.id]);
    
    // Entry 3: Credit ISR Payable (if any)
    if (totalISR > 0) {
      await client.query(`
        INSERT INTO journal_entries (date, description, account_code, debit, credit, source_type, source_id, created_by)
        VALUES ($1, $2, '2106', 0, $3, 'payroll', $4, $5)
      `, [payDate, `Nómina ${periodName} - ISR Retenido`, totalISR, id, req.user.id]);
    }
    
    // Entry 4: Credit IMSS Payable (if any)
    if (totalIMSS > 0) {
      await client.query(`
        INSERT INTO journal_entries (date, description, account_code, debit, credit, source_type, source_id, created_by)
        VALUES ($1, $2, '2107', 0, $3, 'payroll', $4, $5)
      `, [payDate, `Nómina ${periodName} - IMSS Retenido`, totalIMSS, id, req.user.id]);
    }
    
    console.log(`📒 Created payroll journal entries: Gross $${totalGross}, Net $${totalNet}, ISR $${totalISR}, IMSS $${totalIMSS}`);
    
    // Update period status
    await client.query(`
      UPDATE payroll_periods SET 
        status = 'paid', 
        payment_date = $1,
        total_gross = $2,
        total_net = $3,
        closed_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, [payment_date || new Date(), totalGross, totalNet, id]);
    
    await client.query('COMMIT');
    
    console.log(`✅ Processed payroll period ${id}: $${totalNet} net paid`);
    
    // Send notification to all users about payroll processing
    try {
      await notifyAllUsers(req.pool, {
        ...NotificationTemplates.payrollProcessed(period.rows[0].period_name, totalNet),
        fromUserId: req.user.id
      });
    } catch (notifError) {
      console.log('Could not send payroll notification:', notifError.message);
    }
    
    res.json({ 
      message: 'Payroll processed successfully',
      total_gross: totalGross,
      total_net: totalNet,
      entries_processed: entries.rows.length
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing payroll:', error);
    res.status(500).json({ error: 'Failed to process payroll' });
  } finally {
    client.release();
  }
});

// =====================================================
// OPERATING EXPENSES ROUTES
// =====================================================

/**
 * GET /api/hr/expenses
 * Get operating expenses
 */
router.get('/expenses', async (req, res) => {
  try {
    const { category_id, from_date, to_date, limit } = req.query;
    
    let query = `
      SELECT 
        oe.*,
        ec.name as category_name,
        u.name as created_by_name
      FROM operating_expenses oe
      LEFT JOIN expense_categories ec ON oe.category_id = ec.id
      LEFT JOIN users u ON oe.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (category_id) {
      params.push(category_id);
      query += ` AND oe.category_id = $${params.length}`;
    }
    
    if (from_date) {
      params.push(from_date);
      query += ` AND oe.expense_date >= $${params.length}`;
    }
    
    if (to_date) {
      params.push(to_date);
      query += ` AND oe.expense_date <= $${params.length}`;
    }
    
    query += ' ORDER BY oe.expense_date DESC';
    
    if (limit) {
      params.push(parseInt(limit));
      query += ` LIMIT $${params.length}`;
    }
    
    const result = await req.pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

/**
 * GET /api/hr/expense-categories
 * Get expense categories
 */
router.get('/expense-categories', async (req, res) => {
  try {
    const result = await req.pool.query('SELECT * FROM expense_categories WHERE is_active = true ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching expense categories:', error);
    res.status(500).json({ error: 'Failed to fetch expense categories' });
  }
});

/**
 * POST /api/hr/expenses
 * Record operating expense
 */
router.post('/expenses', async (req, res) => {
  const client = await req.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const {
      category_id, description, amount, expense_date,
      vendor, invoice_number, payment_method, payment_reference,
      is_recurring, recurrence_frequency, notes
    } = req.body;
    
    if (!description || !amount) {
      return res.status(400).json({ error: 'Description and amount are required' });
    }
    
    // Get expense category and account code
    let expenseAccountCode = '6500'; // Default: Other Operating Expenses
    if (category_id) {
      const category = await client.query(
        'SELECT account_code FROM expense_categories WHERE id = $1', [category_id]
      );
      if (category.rows.length && category.rows[0].account_code) {
        expenseAccountCode = category.rows[0].account_code;
      }
    }
    
    // Create expense record
    const expenseResult = await client.query(`
      INSERT INTO operating_expenses (
        category_id, description, amount, expense_date,
        vendor, invoice_number, payment_method, payment_reference,
        is_recurring, recurrence_frequency, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      category_id, description, amount, expense_date || new Date(),
      vendor, invoice_number, payment_method, payment_reference,
      is_recurring || false, recurrence_frequency, notes, req.user.id
    ]);
    
    const expenseId = expenseResult.rows[0].id;
    const expDate = expense_date || new Date();
    
    // Determine bank/cash account based on payment method
    const bankAccountCode = (payment_method === 'transferencia' || payment_method === 'transfer') ? '1102' : '1101';
    
    // Create journal entries using correct schema format:
    // Debit: Expense Account (increases expense)
    await client.query(`
      INSERT INTO journal_entries (date, description, account_code, debit, credit, source_type, source_id, created_by)
      VALUES ($1, $2, $3, $4, 0, 'expense', $5, $6)
    `, [expDate, `Gasto: ${description}`, expenseAccountCode, amount, expenseId, req.user.id]);
    
    // Credit: Bank/Cash Account (decreases cash)
    await client.query(`
      INSERT INTO journal_entries (date, description, account_code, debit, credit, source_type, source_id, created_by)
      VALUES ($1, $2, $3, 0, $4, 'expense', $5, $6)
    `, [expDate, `Pago: ${description}`, bankAccountCode, amount, expenseId, req.user.id]);
    
    console.log(`📒 Created expense journal entries: Debit ${expenseAccountCode}, Credit ${bankAccountCode} - $${amount}`);
    
    await client.query('COMMIT');
    
    console.log(`✅ Recorded expense: ${description} - $${amount}`);
    res.status(201).json(expenseResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error recording expense:', error);
    res.status(500).json({ error: 'Failed to record expense' });
  } finally {
    client.release();
  }
});

// =====================================================
// FINANCIAL STATEMENTS ROUTES
// =====================================================

/**
 * GET /api/hr/financial/profit-loss
 * Get Profit & Loss statement
 */
router.get('/financial/profit-loss', async (req, res) => {
  try {
    const { year, month } = req.query;
    
    let dateFilter = '';
    const params = [];
    
    if (year && month) {
      params.push(`${year}-${month.toString().padStart(2, '0')}`);
      dateFilter = 'WHERE month = $1';
    } else if (year) {
      params.push(`${year}%`);
      dateFilter = 'WHERE month LIKE $1';
    }
    
    // Get revenue
    const revenueQuery = `
      SELECT 
        TO_CHAR(payment_date, 'YYYY-MM') as month,
        SUM(amount) as total
      FROM invoice_payments
      ${year ? `WHERE EXTRACT(YEAR FROM payment_date) = ${year}` : ''}
      GROUP BY TO_CHAR(payment_date, 'YYYY-MM')
      ORDER BY month DESC
    `;
    const revenue = await req.pool.query(revenueQuery);
    
    // Get labor costs
    const laborQuery = `
      SELECT * FROM v_monthly_labor_cost
      ${dateFilter}
      ORDER BY month DESC
    `;
    const labor = await req.pool.query(laborQuery, params);
    
    // Get operating expenses
    const expensesQuery = `
      SELECT 
        TO_CHAR(expense_date, 'YYYY-MM') as month,
        ec.name as category,
        SUM(oe.amount) as total
      FROM operating_expenses oe
      LEFT JOIN expense_categories ec ON oe.category_id = ec.id
      ${year ? `WHERE EXTRACT(YEAR FROM expense_date) = ${year}` : ''}
      GROUP BY TO_CHAR(expense_date, 'YYYY-MM'), ec.name
      ORDER BY month DESC, category
    `;
    const expenses = await req.pool.query(expensesQuery);
    
    // Get P&L summary
    const summaryQuery = `SELECT * FROM v_profit_loss_summary ${dateFilter} ORDER BY month DESC`;
    const summary = await req.pool.query(summaryQuery, params);
    
    res.json({
      summary: summary.rows,
      revenue: revenue.rows,
      labor_costs: labor.rows,
      operating_expenses: expenses.rows
    });
  } catch (error) {
    console.error('Error fetching P&L:', error);
    res.status(500).json({ error: 'Failed to fetch profit & loss statement' });
  }
});

/**
 * GET /api/hr/financial/summary
 * Get financial summary dashboard data
 */
router.get('/financial/summary', async (req, res) => {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentYear = new Date().getFullYear();
    
    // Current month revenue
    const revenueResult = await req.pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM invoice_payments
      WHERE TO_CHAR(payment_date, 'YYYY-MM') = $1
    `, [currentMonth]);
    
    // Current month labor cost
    const laborResult = await req.pool.query(`
      SELECT COALESCE(SUM(pe.net_pay), 0) as total
      FROM payroll_entries pe
      JOIN payroll_periods pp ON pe.payroll_period_id = pp.id
      WHERE TO_CHAR(pp.end_date, 'YYYY-MM') = $1 AND pp.status = 'paid'
    `, [currentMonth]);
    
    // Current month expenses
    const expensesResult = await req.pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM operating_expenses
      WHERE TO_CHAR(expense_date, 'YYYY-MM') = $1
    `, [currentMonth]);
    
    // YTD totals
    const ytdRevenueResult = await req.pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM invoice_payments
      WHERE EXTRACT(YEAR FROM payment_date) = $1
    `, [currentYear]);
    
    const ytdLaborResult = await req.pool.query(`
      SELECT COALESCE(SUM(pe.net_pay), 0) as total
      FROM payroll_entries pe
      JOIN payroll_periods pp ON pe.payroll_period_id = pp.id
      WHERE EXTRACT(YEAR FROM pp.end_date) = $1 AND pp.status = 'paid'
    `, [currentYear]);
    
    const ytdExpensesResult = await req.pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM operating_expenses
      WHERE EXTRACT(YEAR FROM expense_date) = $1
    `, [currentYear]);
    
    // Employee count
    const employeeCount = await req.pool.query(
      'SELECT COUNT(*) as total FROM team_members WHERE is_active = true'
    );
    
    const mtdRevenue = parseFloat(revenueResult.rows[0].total);
    const mtdLabor = parseFloat(laborResult.rows[0].total);
    const mtdExpenses = parseFloat(expensesResult.rows[0].total);
    const mtdProfit = mtdRevenue - mtdLabor - mtdExpenses;
    
    const ytdRevenue = parseFloat(ytdRevenueResult.rows[0].total);
    const ytdLabor = parseFloat(ytdLaborResult.rows[0].total);
    const ytdExpenses = parseFloat(ytdExpensesResult.rows[0].total);
    const ytdProfit = ytdRevenue - ytdLabor - ytdExpenses;
    
    res.json({
      current_month: currentMonth,
      mtd: {
        revenue: mtdRevenue,
        labor_cost: mtdLabor,
        operating_expenses: mtdExpenses,
        net_income: mtdProfit,
        profit_margin: mtdRevenue > 0 ? ((mtdProfit / mtdRevenue) * 100).toFixed(2) : 0
      },
      ytd: {
        revenue: ytdRevenue,
        labor_cost: ytdLabor,
        operating_expenses: ytdExpenses,
        net_income: ytdProfit,
        profit_margin: ytdRevenue > 0 ? ((ytdProfit / ytdRevenue) * 100).toFixed(2) : 0
      },
      employee_count: parseInt(employeeCount.rows[0].total)
    });
  } catch (error) {
    console.error('Error fetching financial summary:', error);
    res.status(500).json({ error: 'Failed to fetch financial summary' });
  }
});

module.exports = router;

