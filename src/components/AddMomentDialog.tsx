import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AddMomentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityName: string;
  onSave: (moment: string, date: string) => Promise<void>;
}

const AddMomentDialog = ({
  open,
  onOpenChange,
  opportunityName,
  onSave,
}: AddMomentDialogProps) => {
  const [moment, setMoment] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!moment.trim()) return;

    setSaving(true);
    try {
      await onSave(moment.trim(), date);
      setMoment('');
      setDate(new Date().toISOString().split('T')[0]);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setMoment('');
      setDate(new Date().toISOString().split('T')[0]);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a Moment</DialogTitle>
          <DialogDescription>
            Record a meaningful experience at {opportunityName}. These reflections will help you write compelling application essays.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="moment">Your Reflection</Label>
            <Textarea
              id="moment"
              placeholder="Describe a meaningful interaction, observation, or lesson learned..."
              value={moment}
              onChange={(e) => setMoment(e.target.value)}
              rows={5}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Tip: Focus on specific details - patient interactions, skills observed, or moments that reinforced your interest in medicine.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!moment.trim() || saving}>
            {saving ? 'Saving...' : 'Save Moment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddMomentDialog;

