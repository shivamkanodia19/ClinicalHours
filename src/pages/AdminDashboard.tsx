import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Shield,
  Database,
  Upload,
  MapPin,
  Link2,
  Trash2,
  RefreshCw,
  Activity,
  Users,
  Building2,
  AlertTriangle,
  CheckCircle,
  Loader2,
  FileSpreadsheet,
} from 'lucide-react';

interface OperationResult {
  success: boolean;
  message: string;
  details?: unknown;
}

interface StatsData {
  totalOpportunities: number;
  missingWebsites: number;
  missingEmails: number;
  missingCoordinates: number;
  missingStates: number;
  totalUsers: number;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdminCheck();
  
  const [stats, setStats] = useState<StatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  
  // Import state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [clearExisting, setClearExisting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  
  // Operation states
  const [fixingStates, setFixingStates] = useState(false);
  const [findingLinks, setFindingLinks] = useState(false);
  const [removingDuplicates, setRemovingDuplicates] = useState(false);
  const [fixingCoordinates, setFixingCoordinates] = useState(false);
  
  // Results
  const [operationResult, setOperationResult] = useState<OperationResult | null>(null);
  
  // Limits
  const [fixStatesLimit, setFixStatesLimit] = useState(50);
  const [findLinksLimit, setFindLinksLimit] = useState(25);

  // Loading state
  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-destructive" />
              Authentication Required
            </CardTitle>
            <CardDescription>You must be logged in to access this page.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/auth')} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Access Denied
            </CardTitle>
            <CardDescription>
              You do not have permission to access the admin dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')} variant="outline" className="w-full">
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch stats
  async function fetchStats() {
    setStatsLoading(true);
    try {
      const [
        { count: totalOpportunities },
        { count: missingWebsites },
        { count: missingEmails },
        { count: missingCoordinates },
        { count: totalUsers },
      ] = await Promise.all([
        supabase.from('opportunities').select('*', { count: 'exact', head: true }),
        supabase.from('opportunities').select('*', { count: 'exact', head: true }).is('website', null),
        supabase.from('opportunities').select('*', { count: 'exact', head: true }).is('email', null),
        supabase.from('opportunities').select('*', { count: 'exact', head: true }).or('latitude.is.null,longitude.is.null'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
      ]);

      // Count missing states (location without comma)
      const { data: allOpps } = await supabase.from('opportunities').select('location');
      const missingStates = allOpps?.filter(o => o.location && !o.location.includes(',')).length || 0;

      setStats({
        totalOpportunities: totalOpportunities || 0,
        missingWebsites: missingWebsites || 0,
        missingEmails: missingEmails || 0,
        missingCoordinates: missingCoordinates || 0,
        missingStates,
        totalUsers: totalUsers || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast.error('Failed to fetch statistics');
    } finally {
      setStatsLoading(false);
    }
  }

  // Get session token
  async function getAuthToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  // CSV Import
  async function handleCsvImport() {
    if (!csvFile) {
      toast.error('Please select a CSV file');
      return;
    }

    setImporting(true);
    setImportProgress(0);
    setOperationResult(null);

    try {
      const text = await csvFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const opportunities = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length < headers.length) continue;

        const opp: Record<string, unknown> = {};
        headers.forEach((header, idx) => {
          let value: unknown = values[idx]?.trim().replace(/^"|"$/g, '');
          
          // Parse numeric fields
          if (header === 'latitude' || header === 'longitude') {
            value = value ? parseFloat(value as string) : null;
          }
          // Parse arrays
          if (header === 'requirements') {
            value = value ? (value as string).split(';').map(r => r.trim()) : [];
          }
          
          opp[header] = value;
        });
        
        opportunities.push(opp);
        setImportProgress(Math.round((i / lines.length) * 50));
      }

      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');

      setImportProgress(60);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-csv-hospitals`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ opportunities, clearExisting }),
        }
      );

      setImportProgress(90);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Import failed');
      }

      setImportProgress(100);
      setOperationResult({
        success: true,
        message: `Successfully imported ${result.imported} opportunities`,
        details: result,
      });
      toast.success(`Imported ${result.imported} opportunities`);
      fetchStats();
    } catch (error) {
      console.error('Import error:', error);
      setOperationResult({
        success: false,
        message: error instanceof Error ? error.message : 'Import failed',
      });
      toast.error('Import failed');
    } finally {
      setImporting(false);
      setCsvFile(null);
    }
  }

  // Fix Missing States
  async function handleFixStates(preview = true) {
    setFixingStates(true);
    setOperationResult(null);

    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const action = preview ? 'preview' : 'fix';
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fix-missing-states?action=${action}&limit=${fixStatesLimit}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Operation failed');
      }

      setOperationResult({
        success: true,
        message: preview
          ? `Found ${result.count} opportunities missing state`
          : `Fixed ${result.fixed} opportunities, ${result.failed} failed`,
        details: result,
      });

      if (!preview) {
        toast.success(`Fixed ${result.fixed} missing states`);
        fetchStats();
      }
    } catch (error) {
      console.error('Fix states error:', error);
      setOperationResult({
        success: false,
        message: error instanceof Error ? error.message : 'Operation failed',
      });
      toast.error('Fix states failed');
    } finally {
      setFixingStates(false);
    }
  }

  // Find Missing Links
  async function handleFindLinks() {
    setFindingLinks(true);
    setOperationResult(null);

    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/find-missing-links`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ limit: findLinksLimit }),
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Operation failed');
      }

      setOperationResult({
        success: true,
        message: `Processed ${result.processed} opportunities: ${result.updated} updated, ${result.failed} failed`,
        details: result,
      });
      toast.success(`Found links for ${result.updated} opportunities`);
      fetchStats();
    } catch (error) {
      console.error('Find links error:', error);
      setOperationResult({
        success: false,
        message: error instanceof Error ? error.message : 'Operation failed',
      });
      toast.error('Find links failed');
    } finally {
      setFindingLinks(false);
    }
  }

  // Remove Duplicates
  async function handleRemoveDuplicates() {
    setRemovingDuplicates(true);
    setOperationResult(null);

    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/remove-duplicates`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Operation failed');
      }

      setOperationResult({
        success: true,
        message: `Removed ${result.removed} duplicate opportunities`,
        details: result,
      });
      toast.success(`Removed ${result.removed} duplicates`);
      fetchStats();
    } catch (error) {
      console.error('Remove duplicates error:', error);
      setOperationResult({
        success: false,
        message: error instanceof Error ? error.message : 'Operation failed',
      });
      toast.error('Remove duplicates failed');
    } finally {
      setRemovingDuplicates(false);
    }
  }

  // Fix Coordinates
  async function handleFixCoordinates() {
    setFixingCoordinates(true);
    setOperationResult(null);

    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fix-coordinates`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Operation failed');
      }

      setOperationResult({
        success: true,
        message: `Fixed coordinates for ${result.fixed || 0} opportunities`,
        details: result,
      });
      toast.success(`Fixed ${result.fixed || 0} coordinates`);
      fetchStats();
    } catch (error) {
      console.error('Fix coordinates error:', error);
      setOperationResult({
        success: false,
        message: error instanceof Error ? error.message : 'Operation failed',
      });
      toast.error('Fix coordinates failed');
    } finally {
      setFixingCoordinates(false);
    }
  }

  return (
    <>
      <Helmet>
        <title>Admin Dashboard | ClinicalHours</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <Navigation />

      <main className="min-h-screen bg-background pt-20 pb-12">
        <div className="container mx-auto px-4 max-w-7xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Shield className="h-8 w-8 text-primary" />
                Admin Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage opportunities, data quality, and system operations
              </p>
            </div>
            <Badge variant="outline" className="text-sm">
              {user.email}
            </Badge>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Total</span>
                </div>
                <p className="text-2xl font-bold">
                  {statsLoading ? '-' : stats?.totalOpportunities.toLocaleString() || '-'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-muted-foreground">Users</span>
                </div>
                <p className="text-2xl font-bold">
                  {statsLoading ? '-' : stats?.totalUsers.toLocaleString() || '-'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Link2 className="h-4 w-4 text-orange-500" />
                  <span className="text-sm text-muted-foreground">No Website</span>
                </div>
                <p className="text-2xl font-bold text-orange-500">
                  {statsLoading ? '-' : stats?.missingWebsites.toLocaleString() || '-'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm text-muted-foreground">No Email</span>
                </div>
                <p className="text-2xl font-bold text-yellow-500">
                  {statsLoading ? '-' : stats?.missingEmails.toLocaleString() || '-'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-muted-foreground">No Coords</span>
                </div>
                <p className="text-2xl font-bold text-red-500">
                  {statsLoading ? '-' : stats?.missingCoordinates.toLocaleString() || '-'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-purple-500" />
                  <span className="text-sm text-muted-foreground">No State</span>
                </div>
                <p className="text-2xl font-bold text-purple-500">
                  {statsLoading ? '-' : stats?.missingStates.toLocaleString() || '-'}
                </p>
              </CardContent>
            </Card>
          </div>

          <Button onClick={fetchStats} disabled={statsLoading} className="mb-8">
            {statsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh Stats
          </Button>

          {/* Operation Result */}
          {operationResult && (
            <Card className={`mb-8 ${operationResult.success ? 'border-green-500' : 'border-red-500'}`}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  {operationResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                  )}
                  <div>
                    <p className="font-medium">{operationResult.message}</p>
                    {operationResult.details && (
                      <pre className="mt-2 text-xs bg-muted p-3 rounded overflow-auto max-h-48">
                        {JSON.stringify(operationResult.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabs */}
          <Tabs defaultValue="import" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="import" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Import
              </TabsTrigger>
              <TabsTrigger value="data-quality" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Data Quality
              </TabsTrigger>
              <TabsTrigger value="maintenance" className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Maintenance
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Users
              </TabsTrigger>
            </TabsList>

            {/* Import Tab */}
            <TabsContent value="import">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5" />
                    CSV Import
                  </CardTitle>
                  <CardDescription>
                    Import opportunities from a CSV file. The CSV should have headers matching
                    the database columns (name, type, location, latitude, longitude, phone, email, website, etc.)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="csv-file">Select CSV File</Label>
                    <Input
                      id="csv-file"
                      type="file"
                      accept=".csv"
                      onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                      disabled={importing}
                      className="mt-1"
                    />
                    {csvFile && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Selected: {csvFile.name} ({(csvFile.size / 1024).toFixed(1)} KB)
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="clear-existing"
                      checked={clearExisting}
                      onChange={(e) => setClearExisting(e.target.checked)}
                      disabled={importing}
                      className="rounded border-input"
                    />
                    <Label htmlFor="clear-existing" className="text-destructive font-medium">
                      ⚠️ Clear ALL existing opportunities before import
                    </Label>
                  </div>

                  {importing && (
                    <div className="space-y-2">
                      <Progress value={importProgress} />
                      <p className="text-sm text-muted-foreground text-center">
                        {importProgress < 50 ? 'Parsing CSV...' : 
                         importProgress < 90 ? 'Uploading to database...' : 
                         'Finalizing...'}
                      </p>
                    </div>
                  )}

                  <Button
                    onClick={handleCsvImport}
                    disabled={!csvFile || importing}
                    className="w-full"
                  >
                    {importing ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {importing ? 'Importing...' : 'Import CSV'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Data Quality Tab */}
            <TabsContent value="data-quality" className="space-y-6">
              {/* Fix Missing States */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Fix Missing States
                  </CardTitle>
                  <CardDescription>
                    Use reverse geocoding to add state information to locations that are missing it.
                    This uses Mapbox API to look up states from coordinates.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="fix-states-limit">Limit (max opportunities to process)</Label>
                    <Input
                      id="fix-states-limit"
                      type="number"
                      min={1}
                      max={500}
                      value={fixStatesLimit}
                      onChange={(e) => setFixStatesLimit(parseInt(e.target.value) || 50)}
                      disabled={fixingStates}
                      className="mt-1 w-32"
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => handleFixStates(true)}
                      disabled={fixingStates}
                    >
                      {fixingStates ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Preview
                    </Button>
                    <Button
                      onClick={() => handleFixStates(false)}
                      disabled={fixingStates}
                    >
                      {fixingStates ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Fix States
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Find Missing Links */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Link2 className="h-5 w-5" />
                    Find Missing Links
                  </CardTitle>
                  <CardDescription>
                    Search the web to find official websites and contact emails for opportunities
                    that are missing them. Uses DuckDuckGo search and web scraping.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="find-links-limit">Limit (max opportunities to process)</Label>
                    <Input
                      id="find-links-limit"
                      type="number"
                      min={1}
                      max={100}
                      value={findLinksLimit}
                      onChange={(e) => setFindLinksLimit(parseInt(e.target.value) || 25)}
                      disabled={findingLinks}
                      className="mt-1 w-32"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      ⚠️ This operation is slow (2.5s delay between requests to avoid rate limits)
                    </p>
                  </div>
                  <Button
                    onClick={handleFindLinks}
                    disabled={findingLinks}
                  >
                    {findingLinks ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
                    {findingLinks ? 'Searching...' : 'Find Missing Links'}
                  </Button>
                </CardContent>
              </Card>

              {/* Fix Coordinates */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Fix Missing Coordinates
                  </CardTitle>
                  <CardDescription>
                    Geocode addresses to add latitude/longitude for opportunities missing coordinates.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={handleFixCoordinates}
                    disabled={fixingCoordinates}
                  >
                    {fixingCoordinates ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MapPin className="h-4 w-4 mr-2" />}
                    {fixingCoordinates ? 'Fixing...' : 'Fix Coordinates'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Maintenance Tab */}
            <TabsContent value="maintenance">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trash2 className="h-5 w-5" />
                    Remove Duplicates
                  </CardTitle>
                  <CardDescription>
                    Find and remove duplicate opportunities based on matching name and location.
                    Keeps the oldest record and removes newer duplicates.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="destructive"
                    onClick={handleRemoveDuplicates}
                    disabled={removingDuplicates}
                  >
                    {removingDuplicates ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                    {removingDuplicates ? 'Processing...' : 'Remove Duplicates'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Users Tab */}
            <TabsContent value="users">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    User Management
                  </CardTitle>
                  <CardDescription>
                    View and manage user accounts and roles.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    User management features coming soon. Current admins:
                  </p>
                  <ul className="mt-4 space-y-2">
                    <li className="flex items-center gap-2">
                      <Badge>Admin</Badge>
                      shivamkanodia77@gmail.com
                    </li>
                    <li className="flex items-center gap-2">
                      <Badge>Admin</Badge>
                      ragtirup07@gmail.com
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </>
  );
}
