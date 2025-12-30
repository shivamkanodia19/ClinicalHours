import { useState } from "react";
import { Helmet } from "react-helmet-async";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link, Loader2, CheckCircle, XCircle, AlertCircle, Search } from "lucide-react";
import { logger } from "@/lib/logger";

const OPPORTUNITY_TYPES = [
  { value: "all", label: "All Types" },
  { value: "hospital", label: "Hospitals" },
  { value: "clinic", label: "Clinics" },
  { value: "hospice", label: "Hospices" },
  { value: "emt", label: "EMT Services" },
  { value: "volunteer", label: "Volunteer Programs" },
];

const PROCESS_LIMITS = [
  { value: "10", label: "10 opportunities" },
  { value: "25", label: "25 opportunities" },
  { value: "50", label: "50 opportunities" },
  { value: "100", label: "100 opportunities" },
];

interface ProcessResult {
  success: boolean;
  processed: number;
  updated: number;
  failed: number;
  skipped: number;
  details?: Array<{
    id: string;
    name: string;
    website_found: boolean;
    email_found: boolean;
    website?: string | null;
    email?: string | null;
    error?: string;
  }>;
  message: string;
  error?: string;
}

export default function AdminFindMissingLinks() {
  const [opportunityType, setOpportunityType] = useState("all");
  const [limit, setLimit] = useState("25");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ProcessResult | null>(null);

  const handleProcess = async () => {
    setIsProcessing(true);
    setProgress(10);
    setResults(null);

    try {
      const body = {
        limit: parseInt(limit),
        opportunityType: opportunityType === "all" ? null : opportunityType,
      };

      setProgress(30);
      toast.info("Searching for missing websites and emails...");

      const { data, error } = await supabase.functions.invoke('find-missing-links', {
        body,
      });

      setProgress(100);

      if (error) {
        throw error;
      }

      setResults(data as ProcessResult);

      if (data.success) {
        toast.success(`Successfully processed ${data.processed} opportunities! Updated ${data.updated}.`);
      } else {
        toast.error(data.error || "Processing failed");
      }
    } catch (error) {
      logger.error("Process error", error);
      toast.error("Failed to process opportunities. Please try again.");
      setResults({
        success: false,
        processed: 0,
        updated: 0,
        failed: 0,
        skipped: 0,
        message: "Processing failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
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
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold text-foreground flex items-center justify-center gap-2">
                <Search className="h-8 w-8 text-primary" />
                Find Missing Links
              </h1>
              <p className="text-muted-foreground">
                Automatically discover and update missing website and email links for opportunities
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Processing Settings</CardTitle>
                <CardDescription>
                  Configure how many opportunities to process and filter by type
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Opportunity Type</label>
                    <Select value={opportunityType} onValueChange={setOpportunityType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {OPPORTUNITY_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Limit</label>
                    <Select value={limit} onValueChange={setLimit}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select limit" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROCESS_LIMITS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

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
                      Searching for websites and emails... This may take several minutes.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {results && (
              <Card className={results.success ? "border-green-500/50" : "border-destructive/50"}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {results.success ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive" />
                    )}
                    Processing Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {results.success ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-4 gap-4 text-center">
                        <div className="p-4 bg-blue-500/10 rounded-lg">
                          <div className="text-2xl font-bold text-blue-500">{results.processed}</div>
                          <div className="text-sm text-muted-foreground">Processed</div>
                        </div>
                        <div className="p-4 bg-green-500/10 rounded-lg">
                          <div className="text-2xl font-bold text-green-500">{results.updated}</div>
                          <div className="text-sm text-muted-foreground">Updated</div>
                        </div>
                        <div className="p-4 bg-yellow-500/10 rounded-lg">
                          <div className="text-2xl font-bold text-yellow-500">{results.skipped}</div>
                          <div className="text-sm text-muted-foreground">Skipped</div>
                        </div>
                        <div className="p-4 bg-red-500/10 rounded-lg">
                          <div className="text-2xl font-bold text-red-500">{results.failed}</div>
                          <div className="text-sm text-muted-foreground">Failed</div>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground text-center">
                        {results.message}
                      </p>
                      
                      {results.details && results.details.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <p className="text-sm font-medium">Recent Updates:</p>
                          <div className="space-y-1 max-h-60 overflow-y-auto">
                            {results.details.slice(0, 10).map((detail) => (
                              <div key={detail.id} className="text-xs p-2 bg-muted rounded">
                                <div className="font-medium">{detail.name}</div>
                                {detail.website_found && (
                                  <div className="text-green-600">✓ Website: {detail.website}</div>
                                )}
                                {detail.email_found && (
                                  <div className="text-green-600">✓ Email: {detail.email}</div>
                                )}
                                {detail.error && (
                                  <div className="text-red-600">⚠ {detail.error}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 text-destructive">
                      <AlertCircle className="h-5 w-5 mt-0.5" />
                      <div>
                        <p className="font-medium">Processing failed</p>
                        <p className="text-sm opacity-80">{results.error}</p>
                      </div>
                    </div>
                  )}
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
                  for opportunities that are missing this information.
                </p>
                <div className="space-y-2">
                  <p className="font-medium text-foreground">Process:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Searches DuckDuckGo for official websites</li>
                    <li>Verifies websites are legitimate and official</li>
                    <li>Scrapes websites to find contact email addresses</li>
                    <li>Verifies emails match website domains</li>
                    <li>Updates the database automatically</li>
                  </ol>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary">Web Scraping</Badge>
                  <Badge variant="secondary">Auto Verification</Badge>
                  <Badge variant="secondary">Safe Updates</Badge>
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

