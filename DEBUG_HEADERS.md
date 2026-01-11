# Debugging CSP and CSRF Headers

## Issue: Not seeing CSP or CSRF headers in Network tab

### For CSP Headers:

1. **Are you checking the right request?**
   - CSP headers are ONLY on HTML document requests
   - In Network tab, filter by "Doc" (document)
   - Click on the HTML document request (usually the first one, or the one for `/`, `/dashboard`, etc.)
   - Go to **Headers** tab → **Response Headers**
   - Look for `Content-Security-Policy`

2. **Are you testing in production or development?**
   - **Development** (`localhost:8080`): CSP headers come from Vite plugin (should work)
   - **Production** (`clinicalhours.org`): CSP headers must come from hosting/CDN
     - `_headers` file (for Netlify)
     - `vercel.json` (for Vercel)
     - Lovable Cloud might need different configuration

3. **Check if headers are being set:**
   - Open Console tab
   - Type: `fetch('/').then(r => console.log(r.headers.get('content-security-policy')))`
   - Should log the CSP policy

### For CSRF Tokens:

1. **Are you signed in?**
   - CSRF tokens are only set after sign-in
   - Check Application → Cookies → should see `csrf-token` cookie

2. **Are you making POST/PUT/DELETE requests?**
   - CSRF tokens are ONLY added to state-changing requests
   - GET requests won't have CSRF tokens
   - Try: Update profile, save opportunity, send contact form

3. **Check Request Headers:**
   - Network tab → Find a POST request to `/functions/v1/*`
   - Click on it → Headers tab → Request Headers
   - Look for `X-CSRF-Token: <token-value>`

4. **Debug CSRF token availability:**
   - Open Console tab
   - Type: `import('@/lib/csrf').then(m => m.getCSRFToken().then(t => console.log('CSRF Token:', t)))`
   - Should log the token or null

5. **Check if edge functions are deployed:**
   - If `csrf-token` function returns 404, CSRF tokens won't work
   - Check Network tab for 404 errors on `/functions/v1/csrf-token`

