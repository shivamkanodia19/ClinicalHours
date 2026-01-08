import { useState } from 'react';
import { ExperienceWithDetails } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Clock, Plus, MoreVertical, Trash2, Calendar } from 'lucide-react';
import AddMomentDialog from './AddMomentDialog';
import LogHoursDialog from './LogHoursDialog';

interface ExperienceCardProps {
  experience: ExperienceWithDetails;
  onAddEntry: (
    opportunityId: string,
    entry: { hours?: number; moment?: string; entry_date: string }
  ) => Promise<void>;
  onDeleteEntry: (entryId: string) => Promise<void>;
  onRemoveLocation: (savedOpportunityId: string) => Promise<void>;
}

const ExperienceCard = ({
  experience,
  onAddEntry,
  onDeleteEntry,
  onRemoveLocation,
}: ExperienceCardProps) => {
  const [momentDialogOpen, setMomentDialogOpen] = useState(false);
  const [hoursDialogOpen, setHoursDialogOpen] = useState(false);

  const { opportunity, savedOpportunityId, totalHours, entries } = experience;

  // Get moments only (entries with moment text)
  const moments = entries.filter((entry) => entry.moment);

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Get type color
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'hospital':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'clinic':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'hospice':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'emt':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const handleAddMoment = async (moment: string, date: string) => {
    await onAddEntry(opportunity.id, { moment, entry_date: date });
    setMomentDialogOpen(false);
  };

  const handleLogHours = async (hours: number, date: string) => {
    await onAddEntry(opportunity.id, { hours, entry_date: date });
    setHoursDialogOpen(false);
  };

  return (
    <>
      <Card className="bg-card/50 border-border">
        <CardContent className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="text-lg font-semibold text-foreground">
                  {opportunity.name}
                </h3>
                <Badge variant="outline" className={getTypeColor(opportunity.type)}>
                  {opportunity.type === 'emt'
                    ? 'EMT'
                    : opportunity.type.charAt(0).toUpperCase() + opportunity.type.slice(1)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{opportunity.location}</p>
            </div>

            <div className="flex items-center gap-2">
              {/* Hours badge */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 rounded-md">
                <Clock className="h-4 w-4 text-primary" />
                <span className="font-semibold text-foreground">{totalHours}</span>
                <span className="text-sm text-muted-foreground">hours</span>
              </div>

              {/* More options */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onRemoveLocation(savedOpportunityId)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove from experiences
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Moments list */}
          {moments.length > 0 ? (
            <div className="mb-4">
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Key moments:
              </p>
              <div className="space-y-2">
                {moments.slice(0, 3).map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3 bg-muted/50 rounded-lg border border-border group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {formatDate(entry.entry_date)}
                          </span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">
                          "{entry.moment}"
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onDeleteEntry(entry.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                {moments.length > 3 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    + {moments.length - 3} more moments
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="mb-4 p-4 bg-muted/30 rounded-lg border border-dashed border-border">
              <p className="text-sm text-muted-foreground text-center">
                No moments added yet.
                <br />
                What meaningful experiences have you had here?
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMomentDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              {moments.length > 0 ? 'Add Moment' : 'Add Your First Moment'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHoursDialogOpen(true)}
            >
              <Clock className="h-4 w-4 mr-1" />
              Log Hours
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AddMomentDialog
        open={momentDialogOpen}
        onOpenChange={setMomentDialogOpen}
        opportunityName={opportunity.name}
        onSave={handleAddMoment}
      />
      <LogHoursDialog
        open={hoursDialogOpen}
        onOpenChange={setHoursDialogOpen}
        opportunityName={opportunity.name}
        onSave={handleLogHours}
      />
    </>
  );
};

export default ExperienceCard;

