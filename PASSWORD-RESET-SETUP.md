# Password Reset Setup Guide - Step by Step

## Overview
Your password reset feature is already built! You just need to configure the email service (Resend) to send emails from `noreply@clinicalhours.org`.

## Step-by-Step Setup

### Step 1: Create Resend Account (5 minutes)

1. Go to **https://resend.com**
2. Click **Sign Up** (top right)
3. Sign up with your email (free tier: 100 emails/day)
4. Verify your email address

### Step 2: Verify Your Domain - clinicalhours.org (10-15 minutes)

1. In Resend dashboard, click **Domains** in the left sidebar
2. Click **Add Domain** button
3. Enter: `clinicalhours.org` (without www)
4. Click **Add Domain**

5. **Resend will show you DNS records to add:**
   - You'll see 3-4 TXT records (DKIM, SPF, etc.)
   - Copy each record

6. **Add DNS records to your domain:**
   - Go to where you manage your domain DNS (GoDaddy, Namecheap, Cloudflare, etc.)
   - Find DNS settings for `clinicalhours.org`
   - Add each TXT record that Resend provided
   - **Important:** Make sure to add them exactly as Resend shows them

7. **Wait for verification:**
   - Go back to Resend dashboard
   - Click **Refresh** or wait a few minutes
   - Status should change to "Verified" ✅
   - This can take 5 minutes to 24 hours (usually 5-15 minutes)

### Step 3: Get Your Resend API Key (2 minutes)

1. In Resend dashboard, click **API Keys** in left sidebar
2. Click **Create API Key** button
3. Name it: `ClinicalHours Production`
4. Click **Create**
5. **IMPORTANT:** Copy the API key immediately (you can only see it once!)
   - It will look like: `re_xxxxxxxxxxxxxxxxxxxxx`
   - Save it somewhere safe

### Step 4: Add API Key to Supabase (5 minutes)

**Since you're using Lovable Cloud, you have two options:**

#### Option A: Add via Supabase Dashboard (Recommended)
1. Go to **https://supabase.com**
2. Sign in and select your **ClinicalHours** project
3. In left sidebar, click **Edge Functions**
4. Click **Secrets** tab (at the top)
5. Click **Add Secret** button
6. Fill in:
   - **Name:** `RESEND_API_KEY`
   - **Value:** Paste your Resend API key (the one you copied in Step 3)
7. Click **Save**

#### Option B: Add via Lovable Dashboard
1. Go to your Lovable project dashboard
2. Look for **Environment Variables** or **Secrets** section
3. Add a new secret:
   - **Key:** `RESEND_API_KEY`
   - **Value:** Paste your Resend API key
4. Make sure it's available to Edge Functions/Supabase functions
5. Redeploy if needed

**Note:** The secret needs to be accessible to Supabase Edge Functions, so Option A (Supabase dashboard) is usually more reliable.

### Step 5: Test It! (2 minutes)

1. Go to your website: **https://clinicalhours.org/auth**
2. Click **"Forgot Password?"** link (below the password field)
3. Enter an email address that's registered in your system
4. Click **"Send Reset Link"**
5. Check the email inbox
6. You should receive an email from: **ClinicalHours <noreply@clinicalhours.org>**
7. Click the **"Reset Password"** button in the email
8. It should take you to: **https://clinicalhours.org/reset-password?token=...**
9. Enter your new password and confirm it
10. Click **"Reset Password"**
11. You should see a success message!

## How It Works

1. **User clicks "Forgot Password?"** → Enters email
2. **System generates secure token** → Saves it to database
3. **Email sent** from `noreply@clinicalhours.org` with reset link
4. **User clicks link** → Goes to `clinicalhours.org/reset-password?token=...`
5. **User enters new password** → System validates and updates password
6. **Success!** → User can now sign in with new password

## Troubleshooting

### Email Not Sending?

**Check Supabase Logs:**
1. Go to Supabase dashboard → Edge Functions → Logs
2. Look for `send-password-reset` function logs
3. Check for error messages

**Or check Lovable Logs:**
1. Go to your Lovable project dashboard
2. Look for **Logs** or **Function Logs** section
3. Check for errors related to `send-password-reset`

**Common Issues:**
- ❌ `RESEND_API_KEY not configured` → Go back to Step 4
- ❌ `Domain not verified` → Go back to Step 2, check DNS records
- ❌ `Unauthorized` → API key is wrong, get a new one from Step 3

### Domain Not Verifying?

1. **Check DNS records are correct:**
   - Use a DNS checker: https://mxtoolbox.com/TXTLookup.aspx
   - Enter `clinicalhours.org` and check if Resend's TXT records appear

2. **Common mistakes:**
   - Forgot to save DNS records
   - Typo in DNS records
   - DNS hasn't propagated yet (wait up to 24 hours)

3. **Still not working?**
   - Contact your domain registrar support
   - Or contact Resend support: support@resend.com

### Reset Link Not Working?

- Make sure the link goes to: `https://clinicalhours.org/reset-password?token=...`
- Check that your website is deployed and accessible
- Token expires after 1 hour - request a new one if expired

### Emails Going to Spam?

- Make sure all DNS records (DKIM, SPF, DMARC) are set up
- Wait a few days for domain reputation to build
- Consider setting up DMARC policy in Resend

## Security Features Already Built In

✅ **Rate limiting:** Max 3 reset requests per email per hour  
✅ **Token expiration:** Links expire after 1 hour  
✅ **Secure tokens:** Cryptographically secure random tokens  
✅ **Email validation:** Prevents email enumeration attacks  
✅ **Constant-time responses:** Prevents timing attacks  

## Files Involved

- **Frontend:** `src/pages/Auth.tsx` (forgot password form)
- **Frontend:** `src/pages/ResetPassword.tsx` (reset password page)
- **Backend:** `supabase/functions/send-password-reset/index.ts` (sends email)
- **Backend:** `supabase/functions/reset-password/index.ts` (resets password)

## Lovable Cloud Specific Notes

Since you're using Lovable Cloud:
- ✅ Your site is already deployed at `clinicalhours.org`
- ✅ Edge Functions are already set up
- ✅ You just need to add the `RESEND_API_KEY` secret
- ⚠️ After adding the secret, you may need to redeploy or wait a few minutes for it to take effect

**Quick Lovable Checklist:**
1. ✅ Resend account created
2. ✅ Domain verified in Resend
3. ✅ API key created
4. ⏳ Add `RESEND_API_KEY` to Supabase secrets (or Lovable env vars)
5. ⏳ Test the forgot password flow

## Need Help?

If you're stuck:
1. Check Supabase Edge Functions logs for errors (or Lovable logs)
2. Check Resend dashboard for domain status
3. Verify DNS records are correct
4. Make sure API key is set correctly in Supabase secrets
5. Try redeploying your Lovable project after adding the secret

The code is already complete - you just need to configure Resend! 🚀

