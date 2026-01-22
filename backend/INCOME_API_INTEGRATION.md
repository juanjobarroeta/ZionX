# 💰 Income Management API Integration Guide

## Quick Start

### 1. Apply Database Schema

```bash
# From backend directory
psql $DATABASE_URL -f income-management-schema.sql
```

### 2. Integrate Routes into index.js

Add this code to your `backend/index.js`:

```javascript
// ==========================================
// INCOME MANAGEMENT ROUTES
// ==========================================

// Helper function for IVA calculation (16%)
const IVA_RATE = 0.16;

function calculateIVA(amount) {
  return Math.round(amount * IVA_RATE * 100) / 100;
}

function calculateInvoiceTotals(subtotal, discountAmount = 0) {
  const subtotalAfterDiscount = subtotal - discountAmount;
  const taxAmount = calculateIVA(subtotalAfterDiscount);
  const total = subtotalAfterDiscount + taxAmount;
  
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.round(discountAmount * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    total: Math.round(total * 100) / 100
  };
}

async function generateInvoiceNumber(pool) {
  const result = await pool.query(`
    SELECT 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || 
           LPAD((COUNT(*) + 1)::text, 4, '0') as invoice_number
    FROM invoices 
    WHERE EXTRACT(YEAR FROM invoice_date) = EXTRACT(YEAR FROM CURRENT_DATE)
  `);
  return result.rows[0].invoice_number;
}

// Mount income routes - PASTE ROUTE CODE BELOW
// (See ROUTE_EXAMPLES.md for all routes)

// Example: Service Packages
app.get('/api/income/packages', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM service_packages 
      WHERE is_active = true 
      ORDER BY display_order, base_price
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching packages:', error);
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
});

// Add all other routes from the route files...
```

---

## 📚 Complete API Reference

### Service Packages

#### `GET /api/income/packages`
Get all active service packages.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Plan Profesional",
    "description": "Gestión completa con estrategia",
    "base_price": 12000.00,
    "billing_cycle": "monthly",
    "posts_per_month": 20,
    "platforms_included": ["instagram", "facebook", "tiktok"],
    "features": {...}
  }
]
```

#### `POST /api/income/packages`
Create new service package.

**Request:**
```json
{
  "name": "Plan Básico",
  "description": "Gestión básica de redes sociales",
  "base_price": 5000.00,
  "billing_cycle": "monthly",
  "posts_per_month": 12,
  "platforms_included": ["instagram", "facebook"]
}
```

---

### Add-ons

#### `GET /api/income/addons`
Get all active add-ons (optionally filter by category).

**Query Parameters:**
- `category` (optional): Filter by category

**Response:**
```json
[
  {
    "id": 1,
    "name": "Post Extra",
    "category": "content",
    "price": 500.00,
    "pricing_type": "per_unit",
    "billing_frequency": "one-time"
  }
]
```

#### `POST /api/income/addons`
Create new add-on.

---

### Customer Subscriptions

#### `GET /api/income/subscriptions`
Get all subscriptions.

**Query Parameters:**
- `customer_id`: Filter by customer
- `status`: Filter by status (active, paused, cancelled, expired)

#### `POST /api/income/subscriptions`
Create customer subscription.

**Request:**
```json
{
  "customer_id": 15,
  "service_package_id": 2,
  "start_date": "2025-02-01",
  "custom_monthly_price": 10000.00,
  "notes": "Special pricing for 6-month contract"
}
```

**Response:**
```json
{
  "id": 42,
  "customer_id": 15,
  "service_package_id": 2,
  "status": "active",
  "start_date": "2025-02-01",
  "next_billing_date": "2025-03-01",
  "custom_monthly_price": 10000.00
}
```

#### `POST /api/income/subscriptions/:id/cancel`
Cancel a subscription.

---

### Add-on Purchases

#### `GET /api/income/addon-purchases/unbilled`
Get add-ons that haven't been invoiced yet.

**Query Parameters:**
- `customer_id`: Filter by customer

#### `POST /api/income/addon-purchases`
Purchase an add-on for a customer.

**Request:**
```json
{
  "customer_id": 15,
  "addon_id": 1,
  "quantity": 5,
  "description": "5 posts extras para campaña Navidad",
  "project_id": 88
}
```

**Response (includes IVA calculation):**
```json
{
  "id": 123,
  "customer_id": 15,
  "addon_id": 1,
  "quantity": 5,
  "unit_price": 500.00,
  "total_price": 2500.00,
  "status": "approved",
  "addon_name": "Post Extra"
}
```

#### `POST /api/income/addon-purchases/:id/approve`
Approve a pending add-on purchase (if requires_approval).

---

### Invoices

#### `GET /api/income/invoices`
Get all invoices.

**Query Parameters:**
- `customer_id`: Filter by customer
- `status`: Filter by status
- `from_date`: Start date
- `to_date`: End date

#### `GET /api/income/invoices/:id`
Get single invoice with line items and payments.

**Response:**
```json
{
  "id": 1,
  "invoice_number": "INV-2025-0001",
  "customer_id": 15,
  "customer_name": "Juan Pérez",
  "invoice_date": "2025-02-01",
  "due_date": "2025-02-16",
  "subtotal": 17000.00,
  "tax_percentage": 16,
  "tax_amount": 2720.00,
  "total": 19720.00,
  "amount_paid": 0,
  "amount_due": 19720.00,
  "status": "sent",
  "items": [
    {
      "item_type": "subscription",
      "description": "Plan Profesional - Febrero 2025",
      "quantity": 1,
      "unit_price": 12000.00,
      "total": 12000.00
    },
    {
      "item_type": "addon",
      "description": "5 posts extras",
      "quantity": 5,
      "unit_price": 500.00,
      "total": 2500.00
    },
    {
      "item_type": "addon",
      "description": "Campaña WhatsApp",
      "quantity": 1,
      "unit_price": 2500.00,
      "total": 2500.00
    }
  ],
  "payments": []
}
```

#### `POST /api/income/invoices/generate`
Generate invoice (manual or automated).

**Request:**
```json
{
  "customer_id": 15,
  "subscription_id": 42,
  "billing_period_start": "2025-02-01",
  "billing_period_end": "2025-02-28",
  "include_unbilled_addons": true,
  "include_unbilled_hours": true,
  "include_unbilled_expenses": true,
  "custom_items": [
    {
      "description": "Servicio especial",
      "quantity": 1,
      "unit_price": 3000.00
    }
  ],
  "notes": "Factura mensual Febrero 2025",
  "auto_send": false
}
```

**Response (includes IVA breakdown):**
```json
{
  "invoice_id": 1,
  "invoice_number": "INV-2025-0001",
  "customer_id": 15,
  "subtotal": 17000.00,
  "iva": 2720.00,
  "total": 19720.00,
  "line_items": [...],
  "status": "draft"
}
```

**IVA Calculation Example:**
```
Subtotal:  $17,000.00
IVA (16%):  $2,720.00
-------------------
Total:     $19,720.00
```

#### `POST /api/income/invoices/:id/send`
Mark invoice as sent (and optionally send via email/WhatsApp).

**Request:**
```json
{
  "send_email": true,
  "send_whatsapp": true
}
```

#### `POST /api/income/invoices/:id/cancel`
Cancel an invoice (only if no payments recorded).

---

### Payments

#### `GET /api/income/payments`
Get all invoice payments.

**Query Parameters:**
- `invoice_id`: Filter by invoice
- `customer_id`: Filter by customer
- `from_date`: Start date
- `to_date`: End date

#### `POST /api/income/invoices/:id/payment`
Record a payment for an invoice.

**Request:**
```json
{
  "amount": 19720.00,
  "payment_method": "transferencia",
  "payment_date": "2025-02-10",
  "reference_number": "REF-12345",
  "notes": "Pago completo vía transferencia"
}
```

**Response:**
```json
{
  "payment_id": 1,
  "invoice_id": 1,
  "invoice_number": "INV-2025-0001",
  "payment_amount": 19720.00,
  "new_amount_paid": 19720.00,
  "amount_remaining": 0,
  "invoice_status": "paid"
}
```

**Automatic IVA Accounting:**
When payment is recorded, the system automatically:
1. Calculates proportional IVA in the payment
2. Creates journal entries:
   - Debit: Bank/Cash Account (1002 or 1001)
   - Credit: Customer Receivables (1103-XXXX)
3. Updates invoice status to "paid" or "partial"

**Partial Payment Example:**
```json
{
  "amount": 10000.00,
  "payment_method": "transferencia",
  "reference_number": "REF-001"
}
```
Response shows:
```json
{
  "payment_amount": 10000.00,
  "new_amount_paid": 10000.00,
  "amount_remaining": 9720.00,
  "invoice_status": "partial"
}
```

#### `DELETE /api/income/payments/:id`
Void a payment (admin only, reverses accounting entries).

---

### Revenue & Analytics

#### `GET /api/income/revenue/summary`
Monthly revenue breakdown.

**Query Parameters:**
- `year`: Filter by year
- `month`: Specific month (1-12)

**Response:**
```json
[
  {
    "month": "2025-02",
    "invoice_count": 15,
    "subtotal": 180000.00,
    "tax": 28800.00,
    "total_billed": 208800.00,
    "total_paid": 195000.00,
    "confirmed_revenue": 195000.00
  }
]
```

#### `GET /api/income/revenue/mrr`
Get Monthly Recurring Revenue.

**Response:**
```json
{
  "mrr": 125000.00,
  "active_subscriptions": 12,
  "arpu": 10416.67
}
```

#### `GET /api/income/revenue/by-customer`
Revenue breakdown by customer.

**Response:**
```json
[
  {
    "id": 15,
    "customer_name": "Juan Pérez",
    "invoice_count": 8,
    "total_billed": 157760.00,
    "total_paid": 157760.00,
    "outstanding": 0,
    "last_invoice_date": "2025-02-01"
  }
]
```

#### `GET /api/income/revenue/addon-performance`
Add-on sales performance.

**Response:**
```json
[
  {
    "id": 1,
    "addon_name": "Post Extra",
    "category": "content",
    "base_price": 500.00,
    "times_purchased": 25,
    "total_quantity": 87,
    "total_revenue": 43500.00,
    "avg_revenue_per_purchase": 1740.00
  }
]
```

#### `GET /api/income/dashboard`
Overview dashboard data.

**Response:**
```json
{
  "mrr": 125000.00,
  "total_outstanding": 45000.00,
  "overdue_amount": 12000.00,
  "overdue_count": 3,
  "revenue_this_month": 180000.00,
  "revenue_last_month": 165000.00,
  "month_over_month_growth": 9.09,
  "invoices_this_month": 15,
  "active_subscriptions": 12,
  "annual_run_rate": 1500000.00
}
```

---

## 🔄 Common Workflows

### 1. New Customer Onboarding

```javascript
// 1. Customer signs up for Plan Profesional
POST /api/income/subscriptions
{
  "customer_id": 15,
  "service_package_id": 2, // Plan Profesional
  "start_date": "2025-02-01"
}

// 2. Generate first invoice
POST /api/income/invoices/generate
{
  "customer_id": 15,
  "subscription_id": 42,
  "billing_period_start": "2025-02-01",
  "billing_period_end": "2025-02-28",
  "auto_send": true
}

// Response includes IVA:
// Subtotal: $12,000.00
// IVA (16%): $1,920.00
// Total: $13,920.00

// 3. Customer pays
POST /api/income/invoices/1/payment
{
  "amount": 13920.00,
  "payment_method": "transferencia",
  "reference_number": "BANK-REF-123"
}
```

### 2. Monthly Billing with Add-ons

```javascript
// During the month, customer requests extra work
POST /api/income/addon-purchases
{
  "customer_id": 15,
  "subscription_id": 42,
  "addon_id": 1, // Post Extra
  "quantity": 5
}

POST /api/income/addon-purchases
{
  "customer_id": 15,
  "subscription_id": 42,
  "addon_id": 16, // Campaña WhatsApp
  "quantity": 1
}

// At month end, generate invoice (auto-includes addons)
POST /api/income/invoices/generate
{
  "customer_id": 15,
  "subscription_id": 42,
  "billing_period_start": "2025-03-01",
  "billing_period_end": "2025-03-31",
  "include_unbilled_addons": true
}

// Result:
// Plan Profesional: $12,000
// 5x Post Extra: $2,500
// Campaña WhatsApp: $2,500
// Subtotal: $17,000
// IVA (16%): $2,720
// Total: $19,720
```

### 3. Partial Payments

```javascript
// Customer pays half now
POST /api/income/invoices/2/payment
{
  "amount": 9860.00,
  "payment_method": "transferencia"
}
// Invoice status: "partial"

// Customer pays rest later
POST /api/income/invoices/2/payment
{
  "amount": 9860.00,
  "payment_method": "transferencia"
}
// Invoice status: "paid"
```

---

## 🎯 IVA (Mexican VAT) Handling

### Automatic IVA Calculation

**All monetary amounts are handled with IVA:**

```javascript
const IVA_RATE = 0.16; // 16%

function calculateInvoiceTotals(subtotal) {
  const taxAmount = subtotal * 0.16;
  const total = subtotal + taxAmount;
  
  return {
    subtotal: 10000.00,
    iva: 1600.00,
    total: 11600.00
  };
}
```

### Invoice Totals Always Include IVA

```json
{
  "subtotal": 10000.00,
  "tax_percentage": 16,
  "tax_amount": 1600.00,
  "total": 11600.00
}
```

### Accounting Entries with IVA

When invoice is generated:
```
Debit:  Cuentas por Cobrar (1103-XXXX)  $11,600
Credit: Ingresos (4002)                  $10,000
Credit: IVA por Pagar (2003)              $1,600
```

When payment is received:
```
Debit:  Bancos (1002)                    $11,600
Credit: Cuentas por Cobrar (1103-XXXX)  $11,600
```

---

## 🚀 Testing the API

### Using curl

```bash
# Get all packages
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/income/packages

# Create subscription
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"customer_id":15,"service_package_id":2}' \
  http://localhost:3000/api/income/subscriptions

# Generate invoice
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"customer_id":15,"subscription_id":42}' \
  http://localhost:3000/api/income/invoices/generate

# Record payment
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount":13920,"payment_method":"transferencia"}' \
  http://localhost:3000/api/income/invoices/1/payment
```

---

## 📝 Notes

1. **All prices in MXN** (Mexican Pesos)
2. **IVA is always 16%** (configurable via IVA_RATE constant)
3. **Invoice numbers auto-increment** per year (INV-2025-0001, INV-2025-0002, etc.)
4. **Accounting entries created automatically** for invoices and payments
5. **Partial payments supported**
6. **Custom pricing per customer** via custom_monthly_price
7. **Add-ons can be one-time or recurring**
8. **All monetary calculations rounded to 2 decimals**

---

Ready to use! 🎉

