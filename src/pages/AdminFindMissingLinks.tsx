import { useState } from "react";
import { Helmet } from "react-helmet-async";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { logger } from "@/lib/logger";

const EXCLUDED_DOMAINS = [
  'yelp.com', 'healthgrades.com', 'vitals.com', 'webmd.com', 'wikipedia.org',
  'facebook.com', 'linkedin.com', 'twitter.com', 'instagram.com',
  'yellowpages.com', 'whitepages.com', 'bbb.org', 'indeed.com', 'glassdoor.com',
  'google.com/maps', 'mapquest.com',
];

const REQUEST_DELAY_MS = 2000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return null;
  }
}

function isExcludedDomain(url: string): boolean {
  const domain = extractDomain(url);
  if (!domain) return true;
  return EXCLUDED_DOMAINS.some(excluded => domain.includes(excluded));
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

function emailDomainMatchesWebsite(email: string, website: string): boolean {
  const emailDomain = email.split('@')[1]?.toLowerCase();
  const websiteDomain = extractDomain(website)?.toLowerCase();
  if (!emailDomain || !websiteDomain) return false;
  return emailDomain === websiteDomain || emailDomain.endsWith('.' + websiteDomain);
}

async function searchForWebsite(name: string, location: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(`${name} ${location} official website`);
    const searchUrl = `https://html.duckduckgo.com/html/?q=${query}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();
    const urlPattern = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"/gi;
    const matches: string[] = [];
    let match;
    
    while ((match = urlPattern.exec(html)) !== null && matches.length < 5) {
      const url = match[1];
      if (!isExcludedDomain(url)) {
        matches.push(url);
      }
    }
    
    // Try common patterns if search fails
    if (matches.length === 0) {
      const cleanName = name.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '')
        .substring(0, 30);
      
      const patterns = [
        `https://www.${cleanName}.org`,
        `https://www.${cleanName}.com`,
        `https://${cleanName}.org`,
        `https://${cleanName}.com`,
      ];
      
      for (const pattern of patterns) {
        try {
          const testResponse = await fetch(pattern, {
            method: 'HEAD',
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(5000),
          });
          if (testResponse.ok) {
            return pattern;
          }
        } catch {
          // Continue
        }
      }
    }
    
    return matches.length > 0 ? matches[0] : null;
  } catch (error) {
    logger.error('Error searching for website', error);
    return null;
  }
}

async function verifyWebsite(website: string, name: string): Promise<boolean> {
  try {
    const response = await fetch(website, {
      method: 'HEAD',
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) return false;
    
    const domain = extractDomain(website);
    if (!domain) return false;
    
    const nameWords = name.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const domainLower = domain.toLowerCase();
    const hasNameMatch = nameWords.some(word => domainLower.includes(word));
    
    return hasNameMatch;
  } catch {
    return false;
  }
}

async function findEmailOnWebsite(website: string): Promise<string | null> {
  try {
    const response = await fetch(website, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();
    const emailPatterns = [
      /contact@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
      /info@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
      /volunteer@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
      /hr@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
      /volunteers@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
      /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
    ];
    
    const foundEmails = new Set<string>();
    
    for (const pattern of emailPatterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        const email = match[1] || match[0];
        const cleanEmail = email.replace('mailto:', '').trim().toLowerCase();
        
        if (isValidEmail(cleanEmail) && emailDomainMatchesWebsite(cleanEmail, website)) {
          foundEmails.add(cleanEmail);
        }
      }
    }
    
    const preferredEmails = Array.from(foundEmails).filter(e => 
      e.startsWith('contact@') || e.startsWith('info@') || e.startsWith('volunteer@')
    );
    
    return preferredEmails.length > 0 ? preferredEmails[0] : (Array.from(foundEmails)[0] || null);
  } catch (error) {
    logger.error('Error finding email', error);
    return null;
  }
}

interface Opportunity {
  id: string;
  name: string;
  type: string;
  location: string;
  website?: string | null;
  email?: string | null;
}

interface ProcessResult {
  id: string;
  name: string;
  website_found: boolean;
  email_found: boolean;
  website?: string | null;
  email?: string | null;
  error?: string;
}

export default function AdminFindMissingLinks() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ProcessResult[]>([]);
  const [stats, setStats] = useState({ processed: 0, updated: 0, failed: 0, skipped: 0 });

  const handleProcess = async () => {
    setIsProcessing(true);
    setProgress(0);
    setResults([]);
    setStats({ processed: 0, updated: 0, failed: 0, skipped: 0 });

    try {
      toast.info("Fetching hospitals from database...");
      
      // Query hospitals missing website or email
      const { data: opportunities, error: queryError } = await supabase
        .from('opportunities')
        .select('id, name, type, location, website, email')
        .eq('type', 'hospital')
        .or('website.is.null,email.is.null')
        .limit(50); // Process 50 at a time

      if (queryError) throw queryError;

      if (!opportunities || opportunities.length === 0) {
        toast.success("No hospitals found missing website or email!");
        setIsProcessing(false);
        return;
      }

      toast.info(`Found ${opportunities.length} hospitals to process. Starting...`);

      const processResults: ProcessResult[] = [];
      let updated = 0;
      let failed = 0;
      let skipped = 0;

      for (let i = 0; i < opportunities.length; i++) {
        const opp = opportunities[i];
        setProgress(((i + 1) / opportunities.length) * 100);
        
        const result: ProcessResult = {
          id: opp.id,
          name: opp.name,
          website_found: false,
          email_found: false,
        };

        try {
          // Find website if missing
          if (!opp.website) {
            toast.info(`[${i + 1}/${opportunities.length}] Searching for website: ${opp.name}...`);
            const website = await searchForWebsite(opp.name, opp.location);
            
            if (website) {
              const isValid = await verifyWebsite(website, opp.name);
              if (isValid) {
                const { error: updateError } = await supabase
                  .from('opportunities')
                  .update({ website })
                  .eq('id', opp.id);
                
                if (updateError) {
                  result.error = `Failed to update website: ${updateError.message}`;
                  failed++;
                } else {
                  result.website = website;
                  result.website_found = true;
                  updated++;
                  toast.success(`✓ Updated website for ${opp.name}`);
                }
              } else {
                result.error = 'Website found but failed verification';
                skipped++;
              }
            } else {
              result.error = 'No website found';
              skipped++;
            }
            
            await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
          } else {
            result.website = opp.website;
            result.website_found = true;
          }
          
          // Find email if missing
          if (!opp.email) {
            const websiteToCheck = result.website || opp.website;
            
            if (websiteToCheck) {
              const email = await findEmailOnWebsite(websiteToCheck);
              
              if (email && isValidEmail(email) && emailDomainMatchesWebsite(email, websiteToCheck)) {
                const { error: updateError } = await supabase
                  .from('opportunities')
                  .update({ email })
                  .eq('id', opp.id);
                
                if (updateError) {
                  result.error = result.error 
                    ? `${result.error}; Failed to update email: ${updateError.message}`
                    : `Failed to update email: ${updateError.message}`;
                  if (!result.error?.includes('website')) failed++;
                } else {
                  result.email = email;
                  result.email_found = true;
                  updated++;
                  toast.success(`✓ Updated email for ${opp.name}`);
                }
              } else {
                if (!result.error) {
                  result.error = 'No valid email found';
                  skipped++;
                }
              }
              
              await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
            } else if (!opp.website) {
              if (!result.error) {
                result.error = 'Cannot find email without website';
                skipped++;
              }
            }
          } else {
            result.email = opp.email;
            result.email_found = true;
          }
        } catch (error) {
          result.error = error instanceof Error ? error.message : 'Unknown error';
          failed++;
          logger.error(`Error processing ${opp.name}`, error);
        }

        processResults.push(result);
        setResults([...processResults]);
        setStats({ processed: i + 1, updated, failed, skipped });
      }

      toast.success(`Processing complete! Updated ${updated} hospitals.`);
      setProgress(100);
    } catch (error) {
      logger.error("Process error", error);
      toast.error("Failed to process hospitals. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Find Missing Links | Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />

        <main className="flex-1 container mx-auto px-4 pt-28 pb-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold text-foreground flex items-center justify-center gap-2">
                <Search className="h-8 w-8 text-primary" />
                Find Missing Links
              </h1>
              <p className="text-muted-foreground">
                Automatically discover and update missing website and email links for hospitals
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Process Hospitals</CardTitle>
                <CardDescription>
                  This will search for missing websites and emails for up to 50 hospitals at a time
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={handleProcess}
                  disabled={isProcessing}
                  className="w-full"
                  size="lg"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Find & Update Links
                    </>
                  )}
                </Button>

                {isProcessing && (
                  <div className="space-y-2">
                    <Progress value={progress} />
                    <p className="text-sm text-muted-foreground text-center">
                      Processing hospitals... This may take several minutes.
                    </p>
                  </div>
                )}

                {(stats.processed > 0 || results.length > 0) && (
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div className="p-4 bg-blue-500/10 rounded-lg">
                      <div className="text-2xl font-bold text-blue-500">{stats.processed}</div>
                      <div className="text-sm text-muted-foreground">Processed</div>
                    </div>
                    <div className="p-4 bg-green-500/10 rounded-lg">
                      <div className="text-2xl font-bold text-green-500">{stats.updated}</div>
                      <div className="text-sm text-muted-foreground">Updated</div>
                    </div>
                    <div className="p-4 bg-yellow-500/10 rounded-lg">
                      <div className="text-2xl font-bold text-yellow-500">{stats.skipped}</div>
                      <div className="text-sm text-muted-foreground">Skipped</div>
                    </div>
                    <div className="p-4 bg-red-500/10 rounded-lg">
                      <div className="text-2xl font-bold text-red-500">{stats.failed}</div>
                      <div className="text-sm text-muted-foreground">Failed</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {results.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Results</CardTitle>
                  <CardDescription>
                    Detailed results for each processed hospital
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {results.map((result) => (
                      <div key={result.id} className="p-3 bg-muted rounded-lg text-sm">
                        <div className="font-medium mb-1">{result.name}</div>
                        {result.website_found && result.website && (
                          <div className="text-green-600 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Website: {result.website}
                          </div>
                        )}
                        {result.email_found && result.email && (
                          <div className="text-green-600 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Email: {result.email}
                          </div>
                        )}
                        {result.error && (
                          <div className="text-red-600 flex items-center gap-1">
                            <XCircle className="h-3 w-3" />
                            {result.error}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>How It Works</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <p>
                  This tool automatically searches the internet to find official websites and contact emails 
                  for hospitals that are missing this information.
                </p>
                <div className="space-y-2">
                  <p className="font-medium text-foreground">Process:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Queries database for hospitals missing website or email</li>
                    <li>Searches DuckDuckGo for official websites</li>
                    <li>Verifies websites are legitimate and official</li>
                    <li>Scrapes websites to find contact email addresses</li>
                    <li>Verifies emails match website domains</li>
                    <li>Updates the database automatically</li>
                  </ol>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary">Direct Database Updates</Badge>
                  <Badge variant="secondary">Auto Verification</Badge>
                  <Badge variant="secondary">Real-time Progress</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}
