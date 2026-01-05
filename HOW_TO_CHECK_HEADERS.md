# How to Check CSP and CSRF Headers

## ⚠️ Important Notes

### CSP Headers
- **Only appear on HTML document requests** (not API/data requests)
- **In production**: Must be configured at hosting/CDN level
- **In development**: Set by Vite plugin (localhost only)

### CSRF Tokens
- **Only appear on POST/PUT/PATCH/DELETE requests** (not GET)
- **Only for edge function requests** (`/functions/v1/*`)
- **Requires you to be signed in first**

---

## Step-by-Step: Check CSP Headers

### 1. Find the HTML Document Request
1. Open **Network** tab
2. **Filter by "Doc"** (or look for Type: "document")
3. Click on the **HTML document request** (usually the first one, or `/`, `/dashboard`, etc.)
   - It should show `Type: document` or `Doc` in the list

### 2. Check Response Headers
1. Click on the HTML document request
2. Go to **Headers** tab
3. Scroll to **Response Headers** section
4. Look for: `Content-Security-Policy`

### 3. If NOT Found in Production
- Lovable Cloud may not support `_headers` or `vercel.json` files
- You may need to configure headers in Lovable Cloud settings
- Or use a different hosting/CDN that supports header files

---

## Step-by-Step: Check CSRF Tokens

### 1. Sign In First
- You **must** be signed in for CSRF tokens to work
- Check **Application** → **Cookies** → should see `csrf-token` cookie

### 2. Make a POST Request
- **Update your profile** (`/profile` page)
- **Save an opportunity** (click "+ Add to Tracker")
- **Send contact form** (`/contact` page)

### 3. Check Request Headers
1. In **Network** tab, find the **POST request** to `/functions/v1/*`
2. Click on it
3. Go to **Headers** tab
4. Scroll to **Request Headers** section
5. Look for: `X-CSRF-Token: <token-value>`

### 4. Check Console for Debug Messages
- You should see: `[CSRF] Added X-CSRF-Token header to ...`
- If you see: `[CSRF] No CSRF token available`, the token isn't set

---

## Quick Console Tests

### Test CSP Header (works in browser console):
```javascript
// Check CSP header for current page
fetch(window.location.href, {method: 'HEAD'})
  .then(r => {
    const csp = r.headers.get('content-security-policy');
    console.log('CSP Header:', csp || 'NOT FOUND');
  });
```

### Test CSRF Token (check if available):
```javascript
// Check if CSRF token cookie exists
document.cookie.split(';').find(c => c.trim().startsWith('csrf-token=')) 
  ? console.log('CSRF cookie: FOUND') 
  : console.log('CSRF cookie: NOT FOUND');
```

### Test CSRF Token in Request (after making a POST):
1. Make a POST request (update profile, etc.)
2. In Network tab, find the POST request
3. Check Request Headers for `X-CSRF-Token`

---

## Common Issues

### CSP Header Not Found
- **Production**: Headers must be configured at hosting level
- **Development**: Should work automatically with Vite plugin
- **Solution**: Check Lovable Cloud settings for header configuration

### CSRF Token Not Found
- **Not signed in**: Sign in first
- **GET request**: CSRF only on POST/PUT/PATCH/DELETE
- **Edge function not deployed**: Deploy `csrf-token` function
- **Cookie not set**: Check Application → Cookies

---

## What You Should See

### CSP Headers (Response Headers on HTML document):
```
Content-Security-Policy: default-src 'self'; script-src 'self'; ...
```

### CSRF Tokens (Request Headers on POST requests):
```
X-CSRF-Token: a1b2c3d4e5f6...
Cookie: session=...; csrf-token=...
```

