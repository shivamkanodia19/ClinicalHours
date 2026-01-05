# How to Configure CSP Headers in Lovable Cloud

## Option 1: Lovable Cloud Settings (If Available)

### Step 1: Access Your Project
1. Go to [lovable.dev](https://lovable.dev)
2. Open your project (ClinicalHours)
3. Click the **Cloud** icon in the top bar (or navigate to Cloud view)

### Step 2: Look for Header/HTTP Settings
In the Cloud interface, check these sections:

1. **Settings Tab** (if available)
   - Look for "HTTP Headers" or "Security Headers"
   - Look for "Response Headers" or "Custom Headers"
   - Look for "CDN Settings" or "Edge Settings"

2. **Deployment/Deploy Settings**
   - Some platforms have header configuration in deployment settings
   - Look for "Build Settings" or "Deploy Configuration"

3. **Project Settings** (outside Cloud view)
   - Click on your project name/settings
   - Look for "Headers", "Security", or "HTTP" sections

### Step 3: Add CSP Header
If you find a header configuration option, add:

**Header Name:** `Content-Security-Policy`

**Header Value:**
```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co https://api.mapbox.com https://*.tiles.mapbox.com https://events.mapbox.com; frame-ancestors 'none';
```

---

## Option 2: If Lovable Cloud Doesn't Support Headers

### Alternative: Use a Custom Domain with CDN

If Lovable Cloud doesn't have header configuration:

1. **Use Cloudflare** (or similar CDN):
   - Point your domain to Lovable Cloud
   - Configure headers in Cloudflare
   - Go to Cloudflare Dashboard → Rules → Transform Rules → Modify Response Header
   - Add `Content-Security-Policy` header

2. **Use a Reverse Proxy**:
   - Set up Nginx or similar in front of Lovable Cloud
   - Configure headers in the proxy configuration

---

## Option 3: Check if Headers Are Auto-Applied

Lovable Cloud might automatically read:
- `public/_headers` file (Netlify format)
- `vercel.json` file (Vercel format)

**We've already created both files**, so check if they're being used:

1. Deploy your latest code
2. Check Network tab → Response Headers
3. If headers appear, Lovable Cloud is reading the files automatically

---

## What to Look For in Lovable Cloud Interface

Based on the Cloud interface you showed earlier, check:

1. **Cloud Tab → Settings** (gear icon or settings button)
2. **Cloud Tab → Overview** → Look for "Headers" or "Security" section
3. **Project Settings** (outside Cloud view) → "Deployment" or "Headers"
4. **Ask Lovable AI** in the chat: "How do I configure HTTP headers like Content-Security-Policy?"

---

## Quick Test

After configuring (or if files are auto-read):

1. Deploy your site
2. Go to `https://clinicalhours.org`
3. Open DevTools → Network tab
4. Filter by "Doc"
5. Click the HTML document request
6. Check Response Headers → should see `Content-Security-Policy`

---

## If Nothing Works

If Lovable Cloud doesn't support header configuration:

1. **Contact Lovable Support** - Ask how to configure HTTP headers
2. **Use Cloudflare** - Free CDN that supports header configuration
3. **Accept limitation** - CSP headers will only work in development (localhost)

---

## Current Status

✅ **Development**: CSP headers work (via Vite plugin)  
❓ **Production**: Need to configure in Lovable Cloud or use CDN

The `public/_headers` and `vercel.json` files are already in your repo - Lovable Cloud might pick them up automatically on next deployment.

