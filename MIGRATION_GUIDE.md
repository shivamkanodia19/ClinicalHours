# How to Apply Performance Optimization Migration

This guide explains how to apply the database performance optimizations to your Supabase project.

## Option 1: Using Supabase Dashboard (Recommended - Easiest)

### Step 1: Access Supabase Dashboard
1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Sign in to your account
3. Select your project (project ID: `sysbtcikrbrrgafffody`)

### Step 2: Open SQL Editor
1. In the left sidebar, click on **"SQL Editor"**
2. Click **"New query"** button

### Step 3: Copy and Run Migration
1. Open the file: `supabase/migrations/20251229000000_performance_optimization.sql`
2. Copy the entire contents of the file
3. Paste it into the SQL Editor in Supabase Dashboard
4. Click **"Run"** button (or press Ctrl+Enter)

### Step 4: Verify Migration
1. After running, you should see "Success" message
2. Check the left sidebar → **"Database"** → **"Indexes"**
3. You should see all the new indexes listed (20+ indexes)

## Option 2: Using Supabase CLI (If Installed)

### Prerequisites
- Supabase CLI installed: `npm install -g supabase`
- Logged in: `supabase login`
- Linked to project: `supabase link --project-ref sysbtcikrbrrgafffody`

### Apply Migration
```bash
# Navigate to your project directory
cd C:\Users\shiva\ClinicalHours-2

# Push migrations to Supabase
supabase db push
```

## Verify Indexes Were Created

### In Supabase Dashboard:
1. Go to **"Database"** → **"Indexes"** in the left sidebar
2. You should see indexes like:
   - `idx_reviews_opportunity_id`
   - `idx_reviews_created_at_desc`
   - `idx_questions_opportunity_id`
   - `idx_answers_question_id`
   - `idx_votes_votable`
   - And many more...

### Using SQL Query:
Run this in SQL Editor to see all indexes:
```sql
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
```

## Monitor Performance

### In Supabase Dashboard:
1. Go to **"Database"** → **"Reports"**
2. View query performance metrics
3. Check for slow queries

### Check Query Performance:
Run this to see slow queries:
```sql
SELECT 
  query,
  calls,
  total_exec_time,
  mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

## Troubleshooting

### If Migration Fails:
1. **Check for existing indexes**: Some indexes might already exist
   - The migration uses `CREATE INDEX IF NOT EXISTS` so this shouldn't be an issue
   
2. **Check extension availability**: 
   - Run: `SELECT * FROM pg_extension WHERE extname = 'pg_trgm';`
   - If not available, the trigram indexes will be skipped (not critical)

3. **Check constraints**:
   - The migration checks if constraints exist before adding them
   - If you see constraint errors, they may already exist (safe to ignore)

### Common Issues:
- **"Extension pg_trgm does not exist"**: This is okay - trigram indexes will be skipped
- **"Index already exists"**: Safe to ignore (IF NOT EXISTS handles this)
- **"Constraint already exists"**: Safe to ignore (migration checks for this)

## Next Steps After Migration

1. **Monitor for 24-48 hours**: Check query performance in Supabase dashboard
2. **Review slow queries**: Use Database → Reports to identify any slow queries
3. **Adjust if needed**: Fine-tune based on actual usage patterns

## Server-Side Rate Limiting (Future Enhancement)

For production, consider implementing server-side rate limiting:

1. **Supabase Edge Functions**: Add rate limiting middleware
2. **API Gateway**: Use a service like Cloudflare or AWS API Gateway
3. **Database Functions**: Create PostgreSQL functions with rate limiting logic

The client-side rate limiting we've implemented provides basic protection, but server-side is more secure and harder to bypass.

