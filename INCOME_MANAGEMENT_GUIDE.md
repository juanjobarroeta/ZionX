# 💰 Income Management System - Marketing Agency

## Overview

This income management system is designed specifically for marketing agencies to handle:
- 📦 **Monthly retainer packages** (fixed recurring income)
- ➕ **Add-ons** (extra services billed to clients)
- 📄 **Invoicing** (automated and manual)
- ⏱️ **Billable hours** (consulting, extra work)
- 💸 **Client expenses** (pass-through costs with markup)

---

## 🏗️ System Architecture

### 1. Service Packages (Monthly Retainers)

**Table:** `service_packages`

These are your standard service offerings that clients subscribe to monthly.

**Example Packages:**
```
Plan Básico - $5,000 MXN/month
- 12 posts per month
- Instagram + Facebook
- 3 stories per week
- 2 reels per month
- Monthly report

Plan Profesional - $12,000 MXN/month
- 20 posts per month
- Instagram + Facebook + TikTok
- 7 stories per week
- 6 reels per month
- Community management
- Strategy sessions

Plan Premium - $25,000 MXN/month
- 30 posts per month
- All platforms
- Unlimited revisions
- Paid ads management
- Priority support
```

### 2. Service Add-ons Catalog

**Table:** `service_addons`

Individual services clients can purchase on top of their package.

**Categories:**
- 📱 **Content:** Extra posts, reels, stories
- 🎨 **Design:** Logos, brand manuals, feed redesigns
- 🎬 **Video:** Professional video editing
- 📊 **Ads:** Facebook/Instagram ads management
- 💡 **Consulting:** Strategy sessions, training
- 📸 **Photography:** Professional photo shoots
- ⚡ **Other:** Express delivery, extra revisions

**Pricing Types:**
- `fixed` - One fixed price (e.g., Logo design: $8,000)
- `per_unit` - Price per quantity (e.g., Extra post: $500 each)
- `hourly` - Hourly rate (e.g., Consulting: $1,500/hour)
- `percentage` - Percentage of something (e.g., Ads management: 20% of ad spend)

**Billing Frequency:**
- `one-time` - Billed once when purchased
- `monthly` - Recurring monthly charge
- `per-use` - Billed when used

### 3. Customer Subscriptions

**Table:** `customer_subscriptions`

Links customers to their chosen package with custom pricing if needed.

**Key Features:**
- Override package price for special deals
- Customize included services per client
- Track subscription status and billing dates
- Automatic next billing date calculation

**Subscription Status:**
- `active` - Currently active subscription
- `paused` - Temporarily paused (no billing)
- `cancelled` - Subscription ended
- `expired` - Ended due to non-payment or term completion

### 4. Customer Add-on Purchases

**Table:** `customer_addon_purchases`

Tracks when clients purchase add-ons.

**Workflow:**
1. Team member adds an addon for a customer
2. Optional: Requires approval from manager
3. Addon is included in next invoice
4. Can be one-time or recurring

**Example:**
```sql
-- Client needs 3 extra posts this month
INSERT INTO customer_addon_purchases 
(customer_id, addon_id, quantity, unit_price, total_price, description)
VALUES 
(15, 1, 3, 500.00, 1500.00, '3 posts extra para campaña Navidad');
```

### 5. Invoices

**Table:** `invoices`

The actual billing documents sent to clients.

**Invoice Lifecycle:**
1. `draft` - Being prepared, not sent yet
2. `sent` - Sent to client, awaiting payment
3. `partial` - Partially paid
4. `paid` - Fully paid
5. `overdue` - Past due date and unpaid
6. `cancelled` - Cancelled invoice

**Auto-calculation:**
- Subtotal of all line items
- Tax (IVA 16%)
- Discounts
- Total amount
- Amount due (total - amount paid)

### 6. Invoice Line Items

**Table:** `invoice_items`

Detailed breakdown of what's being billed.

**Item Types:**
- `subscription` - Monthly package fee
- `addon` - Add-on service purchased
- `project` - One-time project
- `hours` - Billable time
- `expense` - Client expense passed through
- `custom` - Manual line item

**Example Invoice:**
```
Cliente: Empresa ABC
Período: Enero 2025

Items:
1. Plan Profesional - Enero 2025          $12,000.00
2. Post Extra (x3)                         $1,500.00
3. Campaña WhatsApp                        $2,500.00
4. Sesión Fotográfica                      $4,000.00
                                          -----------
Subtotal:                                 $20,000.00
IVA (16%):                                 $3,200.00
                                          -----------
TOTAL:                                    $23,200.00
```

### 7. Invoice Payments

**Table:** `invoice_payments`

Track all payments received against invoices (supports partial payments).

**Example:**
```sql
-- Client pays half now, half later
INSERT INTO invoice_payments (invoice_id, amount, payment_method, reference_number)
VALUES (123, 11600.00, 'transferencia', 'REF-001');

-- Later, they pay the rest
INSERT INTO invoice_payments (invoice_id, amount, payment_method, reference_number)
VALUES (123, 11600.00, 'transferencia', 'REF-002');
```

### 8. Billable Time Entries

**Table:** `billable_time_entries`

Track hours worked for hourly billing (consulting, extra revisions, etc.).

**Workflow:**
1. Team member logs time on a task/project
2. System calculates total (hours × rate)
3. Unbilled hours show in "To Invoice" list
4. When invoiced, `is_invoiced = true` and `invoice_id` is set

### 9. Client Expenses (Pass-through)

**Table:** `client_expenses`

Track expenses paid on behalf of client that get billed back.

**Examples:**
- Facebook/Instagram ad spend (with markup)
- Stock photos purchased
- Domain registration
- Software licenses
- Printing costs

**Markup Calculation:**
```
Cost: $5,000 (what you paid)
Markup: 15%
Client Price: $5,750 (what you charge)
```

---

## 🔄 Complete Billing Workflow

### Monthly Retainer Billing

**Automated Process (Recommended):**

1. **Setup** (Once per client)
   ```sql
   -- Create subscription
   INSERT INTO customer_subscriptions 
   (customer_id, service_package_id, next_billing_date)
   VALUES (15, 2, '2025-02-01');
   ```

2. **Auto-generate invoices** (Cron job runs daily)
   - Checks `customer_subscriptions` where `next_billing_date = TODAY`
   - Creates invoice with:
     - Base package as line item
     - Any recurring add-ons
     - Any unbilled time entries
     - Any unbilled client expenses
   - Updates `next_billing_date` to next month
   - Sends invoice via email/WhatsApp

3. **Manual add-ons during month**
   ```sql
   -- Client requests 5 extra posts
   INSERT INTO customer_addon_purchases 
   (customer_id, subscription_id, addon_id, quantity, unit_price, total_price)
   VALUES (15, 42, 1, 5, 500.00, 2500.00);
   ```
   These get included in the next invoice automatically.

### One-Time Project Billing

```sql
-- 1. Create invoice manually
INSERT INTO invoices (customer_id, invoice_number, invoice_date, due_date)
VALUES (15, 'INV-2025-001', CURRENT_DATE, CURRENT_DATE + 30);

-- 2. Add line items
INSERT INTO invoice_items (invoice_id, item_type, description, quantity, unit_price, subtotal, total)
VALUES 
(1, 'project', 'Diseño de Sitio Web Corporativo', 1, 45000.00, 45000.00, 45000.00),
(1, 'addon', 'Manual de Marca Completo', 1, 15000.00, 15000.00, 15000.00);

-- 3. System auto-calculates totals (via trigger or API)
UPDATE invoices SET 
  subtotal = 60000.00,
  tax_amount = 9600.00,
  total = 69600.00
WHERE id = 1;

-- 4. Mark as sent
UPDATE invoices SET status = 'sent', sent_at = NOW() WHERE id = 1;
```

### Recording Payment

```sql
-- Client pays invoice
INSERT INTO invoice_payments (invoice_id, amount, payment_method, payment_date, reference_number)
VALUES (1, 69600.00, 'transferencia', CURRENT_DATE, 'REF-12345');

-- Update invoice status
UPDATE invoices SET 
  amount_paid = 69600.00,
  status = 'paid',
  paid_at = NOW()
WHERE id = 1;

-- Create accounting entries (journal_entries table)
-- Debit: Bank Account
-- Credit: Revenue Account
```

---

## 📊 Reports & Analytics

### Revenue by Month
```sql
SELECT * FROM v_monthly_revenue;
```

### Pending Invoices
```sql
SELECT * FROM v_pending_invoices 
WHERE current_status = 'overdue'
ORDER BY due_date;
```

### Customer Revenue Summary
```sql
SELECT 
  c.id,
  c.first_name || ' ' || c.last_name as customer_name,
  COUNT(DISTINCT i.id) as invoice_count,
  SUM(i.total) as total_billed,
  SUM(i.amount_paid) as total_paid,
  SUM(i.total - i.amount_paid) as outstanding
FROM customers c
LEFT JOIN invoices i ON c.id = i.customer_id
WHERE i.status != 'cancelled'
GROUP BY c.id, customer_name
ORDER BY total_billed DESC;
```

### Add-on Sales Report
```sql
SELECT 
  sa.name as addon_name,
  sa.category,
  COUNT(*) as times_sold,
  SUM(cap.quantity) as total_quantity,
  SUM(cap.total_price) as total_revenue
FROM customer_addon_purchases cap
JOIN service_addons sa ON cap.addon_id = sa.id
WHERE cap.status != 'cancelled'
GROUP BY sa.id, sa.name, sa.category
ORDER BY total_revenue DESC;
```

### Subscription MRR (Monthly Recurring Revenue)
```sql
SELECT 
  SUM(COALESCE(cs.custom_monthly_price, sp.base_price)) as monthly_recurring_revenue,
  COUNT(*) as active_subscriptions,
  AVG(COALESCE(cs.custom_monthly_price, sp.base_price)) as average_revenue_per_customer
FROM customer_subscriptions cs
JOIN service_packages sp ON cs.service_package_id = sp.id
WHERE cs.status = 'active';
```

---

## 🎯 Smart Features

### 1. Custom Pricing Per Client
```sql
-- Client negotiated a special rate
UPDATE customer_subscriptions 
SET custom_monthly_price = 10000.00 
WHERE id = 42;
-- Normal price is $12,000 but they get $10,000
```

### 2. Recurring Add-ons
```sql
-- Client wants LinkedIn management every month
INSERT INTO customer_addon_purchases 
(customer_id, subscription_id, addon_id, is_recurring, billing_period)
VALUES (15, 42, 6, true, '2025-02');
-- Will auto-add to each month's invoice
```

### 3. Approval Workflow for Add-ons
```sql
-- Team member adds expensive addon
INSERT INTO customer_addon_purchases 
(customer_id, addon_id, quantity, unit_price, total_price, status)
VALUES (15, 8, 1, 15000.00, 15000.00, 'pending');

-- Manager approves
UPDATE customer_addon_purchases 
SET status = 'approved', approved_by = 1, approved_at = NOW()
WHERE id = 123;
```

### 4. Invoice Auto-numbering
```sql
-- Format: INV-2025-0001
SELECT 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || 
       LPAD((COUNT(*) + 1)::text, 4, '0') as next_invoice_number
FROM invoices 
WHERE EXTRACT(YEAR FROM invoice_date) = EXTRACT(YEAR FROM CURRENT_DATE);
```

---

## 🔗 Integration with Existing System

### Links to Projects
```sql
-- Addon purchased for specific project
INSERT INTO customer_addon_purchases 
(customer_id, addon_id, project_id, quantity, unit_price, total_price)
VALUES (15, 4, 88, 1, 3500.00, 3500.00);
```

### Links to Content Calendar
```sql
-- Extra posts get tracked in content calendar
-- When creating content_calendar entry:
UPDATE content_calendar 
SET is_addon = true, addon_purchase_id = 123
WHERE id = 456;
```

### Accounting Integration
```sql
-- When invoice is paid, create journal entries
INSERT INTO journal_entries (date, description, account_code, debit, credit, source_type, source_id)
VALUES
(CURRENT_DATE, 'Pago Factura INV-2025-001', '1002', 69600.00, 0, 'invoice_payment', 1), -- Debit Bank
(CURRENT_DATE, 'Pago Factura INV-2025-001', '4002', 0, 60000.00, 'invoice_payment', 1), -- Credit Revenue
(CURRENT_DATE, 'Pago Factura INV-2025-001', '2003', 0, 9600.00, 'invoice_payment', 1);  -- Credit IVA
```

---

## ⚡ Next Steps

### Backend API Endpoints Needed
- `POST /api/subscriptions` - Create customer subscription
- `POST /api/addons/purchase` - Purchase addon for customer
- `POST /api/invoices/generate` - Generate invoice (manual or auto)
- `POST /api/invoices/:id/send` - Send invoice to customer
- `POST /api/invoices/:id/payment` - Record payment
- `GET /api/invoices/pending` - Get pending invoices
- `GET /api/revenue/summary` - Revenue analytics

### Frontend Components Needed
- **Income Dashboard** - Revenue overview, pending invoices
- **Subscription Management** - Manage customer packages
- **Add-on Catalog** - Browse and purchase add-ons
- **Invoice Generator** - Create and send invoices
- **Payment Recording** - Record payments received
- **Revenue Reports** - Analytics and insights

---

## 📝 Example: Complete Customer Journey

### Month 1: New Customer
```sql
-- 1. Customer signs Plan Profesional
INSERT INTO customer_subscriptions (customer_id, service_package_id, next_billing_date)
VALUES (15, 2, '2025-03-01');

-- 2. Generate first invoice
INSERT INTO invoices (customer_id, subscription_id, invoice_number, invoice_date, due_date, status)
VALUES (15, 1, 'INV-2025-001', '2025-02-01', '2025-02-15', 'sent');

INSERT INTO invoice_items (invoice_id, item_type, description, quantity, unit_price, total)
VALUES (1, 'subscription', 'Plan Profesional - Febrero 2025', 1, 12000.00, 12000.00);

-- Invoice total: $13,920 (with IVA)
```

### Month 2: Add-ons Needed
```sql
-- Customer needs extras this month
INSERT INTO customer_addon_purchases (customer_id, addon_id, quantity, unit_price, total_price, description)
VALUES 
(15, 1, 5, 500.00, 2500.00, '5 posts extras para campaña'),
(15, 16, 1, 2500.00, 2500.00, 'Campaña WhatsApp');

-- Next invoice (March 1st) includes:
-- - Plan Profesional: $12,000
-- - 5 Posts Extra: $2,500
-- - Campaña WhatsApp: $2,500
-- = $17,000 + IVA = $19,720
```

### Month 3: Billing Hours
```sql
-- Customer needed strategy consulting
INSERT INTO billable_time_entries (customer_id, hours, hourly_rate, total_amount, description)
VALUES (15, 3.5, 1500.00, 5250.00, 'Sesión de estrategia de contenido Q2');

-- Next invoice includes hours worked
```

---

## 💡 Tips

1. **Set up recurring invoices** - Automate monthly billing to save time
2. **Track everything** - Every service, addon, hour should be tracked
3. **Custom pricing carefully** - Document why a customer has special pricing
4. **Review unbilled items weekly** - Don't lose revenue by forgetting to invoice
5. **Follow up on overdue invoices** - Integrate with WhatsApp for payment reminders
6. **Markup expenses consistently** - Standard 15-20% on pass-through costs
7. **Monthly reconciliation** - Compare invoiced vs. actual work delivered

---

## 🚀 Ready to Implement?

Would you like me to create:
1. ✅ Backend API routes for invoice management
2. ✅ Frontend components for income dashboard
3. ✅ Automated invoice generation system
4. ✅ Integration with accounting (journal entries)
5. ✅ WhatsApp invoice delivery
6. ✅ Payment reminder system





