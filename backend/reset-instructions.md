# Safe Database Reset Instructions

## 🛡️ What This Reset Does

**PRESERVES:**
- ✅ Admin user account
- ✅ Chart of Accounts (all accounting structure)  
- ✅ Financial Products
- ✅ All table structures and endpoints
- ✅ All migrations and schema

**RESETS:**
- 🧹 All customer data
- 🧹 All loan data  
- 🧹 All inventory data
- 🧹 All payment records
- 🧹 All journal entries
- 🧹 Resets ID sequences to start from 1

## 🚀 How to Use

### Option 1: API Endpoint
```bash
curl -X POST "https://crediya-backend-a-production.up.railway.app/admin/safe-database-reset" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

### Option 2: Browser Console
```javascript
fetch('https://crediya-backend-a-production.up.railway.app/admin/safe-database-reset', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('token'),
    'Content-Type': 'application/json'
  }
})
.then(response => response.json())
.then(data => {
  console.log('✅ Reset result:', data);
  alert('Database safely reset! You can now add real data.');
  location.reload();
})
.catch(error => {
  console.error('❌ Reset error:', error);
  alert('Reset failed: ' + error.message);
});
```

### Option 3: Direct Script (Railway Console)
```bash
node safe-reset.js
```

## ⚠️ Safety Features

1. **Admin Only** - Only admin users can trigger reset
2. **Transaction Safety** - All operations in single transaction
3. **Rollback on Error** - Automatic rollback if anything fails  
4. **Logging** - Full logging of what was reset
5. **Foreign Key Safe** - Respects database constraints

## 🎯 When to Use

- ✅ Moving from test data to real data
- ✅ Starting fresh after development
- ✅ Cleaning up after bulk testing
- ✅ Preparing for production data import

## 🚫 When NOT to Use

- ❌ Never use in production with real customer data
- ❌ Don't use if you need to preserve any customer/loan data
- ❌ Not for partial cleanup (use specific deletes instead)

This is much safer than full database resets that can break endpoints!
