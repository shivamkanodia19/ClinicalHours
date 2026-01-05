# Security Testing Guide

This guide will help you test all the security improvements we've implemented:
- CSP (Content Security Policy) headers
- Cookie-based authentication (httpOnly cookies)
- CSRF protection
- Origin validation
- No localStorage for auth tokens
- Edge function security

---

## Prerequisites

1. **Deploy Edge Functions** (if not already deployed):
   ```bash
   # If using Supabase CLI
   supabase functions deploy csrf-token
   supabase functions deploy auth-cookie
   supabase functions deploy logout
   
   # Or deploy via Lovable Cloud interface
   ```

2. **Start Local Server**:
   ```bash
   npm run dev
   ```
   Server should be running at `http://localhost:8080`

3. **Open Browser DevTools**:
   - Press `F12` or Right-click → Inspect
   - Keep **Console**, **Network**, and **Application** tabs open

---

## Test 1: CSP Headers

### Objective
Verify that CSP headers are applied to all routes and prevent XSS attacks.

### Steps

1. **Check CSP Headers on Different Routes**:
   - Navigate to: `http://localhost:8080/`
   - Navigate to: `http://localhost:8080/auth`
   - Navigate to: `http://localhost:8080/dashboard`
   - Navigate to: `http://localhost:8080/profile`
   - Navigate to: `http://localhost:8080/opportunities`

2. **For Each Route**:
   - Open **Network** tab
   - Select the HTML document request (first request)
   - Click on it → Go to **Headers** tab
   - Scroll to **Response Headers**
   - Look for: `Content-Security-Policy`

3. **Verify CSP Policy**:
   - Should include: `default-src 'self'`
   - Should include: `script-src 'self'` (or `'unsafe-inline' 'unsafe-eval'` in dev)
   - Should include: `connect-src 'self' https://*.supabase.co`
   - Should include: `frame-ancestors 'none'`

4. **Test CSP Enforcement**:
   - Open **Console** tab
   - Try to inject a script:
     ```javascript
     // This should be blocked by CSP
     eval('alert("XSS")');
     ```
   - Should see CSP violation error in console

### ✅ Expected Results
- CSP header present on all HTML pages
- CSP violations logged in console
- No inline scripts executed (except those explicitly allowed)

---

## Test 2: Cookie-Based Authentication

### Objective
Verify that authentication uses httpOnly cookies instead of localStorage.

### Steps

1. **Sign In**:
   - Go to `http://localhost:8080/auth`
   - Sign in with valid credentials

2. **Check Network Tab**:
   - Look for request to `/functions/v1/auth-cookie`
   - Should return `200 OK`
   - Response should include `Set-Cookie` headers

3. **Check Cookies** (Application Tab):
   - Go to **Application** → **Cookies** → `http://localhost:8080`
   - You should see:
     - `session` cookie
       - ✅ `HttpOnly` flag: **Yes**
       - ✅ `SameSite`: **Lax**
       - ✅ `Secure`: **No** (in dev) or **Yes** (in production)
     - `csrf-token` cookie
       - ✅ `HttpOnly` flag: **Yes**
       - ✅ `SameSite`: **Lax`

4. **Verify No localStorage**:
   - Go to **Application** → **Local Storage** → `http://localhost:8080`
   - ✅ Should **NOT** see any Supabase auth tokens
   - ✅ Should **NOT** see `sb-access-token` or `sb-refresh-token`

5. **Test Session Persistence**:
   - Close the browser tab (not browser)
   - Reopen `http://localhost:8080`
   - ✅ Should still be logged in (cookies persist)

### ✅ Expected Results
- Cookies set with httpOnly flag
- No auth tokens in localStorage
- Session persists across tab closes
- `auth-cookie` endpoint returns success

---

## Test 3: CSRF Protection

### Objective
Verify that state-changing requests include CSRF tokens.

### Steps

1. **Sign In First** (to get CSRF token)

2. **Test CSRF Token in Requests**:
   - Open **Network** tab
   - Perform actions that make POST/PUT/DELETE requests:
     - **Save an opportunity** (if available)
     - **Update profile** (`/profile` page)
     - **Send contact form** (`/contact` page)
     - **Import hospitals** (if admin, `/admin/import-hospitals`)

3. **For Each POST/PUT/DELETE Request**:
   - Click on the request in Network tab
   - Go to **Headers** tab
   - Look for **Request Headers**
   - ✅ Should see: `X-CSRF-Token: <token-value>`
   - ✅ Should see: `Cookie: session=...; csrf-token=...`

4. **Verify CSRF Validation**:
   - Check **Response** tab
   - ✅ Should return `200 OK` (not `403 Forbidden`)
   - ✅ No CSRF errors in console

5. **Test CSRF Failure** (Optional - Advanced):
   - Open **Console**
   - Try to manually make a POST request without CSRF token:
     ```javascript
     fetch('/functions/v1/send-contact-email', {
       method: 'POST',
       body: JSON.stringify({name: 'test', email: 'test@test.com', subject: 'test', message: 'test'})
     })
     ```
   - ✅ Should return `403` with CSRF error

### ✅ Expected Results
- All POST/PUT/DELETE requests include `X-CSRF-Token` header
- Requests succeed (200 OK)
- No CSRF validation errors

---

## Test 4: Origin Validation

### Objective
Verify that edge functions only accept requests from allowed origins.

### Steps

1. **Test from Allowed Origin**:
   - Make requests from `http://localhost:8080`
   - ✅ Should work normally

2. **Test from Disallowed Origin** (Advanced):
   - Open browser console
   - Try to make a request with a fake origin:
     ```javascript
     fetch('https://sysbtcikrbrrgafffody.supabase.co/functions/v1/csrf-token', {
       method: 'GET',
       headers: {
         'Origin': 'https://evil.com'
       }
     })
     ```
   - ✅ Should return `403 Forbidden` (if edge function validates origin)

### ✅ Expected Results
- Requests from allowed origins succeed
- Requests from disallowed origins fail (if tested)

---

## Test 5: Sign Out Flow

### Objective
Verify that logout clears cookies properly.

### Steps

1. **Sign In First**

2. **Check Cookies Before Logout**:
   - **Application** → **Cookies**
   - ✅ Should see `session` and `csrf-token` cookies

3. **Sign Out**:
   - Click **Log Out** button
   - Check **Network** tab
   - ✅ Should see request to `/functions/v1/logout`
   - ✅ Should return `200 OK`

4. **Check Cookies After Logout**:
   - **Application** → **Cookies**
   - ✅ `session` cookie should be **deleted**
   - ✅ `csrf-token` cookie should be **deleted**

5. **Verify Redirect**:
   - ✅ Should be redirected to home page
   - ✅ Should not be able to access protected routes

### ✅ Expected Results
- Logout endpoint called successfully
- Cookies cleared
- User redirected and logged out

---

## Test 6: Edge Function Security

### Objective
Verify that edge functions have proper CORS and security headers.

### Steps

1. **Test CORS Headers**:
   - Make any request to an edge function
   - Check **Response Headers** in Network tab
   - ✅ Should see: `Access-Control-Allow-Origin: http://localhost:8080` (exact origin, not `*`)
   - ✅ Should see: `Access-Control-Allow-Credentials: true`
   - ✅ Should see: `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type, x-csrf-token`

2. **Test Preflight Requests**:
   - For POST requests, check for OPTIONS preflight request
   - ✅ Should return `200 OK` with proper CORS headers

### ✅ Expected Results
- CORS headers use exact origin (not wildcard)
- Credentials allowed
- Preflight requests succeed

---

## Test 7: Token Refresh

### Objective
Verify that token refresh works with cookie-based auth.

### Steps

1. **Sign In**

2. **Wait for Token Refresh** (or trigger manually):
   - Supabase should automatically refresh tokens
   - Check **Network** tab for token refresh requests

3. **Verify Cookie Update**:
   - After refresh, check cookies
   - ✅ New `session` cookie should be set
   - ✅ New `csrf-token` cookie should be set

4. **Verify No Disruption**:
   - ✅ User should remain logged in
   - ✅ No errors in console
   - ✅ App should continue working normally

### ✅ Expected Results
- Token refresh updates cookies
- No session disruption
- No errors

---

## Test 8: Protected Routes

### Objective
Verify that protected routes work correctly with cookie-based auth.

### Steps

1. **Test While Logged In**:
   - Navigate to `/dashboard`
   - Navigate to `/profile`
   - Navigate to `/admin/import-hospitals` (if admin)
   - ✅ All should load without errors
   - ✅ Buttons and interactions should work

2. **Test While Logged Out**:
   - Sign out
   - Try to access `/dashboard` or `/profile`
   - ✅ Should redirect to login or show error
   - ✅ Cannot access protected content

### ✅ Expected Results
- Protected routes accessible when logged in
- Protected routes inaccessible when logged out
- Proper redirects

---

## Common Issues & Troubleshooting

### Issue: 404 Errors for Edge Functions
**Solution**: Deploy the functions:
```bash
supabase functions deploy csrf-token
supabase functions deploy auth-cookie
supabase functions deploy logout
```

### Issue: CORS Errors
**Solution**: 
- Check that `getCorsHeaders()` is used in edge functions
- Verify `ALLOWED_ORIGINS` includes your domain
- Check that `credentials: 'include'` is used in fetch requests

### Issue: CSRF Token Missing
**Solution**:
- Ensure you're signed in (CSRF token set after login)
- Check that `X-CSRF-Token` header is being added in `customFetch`
- Verify `csrf-token` cookie exists

### Issue: Cookies Not Set
**Solution**:
- Check that `auth-cookie` function is deployed
- Verify sign-in completed successfully
- Check Network tab for `auth-cookie` request success

### Issue: Page Freezing/Unresponsive
**Solution**:
- Check console for infinite loop errors
- Verify `useAuth` hook doesn't have dependency issues
- Check that `isMounted` flag is working correctly

---

## Quick Test Checklist

Use this checklist to quickly verify all security features:

- [ ] CSP headers present on all routes
- [ ] No auth tokens in localStorage
- [ ] httpOnly cookies set after login
- [ ] CSRF token in POST/PUT/DELETE requests
- [ ] Logout clears cookies
- [ ] Protected routes work correctly
- [ ] Token refresh updates cookies
- [ ] CORS headers use exact origin
- [ ] No CORS errors in console
- [ ] No CSRF errors in console
- [ ] All edge functions return 200 (not 404)

---

## Security Features Summary

✅ **CSP Headers**: Applied to all routes, prevents XSS  
✅ **Cookie-Based Auth**: httpOnly cookies, no localStorage  
✅ **CSRF Protection**: Double-submit cookie pattern  
✅ **Origin Validation**: Only allowed origins can call functions  
✅ **Secure Cookies**: SameSite=Lax, httpOnly, Secure in production  
✅ **No localStorage**: Auth tokens never stored client-side  

---

## Next Steps

After testing:
1. Deploy edge functions to production
2. Test in production environment
3. Monitor for any security issues
4. Update CSP policy if needed for production

