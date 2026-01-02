import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, CalendarPlus } from "lucide-react";
import { format } from "date-fns";
import { downloadIcsFile, createOpportunityReminder } from "@/lib/calendar";

interface ReminderDialogProps {
  opportunityId: string;
  opportunityName: string;
  opportunityLocation?: string;
  opportunityDescription?: string;
  opportunityWebsite?: string;
  userId: string;
}

export function ReminderDialog({
  opportunityId,
  opportunityName,
  opportunityLocation,
  opportunityDescription,
  opportunityWebsite,
  userId,
}: ReminderDialogProps) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState("09:00");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSetReminder = async () => {
    if (!date) {
      toast({
        title: "Please select a date",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const [hours, minutes] = time.split(":").map(Number);
      const reminderDate = new Date(date);
      reminderDate.setHours(hours, minutes, 0, 0);

      const { error } = await supabase.from("reminders").insert({
        user_id: userId,
        opportunity_id: opportunityId,
        remind_at: reminderDate.toISOString(),
      });

      if (error) throw error;

      toast({
        title: "Reminder set!",
        description: `You'll receive an email reminder on ${format(reminderDate, "PPP 'at' p")}`,
      });

      setOpen(false);
      setDate(undefined);
    } catch (error: unknown) {
      toast({
        title: "Error setting reminder",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadCalendar = () => {
    if (!date) {
      toast({
        title: "Please select a date",
        variant: "destructive",
      });
      return;
    }

    const [hours, minutes] = time.split(":").map(Number);
    const reminderDate = new Date(date);
    reminderDate.setHours(hours, minutes, 0, 0);

    const event = createOpportunityReminder(
      opportunityName,
      reminderDate,
      opportunityLocation,
      opportunityDescription,
      opportunityWebsite
    );

    downloadIcsFile(event);

    toast({
      title: "Calendar file downloaded",
      description: "Open the .ics file to add the event to your calendar",
    });
  };

  const timeOptions = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, "0");
    return [`${hour}:00`, `${hour}:30`];
  }).flat();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Bell className="h-4 w-4 mr-2" />
          Remind Me
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Set Reminder</DialogTitle>
          <DialogDescription>
            Get an email reminder or add to your calendar for "{opportunityName}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              disabled={(date) => date < new Date()}
              className="rounded-md border"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Time</label>
            <Select value={time} onValueChange={setTime}>
              <SelectTrigger>
                <SelectValue placeholder="Select time" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {timeOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {date && (
            <p className="text-sm text-muted-foreground text-center">
              Reminder: {format(date, "EEEE, MMMM d, yyyy")} at {time}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={handleSetReminder}
            disabled={!date || saving}
            className="flex-1"
          >
            <Bell className="h-4 w-4 mr-2" />
            {saving ? "Setting..." : "Set Email Reminder"}
          </Button>
          <Button
            onClick={handleDownloadCalendar}
            disabled={!date}
            variant="secondary"
            className="flex-1"
          >
            <CalendarPlus className="h-4 w-4 mr-2" />
            Download .ics
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
