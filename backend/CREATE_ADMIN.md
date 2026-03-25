# Create Production Admin User

## Quick Start

Run this command:

```bash
node create-production-admin.js
```

## What You'll Need

1. **Railway DATABASE_URL**
   - Get it from: Railway Dashboard > PostgreSQL > Connect tab
   - Format: `postgresql://user:pass@host:port/database`

2. **Admin Details** (or use defaults):
   - Name: `Admin`
   - Email: `admin@zionx.com`
   - Password: `zionx2024`

## Example

```bash
$ node create-production-admin.js

🚀 ZIONX Marketing - Production Admin Creator
==============================================

Paste your DATABASE_URL here: postgresql://postgres:xxx@xxx.railway.app:5432/railway

👤 Enter admin user details:

Full Name (default: Admin): Juan Barroeta
Email (default: admin@zionx.com): juan@zionx.com
Password (default: zionx2024): mySecurePassword123

🔄 Creating admin user in production database...

✅ Production admin user created successfully!
==============================================
👤 Name: Juan Barroeta
📧 Email: juan@zionx.com
🔑 Password: mySecurePassword123
🎭 Role: admin
🆔 User ID: 1
==============================================

🌐 You can now login at: https://zionx-marketing.vercel.app/
```

## After Creating Admin

1. Go to https://zionx-marketing.vercel.app/
2. Login with your admin credentials
3. Navigate to `/admin/create-user` to create more users
4. Change your password in settings (recommended)

## Notes

- The script will prevent duplicate emails
- If user exists, it offers to update them to admin
- All admin permissions are automatically applied
- User is set to active by default
