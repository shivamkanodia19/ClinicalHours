# CSV Import Scripts

## Texas Hospitals Import

Import Texas hospitals from CSV file into Supabase database.

### Prerequisites

1. **Environment Variables**: Create a `.env` file in the project root with:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

   > **Note**: The service role key is different from the anon key. Get it from your Supabase project settings → API → service_role key.

2. **CSV File**: Ensure the CSV file is at:
   ```
   c:\Users\shiva\Downloads\texas (1).csv
   ```

### Usage

```bash
npm run import:texas
```

### What It Does

1. Reads the CSV file with Texas hospitals
2. Maps CSV columns to database fields:
   - `name` → name
   - `website` → website
   - `email` → email
   - `phone` → phone
   - `bio` → description
   - `city + state` → location
   - `lat` → latitude
   - `lon` → longitude
   - `type` → inferred from name/bio (defaults to "hospital")
3. Checks for duplicates (by name + location)
4. Inserts records in batches of 100
5. Shows progress and final summary

### Expected Output

```
🚀 Starting Texas Hospitals Import
==================================================
📖 Reading CSV file: c:\Users\shiva\Downloads\texas (1).csv
✅ Parsed 653 records from CSV
🔍 Checking for existing opportunities...
✅ Found X existing opportunities
📝 Mapping CSV rows to opportunities...
✅ Mapped Y valid opportunities
⚠️  Skipped Z invalid/duplicate records
📦 Processing Y opportunities in batches of 100...
==================================================
📊 IMPORT SUMMARY
==================================================
✅ Successfully imported: Y
❌ Failed: 0
⚠️  Skipped (invalid/duplicate): Z
📝 Total processed: 653
⏱️  Duration: X.XXs
==================================================
🎉 Import completed successfully!
```

### Performance

- **~653 records** processed in ~7 batches
- **Estimated time:** 10-30 seconds
- **No geocoding delays** (coordinates already in CSV)

