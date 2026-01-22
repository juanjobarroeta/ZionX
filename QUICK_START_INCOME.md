# 🚀 Quick Start - Income Management

## ✅ System is Ready!

All income management features are installed and ready to use:
- 📦 Service Packages
- ➕ Add-ons Catalog  
- 📋 Subscriptions
- 📄 Invoices with automatic IVA (16%)
- 💳 Payment tracking
- 📊 Revenue analytics

---

## 🎯 Next Steps

### Step 1: Start Backend (if not running)
```bash
cd backend
npm start
```

Server will start on: `http://localhost:5001`

### Step 2: Create Test Customer (if needed)
```bash
curl -X POST http://localhost:5001/customers \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Test",
    "last_name": "Customer",
    "email": "test@empresa.com",
    "phone": "5512345678"
  }'
```

### Step 3: Create Subscription
```bash
curl -X POST http://localhost:5001/api/income/subscriptions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 1,
    "service_package_id": 2,
    "start_date": "2025-12-01"
  }'
```

**Response:**
```json
{
  "id": 1,
  "customer_id": 1,
  "status": "active",
  "next_billing_date": "2026-01-01"
}
```

### Step 4: Purchase Add-ons
```bash
curl -X POST http://localhost:5001/api/income/addon-purchases \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 1,
    "addon_id": 1,
    "quantity": 5,
    "description": "5 posts extra para campaña especial"
  }'
```

### Step 5: Generate Invoice (Automatic IVA!)
```bash
curl -X POST http://localhost:5001/api/income/invoices/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 1,
    "subscription_id": 1,
    "billing_period_start": "2025-12-01",
    "billing_period_end": "2025-12-31",
    "include_unbilled_addons": true
  }'
```

**Response (with IVA automatically calculated):**
```json
{
  "invoice_id": 1,
  "invoice_number": "INV-2025-0001",
  "subtotal": 14500.00,
  "iva": 2320.00,
  "total": 16820.00,
  "line_items": [
    {
      "type": "subscription",
      "description": "Plan Profesional",
      "amount": 12000.00
    },
    {
      "type": "addon",
      "description": "5 posts extra",
      "amount": 2500.00
    }
  ]
}
```

### Step 6: Record Payment
```bash
curl -X POST http://localhost:5001/api/income/invoices/1/payment \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 16820.00,
    "payment_method": "transferencia",
    "reference_number": "REF-12345"
  }'
```

### Step 7: Check Revenue Dashboard
```bash
curl -X GET http://localhost:5001/api/income/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "mrr": 12000.00,
  "total_outstanding": 0,
  "revenue_this_month": 16820.00,
  "active_subscriptions": 1,
  "annual_run_rate": 144000.00
}
```

---

## 📊 Available Reports

### Monthly Recurring Revenue
```
GET /api/income/revenue/mrr
```

### Revenue by Month
```
GET /api/income/revenue/summary?year=2025
```

### Pending Invoices
```
GET /api/income/invoices/pending
```

### Overdue Invoices
```
GET /api/income/invoices/overdue
```

### Top Customers
```
GET /api/income/revenue/by-customer?limit=10
```

### Add-on Performance
```
GET /api/income/revenue/addon-performance
```

---

## 💡 Real-World Example

**Scenario:** Cliente "Empresa ABC" needs full service

```javascript
// 1. Create subscription - Plan Premium
POST /api/income/subscriptions
{
  "customer_id": 5,
  "service_package_id": 3,  // Plan Premium
  "start_date": "2025-12-01",
  "custom_monthly_price": 22000.00,  // Negotiated price
  "notes": "Precio especial - contrato 12 meses"
}

// 2. They need extras this month
POST /api/income/addon-purchases
{
  "customer_id": 5,
  "addon_id": 8,  // Manual de Marca
  "quantity": 1
}

POST /api/income/addon-purchases
{
  "customer_id": 5,
  "addon_id": 13,  // Sesión Fotográfica
  "quantity": 2,
  "description": "2 sesiones para producto nuevo"
}

// 3. Generate invoice
POST /api/income/invoices/generate
{
  "customer_id": 5,
  "subscription_id": 1,
  "billing_period_start": "2025-12-01",
  "billing_period_end": "2025-12-31",
  "include_unbilled_addons": true,
  "notes": "Primera factura - Diciembre 2025"
}

// Result:
// Subtotal: $37,000.00
// - Plan Premium (custom): $22,000.00
// - Manual de Marca: $15,000.00
// IVA (16%): $5,920.00
// TOTAL: $42,920.00 MXN

// 4. Customer pays 50% now, 50% later
POST /api/income/invoices/1/payment
{
  "amount": 21460.00,
  "payment_method": "transferencia",
  "reference_number": "BBVA-98765"
}
// Invoice status: "partial"

// Later...
POST /api/income/invoices/1/payment
{
  "amount": 21460.00,
  "payment_method": "transferencia"
}
// Invoice status: "paid"
```

---

## 🔧 Troubleshooting

### Can't connect to backend?
```bash
# Check if server is running
lsof -i :5001

# If not running, start it
cd backend && npm start
```

### Need to reset database?
```bash
cd backend
psql $DATABASE_URL -f schema.sql
psql $DATABASE_URL -f income-management-schema.sql
```

### Test database connection
```bash
cd backend
node test-income-api.js
```

---

## 📚 Full Documentation

- `INCOME_MANAGEMENT_GUIDE.md` - Complete system guide
- `INCOME_API_ENDPOINTS.md` - Full API reference
- `income-management-schema.sql` - Database schema

---

## ✨ Key Features

✅ **Fixed Monthly Retainers** - Recurring subscriptions  
✅ **Flexible Add-ons** - Purchase extras anytime  
✅ **Automatic IVA** - 16% calculated on every invoice  
✅ **Partial Payments** - Track multiple payments per invoice  
✅ **Custom Pricing** - Override prices per customer  
✅ **Accounting Integration** - Auto-create journal entries  
✅ **Revenue Analytics** - MRR, revenue by month, top customers  
✅ **Unbilled Items Tracking** - Never miss billable work  

**Ready to build the frontend dashboard? 🎨**




