# Comprehensive Authentication Testing Guide

This guide provides step-by-step instructions for testing all authentication flows, email systems, and security features.

## Prerequisites

1. **Environment Setup**
   - Ensure Supabase project is configured
   - RESEND_API_KEY is set in Supabase Edge Functions secrets
   - Application is running locally or deployed
   - Access to email inbox for test emails

2. **Test Accounts**
   - Use real email addresses you can access
   - Use unique test emails (e.g., `test-YYYYMMDD-HHMMSS@example.com`)
   - Keep passwords meeting requirements (minimum length, etc.)

## Test Scenarios

### 1. Sign Up Flow

#### Test 1.1: Valid Sign Up
1. Navigate to `/auth`
2. Click "Sign Up" tab
3. Fill in:
   - Full Name: "Test User"
   - Email: `test-signup-${timestamp}@example.com`
   - Phone (optional): "(555) 123-4567"
   - Password: "TestPassword123!"
4. Click "Sign Up"
5. **Expected Results:**
   - ✅ Success toast: "Account created! Please check your email to verify your account."
   - ✅ Redirected to verification message screen
   - ✅ Verification email sent to provided email
   - ✅ Email contains verification link
   - ✅ Link points to `/verify?token=...`

#### Test 1.2: Invalid Email Format
1. Navigate to `/auth`
2. Click "Sign Up" tab
3. Fill in:
   - Email: "invalid-email"
   - Password: "TestPassword123!"
4. Click "Sign Up"
5. **Expected Results:**
   - ❌ Error: "Invalid email address"
   - Form does not submit

#### Test 1.3: Missing Required Fields
1. Navigate to `/auth`
2. Click "Sign Up" tab
3. Leave Full Name or Email empty
4. Click "Sign Up"
5. **Expected Results:**
   - ❌ Browser validation error or custom error
   - Form does not submit

#### Test 1.4: Duplicate Email
1. Use email from Test 1.1
2. Navigate to `/auth`
3. Click "Sign Up" tab
4. Fill in same email with different password
5. Click "Sign Up"
6. **Expected Results:**
   - ❌ Error message (may be generic to prevent enumeration)
   - Account not created

#### Test 1.5: Resend Verification Email
1. After Test 1.1, on verification message screen
2. Click "Resend Verification Email"
3. **Expected Results:**
   - ✅ Success toast: "Verification email sent! Please check your inbox."
   - ✅ New email received (may have different token)

### 2. Email Verification Flow

#### Test 2.1: Verify Email with Valid Token
1. Complete Test 1.1 to receive verification email
2. Open email inbox
3. Click verification link in email (or copy/paste)
4. Navigate to `/verify?token=<token>`
5. **Expected Results:**
   - ✅ Loading indicator appears briefly
   - ✅ Success message: "Email Verified!"
   - ✅ Email address displayed
   - ✅ Button: "Sign In Now" appears
   - ✅ User profile updated: `email_verified = true`
   - ✅ Token marked as used in database

#### Test 2.2: Verify Email Twice (Already Verified)
1. Use same token from Test 2.1
2. Navigate to `/verify?token=<same-token>`
3. **Expected Results:**
   - ✅ Message: "Already Verified"
   - ✅ Button: "Go to Sign In"

#### Test 2.3: Invalid Token
1. Navigate to `/verify?token=invalid-token-12345`
2. **Expected Results:**
   - ❌ Error: "Invalid or expired verification link"
   - ✅ Error message displayed clearly

#### Test 2.4: Expired Token
1. Request verification email
2. Wait 24+ hours (or manually expire token in database)
3. Click link
4. **Expected Results:**
   - ❌ Error: "Verification link has expired. Please request a new one."
   - ✅ User can request new verification email

#### Test 2.5: No Token Provided
1. Navigate to `/verify` (no token parameter)
2. **Expected Results:**
   - ❌ Error: "No verification token provided"
   - ✅ Error message displayed

### 3. Sign In Flow

#### Test 3.1: Valid Sign In
1. Complete Test 2.1 (verified user)
2. Navigate to `/auth`
3. Click "Sign In" tab (or already selected)
4. Enter:
   - Email: Verified user email
   - Password: Original password
5. Click "Sign In"
6. **Expected Results:**
   - ✅ Success toast: "Logged in successfully!"
   - ✅ Redirected to `/dashboard`
   - ✅ Session created
   - ✅ User authenticated

#### Test 3.2: Invalid Password
1. Use verified email from Test 3.1
2. Enter wrong password
3. Click "Sign In"
4. **Expected Results:**
   - ❌ Error: "Invalid email or password. Please try again."
   - ✅ Generic error (doesn't reveal if email exists)
   - ❌ Not redirected

#### Test 3.3: Invalid Email
1. Enter non-existent email
2. Enter any password
3. Click "Sign In"
4. **Expected Results:**
   - ❌ Error: "Invalid email or password. Please try again."
   - ✅ Generic error (doesn't reveal if email exists)
   - ❌ Not redirected

#### Test 3.4: Empty Fields
1. Leave email or password empty
2. Click "Sign In"
3. **Expected Results:**
   - ❌ Browser validation or custom error
   - Form does not submit

#### Test 3.5: Unverified Email Sign In
1. Create account but don't verify
2. Attempt to sign in
3. **Expected Results:**
   - Behavior depends on Supabase configuration
   - May allow sign in or require verification

#### Test 3.6: Already Logged In Redirect
1. Sign in (Test 3.1)
2. Navigate to `/auth`
3. **Expected Results:**
   - ✅ Automatically redirected to `/dashboard`
   - ✅ Cannot access auth page while logged in

### 4. Password Reset Flow

#### Test 4.1: Request Password Reset (Valid Email)
1. Navigate to `/auth`
2. Click "Forgot Password?" link
3. Enter verified user's email
4. Click "Send Reset Link"
5. **Expected Results:**
   - ✅ Success toast: "If an account exists, a password reset email will be sent."
   - ✅ Email received within seconds
   - ✅ Email contains reset link: `/reset-password?token=...`
   - ✅ Email has professional styling
   - ✅ Link expiration noted (1 hour)

#### Test 4.2: Request Password Reset (Invalid Email)
1. Navigate to `/auth`
2. Click "Forgot Password?"
3. Enter non-existent email
4. Click "Send Reset Link"
5. **Expected Results:**
   - ✅ Same success message (prevents email enumeration)
   - ✅ No error revealed
   - ✅ No email sent (or sent to non-existent address)

#### Test 4.3: Reset Password with Valid Token
1. Complete Test 4.1
2. Open reset email
3. Click reset link or navigate to `/reset-password?token=<token>`
4. Enter new password: "NewPassword123!"
5. Confirm password: "NewPassword123!"
6. Click "Reset Password"
7. **Expected Results:**
   - ✅ Success message: "Password reset successfully!"
   - ✅ Redirected to sign in page
   - ✅ Can sign in with new password
   - ✅ Cannot sign in with old password
   - ✅ Token marked as used

#### Test 4.4: Password Mismatch
1. On reset password page
2. Enter password: "Password123!"
3. Confirm password: "DifferentPassword123!"
4. Click "Reset Password"
5. **Expected Results:**
   - ❌ Error: "Passwords do not match"
   - Form does not submit

#### Test 4.5: Weak Password
1. On reset password page
2. Enter weak password (if validation enforced)
3. Click "Reset Password"
4. **Expected Results:**
   - ❌ Error about password requirements
   - Form does not submit

#### Test 4.6: Expired Reset Token
1. Request password reset
2. Wait 1+ hour (or manually expire in database)
3. Click reset link
4. Enter new password
5. **Expected Results:**
   - ❌ Error: "Reset link has expired. Please request a new one."
   - ✅ Can request new reset link

#### Test 4.7: Used Reset Token
1. Complete Test 4.3 (successful reset)
2. Try using same reset link again
3. **Expected Results:**
   - ❌ Error: "Invalid or expired reset link"
   - ✅ Token cannot be reused

#### Test 4.8: Invalid Reset Token
1. Navigate to `/reset-password?token=invalid-token`
2. **Expected Results:**
   - ❌ Error: "Invalid or expired reset link"
   - ✅ Error message displayed

#### Test 4.9: Rate Limiting (Password Reset Requests)
1. Request password reset for same email 4+ times rapidly
2. **Expected Results:**
   - ✅ First 3 requests succeed
   - ❌ 4th+ request: Rate limit error or success (but no email)
   - ✅ Rate limit resets after 1 hour

### 5. Session Management

#### Test 5.1: Session Persistence
1. Sign in (Test 3.1)
2. Close browser tab
3. Reopen application
4. Navigate to `/dashboard`
5. **Expected Results:**
   - ✅ Still authenticated (session persisted)
   - ✅ Can access protected routes
   - ✅ User info displayed correctly

#### Test 5.2: Logout
1. While signed in
2. Click logout button/menu
3. **Expected Results:**
   - ✅ Successfully logged out
   - ✅ Redirected to home or auth page
   - ✅ Session cleared
   - ✅ Cannot access protected routes
   - ✅ Cookies cleared

#### Test 5.3: Session Timeout (30 minutes inactivity)
1. Sign in
2. Wait 30+ minutes without any activity
3. Try to navigate or interact
4. **Expected Results:**
   - ✅ Automatically logged out
   - ✅ Redirected to auth page or home
   - ✅ Session expired message (optional)

#### Test 5.4: Activity Resets Timeout
1. Sign in
2. Wait 29 minutes
3. Move mouse or interact (mousedown, mousemove, keypress, scroll, touchstart, click)
4. Wait another 29 minutes
5. **Expected Results:**
   - ✅ Still authenticated
   - ✅ Activity timer reset
   - ✅ Session not expired

#### Test 5.5: Multiple Tabs Session Sync
1. Sign in
2. Open another tab with same site
3. **Expected Results:**
   - ✅ Both tabs authenticated
   - ✅ Logout in one tab affects other tabs
   - ✅ Session state synchronized

### 6. Security Features

#### Test 6.1: CSRF Protection
1. Open browser DevTools
2. Attempt POST request without CSRF token
3. **Expected Results:**
   - ❌ Request fails with CSRF error (403)
   - ✅ State-changing operations protected

#### Test 6.2: Origin Validation
1. Try to call Edge Function from unauthorized domain
2. **Expected Results:**
   - ❌ Request rejected (403 Forbidden)
   - ✅ Only allowed origins work

#### Test 6.3: Email Enumeration Protection
1. Try to sign up with existing email
2. Try to reset password for non-existent email
3. **Expected Results:**
   - ✅ Same generic error messages
   - ✅ Cannot determine if email exists
   - ✅ Timing attacks prevented (constant response time)

#### Test 6.4: Token Security
1. Verify email token format
2. Verify reset token format
3. **Expected Results:**
   - ✅ Tokens are UUIDs (long, random)
   - ✅ Tokens are single-use
   - ✅ Tokens expire appropriately
   - ✅ Tokens cannot be guessed

#### Test 6.5: Rate Limiting
1. Attempt rapid requests:
   - Multiple sign up attempts
   - Multiple password resets
   - Multiple verification requests
2. **Expected Results:**
   - ✅ Rate limits enforced (429 Too Many Requests)
   - ✅ Limits reset after window
   - ✅ Different limits for different operations

### 7. Email System Testing

#### Test 7.1: Verification Email Content
1. Complete sign up
2. Check verification email
3. **Expected Results:**
   - ✅ Professional HTML email
   - ✅ Branded with ClinicalHours styling
   - ✅ Clear call-to-action button
   - ✅ Plain text link alternative
   - ✅ Expiration information (24 hours)
   - ✅ From: "ClinicalHours <support@send.clinicalhours.org>"
   - ✅ Subject: "Verify your ClinicalHours account"

#### Test 7.2: Password Reset Email Content
1. Request password reset
2. Check reset email
3. **Expected Results:**
   - ✅ Professional HTML email
   - ✅ Branded with ClinicalHours styling
   - ✅ Clear call-to-action button
   - ✅ Plain text link alternative
   - ✅ Expiration information (1 hour)
   - ✅ Security warning about ignoring if not requested
   - ✅ From: "ClinicalHours <noreply@clinicalhours.org>"
   - ✅ Subject: "Reset your ClinicalHours password"

#### Test 7.3: Email Links Work
1. Click links in emails
2. **Expected Results:**
   - ✅ Verification links go to `/verify?token=...`
   - ✅ Reset links go to `/reset-password?token=...`
   - ✅ Links use production domain (`clinicalhours.org`)
   - ✅ Links are clickable and functional

#### Test 7.4: Email Delivery
1. Check spam folder
2. Check email delivery time
3. **Expected Results:**
   - ✅ Emails arrive within 1-5 seconds
   - ✅ Emails not marked as spam (check sender reputation)
   - ✅ Emails formatted correctly in all email clients

#### Test 7.5: Email Error Handling
1. Test with invalid RESEND_API_KEY (if possible)
2. Test with invalid email domain
3. **Expected Results:**
   - ✅ Graceful error handling
   - ✅ Appropriate error messages logged
   - ✅ User sees appropriate feedback

### 8. Edge Cases

#### Test 8.1: Very Long Email
1. Try email with 250+ characters
2. **Expected Results:**
   - ❌ Validation error
   - ✅ Email length limits enforced

#### Test 8.2: Special Characters in Email
1. Try email with special characters (if valid)
2. **Expected Results:**
   - ✅ Valid special characters accepted
   - ✅ Invalid characters rejected

#### Test 8.3: Unicode in Names
1. Sign up with Unicode characters in name
2. **Expected Results:**
   - ✅ Properly handled in database
   - ✅ Displayed correctly in emails
   - ✅ No encoding issues

#### Test 8.4: Concurrent Requests
1. Make multiple requests simultaneously
2. **Expected Results:**
   - ✅ No race conditions
   - ✅ Proper handling of concurrent operations

#### Test 8.5: Browser Back Button
1. Sign up, go to verification screen
2. Click browser back button
3. **Expected Results:**
   - ✅ Appropriate navigation handling
   - ✅ State maintained or cleared appropriately

## Testing Checklist

Use this checklist to ensure all scenarios are tested:

- [ ] Sign Up - Valid
- [ ] Sign Up - Invalid email
- [ ] Sign Up - Missing fields
- [ ] Sign Up - Duplicate email
- [ ] Sign Up - Resend verification
- [ ] Email Verification - Valid token
- [ ] Email Verification - Already verified
- [ ] Email Verification - Invalid token
- [ ] Email Verification - Expired token
- [ ] Email Verification - No token
- [ ] Sign In - Valid credentials
- [ ] Sign In - Invalid password
- [ ] Sign In - Invalid email
- [ ] Sign In - Empty fields
- [ ] Sign In - Unverified email (if applicable)
- [ ] Sign In - Already logged in redirect
- [ ] Password Reset - Request (valid email)
- [ ] Password Reset - Request (invalid email)
- [ ] Password Reset - Valid token
- [ ] Password Reset - Password mismatch
- [ ] Password Reset - Weak password
- [ ] Password Reset - Expired token
- [ ] Password Reset - Used token
- [ ] Password Reset - Invalid token
- [ ] Password Reset - Rate limiting
- [ ] Session - Persistence
- [ ] Session - Logout
- [ ] Session - Timeout
- [ ] Session - Activity resets timeout
- [ ] Session - Multiple tabs
- [ ] Security - CSRF protection
- [ ] Security - Origin validation
- [ ] Security - Email enumeration protection
- [ ] Security - Token security
- [ ] Security - Rate limiting
- [ ] Email - Verification content
- [ ] Email - Reset content
- [ ] Email - Links work
- [ ] Email - Delivery
- [ ] Email - Error handling

## Database Verification

After tests, verify database state:

```sql
-- Check email verification tokens
SELECT * FROM email_verification_tokens 
WHERE email LIKE 'test-%@example.com' 
ORDER BY created_at DESC;

-- Check password reset tokens
SELECT * FROM password_reset_tokens 
WHERE email LIKE 'test-%@example.com' 
ORDER BY created_at DESC;

-- Check user profiles
SELECT id, email, email_verified, created_at 
FROM profiles 
WHERE email LIKE 'test-%@example.com' 
ORDER BY created_at DESC;

-- Check auth users
SELECT id, email, email_confirmed_at, created_at 
FROM auth.users 
WHERE email LIKE 'test-%@example.com' 
ORDER BY created_at DESC;
```

## Cleanup

After testing, clean up test data:

```sql
-- Delete test users and related data
DELETE FROM email_verification_tokens 
WHERE email LIKE 'test-%@example.com';

DELETE FROM password_reset_tokens 
WHERE email LIKE 'test-%@example.com';

DELETE FROM profiles 
WHERE email LIKE 'test-%@example.com';

-- Note: auth.users may need manual deletion via Supabase dashboard
```

## Automated Testing

For automated testing, use the `test-auth.ts` script:

```bash
# Set environment variables
export SUPABASE_URL="your-supabase-url"
export SUPABASE_ANON_KEY="your-anon-key"

# Run tests
deno run --allow-net --allow-env test-auth.ts
```

## Reporting Issues

When reporting authentication issues, include:
1. Test scenario number
2. Steps to reproduce
3. Expected vs actual behavior
4. Browser/device information
5. Error messages (if any)
6. Network logs (if applicable)
7. Database state (if applicable)

## Notes

- Some tests require waiting (timeouts, email delivery)
- Email delivery may vary by provider
- Rate limits reset after their windows
- Session timeouts require inactivity
- Some tests may affect each other (e.g., duplicate email)

