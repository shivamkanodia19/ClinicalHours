import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfileComplete } from "@/hooks/useProfileComplete";
import { ProfileGate } from "@/components/ProfileGate";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { checkRateLimit } from "@/lib/rateLimit";
import { moderateContent } from "@/lib/moderation";

interface ReviewFormProps {
  opportunityId: string;
  opportunityName: string;
  onReviewSubmitted: () => void;
}

interface RatingCategory {
  key: string;
  label: string;
  value: number;
}

const ReviewForm = ({ opportunityId, opportunityName, onReviewSubmitted }: ReviewFormProps) => {
  const { user } = useAuth();
  const { isComplete, isLoading: profileLoading, missingFields } = useProfileComplete();
  const [open, setOpen] = useState(false);
  const [showProfileGate, setShowProfileGate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState("");
  const [ratings, setRatings] = useState<RatingCategory[]>([
    { key: "rating", label: "Overall Rating", value: 0 },
    { key: "overall_experience", label: "Overall Experience", value: 0 },
    { key: "acceptance_difficulty", label: "Acceptance Difficulty", value: 0 },
    { key: "staff_friendliness", label: "Staff Friendliness", value: 0 },
    { key: "learning_opportunities", label: "Learning Opportunities", value: 0 },
  ]);

  const handleRatingChange = (key: string, value: number) => {
    setRatings(ratings.map((r) => (r.key === key ? { ...r, value } : r)));
  };

  const handleOpenReviewDialog = () => {
    if (!user) {
      toast.error("Please sign in to write a review");
      return;
    }

    if (!isComplete) {
      setShowProfileGate(true);
      return;
    }

    setOpen(true);
  };

  const handleSubmit = async () => {
    const overallRating = ratings.find((r) => r.key === "rating")?.value || 0;
    if (overallRating === 0) {
      toast.error("Please provide at least an overall rating");
      return;
    }

    if (!user?.id) {
      toast.error("Please sign in to submit a review");
      return;
    }

    // Re-check profile completion before submission
    // This ensures users who complete their profile after opening the dialog can still submit
    // Wait for profile to finish loading
    if (profileLoading) {
      toast.error("Please wait while we verify your profile");
      setLoading(false);
      return;
    }
    
    if (!isComplete) {
      setShowProfileGate(true);
      setOpen(false);
      setLoading(false);
      return;
    }

    // Client-side rate limiting (5 reviews per hour per user)
    const rateLimitKey = `review:${user.id}`;
    const rateLimit = checkRateLimit(rateLimitKey, 5, 60 * 60 * 1000);
    
    if (!rateLimit.allowed) {
      const minutesUntilReset = Math.ceil((rateLimit.resetAt - Date.now()) / 60000);
      toast.error(`Rate limit exceeded. Please wait ${minutesUntilReset} minute(s) before submitting another review.`);
      return;
    }

    setLoading(true);
    try {
      // Check for existing review
      const { data: existingReview } = await supabase
        .from("reviews")
        .select("id")
        .eq("opportunity_id", opportunityId)
        .eq("user_id", user.id)
        .single();

      if (existingReview) {
        toast.error("You have already submitted a review for this opportunity");
        setOpen(false);
        return;
      }

      const reviewData: any = {
        opportunity_id: opportunityId,
        user_id: user.id,
        rating: overallRating,
        comment: comment?.trim() || null,
      };

      // Add optional ratings if they were provided
      ratings.forEach((r) => {
        if (r.key !== "rating" && r.value > 0) {
          reviewData[r.key] = r.value;
        }
      });

      // Moderate content before submission
      // Always run moderation if there's a comment
      if (comment?.trim()) {
        console.log("Running moderation check for review comment...");
        const moderationResult = await moderateContent(comment.trim(), 'review');
        console.log("Moderation result:", moderationResult);
        
        if (!moderationResult.approved) {
          console.error("Moderation rejected:", moderationResult);
          toast.error(moderationResult.reason || "Your review does not meet our community guidelines. Please revise and try again.");
          setLoading(false);
          return;
        }
        
        // Log if content was flagged but still approved (shouldn't happen, but for debugging)
        if (moderationResult.flagged_categories.length > 0 && moderationResult.approved) {
          console.warn("Content was flagged but still approved:", moderationResult.flagged_categories);
        }
      } else {
        console.log("No comment to moderate, skipping moderation check");
      }

      // Set moderation status to approved (content has passed moderation)
      reviewData.moderation_status = 'approved';

      let { error } = await supabase.from("reviews").insert(reviewData);

      // If error is about moderation_status column not existing, retry without it
      // This handles cases where the migration hasn't been applied yet
      if (error && (error.message?.includes("moderation_status") || error.message?.includes("column") || error.code === "42703")) {
        console.warn("moderation_status column may not exist, retrying without it");
        const { moderation_status, ...reviewDataWithoutModeration } = reviewData;
        const retryResult = await supabase.from("reviews").insert(reviewDataWithoutModeration);
        error = retryResult.error;
      }

      if (error) {
        console.error("Review submission error:", error);
        throw error;
      }

      toast.success("Review submitted successfully!");
      setOpen(false);
      setComment("");
      setRatings(ratings.map((r) => ({ ...r, value: 0 })));
      onReviewSubmitted();
    } catch (error: any) {
      console.error("Review submission error details:", error);
      
      // Sanitize error message
      let errorMessage = "Failed to submit review. Please try again.";
      
      if (error?.code === "23505") {
        errorMessage = "You have already submitted a review for this opportunity";
      } else if (error?.message?.includes("duplicate") || error?.message?.includes("already exists")) {
        errorMessage = "You have already submitted a review for this opportunity";
      } else if (error?.message?.includes("moderation_status") || error?.message?.includes("column") || error?.code === "42703") {
        errorMessage = "Database configuration error. Please contact support.";
        console.error("Database schema issue - moderation_status column may not exist");
      } else if (error?.message) {
        // Show the actual error message for debugging
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const StarRating = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onChange(star);
            }
          }}
          className="focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded transition-transform hover:scale-110"
          aria-label={`Rate ${star} out of 5 stars`}
          aria-pressed={star <= value}
        >
          <Star
            className={`h-6 w-6 ${
              star <= value ? "fill-primary text-primary" : "text-muted-foreground"
            }`}
          />
        </button>
      ))}
    </div>
  );

  return (
    <>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleOpenReviewDialog}
        disabled={profileLoading}
      >
        <Star className="mr-2 h-4 w-4" />
        Write Review
      </Button>

      <ProfileGate
        open={showProfileGate}
        onOpenChange={setShowProfileGate}
        missingFields={missingFields}
        action="leave a review"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Review {opportunityName}</DialogTitle>
            <DialogDescription>
              Share your experience to help other students
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {ratings.map((rating) => (
              <div key={rating.key} className="space-y-2">
                <Label className="text-sm font-medium">
                  {rating.label}
                  {rating.key === "rating" && <span className="text-destructive ml-1">*</span>}
                </Label>
                <StarRating
                  value={rating.value}
                  onChange={(v) => handleRatingChange(rating.key, v)}
                />
              </div>
            ))}

            <div className="space-y-2">
              <Label htmlFor="comment">Comment (optional)</Label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share details about your experience..."
                rows={4}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Review"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ReviewForm;
