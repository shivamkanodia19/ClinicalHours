# Setting Up Password Reset Emails from clinicalhours.org

The password reset functionality is already built into your app! You just need to configure the email service.

## Step 1: Create a Resend Account

1. Go to https://resend.com
2. Sign up for a free account (100 emails/day free tier)
3. Verify your email address

## Step 2: Verify Your Domain (clinicalhours.org)

1. In Resend dashboard, go to **Domains**
2. Click **Add Domain**
3. Enter: `clinicalhours.org`
4. Resend will give you DNS records to add:
   - **DKIM record** (for email authentication)
   - **SPF record** (for email security)
   - **DMARC record** (optional but recommended)

5. Add these DNS records to your domain registrar (where you bought clinicalhours.org)
   - Go to your domain's DNS settings
   - Add the TXT records that Resend provides
   - Wait for DNS propagation (can take a few minutes to 24 hours)

6. Once verified, Resend will show the domain as "Verified" ✅

## Step 3: Get Your Resend API Key

1. In Resend dashboard, go to **API Keys**
2. Click **Create API Key**
3. Give it a name like "ClinicalHours Production"
4. Copy the API key (you'll only see it once!)

## Step 4: Add API Key to Supabase

1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions** → **Secrets**
3. Click **Add Secret**
4. Name: `RESEND_API_KEY`
5. Value: Paste your Resend API key
6. Click **Save**

## Step 5: Test It!

1. Go to your website: https://clinicalhours.org/auth
2. Click "Forgot Password?"
3. Enter an email address
4. Check that email inbox for the password reset email from `noreply@clinicalhours.org`

## Troubleshooting

**Email not sending?**
- Check Supabase Edge Functions logs for errors
- Verify RESEND_API_KEY is set correctly in Supabase secrets
- Make sure domain is verified in Resend dashboard

**Domain not verifying?**
- Check DNS records are added correctly
- Wait up to 24 hours for DNS propagation
- Use a DNS checker tool to verify records are live

**Emails going to spam?**
- Make sure DKIM, SPF, and DMARC records are all set up
- Wait a few days for domain reputation to build
- Consider setting up DMARC policy

## Current Configuration

The password reset email is already configured to:
- Send from: `noreply@clinicalhours.org`
- Include a branded HTML email template
- Expire reset links after 1 hour
- Rate limit to prevent abuse (3 requests per email per hour)

The code is in: `supabase/functions/send-password-reset/index.ts`

