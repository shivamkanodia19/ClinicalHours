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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface LogHoursDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityName: string;
  onSave: (hours: number, date: string) => Promise<void>;
}

const LogHoursDialog = ({
  open,
  onOpenChange,
  opportunityName,
  onSave,
}: LogHoursDialogProps) => {
  const [hours, setHours] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const hoursNum = parseFloat(hours);
    if (isNaN(hoursNum) || hoursNum <= 0) return;

    setSaving(true);
    try {
      await onSave(hoursNum, date);
      setHours('');
      setDate(new Date().toISOString().split('T')[0]);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setHours('');
      setDate(new Date().toISOString().split('T')[0]);
    }
    onOpenChange(open);
  };

  const hoursNum = parseFloat(hours);
  const isValidHours = !isNaN(hoursNum) && hoursNum > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log Hours</DialogTitle>
          <DialogDescription>
            Record time spent at {opportunityName}.
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
            <Label htmlFor="hours">Hours</Label>
            <Input
              id="hours"
              type="number"
              step="0.5"
              min="0.5"
              placeholder="e.g., 4"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Enter the number of hours (supports half hours, e.g., 3.5)
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValidHours || saving}>
            {saving ? 'Saving...' : 'Log Hours'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LogHoursDialog;

