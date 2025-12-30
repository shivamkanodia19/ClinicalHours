import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfileComplete } from "@/hooks/useProfileComplete";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { sanitizeErrorMessage } from "@/lib/errorUtils";
import { Opportunity } from "@/types";
import { calculateDistance } from "@/lib/geolocation";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Loader2, Plus, Trash2, MapPin, Phone, Mail, Globe, 
  Map, Building2, ClipboardCheck, User, BookOpen, 
  Lightbulb, Target, Heart, MessageCircle, ArrowRight,
  Bookmark, CheckCircle2, Clock, TrendingUp
} from "lucide-react";
import { ReminderDialog } from "@/components/ReminderDialog";
import { downloadIcsFile, createOpportunityReminder } from "@/lib/calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Extended SavedOpportunity with nested opportunities for Dashboard
interface DashboardSavedOpportunity {
  id: string;
  opportunity_id: string;
  contacted?: boolean;
  applied?: boolean;
  heard_back?: boolean;
  scheduled_interview?: boolean;
  deadline?: string;
  notes?: string;
  opportunities?: Opportunity;
}

const tips = [
  {
    icon: Target,
    title: "Set Clear Goals",
    description: "Aim for 100-200 clinical hours before applying to medical school.",
  },
  {
    icon: Heart,
    title: "Quality Over Quantity",
    description: "Deep, meaningful experiences matter more than simply logging hours.",
  },
  {
    icon: MessageCircle,
    title: "Build Relationships",
    description: "Connect with physicians and staff—they can provide valuable mentorship and letters.",
  },
  {
    icon: BookOpen,
    title: "Reflect & Document",
    description: "Keep a journal of meaningful patient interactions for your application essays.",
  },
];

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const { isComplete, isLoading: profileLoading, missingFields, profile } = useProfileComplete();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [savedOpportunities, setSavedOpportunities] = useState<DashboardSavedOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [totalOpportunities, setTotalOpportunities] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [opportunityToDelete, setOpportunityToDelete] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
    return () => {
      isMountedRef.current = false;
    };
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, userLocation]); // Re-fetch and re-sort when location changes

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
        },
        (error) => {
          // Log error but don't show toast - location is optional
          logger.error("Error getting location", error);
          // Location features will work without it, just won't sort by distance
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000, // 5 minutes
        }
      );
    }
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch opportunities with pagination (limit to 50 for performance)
      const MAX_OPPORTUNITIES = 50;
      const { data: oppsData, error: oppsError, count } = await supabase
        .from("opportunities")
        .select("*", { count: 'exact' })
        .limit(MAX_OPPORTUNITIES);

      if (oppsError) throw oppsError;

      setTotalOpportunities(count || 0);
      let processedOpps = oppsData || [];
      
      // Calculate distances and sort if location available
      // Memoize distance calculations to avoid recalculation
      if (userLocation) {
        processedOpps = processedOpps.map((opp) => {
          const distance = opp.latitude && opp.longitude
            ? calculateDistance(
                userLocation.lat,
                userLocation.lon,
                opp.latitude,
                opp.longitude
              )
            : undefined;
          return { ...opp, distance };
        });
        // Sort by distance (closest first) - use stable sort
        processedOpps.sort((a, b) => {
          const distA = a.distance ?? Infinity;
          const distB = b.distance ?? Infinity;
          if (distA === distB) return a.name.localeCompare(b.name);
          return distA - distB;
        });
      } else {
        // Default sort by name if no location
        processedOpps.sort((a, b) => a.name.localeCompare(b.name));
      }

      setOpportunities(processedOpps);

      // Fetch saved opportunities
      const { data: savedData, error: savedError } = await supabase
        .from("saved_opportunities")
        .select(`
          *,
          opportunities (*)
        `)
        .eq("user_id", user?.id);

      if (savedError) throw savedError;
      
      // Process and sort saved opportunities
      let processedSaved = (savedData || []).map((saved: any) => {
        const opp = saved.opportunities;
        let distance: number | undefined;
        
        // Calculate distance if user location and opportunity coordinates are available
        if (userLocation && opp?.latitude && opp?.longitude) {
          distance = calculateDistance(
            userLocation.lat,
            userLocation.lon,
            opp.latitude,
            opp.longitude
          );
        }
        
        return {
          ...saved,
          opportunities: {
            ...opp,
            distance,
          },
        };
      });
      
      // Sort saved opportunities: by distance if available, otherwise alphabetically
      if (userLocation) {
        processedSaved.sort((a: any, b: any) => {
          const distA = a.opportunities?.distance ?? Infinity;
          const distB = b.opportunities?.distance ?? Infinity;
          if (distA !== Infinity || distB !== Infinity) {
            return distA - distB;
          }
          // If both have no distance, sort alphabetically
          return (a.opportunities?.name || "").localeCompare(b.opportunities?.name || "");
        });
      } else {
        // Sort alphabetically if no location
        processedSaved.sort((a: any, b: any) => 
          (a.opportunities?.name || "").localeCompare(b.opportunities?.name || "")
        );
      }
      
      setSavedOpportunities(processedSaved);
    } catch (error: any) {
      logger.error("Error loading dashboard data", error);
      toast({
        title: "Error loading data",
        description: sanitizeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

// calculateDistance imported from @/lib/geolocation

  const addToTracker = async (opportunityId: string) => {
    if (!user?.id) {
      toast({
        title: "Authentication required",
        description: "Please log in to add opportunities to your tracker",
        variant: "destructive",
      });
      return;
    }

    // Optimistic update: add to local state immediately
    const opportunityToAdd = opportunities.find(opp => opp.id === opportunityId);
    if (opportunityToAdd) {
      const optimisticSaved: DashboardSavedOpportunity = {
        id: `temp-${opportunityId}`,
        opportunity_id: opportunityId,
        contacted: false,
        applied: false,
        heard_back: false,
        scheduled_interview: false,
        opportunities: opportunityToAdd,
      };
      setSavedOpportunities(prev => [...prev, optimisticSaved]);
    }

    try {
      const { data, error } = await supabase
        .from("saved_opportunities")
        .insert({
          user_id: user.id,
          opportunity_id: opportunityId,
        })
        .select()
        .single();

      if (error) {
        // Rollback optimistic update only if component is still mounted
        if (isMountedRef.current) {
          setSavedOpportunities(prev => prev.filter(s => s.id !== `temp-${opportunityId}`));
        }
        
        // Handle duplicate entry error
        if (error.code === '23505') {
          toast({
            title: "Already tracked",
            description: "This opportunity is already in your tracker",
          });
          return;
        }
        throw error;
      }

      // Replace optimistic update with real data only if component is still mounted
      if (isMountedRef.current && data && opportunityToAdd) {
        setSavedOpportunities(prev => {
          const filtered = prev.filter(s => s.id !== `temp-${opportunityId}`);
          return [...filtered, {
            ...data,
            opportunities: opportunityToAdd,
          }];
        });
      }

      toast({
        title: "Added to tracker",
        description: "Opportunity added to your personal tracker",
      });

      // Refresh to ensure consistency
      fetchData();
    } catch (error: any) {
      logger.error("Error adding opportunity", error);
      toast({
        title: "Error adding opportunity",
        description: sanitizeErrorMessage(error) || "Failed to add opportunity. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveClick = (savedId: string) => {
    setOpportunityToDelete(savedId);
    setDeleteDialogOpen(true);
  };

  const removeFromTracker = async () => {
    if (!opportunityToDelete) return;
    const savedId = opportunityToDelete;
    
    // Optimistic update: remove from local state immediately
    const opportunityToRemove = savedOpportunities.find(s => s.id === savedId);
    setSavedOpportunities(prev => prev.filter(s => s.id !== savedId));
    
    setDeleteDialogOpen(false);
    const tempOpportunityToDelete = opportunityToDelete;
    setOpportunityToDelete(null);

    try {
      const { error } = await supabase
        .from("saved_opportunities")
        .delete()
        .eq("id", savedId);

      if (error) {
        // Rollback optimistic update only if component is still mounted
        if (isMountedRef.current && opportunityToRemove) {
          setSavedOpportunities(prev => [...prev, opportunityToRemove]);
        }
        throw error;
      }

      toast({
        title: "Removed from tracker",
        description: "Opportunity removed from your tracker",
      });
    } catch (error: any) {
      logger.error("Error removing opportunity", error);
      setOpportunityToDelete(tempOpportunityToDelete);
      toast({
        title: "Error removing opportunity",
        description: sanitizeErrorMessage(error) || "Failed to remove opportunity. Please try again.",
        variant: "destructive",
      });
    }
  };

  const updateTrackerField = async (
    savedId: string,
    field: string,
    value: boolean | string | null
  ) => {
    try {
      const { error } = await supabase
        .from("saved_opportunities")
        .update({ [field]: value })
        .eq("id", savedId);

      if (error) throw error;

      // Update local state immediately
      setSavedOpportunities((prev) =>
        prev.map((item) =>
          item.id === savedId ? { ...item, [field]: value } : item
        )
      );
    } catch (error: any) {
      logger.error("Error updating tracker", error);
      toast({
        title: "Error updating tracker",
        description: sanitizeErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const filteredOpportunities = opportunities.filter((opp) => {
    const matchesSearch =
      opp.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      opp.location.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || opp.type === typeFilter;
    const notSaved = !savedOpportunities.some((s) => s.opportunity_id === opp.id);
    return matchesSearch && matchesType && notSaved;
  });

  const getAcceptanceColor = (likelihood: string) => {
    switch (likelihood) {
      case "high":
        return "bg-green-500/20 text-green-300 border-green-500/30";
      case "medium":
        return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
      case "low":
        return "bg-red-500/20 text-red-300 border-red-500/30";
      default:
        return "bg-gray-500/20 text-gray-300 border-gray-500/30";
    }
  };

  // Calculate stats
  const trackedCount = savedOpportunities.length;
  const contactedCount = savedOpportunities.filter(s => s.contacted).length;
  const appliedCount = savedOpportunities.filter(s => s.applied).length;
  const interviewCount = savedOpportunities.filter(s => s.scheduled_interview).length;
  const nearbyCount = userLocation 
    ? opportunities.filter(o => o.distance && o.distance <= 25).length 
    : 0;
  
  // Profile completion percentage
  const totalFields = 4; // full_name, university, major, graduation_year
  const completedFields = totalFields - missingFields.length;
  const profileCompletionPercent = Math.round((completedFields / totalFields) * 100);

  // Get user's first name for greeting
  const firstName = profile?.full_name?.split(' ')[0] || 'there';

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      
      <main className="flex-1 container mx-auto px-4 pt-28 pb-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold mb-2 text-foreground scroll-mt-28">
                Welcome back, {firstName}!
              </h1>
              <p className="text-muted-foreground">
                Here's an overview of your clinical journey progress.
              </p>
            </div>
            
            {/* Profile Completion Card */}
            {!isComplete && !profileLoading && (
              <Card className="lg:w-80 bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Complete Your Profile</p>
                      <p className="text-xs text-muted-foreground">{profileCompletionPercent}% complete</p>
                    </div>
                  </div>
                  <Progress value={profileCompletionPercent} className="h-2 mb-3" />
                  <Button asChild size="sm" variant="outline" className="w-full">
                    <Link to="/profile">
                      Complete Profile <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bookmark className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{trackedCount}</p>
                  <p className="text-xs text-muted-foreground">Saved Opportunities</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{appliedCount}</p>
                  <p className="text-xs text-muted-foreground">Applications Sent</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{interviewCount}</p>
                  <p className="text-xs text-muted-foreground">Interviews Scheduled</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalOpportunities}</p>
                  <p className="text-xs text-muted-foreground">Total Opportunities</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Action Buttons */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
            <Link to="/map">
              <Map className="h-6 w-6" />
              <span>Explore Map</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
            <Link to="/opportunities">
              <Building2 className="h-6 w-6" />
              <span>Browse All</span>
            </Link>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-4 flex-col gap-2"
            onClick={() => document.getElementById('tracker-section')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <ClipboardCheck className="h-6 w-6" />
            <span>My Tracker</span>
          </Button>
          <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
            <Link to="/profile">
              <User className="h-6 w-6" />
              <span>My Profile</span>
            </Link>
          </Button>
        </div>

        {/* My Opportunities Tracker */}
        <Card id="tracker-section" className="mb-8 bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">My Opportunities Tracker</CardTitle>
            <CardDescription>
              Track your application progress for saved opportunities
            </CardDescription>
          </CardHeader>
          <CardContent>
            {savedOpportunities.length === 0 ? (
              <div className="text-center py-12">
                <div className="h-16 w-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                  <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground mb-4">
                  You haven't added any opportunities to your tracker yet.
                </p>
                <Button asChild>
                  <Link to="/opportunities">
                    Browse Opportunities <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-foreground">Name</TableHead>
                      <TableHead className="text-foreground">Type</TableHead>
                      <TableHead className="text-foreground">Contacted</TableHead>
                      <TableHead className="text-foreground">Applied</TableHead>
                      <TableHead className="text-foreground">Heard Back</TableHead>
                      <TableHead className="text-foreground">Interview</TableHead>
                      <TableHead className="text-foreground">Deadline</TableHead>
                      <TableHead className="text-foreground">Notes</TableHead>
                      <TableHead className="text-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {savedOpportunities.map((saved) => (
                      <TableRow key={saved.id}>
                        <TableCell className="font-medium text-foreground">
                          {saved.opportunities.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {saved.opportunities.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Checkbox
                            checked={saved.contacted}
                            onCheckedChange={(checked) =>
                              updateTrackerField(saved.id, "contacted", checked as boolean)
                            }
                            aria-label={`Mark ${saved.opportunities.name} as contacted`}
                          />
                        </TableCell>
                        <TableCell>
                          <Checkbox
                            checked={saved.applied}
                            onCheckedChange={(checked) =>
                              updateTrackerField(saved.id, "applied", checked as boolean)
                            }
                            aria-label={`Mark ${saved.opportunities.name} as applied`}
                          />
                        </TableCell>
                        <TableCell>
                          <Checkbox
                            checked={saved.heard_back}
                            onCheckedChange={(checked) =>
                              updateTrackerField(saved.id, "heard_back", checked as boolean)
                            }
                            aria-label={`Mark ${saved.opportunities.name} as heard back`}
                          />
                        </TableCell>
                        <TableCell>
                          <Checkbox
                            checked={saved.scheduled_interview}
                            onCheckedChange={(checked) =>
                              updateTrackerField(saved.id, "scheduled_interview", checked as boolean)
                            }
                            aria-label={`Mark ${saved.opportunities.name} as scheduled interview`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            value={saved.deadline || ""}
                            onChange={(e) =>
                              updateTrackerField(saved.id, "deadline", e.target.value || null)
                            }
                            className="w-40"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            placeholder="Add notes..."
                            value={saved.notes || ""}
                            onChange={(e) =>
                              updateTrackerField(saved.id, "notes", e.target.value)
                            }
                            className="w-48"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <ReminderDialog
                              opportunityId={saved.opportunity_id}
                              opportunityName={saved.opportunities.name}
                              opportunityLocation={saved.opportunities.location}
                              opportunityWebsite={saved.opportunities.website}
                              userId={user?.id || ""}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveClick(saved.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Available Opportunities */}
        <Card id="available-opportunities" className="mb-8 bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Available Opportunities</CardTitle>
            <CardDescription>
              Browse and add opportunities to your tracker
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <Input
                placeholder="Search by name or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="hospital">Hospital</SelectItem>
                  <SelectItem value="clinic">Clinic</SelectItem>
                  <SelectItem value="hospice">Hospice</SelectItem>
                  <SelectItem value="emt">EMT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4">
              {filteredOpportunities.slice(0, 5).map((opp) => (
                <Card key={opp.id} className="bg-card/50 border-border">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h3 className="text-lg font-semibold text-foreground">{opp.name}</h3>
                          <Badge variant="outline" className="capitalize">
                            {opp.type}
                          </Badge>
                          <Badge className={getAcceptanceColor(opp.acceptance_likelihood)}>
                            {opp.acceptance_likelihood} acceptance
                          </Badge>
                        </div>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span>{opp.location}</span>
                            {opp.distance && (
                              <span className="text-primary">({opp.distance} miles away)</span>
                            )}
                          </div>
                          {opp.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4" />
                              <a
                                href={`tel:${opp.phone}`}
                                className="text-primary hover:underline"
                              >
                                {opp.phone}
                              </a>
                            </div>
                          )}
                          {opp.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              <a
                                href={`mailto:${opp.email}`}
                                className="text-primary hover:underline"
                              >
                                {opp.email}
                              </a>
                            </div>
                          )}
                          {opp.website && (
                            <div className="flex items-center gap-2">
                              <Globe className="h-4 w-4" />
                              <a
                                href={opp.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                Visit Website
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        onClick={() => addToTracker(opp.id)}
                        size="sm"
                        className="ml-4"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add to Tracker
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {filteredOpportunities.length === 0 && (
                <div className="text-center py-12">
                  <div className="h-16 w-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No opportunities found</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchTerm || typeFilter !== "all" 
                      ? "Try adjusting your search or filters to find more opportunities."
                      : "All available opportunities have been added to your tracker."}
                  </p>
                  {(searchTerm || typeFilter !== "all") && (
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setSearchTerm("");
                        setTypeFilter("all");
                      }}
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              )}

              {filteredOpportunities.length > 5 && (
                <div className="text-center pt-4">
                  <Button asChild variant="outline">
                    <Link to="/opportunities">
                      View All {totalOpportunities > 50 ? `50+` : totalOpportunities} Opportunities <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                  {totalOpportunities > 50 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Showing first 50 opportunities. Use the search to find more.
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tips & Resources Section */}
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              <CardTitle className="text-foreground">Tips for Success</CardTitle>
            </div>
            <CardDescription>
              Make the most of your clinical experience journey
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {tips.map((tip, index) => (
                <div key={index} className="p-4 rounded-lg bg-background/50 border border-border">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                    <tip.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h4 className="font-medium text-foreground mb-1">{tip.title}</h4>
                  <p className="text-sm text-muted-foreground">{tip.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Tracker</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this opportunity from your tracker? You can add it back later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={removeFromTracker}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer />
    </div>
  );
};

export default Dashboard;
