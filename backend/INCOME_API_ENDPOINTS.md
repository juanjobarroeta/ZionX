# 💰 Income Management API - Complete Reference

## 🇲🇽 IVA Handling
All invoices automatically calculate **16% IVA (Mexican VAT)**:
- Subtotal: Sum of all line items (before tax)
- IVA: 16% of subtotal
- Total: Subtotal + IVA

Example:
```
Subtotal: $10,000.00 MXN
IVA (16%): $1,600.00 MXN
Total: $11,600.00 MXN
```

---

## 📦 Service Packages

### `GET /api/income/packages`
Get all active service packages.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Plan Profesional",
    "base_price": 12000.00,
    "posts_per_month": 20,
    "platforms_included": ["instagram", "facebook", "tiktok"]
  }
]
```

### `POST /api/income/packages`
Create new service package.

**Request:**
```json
{
  "name": "Plan Empresarial",
  "description": "Para grandes empresas",
  "base_price": 35000.00,
  "posts_per_month": 50,
  "platforms_included": ["instagram", "facebook", "tiktok", "linkedin"],
  "reels_per_month": 15,
  "features": {
    "community_management": true,
    "paid_ads": true,
    "dedicated_manager": true
  }
}
```

### `PUT /api/income/packages/:id`
Update service package.

---

## ➕ Add-ons

### `GET /api/income/addons`
Get all add-ons (optionally filter by category).

**Query Params:**
- `category` - Filter by category (content, design, video, ads, consulting)

**Response:**
```json
[
  {
    "id": 1,
    "name": "Post Extra",
    "category": "content",
    "price": 500.00,
    "pricing_type": "per_unit"
  }
]
```

### `GET /api/income/addons/categories`
Get unique addon categories.

### `POST /api/income/addons`
Create new add-on.

**Request:**
```json
{
  "name": "Campaña Email Marketing",
  "description": "Diseño y envío de campaña de email",
  "category": "marketing",
  "price": 3500.00,
  "pricing_type": "fixed",
  "billing_frequency": "one-time"
}
```

### `PUT /api/income/addons/:id`
Update add-on.

---

## 📋 Customer Subscriptions

### `GET /api/income/subscriptions`
Get all subscriptions.

**Query Params:**
- `customer_id` - Filter by customer
- `status` - Filter by status (active, paused, cancelled)

**Response:**
```json
[
  {
    "id": 1,
    "customer_id": 15,
    "customer_name": "Juan Pérez",
    "package_name": "Plan Profesional",
    "effective_monthly_price": 12000.00,
    "status": "active",
    "next_billing_date": "2025-03-01"
  }
]
```

### `GET /api/income/subscriptions/active`
Get active subscriptions (uses optimized view).

### `POST /api/income/subscriptions`
Create customer subscription.

**Request:**
```json
{
  "customer_id": 15,
  "service_package_id": 2,
  "start_date": "2025-02-01",
  "custom_monthly_price": 10000.00,
  "notes": "Precio especial por contrato de 12 meses"
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

### `PUT /api/income/subscriptions/:id`
Update subscription (change price, status, etc).

### `POST /api/income/subscriptions/:id/cancel`
Cancel subscription.

---

## 🛒 Add-on Purchases

### `GET /api/income/addon-purchases`
Get addon purchases.

**Query Params:**
- `customer_id` - Filter by customer
- `status` - Filter by status
- `billing_period` - Filter by period (YYYY-MM)

### `GET /api/income/addon-purchases/unbilled`
Get add-ons that haven't been invoiced yet.

**Query Params:**
- `customer_id` - Filter by customer

**Response:**
```json
[
  {
    "id": 88,
    "customer_id": 15,
    "addon_name": "Post Extra",
    "quantity": 5,
    "unit_price": 500.00,
    "total_price": 2500.00,
    "status": "approved"
  }
]
```

### `POST /api/income/addon-purchases`
Purchase addon for customer.

**Request:**
```json
{
  "customer_id": 15,
  "addon_id": 1,
  "quantity": 5,
  "description": "5 posts extra para campaña Black Friday",
  "project_id": 42
}
```

**IVA Note:** IVA is not calculated at purchase time - it's calculated when the addon is added to an invoice.

### `POST /api/income/addon-purchases/:id/approve`
Approve pending addon (if requires approval).

### `DELETE /api/income/addon-purchases/:id`
Cancel addon purchase (only if not invoiced).

---

## 📄 Invoices

### `GET /api/income/invoices`
Get all invoices with filters.

**Query Params:**
- `customer_id` - Filter by customer
- `status` - Filter by status
- `from_date` - Start date (YYYY-MM-DD)
- `to_date` - End date (YYYY-MM-DD)

**Response:**
```json
[
  {
    "id": 1,
    "invoice_number": "INV-2025-0001",
    "customer_name": "Juan Pérez",
    "invoice_date": "2025-02-01",
    "due_date": "2025-02-16",
    "subtotal": 14500.00,
    "tax_amount": 2320.00,
    "total": 16820.00,
    "amount_paid": 0,
    "amount_due": 16820.00,
    "current_status": "sent"
  }
]
```

### `GET /api/income/invoices/pending`
Get pending/unpaid invoices (uses optimized view).

### `GET /api/income/invoices/overdue`
Get overdue invoices.

**Response includes `days_overdue` field.**

### `GET /api/income/invoices/:id`
Get single invoice with full details.

**Response:**
```json
{
  "id": 1,
  "invoice_number": "INV-2025-0001",
  "customer_name": "Juan Pérez",
  "customer_email": "juan@empresa.com",
  "subtotal": 14500.00,
  "tax_percentage": 16,
  "tax_amount": 2320.00,
  "total": 16820.00,
  "amount_paid": 8410.00,
  "amount_due": 8410.00,
  "status": "partial",
  "items": [
    {
      "id": 1,
      "item_type": "subscription",
      "description": "Plan Profesional - Febrero 2025",
      "quantity": 1,
      "unit_price": 12000.00,
      "total": 12000.00
    },
    {
      "id": 2,
      "item_type": "addon",
      "description": "Post Extra",
      "quantity": 5,
      "unit_price": 500.00,
      "total": 2500.00
    }
  ],
  "payments": [
    {
      "id": 1,
      "amount": 8410.00,
      "payment_method": "transferencia",
      "payment_date": "2025-02-05",
      "reference_number": "REF-12345"
    }
  ]
}
```

### `POST /api/income/invoices/generate`
Generate invoice for customer (auto-includes unbilled items).

**Request:**
```json
{
  "customer_id": 15,
  "subscription_id": 42,
  "billing_period_start": "2025-02-01",
  "billing_period_end": "2025-02-28",
  "due_days": 15,
  "include_unbilled_addons": true,
  "include_unbilled_hours": true,
  "include_unbilled_expenses": true,
  "custom_items": [
    {
      "description": "Consultoría especial",
      "quantity": 1,
      "unit_price": 5000.00
    }
  ],
  "notes": "Factura mensual Febrero",
  "auto_send": false
}
```

**Response:**
```json
{
  "invoice_id": 1,
  "invoice_number": "INV-2025-0001",
  "customer_id": 15,
  "subtotal": 19500.00,
  "iva": 3120.00,
  "total": 22620.00,
  "line_items": [
    {
      "type": "subscription",
      "description": "Plan Profesional",
      "amount": 12000.00
    },
    {
      "type": "addon",
      "description": "Post Extra (x5)",
      "amount": 2500.00
    },
    {
      "type": "custom",
      "description": "Consultoría especial",
      "amount": 5000.00
    }
  ],
  "status": "draft"
}
```

**IVA Accounting:**
When invoice is generated, creates journal entries:
```
Debit: Cuentas por Cobrar (1103-XXXX)  $22,620.00
Credit: Ingresos por Ventas (4002)     $19,500.00
Credit: IVA por Cobrar (2003)           $3,120.00
```

### `POST /api/income/invoices/:id/send`
Mark invoice as sent (ready to send to customer).

**Request:**
```json
{
  "send_email": true,
  "send_whatsapp": true
}
```

### `POST /api/income/invoices/:id/cancel`
Cancel an invoice (must have no payments).

---

## 💳 Payments

### `GET /api/income/payments`
Get all payments.

**Query Params:**
- `invoice_id`
- `customer_id`
- `from_date`
- `to_date`

### `POST /api/income/invoices/:id/payment`
Record payment for an invoice.

**Request:**
```json
{
  "amount": 11600.00,
  "payment_method": "transferencia",
  "payment_date": "2025-02-15",
  "reference_number": "REF-54321",
  "notes": "Pago de 50% de la factura"
}
```

**Response:**
```json
{
  "payment_id": 1,
  "invoice_id": 1,
  "invoice_number": "INV-2025-0001",
  "payment_amount": 11600.00,
  "new_amount_paid": 11600.00,
  "amount_remaining": 11020.00,
  "invoice_status": "partial"
}
```

**IVA Accounting:**
When payment is recorded, creates journal entries:
```
Debit: Bancos (1002)                    $11,600.00
Credit: Cuentas por Cobrar (1103-XXXX)  $11,600.00
```

The IVA was already recognized when invoice was generated, so payment just moves cash in and reduces receivable.

### `DELETE /api/income/payments/:id`
Void a payment (admin only).

---

## 📊 Revenue & Analytics

### `GET /api/income/revenue/summary`
Get monthly revenue summary (uses view).

**Query Params:**
- `year` - Filter by year
- `month` - Filter by specific month

**Response:**
```json
[
  {
    "month": "2025-02",
    "invoice_count": 15,
    "subtotal": 180000.00,
    "tax": 28800.00,
    "total_billed": 208800.00,
    "total_paid": 150000.00,
    "confirmed_revenue": 150000.00
  }
]
```

### `GET /api/income/revenue/mrr`
Get Monthly Recurring Revenue.

**Response:**
```json
{
  "mrr": 125000.00,
  "active_subscriptions": 12,
  "arpu": 10416.67
}
```

**Metrics:**
- `mrr` - Monthly Recurring Revenue (total of all active subscriptions)
- `active_subscriptions` - Number of active subscriptions
- `arpu` - Average Revenue Per User (MRR / active subscriptions)

### `GET /api/income/revenue/by-customer`
Top customers by revenue.

**Query Params:**
- `limit` - Number of results (default: 10)

**Response:**
```json
[
  {
    "id": 15,
    "customer_name": "Empresa ABC",
    "invoice_count": 8,
    "total_billed": 156000.00,
    "total_paid": 140000.00,
    "outstanding": 16000.00,
    "last_invoice_date": "2025-02-01"
  }
]
```

### `GET /api/income/revenue/addon-performance`
Add-on sales performance.

**Response:**
```json
[
  {
    "addon_name": "Post Extra",
    "category": "content",
    "base_price": 500.00,
    "times_purchased": 45,
    "total_quantity": 128,
    "total_revenue": 64000.00,
    "avg_revenue_per_purchase": 1422.22
  }
]
```

### `GET /api/income/dashboard`
Overview dashboard with key metrics.

**Response:**
```json
{
  "mrr": 125000.00,
  "total_outstanding": 85000.00,
  "overdue_amount": 15000.00,
  "overdue_count": 3,
  "revenue_this_month": 145000.00,
  "revenue_last_month": 120000.00,
  "month_over_month_growth": 20.83,
  "invoices_this_month": 12,
  "active_subscriptions": 12,
  "annual_run_rate": 1500000.00
}
```

---

## 🔄 Complete Workflow Examples

### Example 1: New Customer with Monthly Retainer

```javascript
// 1. Create subscription
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
  "notes": "Primera factura - Bienvenido!"
}

// Result:
// Invoice INV-2025-0001
// Subtotal: $12,000.00
// IVA (16%): $1,920.00
// Total: $13,920.00

// 3. Customer pays
POST /api/income/invoices/1/payment
{
  "amount": 13920.00,
  "payment_method": "transferencia",
  "reference_number": "BBVA-12345"
}
```

### Example 2: Customer Needs Add-ons

```javascript
// 1. Purchase add-ons
POST /api/income/addon-purchases
{
  "customer_id": 15,
  "addon_id": 1, // Post Extra
  "quantity": 5,
  "description": "5 posts para campaña Black Friday"
}

POST /api/income/addon-purchases
{
  "customer_id": 15,
  "addon_id": 16, // Campaña WhatsApp
  "quantity": 1
}

// 2. Generate invoice (includes subscription + add-ons)
POST /api/income/invoices/generate
{
  "customer_id": 15,
  "subscription_id": 42,
  "billing_period_start": "2025-02-01",
  "billing_period_end": "2025-02-28",
  "include_unbilled_addons": true
}

// Result:
// Line items:
// - Plan Profesional: $12,000.00
// - Post Extra (x5): $2,500.00
// - Campaña WhatsApp: $2,500.00
// Subtotal: $17,000.00
// IVA (16%): $2,720.00
// Total: $19,720.00
```

### Example 3: Partial Payment

```javascript
// Customer pays 50% now
POST /api/income/invoices/1/payment
{
  "amount": 9860.00,
  "payment_method": "transferencia",
  "notes": "Pago parcial - 50%"
}

// Invoice status changes to 'partial'
// Amount remaining: $9,860.00

// Later, customer pays rest
POST /api/income/invoices/1/payment
{
  "amount": 9860.00,
  "payment_method": "transferencia"
}

// Invoice status changes to 'paid'
```

### Example 4: Custom Invoice (No Subscription)

```javascript
// One-time project
POST /api/income/invoices/generate
{
  "customer_id": 15,
  "custom_items": [
    {
      "description": "Diseño de Sitio Web Corporativo",
      "quantity": 1,
      "unit_price": 45000.00
    },
    {
      "description": "Manual de Marca",
      "quantity": 1,
      "unit_price": 15000.00
    }
  ],
  "due_days": 30,
  "notes": "Proyecto especial - Web + Branding"
}

// Result:
// Subtotal: $60,000.00
// IVA (16%): $9,600.00
// Total: $69,600.00
```

---

## 📈 Revenue Analytics Queries

### Get This Month's Revenue
```javascript
GET /api/income/revenue/summary?month=2&year=2025
```

### Top 5 Customers
```javascript
GET /api/income/revenue/by-customer?limit=5
```

### Best Selling Add-ons
```javascript
GET /api/income/revenue/addon-performance
```

### Dashboard Overview
```javascript
GET /api/income/dashboard
```

---

## 🔐 Authentication

All endpoints require JWT authentication token in header:
```
Authorization: Bearer <your_jwt_token>
```

---

## 🧮 IVA Calculation Details

### On Invoice Generation
```javascript
// Given items totaling $10,000.00
Subtotal: $10,000.00
IVA (16%): $1,600.00 
Total: $11,600.00

// Accounting entries:
Debit: Cuentas por Cobrar 1103-XXXX  $11,600.00
Credit: Ingresos por Ventas 4002      $10,000.00
Credit: IVA por Cobrar 2003            $1,600.00
```

### On Payment Received
```javascript
// Customer pays $11,600.00
// Accounting entries:
Debit: Bancos 1002                    $11,600.00
Credit: Cuentas por Cobrar 1103-XXXX  $11,600.00

// IVA already recognized at invoice time
// No additional IVA entry needed
```

### On Partial Payment
```javascript
// Invoice total: $11,600.00 (includes $1,600 IVA)
// Customer pays: $5,800.00 (50%)

// System calculates proportional IVA:
Revenue portion: $5,000.00 (50% of $10,000)
IVA portion: $800.00 (50% of $1,600)

// Accounting entries:
Debit: Bancos 1002                    $5,800.00
Credit: Cuentas por Cobrar 1103-XXXX  $5,800.00
```

---

## ⚠️ Important Notes

1. **IVA is always 16%** - Hard-coded for Mexican tax law
2. **IVA calculated on invoice generation** - Not on addon purchase
3. **Partial payments track IVA proportionally** - For accounting accuracy
4. **Custom pricing overrides package price** - Use for special deals
5. **Addon approval workflow** - Set `requires_approval: true` for expensive items
6. **Unbilled items auto-included** - System finds all unbilled addons/hours/expenses

---

## 🚀 Next: Frontend Integration

Ready-to-use endpoints for building:
- Income Dashboard
- Invoice Manager
- Subscription Manager
- Add-on Catalog
- Payment Recorder
- Revenue Reports





