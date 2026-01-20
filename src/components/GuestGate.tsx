import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserPlus, Sparkles } from "lucide-react";

interface GuestGateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action?: string; // e.g., "save opportunities", "write a review", "ask a question"
}

export function GuestGate({
  open,
  onOpenChange,
  action = "access this feature",
}: GuestGateProps) {
  const navigate = useNavigate();

  const handleSignUp = () => {
    onOpenChange(false);
    navigate("/auth");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <UserPlus className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle>Create an Account</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            To {action}, please create a free account or sign in. It only takes a moment!
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium mb-1">With an account you can:</p>
              <ul className="text-sm text-muted-foreground space-y-0.5">
                <li>• Save opportunities to your tracker</li>
                <li>• Write reviews and share experiences</li>
                <li>• Ask and answer questions</li>
                <li>• Log your clinical hours</li>
              </ul>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Continue Browsing
          </Button>
          <Button onClick={handleSignUp}>
            Sign Up Free
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
