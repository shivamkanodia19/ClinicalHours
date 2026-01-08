import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { sanitizeErrorMessage } from '@/lib/errorUtils';
import { Opportunity, ExperienceEntry, ExperienceWithDetails } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, PenLine } from 'lucide-react';
import ExperienceCard from './ExperienceCard';

interface SavedOpportunityWithOpp {
  id: string;
  opportunity_id: string;
  is_active_experience: boolean | null;
  opportunities: Opportunity;
}

const ExperienceBuilder = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [savedOpportunities, setSavedOpportunities] = useState<SavedOpportunityWithOpp[]>([]);
  const [experienceEntries, setExperienceEntries] = useState<ExperienceEntry[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');

  // Fetch saved opportunities and experience entries
  const fetchData = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      // Fetch saved opportunities with opportunity details
      const { data: savedData, error: savedError } = await supabase
        .from('saved_opportunities')
        .select(`
          id,
          opportunity_id,
          is_active_experience,
          opportunities (*)
        `)
        .eq('user_id', user.id);

      if (savedError) throw savedError;

      // Process and filter the data
      const processedData: SavedOpportunityWithOpp[] = [];
      for (const item of savedData || []) {
        // When using select with foreign key, opportunities comes as an object (or null), not array
        const opp = item.opportunities as unknown;
        if (opp && typeof opp === 'object' && !Array.isArray(opp) && 'id' in opp) {
          processedData.push({
            id: item.id,
            opportunity_id: item.opportunity_id,
            is_active_experience: item.is_active_experience ?? false,
            opportunities: opp as Opportunity,
          });
        }
      }
      setSavedOpportunities(processedData);

      // Fetch experience entries
      const { data: entriesData, error: entriesError } = await supabase
        .from('experience_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('entry_date', { ascending: false });

      if (entriesError) throw entriesError;

      setExperienceEntries(entriesData || []);
    } catch (error) {
      logger.error('Error fetching experience data', error);
      toast({
        title: 'Error loading experiences',
        description: sanitizeErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get active experiences (saved opportunities marked as active)
  const activeExperiences: ExperienceWithDetails[] = savedOpportunities
    .filter((saved) => saved.is_active_experience)
    .map((saved) => {
      const entries = experienceEntries.filter(
        (entry) => entry.opportunity_id === saved.opportunity_id
      );
      const totalHours = entries.reduce((sum, entry) => sum + (entry.hours || 0), 0);

      return {
        opportunity: saved.opportunities,
        savedOpportunityId: saved.id,
        totalHours,
        entries,
      };
    });

  // Get available locations (saved but not yet active)
  const availableLocations = savedOpportunities.filter(
    (saved) => !saved.is_active_experience
  );

  // Handle adding a new location to experiences
  const handleAddLocation = async (savedOpportunityId: string) => {
    if (!savedOpportunityId) return;

    try {
      const { error } = await supabase
        .from('saved_opportunities')
        .update({ is_active_experience: true })
        .eq('id', savedOpportunityId);

      if (error) throw error;

      // Update local state
      setSavedOpportunities((prev) =>
        prev.map((saved) =>
          saved.id === savedOpportunityId
            ? { ...saved, is_active_experience: true }
            : saved
        )
      );

      setSelectedLocation('');

      toast({
        title: 'Location added',
        description: 'You can now log hours and moments at this location.',
      });
    } catch (error) {
      logger.error('Error adding location', error);
      toast({
        title: 'Error adding location',
        description: sanitizeErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  // Handle removing a location from experiences
  const handleRemoveLocation = async (savedOpportunityId: string) => {
    try {
      const { error } = await supabase
        .from('saved_opportunities')
        .update({ is_active_experience: false })
        .eq('id', savedOpportunityId);

      if (error) throw error;

      // Update local state
      setSavedOpportunities((prev) =>
        prev.map((saved) =>
          saved.id === savedOpportunityId
            ? { ...saved, is_active_experience: false }
            : saved
        )
      );

      toast({
        title: 'Location removed',
        description: 'You can add it back anytime from the dropdown.',
      });
    } catch (error) {
      logger.error('Error removing location', error);
      toast({
        title: 'Error removing location',
        description: sanitizeErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  // Handle adding a new entry (hours or moment)
  const handleAddEntry = async (
    opportunityId: string,
    entry: { hours?: number; moment?: string; entry_date: string }
  ) => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('experience_entries')
        .insert({
          user_id: user.id,
          opportunity_id: opportunityId,
          hours: entry.hours || null,
          moment: entry.moment || null,
          entry_date: entry.entry_date,
        })
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setExperienceEntries((prev) => [data, ...prev]);

      toast({
        title: entry.moment ? 'Moment added' : 'Hours logged',
        description: entry.moment
          ? 'Your reflection has been saved.'
          : `${entry.hours} hours logged successfully.`,
      });
    } catch (error) {
      logger.error('Error adding entry', error);
      toast({
        title: 'Error saving entry',
        description: sanitizeErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  // Handle deleting an entry
  const handleDeleteEntry = async (entryId: string) => {
    try {
      const { error } = await supabase
        .from('experience_entries')
        .delete()
        .eq('id', entryId);

      if (error) throw error;

      // Update local state
      setExperienceEntries((prev) => prev.filter((entry) => entry.id !== entryId));

      toast({
        title: 'Entry deleted',
        description: 'The entry has been removed.',
      });
    } catch (error) {
      logger.error('Error deleting entry', error);
      toast({
        title: 'Error deleting entry',
        description: sanitizeErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">My Experiences</CardTitle>
        <CardDescription>
          Build your clinical narrative for applications
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Location Selector */}
        {availableLocations.length > 0 && (
          <div className="mb-6">
            <p className="text-sm text-muted-foreground mb-2">
              Select from your saved opportunities to start tracking experiences:
            </p>
            <div className="flex gap-2">
              <Select
                value={selectedLocation}
                onValueChange={(value) => {
                  setSelectedLocation(value);
                  handleAddLocation(value);
                }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a location to add..." />
                </SelectTrigger>
                <SelectContent>
                  {availableLocations.map((saved) => (
                    <SelectItem key={saved.id} value={saved.id}>
                      {saved.opportunities.name} - {saved.opportunities.location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Active Experiences */}
        {activeExperiences.length > 0 ? (
          <div className="space-y-4">
            {activeExperiences.map((experience) => (
              <ExperienceCard
                key={experience.savedOpportunityId}
                experience={experience}
                onAddEntry={handleAddEntry}
                onDeleteEntry={handleDeleteEntry}
                onRemoveLocation={handleRemoveLocation}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="h-16 w-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
              <PenLine className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-foreground">
              No experiences yet
            </h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              {savedOpportunities.length > 0
                ? 'Select a location from your saved opportunities above to start logging hours and meaningful moments.'
                : 'Save some opportunities first, then come back here to track your experiences.'}
            </p>
          </div>
        )}

        {/* Tip */}
        {activeExperiences.length > 0 && (
          <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Tip:</strong> Medical schools value specific stories over hours. Log moments that show growth, empathy, or solidified your decision to pursue medicine.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ExperienceBuilder;

