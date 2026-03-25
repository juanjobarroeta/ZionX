# Quick Fix: Show User Management in Sidebar

## Issue
The user management section isn't visible in the sidebar after login.

## Solution

### Option 1: Hard Refresh (Quickest)
1. Press `Ctrl + Shift + R` (Windows/Linux) or `Cmd + Shift + R` (Mac)
2. This will clear the cache and reload the page

### Option 2: Clear Sidebar State (Most Reliable)
1. Open browser console (F12)
2. Run this command:
```javascript
localStorage.removeItem('sidebar-state');
location.reload();
```

### Option 3: Clear All Cache
1. Open browser console (F12)
2. Run this command:
```javascript
localStorage.clear();
location.href = '/auth';
```
3. Login again

## What Changed

The sidebar now includes in the **⚙️ Configuración** section:
- **➕ Crear Usuario** - Simple user creation interface
- **👥 Gestión de Usuarios** - Advanced user management with permissions

The settings section is now **open by default** for new users.

## After Refresh

You should see at the bottom of your sidebar:
```
⚙️ Configuración
  ➕ Crear Usuario
  👥 Gestión de Usuarios
```

Click on either option to manage users!
