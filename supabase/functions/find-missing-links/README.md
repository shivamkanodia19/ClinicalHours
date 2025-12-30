# Find Missing Links Edge Function

This Supabase Edge Function automatically discovers and updates missing website and email links for opportunities in the database using web scraping.

## Overview

The function queries the database for opportunities that are missing either a website or email address, then uses web scraping to find official websites and contact emails. It verifies that the links are legitimate and automatically updates the database records.

## Features

- **Admin-only access**: Requires admin role to execute
- **Rate limiting**: Maximum 10 requests per hour per admin
- **Web scraping**: Uses DuckDuckGo search to find official websites
- **Website verification**: Validates that found websites are official and accessible
- **Email discovery**: Scrapes websites to find contact email addresses
- **Email verification**: Ensures emails match website domains and are properly formatted
- **Batch processing**: Processes opportunities in configurable batches
- **Dry run mode**: Test the function without updating the database
- **Comprehensive logging**: Detailed logs for debugging and monitoring

## Request Format

```typescript
interface FindMissingLinksRequest {
  limit?: number;           // Max opportunities to process (default: 50, max: 100)
  opportunityType?: string; // Filter by type: 'hospital', 'clinic', 'hospice', 'emt', 'volunteer' (default: all)
  batchSize?: number;      // Process in batches (default: 10, max: 20)
  dryRun?: boolean;        // If true, don't update DB (default: false)
}
```

## Example Request

```bash
curl -X POST https://your-project.supabase.co/functions/v1/find-missing-links \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "limit": 25,
    "opportunityType": "hospital",
    "batchSize": 5,
    "dryRun": false
  }'
```

## Response Format

```json
{
  "success": true,
  "processed": 25,
  "updated": 18,
  "failed": 5,
  "skipped": 2,
  "details": [
    {
      "id": "uuid",
      "name": "Hospital Name",
      "website_found": true,
      "email_found": true,
      "website": "https://hospital.com",
      "email": "contact@hospital.com"
    },
    {
      "id": "uuid",
      "name": "Clinic Name",
      "website_found": false,
      "email_found": false,
      "error": "No website found in search results"
    }
  ],
  "message": "Successfully processed 25 opportunities, updated 18"
}
```

## Rate Limiting

- **Per admin**: Maximum 10 requests per hour
- **Per request**: Maximum 10 opportunities processed per minute
- **Between requests**: 2.5 second delay between individual opportunity processing

## Website Discovery

The function searches for official websites using:
1. DuckDuckGo search with query: `"{name} {location} official website"`
2. Filters out directory sites (Yelp, Healthgrades, etc.)
3. Verifies website accessibility and domain relevance
4. Falls back to common URL patterns if search fails

## Email Discovery

After finding a website, the function:
1. Scrapes the website HTML for email addresses
2. Looks for common patterns: `contact@`, `info@`, `volunteer@`, `hr@`
3. Verifies email domain matches website domain
4. Validates email format (RFC 5322)

## Verification Logic

### Website Verification
- Website must be accessible (HTTP 200)
- Domain must contain keywords from organization name
- Excludes known directory/listing sites
- Checks for official branding indicators

### Email Verification
- Email domain must match website domain
- Must be valid email format
- Prefers contact/info/volunteer emails
- Excludes generic third-party service emails

## Excluded Domains

The following domains are automatically excluded from results:
- yelp.com
- healthgrades.com
- vitals.com
- webmd.com
- wikipedia.org
- facebook.com, linkedin.com, twitter.com, instagram.com
- yellowpages.com, whitepages.com
- bbb.org
- indeed.com, glassdoor.com
- google.com/maps, mapquest.com

## Error Handling

- Failed website searches are logged but don't stop processing
- Invalid websites are skipped
- Database update errors are included in response
- Network timeouts are handled gracefully
- All errors are logged with context

## Security

- Requires admin authentication (JWT token)
- Validates user has admin role
- Rate limiting prevents abuse
- Input validation and sanitization
- Respects robots.txt where possible
- Uses proper User-Agent headers

## Limitations

- Basic web scraping may encounter CAPTCHAs
- Some websites may block automated access
- Email discovery depends on website structure
- Search results may vary in quality
- Processing time increases with batch size

## Future Improvements

- Use dedicated APIs (SerpAPI, Clearbit) for better results
- Add manual review queue option
- Cache results to avoid re-scraping
- Add confidence scores for found links
- Support for additional search engines
- Better handling of CAPTCHAs and bot detection

## Testing

1. Start with a small batch (5-10 opportunities) in dry run mode
2. Verify website/email extraction accuracy
3. Test verification logic with known examples
4. Test rate limiting and error handling
5. Verify database updates are correct

## Usage Tips

- Use `dryRun: true` first to see what would be updated
- Start with small `limit` values to test
- Process by `opportunityType` for better organization
- Monitor logs for errors and adjust as needed
- Run during off-peak hours for better performance

