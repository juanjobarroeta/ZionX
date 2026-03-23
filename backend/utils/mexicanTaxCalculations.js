/**
 * Official Mexican Tax Calculations (2026)
 * Based on SAT (Servicio de Administración Tributaria) tables
 */

// UMA 2026 value (Unidad de Medida y Actualización)
// This should be updated yearly - 2026 estimated value
const UMA_DAILY_2026 = 113.14; // MXN per day (estimated for 2026)
const UMA_MONTHLY_2026 = UMA_DAILY_2026 * 30.4;

/**
 * ISR (Income Tax) Quincenal Tables 2026
 * Source: SAT - Tabla de ISR Quincenal
 * 
 * Formula: ((Income - Lower Limit) × Marginal Rate) + Fixed Amount - Subsidy
 */
const ISR_QUINCENAL_2026 = [
  { lowerLimit: 0.01, upperLimit: 373.65, fixedAmount: 0.00, rate: 0.0192, subsidy: 11.11 },
  { lowerLimit: 373.66, upperLimit: 3172.05, fixedAmount: 7.05, rate: 0.0640, subsidy: 11.11 },
  { lowerLimit: 3172.06, upperLimit: 5544.75, fixedAmount: 186.18, rate: 0.1088, subsidy: 11.11 },
  { lowerLimit: 5544.76, upperLimit: 6429.75, fixedAmount: 444.34, rate: 0.1600, subsidy: 11.11 },
  { lowerLimit: 6429.76, upperLimit: 7706.40, fixedAmount: 585.94, rate: 0.1792, subsidy: 11.11 },
  { lowerLimit: 7706.41, upperLimit: 10028.55, fixedAmount: 814.66, rate: 0.2136, subsidy: 11.11 },
  { lowerLimit: 10028.56, upperLimit: 15906.00, fixedAmount: 1310.88, rate: 0.2352, subsidy: 0.00 },
  { lowerLimit: 15906.01, upperLimit: 31812.00, fixedAmount: 2693.31, rate: 0.3000, subsidy: 0.00 },
  { lowerLimit: 31812.01, upperLimit: 47718.00, fixedAmount: 7465.11, rate: 0.3200, subsidy: 0.00 },
  { lowerLimit: 47718.01, upperLimit: 95436.00, fixedAmount: 12555.03, rate: 0.3400, subsidy: 0.00 },
  { lowerLimit: 95436.01, upperLimit: Infinity, fixedAmount: 28759.15, rate: 0.3500, subsidy: 0.00 }
];

/**
 * Calculate ISR (Income Tax) for quincenal period
 * @param {number} income - Gross quincenal income
 * @returns {number} ISR amount to withhold
 */
function calculateISRQuincenal(income) {
  if (income <= 0) return 0;

  // Find the applicable tax bracket
  const bracket = ISR_QUINCENAL_2026.find(
    b => income >= b.lowerLimit && income <= b.upperLimit
  );

  if (!bracket) return 0;

  // Calculate ISR: ((Income - Lower Limit) × Rate) + Fixed Amount
  const excessIncome = income - bracket.lowerLimit;
  const marginalTax = excessIncome * bracket.rate;
  const totalTax = marginalTax + bracket.fixedAmount;
  
  // Apply subsidy (subsidio para el empleo)
  const isrAfterSubsidy = Math.max(0, totalTax - bracket.subsidy);

  return Math.round(isrAfterSubsidy * 100) / 100;
}

/**
 * Calculate IMSS Employee Contribution
 * 
 * IMSS breakdown (employee portion):
 * - Enfermedades y Maternidad: 0.375%
 * - Invalidez y Vida: 0.625%
 * - Cesantía y Vejez: 1.125%
 * - TOTAL: ~2.375% (we'll use 2.5% to be conservative)
 * 
 * @param {number} dailySalary - Daily salary
 * @returns {number} IMSS employee contribution (quincenal)
 */
function calculateIMSSEmployee(dailySalary) {
  // Cap at 25 UMAs for IMSS calculations
  const maxSalary = UMA_DAILY_2026 * 25;
  const cappedDailySalary = Math.min(dailySalary, maxSalary);
  
  // Employee contribution: 2.375% of daily salary × 15 days (quincena)
  const imssRate = 0.02375; // 2.375%
  const quincenal = cappedDailySalary * 15 * imssRate;
  
  return Math.round(quincenal * 100) / 100;
}

/**
 * Calculate IMSS Employer Contribution (for reference/accounting)
 * 
 * Employer pays approximately 7.58% total:
 * - Enfermedades y Maternidad: 1.05%
 * - Invalidez y Vida: 1.75%
 * - Cesantía y Vejez: 3.15%
 * - Riesgos de Trabajo: 0.50% - 7.58% (we'll use 0.5%)
 * - Guarderías: 1.00%
 * - Retiro: 2.00%
 * - INFONAVIT: 5.00%
 * 
 * @param {number} dailySalary - Daily salary
 * @returns {object} Breakdown of employer contributions
 */
function calculateIMSSEmployer(dailySalary) {
  const maxSalary = UMA_DAILY_2026 * 25;
  const cappedDailySalary = Math.min(dailySalary, maxSalary);
  
  const breakdown = {
    imssEmployer: Math.round(cappedDailySalary * 15 * 0.0758 * 100) / 100, // 7.58%
    infonavit: Math.round(cappedDailySalary * 15 * 0.05 * 100) / 100,      // 5.00%
  };
  
  breakdown.total = breakdown.imssEmployer + breakdown.infonavit;
  
  return breakdown;
}

/**
 * Calculate complete payroll for an employee (quincenal)
 * @param {number} monthlyWage - Employee's monthly wage
 * @param {object} additions - Optional additions (overtime, bonuses, etc.)
 * @returns {object} Complete payroll calculation
 */
function calculateQuincenalPayroll(monthlyWage, additions = {}) {
  // Base calculations
  const baseSalary = Math.round((monthlyWage / 2) * 100) / 100;
  const dailySalary = Math.round((monthlyWage / 30) * 100) / 100;
  
  // Additions (optional)
  const overtimePay = parseFloat(additions.overtimePay) || 0;
  const bonuses = parseFloat(additions.bonuses) || 0;
  const commissions = parseFloat(additions.commissions) || 0;
  const otherEarnings = parseFloat(additions.otherEarnings) || 0;
  
  // Gross pay (base + all additions)
  const grossPay = baseSalary + overtimePay + bonuses + commissions + otherEarnings;
  
  // Calculate deductions
  const isrTax = calculateISRQuincenal(grossPay);
  const imssEmployee = calculateIMSSEmployee(dailySalary);
  const infonavit = parseFloat(additions.infonavit) || 0;
  const loansDeduction = parseFloat(additions.loansDeduction) || 0;
  const otherDeductions = parseFloat(additions.otherDeductions) || 0;
  
  // Total deductions
  const totalDeductions = isrTax + imssEmployee + infonavit + loansDeduction + otherDeductions;
  
  // Net pay
  const netPay = Math.round((grossPay - totalDeductions) * 100) / 100;
  
  // Employer costs (for reference)
  const employerCosts = calculateIMSSEmployer(dailySalary);
  
  return {
    // Earnings
    baseSalary,
    dailySalary,
    overtimePay,
    bonuses,
    commissions,
    otherEarnings,
    grossPay,
    
    // Deductions
    isrTax,
    imssEmployee,
    infonavit,
    loansDeduction,
    otherDeductions,
    totalDeductions,
    
    // Net
    netPay,
    
    // Employer costs (for accounting)
    employerCosts
  };
}

module.exports = {
  UMA_DAILY_2026,
  UMA_MONTHLY_2026,
  calculateISRQuincenal,
  calculateIMSSEmployee,
  calculateIMSSEmployer,
  calculateQuincenalPayroll
};
