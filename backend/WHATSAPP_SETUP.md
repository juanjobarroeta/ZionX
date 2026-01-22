# WhatsApp Business API Setup Guide

This guide will help you set up WhatsApp Business API integration for lead capture and customer communication.

## 📋 Prerequisites

- Facebook Business Account
- Meta Developer Account
- A phone number for WhatsApp Business (can't be used for personal WhatsApp)
- This application running on a public URL (for webhooks)

---

## 🚀 Step 1: Create Meta Developer App

1. Go to [https://developers.facebook.com](https://developers.facebook.com)
2. Click **"My Apps"** → **"Create App"**
3. Select **"Business"** as the app type
4. Fill in:
   - **App Name**: `ZIONX Marketing Platform`
   - **App Contact Email**: your@email.com
   - **Business Account**: Select your business
5. Click **"Create App"**

---

## 📱 Step 2: Add WhatsApp Product

1. In your app dashboard, find **"WhatsApp"** in the products list
2. Click **"Set up"**
3. Select **"Continue"** on the business portfolio page
4. You'll see the **WhatsApp API Setup** page

---

## 🔑 Step 3: Get Your Credentials

### Get Phone Number ID:
1. In WhatsApp setup, under **"API Setup"**
2. Look for **"Phone number ID"** (starts with numbers)
3. Copy this ID → Add to `.env` as `WHATSAPP_PHONE_NUMBER_ID`

### Get Access Token:
1. In the same section, look for **"Temporary access token"**
2. Copy the token → Add to `.env` as `WHATSAPP_ACCESS_TOKEN`
3. **⚠️ Important**: This is temporary! You'll need to generate a permanent token later

### Create Verify Token:
1. Make up your own secure string (e.g., `my_webhook_token_2024`)
2. Add to `.env` as `WHATSAPP_VERIFY_TOKEN`

---

## 🌐 Step 4: Configure Webhook

### Option A: Local Development with ngrok

If testing locally, you need to expose your local server:

```bash
# Install ngrok
npm install -g ngrok

# Start your backend server
npm start

# In a new terminal, expose port 5001
ngrok http 5001

# You'll get a URL like: https://abc123.ngrok.io
```

### Option B: Production Server

Use your production URL (e.g., `https://api.yourdomain.com`)

### Configure in Meta:

1. Go to WhatsApp → **"Configuration"**
2. Under **"Webhook"**, click **"Edit"**
3. Enter:
   - **Callback URL**: `https://your-url.com/webhooks/whatsapp`
   - **Verify Token**: Same as your `WHATSAPP_VERIFY_TOKEN`
4. Click **"Verify and Save"**
5. Subscribe to these webhook fields:
   - ✅ `messages` - Incoming messages
   - ✅ `message_status` - Delivery status

---

## 🔄 Step 5: Test the Integration

### Send a Test Message from Meta Console:

1. In WhatsApp setup, find **"Send and Receive Messages"**
2. You'll see a test phone number
3. Send a message to that number from your WhatsApp
4. Check your server logs - you should see:
   ```
   📩 Incoming text message from [Name] ([phone]): [message]
   ```

### Test Sending a Message:

```bash
curl -X POST http://localhost:5001/leads/create \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Lead",
    "phone": "+5215551234567",
    "service_interest": "Marketing Digital",
    "source": "website"
  }'
```

You should receive a WhatsApp message!

---

## 📝 Step 6: Message Templates

WhatsApp requires pre-approved templates for the **first message** to a user who hasn't messaged you.

### Create a Template:

1. Go to WhatsApp → **"Message Templates"**
2. Click **"Create Template"**
3. Example template:

**Template Name**: `lead_welcome`
**Category**: Utility
**Language**: Spanish (Mexico)
**Body**:
```
Hola {{1}}, gracias por contactarnos. ¿En qué servicio estás interesado?
```

4. Submit for approval (usually approved in minutes)

### Use Template in Code:

```javascript
await whatsappService.sendTemplateMessage(
  '+5215551234567',
  'lead_welcome',
  ['Juan']
);
```

---

## 🎯 Step 7: Generate Permanent Access Token

The temporary token expires in 24 hours. To generate a permanent one:

1. Go to **Settings → Business Settings** in Meta Business Suite
2. Navigate to **System Users**
3. Create a system user (or select existing)
4. Assign the user to your WhatsApp Business Account
5. Generate a token with these permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
6. Copy the permanent token → Update `.env`

---

## 🔧 Environment Variables

Your `.env` should look like:

```env
# Database
DB_NAME=crediya
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432

# WhatsApp
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_ACCESS_TOKEN=EAABsbCS1iHgBO7ZCmF8PqQ2G...
WHATSAPP_VERIFY_TOKEN=my_webhook_token_2024

# JWT
JWT_SECRET=your_secret_key
PORT=5001
```

---

## ✅ Verify Installation

Run these checks:

```bash
# 1. Check database tables created
psql -d crediya -c "\dt whatsapp_*"
# Should show: whatsapp_contacts, whatsapp_messages, whatsapp_templates

# 2. Check webhook endpoint
curl http://localhost:5001/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=your_verify_token&hub.challenge=test
# Should return: test

# 3. Restart server
npm start
# Should see: ✅ WhatsApp and Leads routes loaded
```

---

## 🐛 Troubleshooting

### Webhook Verification Fails:
- ✅ Check `WHATSAPP_VERIFY_TOKEN` matches in both `.env` and Meta console
- ✅ Ensure server is publicly accessible
- ✅ Check server logs for errors

### Messages Not Sending:
- ✅ Verify `WHATSAPP_PHONE_NUMBER_ID` is correct
- ✅ Check `WHATSAPP_ACCESS_TOKEN` is valid
- ✅ Ensure recipient's phone has WhatsApp
- ✅ Check Meta console for API errors

### Messages Not Received:
- ✅ Webhook URL is correct
- ✅ Webhook fields are subscribed
- ✅ Check server logs for webhook requests
- ✅ Verify phone number format: `+[country code][number]`

### Database Errors:
```bash
# Re-run schema
psql -d crediya -f whatsapp-schema.sql
```

---

## 📚 Next Steps

1. **Go Live**: Submit app for Meta review (required for production)
2. **Add Templates**: Create more message templates
3. **Build UI**: Create lead inbox frontend
4. **Analytics**: Track conversation metrics
5. **Automation**: Add chatbot responses

---

## 🔗 Useful Links

- [WhatsApp Business Platform Docs](https://developers.facebook.com/docs/whatsapp)
- [Message Templates Guide](https://developers.facebook.com/docs/whatsapp/message-templates)
- [Webhooks Reference](https://developers.facebook.com/docs/whatsapp/webhooks)
- [API Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/reference)

---

## 💬 Support

For issues with this integration:
1. Check server logs: `npm start`
2. Review webhook logs in Meta console
3. Test with curl commands above
4. Check database: `psql -d crediya -c "SELECT * FROM leads ORDER BY created_at DESC LIMIT 5"`

**Happy messaging! 📱✨**



