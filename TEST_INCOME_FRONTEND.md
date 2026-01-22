# 🔧 Testing Income Management Frontend

## Current Status

✅ Backend running on: `http://localhost:5001`  
✅ Frontend running on: `http://localhost:5174`  
✅ Income routes loaded  
✅ 96 API routes registered  

## 🐛 Debugging 404 Errors

### Issue
Frontend getting 404 errors for `/api/income/subscriptions` and `/api/income/packages`

### Root Cause
The routes ARE loaded and working, but there might be:
1. CORS issue
2. Authentication token issue
3. Frontend caching old requests

## ✅ Quick Fix Steps

### Step 1: Hard Refresh Frontend
```
1. Go to http://localhost:5174
2. Press Cmd + Shift + R (hard refresh)
3. Or clear browser cache
```

### Step 2: Verify You're Logged In
```
1. Open browser console (F12)
2. Type: localStorage.getItem('token')
3. Should return a JWT token
4. If null, login again
```

### Step 3: Test API Directly in Browser
```
Open a new tab and try:
http://localhost:5001/health

Should see:
{"status":"healthy","database":"connected",...}
```

### Step 4: Check Network Tab
```
1. Open DevTools → Network tab
2. Try loading /income/subscriptions
3. Check the failed requests:
   - Is the URL correct? (should be http://localhost:5001/api/income/...)
   - Is there an Authorization header?
   - What's the actual error response?
```

## 🧪 Manual API Test

### Test 1: Get Service Packages
```bash
# Login first to get token
curl -X POST http://localhost:5001/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }'

# Copy the token from response
# Then test packages endpoint:
curl http://localhost:5001/api/income/packages \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

Should return:
```json
[
  {
    "id": 1,
    "name": "Plan Básico",
    "base_price": 5000.00,
    ...
  }
]
```

### Test 2: Get Subscriptions
```bash
curl http://localhost:5001/api/income/subscriptions \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

Should return `[]` (empty array) if no subscriptions yet.

## 💡 Quick Verification

Run this in terminal to test without auth:
```bash
# Should get "Access denied" (means route exists)
curl http://localhost:5001/api/income/packages

# Should get healthy response
curl http://localhost:5001/health
```

## 🔍 Common Issues

### Issue: "Failed to load resource: 404"
**Fix:** The route path might be wrong. Check:
- Frontend uses: `/api/income/packages`
- Backend expects: `/api/income/packages`
- ✅ These match!

### Issue: "Access denied"
**Fix:** Token might be expired or invalid
- Logout and login again
- Check localStorage.getItem('token')

### Issue: CORS error
**Fix:** Backend should have CORS enabled
- Check backend/index.js has: `app.use(cors())`

## 🎯 Expected Behavior

When you visit `/income/subscriptions`:
1. Frontend calls: `GET http://localhost:5001/api/income/subscriptions`
2. Backend checks JWT token
3. Returns subscription data
4. Frontend displays table

## 📊 What Should Work Now

After hard refresh, these should all work:
- ✅ `/income` - Dashboard
- ✅ `/income/subscriptions` - Subscriptions page
- ✅ `/income/invoice-generator` - Invoice generator
- ✅ `/income/invoices` - Invoices list
- ✅ `/income/addons` - Add-ons catalog
- ✅ `/income/reports` - Reports

## 🆘 If Still Not Working

1. **Check backend log for errors:**
   ```bash
   tail -50 backend/backend.log
   ```

2. **Verify income routes are loaded:**
   ```bash
   grep "Income routes" backend/backend.log
   ```
   Should see: "✅ WhatsApp, Leads, and Income routes loaded"

3. **Test a simple endpoint:**
   ```bash
   curl http://localhost:5001/customers
   ```
   If this works but income routes don't, there's an issue with route mounting.

4. **Check if server is actually running:**
   ```bash
   lsof -i :5001
   ```

## 🔄 Nuclear Option: Full Restart

```bash
# Kill everything
pkill -f "node.*index.js"
pkill -f "vite"

# Start backend
cd backend && node index.js &

# Wait 5 seconds
sleep 5

# Start frontend  
cd frontend && npm run dev &

# Visit http://localhost:5174
# Login
# Go to /income
```

## 💬 Next Steps

After hard refresh:
1. Login to the app
2. Look for "💰 Ingresos" in sidebar
3. Click to expand
4. Click "Dashboard de Ingresos"
5. Should load without errors!

If you still see errors, share:
- Browser console errors
- Network tab request details
- Backend log output




