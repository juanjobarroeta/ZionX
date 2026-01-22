# Meta (Facebook & Instagram) API Integration Guide

This guide will help you set up the Meta Graph API integration for posting to Facebook Pages and Instagram Business accounts, plus fetching analytics.

## 📋 Prerequisites

- Facebook Business Account
- Meta Developer Account
- A Facebook Page you manage
- Instagram Business Account linked to your Facebook Page (optional, for Instagram posting)

---

## 🚀 Step 1: Create Meta Developer App

1. Go to [https://developers.facebook.com](https://developers.facebook.com)
2. Click **"My Apps"** → **"Create App"**
3. Select **"Business"** as the app type
4. Fill in:
   - **App Name**: `ZIONX Marketing Platform` (or your preferred name)
   - **App Contact Email**: your@email.com
   - **Business Account**: Select your business
5. Click **"Create App"**

---

## 📱 Step 2: Add Required Products

In your app dashboard, add these products:

### Facebook Login
1. Click **"Add Product"** → Find **"Facebook Login"** → **"Set Up"**
2. Choose **"Web"**
3. Enter your site URL: `http://localhost:5174` (for development)
4. Go to **Settings** in Facebook Login
5. Add Valid OAuth Redirect URIs:
   - `http://localhost:5174/social/accounts`
   - `http://localhost:5174/social/callback`

### Instagram Basic Display (for IG posting)
1. Click **"Add Product"** → Find **"Instagram Graph API"** → **"Set Up"**
2. This enables posting to Instagram Business accounts

### Pages API
1. This is usually enabled by default with Business apps

---

## 🔑 Step 3: Get Your Credentials

### App ID & App Secret:
1. Go to **Settings** → **Basic**
2. Copy your **App ID**
3. Click **"Show"** next to **App Secret** and copy it

### Configure Permissions:
1. Go to **App Review** → **Permissions and Features**
2. Request these permissions (some require business verification):
   - `pages_show_list` - List pages you manage
   - `pages_read_engagement` - Read page engagement data
   - `pages_manage_posts` - Create posts on pages
   - `pages_read_user_content` - Read content from pages
   - `instagram_basic` - Access Instagram account info
   - `instagram_content_publish` - Post to Instagram
   - `instagram_manage_insights` - Read Instagram analytics
   - `business_management` - Manage business assets

---

## 🔧 Step 4: Configure Environment Variables

Add these to your `backend/.env` file:

```env
# Meta API Configuration
META_APP_ID=your_app_id_here
META_APP_SECRET=your_app_secret_here
META_REDIRECT_URI=http://localhost:5174/social/accounts
```

For production, update `META_REDIRECT_URI` to your production domain.

---

## ▶️ Step 5: Restart Backend

After adding the environment variables:

```bash
cd backend
npm start
```

You should see in the logs:
```
✅ WhatsApp, Leads, Income, Customer Import, HR, Notifications, Messages, and Social Media routes loaded
```

---

## 🔗 Step 6: Connect Your Accounts

1. Open the app in your browser: `http://localhost:5174`
2. Navigate to **Social Media** → **🔗 Cuentas Meta**
3. Click **"Conectar Meta"**
4. You'll be redirected to Facebook to authorize the app
5. Select the Facebook Pages you want to connect
6. Click **"Continue"**
7. You'll be redirected back to the app with your accounts connected!

---

## 📤 Available Features

### Posting
- **Facebook Page posts** - Text, links, and photos
- **Instagram posts** - Photos with captions (requires public image URL)
- **Instagram carousels** - Multiple images in one post
- **Scheduled posts** - Queue posts for later publishing

### Analytics
- **Page Insights** - Impressions, reach, engagement
- **Post Performance** - Likes, comments, shares per post
- **Instagram Insights** - Profile views, follower growth
- **Historical Data** - Daily analytics snapshots

### Account Management
- Connect multiple Facebook Pages
- Auto-detect linked Instagram Business accounts
- Disconnect accounts when needed
- Token refresh handling

---

## 🔌 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/social/auth-url` | GET | Get OAuth login URL |
| `/api/social/callback` | POST | Handle OAuth callback |
| `/api/social/accounts` | GET | List connected accounts |
| `/api/social/accounts/:id` | DELETE | Disconnect account |
| `/api/social/post` | POST | Post immediately |
| `/api/social/schedule` | POST | Schedule a post |
| `/api/social/scheduled` | GET | List scheduled posts |
| `/api/social/accounts/:id/insights` | GET | Get account insights |
| `/api/social/accounts/:id/posts` | GET | Get recent posts |
| `/api/social/sync-analytics` | POST | Sync all analytics |
| `/api/social/config` | GET | Check API configuration |

---

## 🐛 Troubleshooting

### "Meta App credentials not configured"
- Verify `META_APP_ID` and `META_APP_SECRET` are in your `.env` file
- Restart the backend server

### OAuth redirect error
- Check that your redirect URI in Meta App settings matches exactly
- For local dev: `http://localhost:5174/social/accounts`

### "User has not authorized application"
- The user needs to grant permissions during OAuth flow
- Check that required permissions are approved in your app

### Instagram posting fails
- Instagram requires a **public** image URL
- The image must be accessible from the internet
- Instagram Business account must be linked to a Facebook Page

### Token expired
- Long-lived tokens last ~60 days
- Reconnect the account to refresh the token

---

## 📚 Next Steps

1. **Go Live**: Submit your app for Meta review (required for production use with non-test users)
2. **Add Webhooks**: Get real-time notifications for comments and messages
3. **Schedule Automation**: Set up a cron job to publish scheduled posts
4. **Analytics Dashboard**: Build charts with historical data

---

## 🔒 Security Notes

- Never expose `META_APP_SECRET` in frontend code
- Store tokens encrypted in production databases
- Use HTTPS in production
- Implement token refresh before expiration

