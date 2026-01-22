const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migratePayments() {
  try {
    console.log('🔄 Starting payment migration...');
    
    // Get all payments that need to be migrated
    const paymentsResult = await pool.query(`
      SELECT p.*, li.id as installment_id, li.week_number, li.amount_due, li.capital_portion, li.interest_portion, li.penalty_applied
      FROM payments p
      JOIN loan_installments li ON p.loan_id = li.loan_id AND p.installment_week = li.week_number
      WHERE p.amount > 0
      ORDER BY p.loan_id, p.installment_week
    `);
    
    console.log(`📊 Found ${paymentsResult.rows.length} payments to migrate`);
    
    let updatedCount = 0;
    
    for (const payment of paymentsResult.rows) {
      const installmentAmount = parseFloat(payment.amount_due);
      const penaltyAmount = parseFloat(payment.penalty_applied || 0);
      const totalDue = installmentAmount + penaltyAmount;
      const paymentAmount = parseFloat(payment.amount);
      
      // Calculate how much of the payment goes to each component
      let capitalPaid = 0;
      let interestPaid = 0;
      let penaltyPaid = 0;
      
      if (totalDue > 0) {
        // First, pay penalties
        if (penaltyAmount > 0) {
          penaltyPaid = Math.min(paymentAmount, penaltyAmount);
          paymentAmount -= penaltyPaid;
        }
        
        // Then, pay interest
        if (paymentAmount > 0) {
          interestPaid = Math.min(paymentAmount, parseFloat(payment.interest_portion));
          paymentAmount -= interestPaid;
        }
        
        // Finally, pay capital
        if (paymentAmount > 0) {
          capitalPaid = paymentAmount;
        }
      }
      
      // Update the installment with the calculated amounts
      await pool.query(`
        UPDATE loan_installments 
        SET 
          capital_paid = COALESCE(capital_paid, 0) + $1,
          interest_paid = COALESCE(interest_paid, 0) + $2,
          penalty_paid = COALESCE(penalty_paid, 0) + $3,
          status = CASE 
            WHEN (COALESCE(capital_paid, 0) + $1 + COALESCE(interest_paid, 0) + $2 + COALESCE(penalty_paid, 0) + $3) >= (amount_due + COALESCE(penalty_applied, 0))
            THEN 'paid'
            ELSE status
          END
        WHERE id = $4
      `, [capitalPaid, interestPaid, penaltyPaid, payment.installment_id]);
      
      console.log(`✅ Updated installment ${payment.week_number} for loan ${payment.loan_id}: Capital: $${capitalPaid}, Interest: $${interestPaid}, Penalty: $${penaltyPaid}`);
      updatedCount++;
    }
    
    console.log(`🎉 Migration completed! Updated ${updatedCount} installments`);
    
    // Verify the migration
    const verificationResult = await pool.query(`
      SELECT 
        li.loan_id,
        li.week_number,
        li.capital_paid,
        li.interest_paid,
        li.penalty_paid,
        li.status
      FROM loan_installments li
      WHERE li.capital_paid > 0 OR li.interest_paid > 0 OR li.penalty_paid > 0
      ORDER BY li.loan_id, li.week_number
    `);
    
    console.log(`📋 Verification: Found ${verificationResult.rows.length} installments with paid amounts`);
    verificationResult.rows.forEach(row => {
      console.log(`   Loan ${row.loan_id}, Week ${row.week_number}: Capital: $${row.capital_paid}, Interest: $${row.interest_paid}, Penalty: $${row.penalty_paid}, Status: ${row.status}`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the migration
migratePayments(); 