# 🎯 ZIONX Marketing - Admin User Setup Guide

## Overview
This guide will help you create an admin user in your production database and manage users through the UI.

---

## Step 1: Get Your Railway DATABASE_URL

1. Go to **Railway Dashboard**: https://railway.app/
2. Open your **ZIONX Marketing** project
3. Click on your **PostgreSQL** service
4. Go to **Connect** tab
5. Copy the **DATABASE_URL** (it looks like: `postgresql://user:password@host:port/database`)

---

## Step 2: Create Production Admin User

Run this command in your terminal:

```bash
cd backend
node create-production-admin.js
```

The script will:
- Prompt you for the DATABASE_URL (paste the one from Step 1)
- Ask for admin details (or use defaults)
- Create an admin user with full permissions

### Default Credentials
- **Email**: `admin@zionx.com`
- **Password**: `zionx2024`
- **Role**: `admin`

You can customize these when prompted by the script.

---

## Step 3: Login to Production

1. Go to: https://zionx-marketing.vercel.app/
2. Login with the admin credentials you created
3. You should now have full admin access!

---

## Step 4: Create More Users Through the UI

Once logged in as admin, you can create more users through the web interface:

### Option A: Simple User Creation (Recommended)
Navigate to: **Admin Panel → Create User** (`/admin/create-user`)

Features:
- Clean, simple interface
- Role-based permission presets
- Create and edit users
- Deactivate users

### Option B: Advanced User Management
Navigate to: **Admin Panel → User Management** (`/admin/user-management`)

Features:
- Comprehensive permission matrix
- User activity tracking
- Audit logs
- Advanced filtering
- User statistics

---

## Available Roles

### 🔐 Admin
- **Full system access**
- Can manage users, finances, and system settings
- Access to all features

### 💼 Account Manager
- Manage clients and projects
- Approve content
- View analytics
- No financial access

### 📱 Community Manager
- Create and schedule social media content
- Manage social accounts
- View analytics

### 🎨 Designer
- Create visual content
- Upload files
- Collaborate on projects

### ✍️ Copywriter
- Create written content
- Collaborate on projects

### 📊 Accountant
- View and manage finances
- Create invoices
- Manage payroll
- View financial reports

### 👥 HR Manager
- Manage team members
- Handle payroll
- View employee data

---

## Managing Users

### Creating a New User
1. Login as admin
2. Go to `/admin/create-user` or `/admin/user-management`
3. Fill in user details:
   - Full name
   - Email
   - Password
   - Role (automatically assigns permissions)
4. Click "Create User"

### Editing a User
1. Find the user in the list
2. Click "Edit"
3. Update details or change role
4. Save changes

### Deactivating a User
1. Find the user in the list
2. Click the delete/deactivate button
3. Confirm the action

---

## Security Best Practices

1. **Change Default Password**: After creating the admin user, login and change the password
2. **Use Strong Passwords**: Require complex passwords for all users
3. **Principle of Least Privilege**: Only give users the permissions they need
4. **Regular Audits**: Review user access regularly using the audit logs
5. **Deactivate Inactive Users**: Disable accounts that are no longer needed

---

## Troubleshooting

### "User already exists" error
If you see this error when creating an admin:
- The script will ask if you want to update the existing user to admin
- Or use a different email address

### Can't login after creating admin
1. Verify the email and password you used
2. Check that the user was created in the database
3. Clear browser cache and try again

### Database connection error
1. Verify your DATABASE_URL is correct
2. Ensure Railway PostgreSQL is running
3. Check that your IP is allowed (Railway typically allows all IPs)

### Frontend not showing admin features
1. Logout and login again
2. Check browser console for errors
3. Verify JWT token is being stored in localStorage

---

## Next Steps

After setting up your admin user:

1. ✅ **Create team members** through the UI
2. ✅ **Configure system settings**
3. ✅ **Set up social media accounts**
4. ✅ **Create your first client/project**
5. ✅ **Customize roles and permissions** as needed

---

## Support

If you encounter any issues:
- Check the browser console for errors
- Review Railway logs for backend errors
- Verify database connection is working
- Contact your development team

---

**Production URL**: https://zionx-marketing.vercel.app/
**Backend**: Deployed on Railway
**Database**: PostgreSQL on Railway

---

*Last Updated: March 2026*
