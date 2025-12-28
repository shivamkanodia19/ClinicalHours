import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, ChevronDown, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { UserProfileBadge } from "@/components/UserProfileBadge";
import { logger } from "@/lib/logger";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
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

interface Review {
  id: string;
  rating: number;
  overall_experience: number | null;
  acceptance_difficulty: number | null;
  staff_friendliness: number | null;
  learning_opportunities: number | null;
  comment: string | null;
  created_at: string;
  user_id: string;
  profiles: {
    full_name: string;
    university: string | null;
    major: string | null;
    graduation_year: number | null;
    clinical_hours: number | null;
  } | null;
}

interface ReviewsListProps {
  opportunityId: string;
  refreshTrigger?: number;
}

const INITIAL_REVIEWS = 5;
const LOAD_MORE_COUNT = 5;

const ReviewsList = ({ opportunityId, refreshTrigger }: ReviewsListProps) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayCount, setDisplayCount] = useState(INITIAL_REVIEWS);
  const [totalCount, setTotalCount] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reviewToDelete, setReviewToDelete] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const fetchReviews = async () => {
      setLoading(true);
      try {
        // First get total count
        const { count } = await supabase
          .from("reviews")
          .select("*", { count: "exact", head: true })
          .eq("opportunity_id", opportunityId);

        setTotalCount(count || 0);

        // Then fetch the actual reviews with extended profile data
        const { data, error } = await supabase
          .from("reviews")
          .select("*, profiles(full_name, university, major, graduation_year, clinical_hours)")
          .eq("opportunity_id", opportunityId)
          .order("created_at", { ascending: false })
          .limit(displayCount);

        if (error) throw error;
        setReviews((data as Review[]) || []);
      } catch (error) {
        logger.error("Error fetching reviews", error);
        // Show user-friendly error message
        toast({
          title: "Error loading reviews",
          description: "Unable to load reviews. Please try refreshing the page.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [opportunityId, refreshTrigger, displayCount]);

  // Reset display count when opportunity changes or refresh triggered
  useEffect(() => {
    setDisplayCount(INITIAL_REVIEWS);
  }, [opportunityId, refreshTrigger]);

  const handleLoadMore = () => {
    setDisplayCount((prev) => prev + LOAD_MORE_COUNT);
  };

  const canDeleteReview = (review: Review): boolean => {
    if (!user || review.user_id !== user.id) return false;
    const createdAt = new Date(review.created_at);
    const now = new Date();
    const minutesSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60);
    return minutesSinceCreation <= 5;
  };

  const handleDeleteReview = async () => {
    if (!reviewToDelete) return;

    const review = reviews.find(r => r.id === reviewToDelete);
    if (!review) return;

    // Double-check user can delete (within 5 minutes and owns it)
    if (!canDeleteReview(review)) {
      toast({
        title: "Cannot delete review",
        description: "You can only delete your own reviews within 5 minutes of posting.",
        variant: "destructive",
      });
      setDeleteDialogOpen(false);
      setReviewToDelete(null);
      return;
    }

    try {
      const { error } = await supabase
        .from("reviews")
        .delete()
        .eq("id", reviewToDelete)
        .eq("user_id", user?.id);

      if (error) throw error;

      toast({
        title: "Review deleted",
        description: "Your review has been removed.",
      });

      // Refresh reviews
      setReviews(reviews.filter(r => r.id !== reviewToDelete));
      setTotalCount(prev => prev - 1);
    } catch (error) {
      logger.error("Error deleting review", error);
      toast({
        title: "Error deleting review",
        description: "Unable to delete review. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setReviewToDelete(null);
    }
  };

  const StarDisplay = ({ rating }: { rating: number }) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${
            star <= rating ? "fill-primary text-primary" : "text-muted-foreground"
          }`}
        />
      ))}
    </div>
  );

  if (loading && reviews.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        Loading reviews...
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        No reviews yet. Be the first to share your experience!
      </div>
    );
  }

  const hasMore = reviews.length < totalCount;

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-sm text-muted-foreground">
        {totalCount} Review{totalCount !== 1 ? "s" : ""}
      </h4>
      {reviews.map((review) => {
        const canDelete = canDeleteReview(review);
        return (
          <Card key={review.id} className="bg-muted/30">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <UserProfileBadge
                    fullName={review.profiles?.full_name || null}
                    university={review.profiles?.university}
                    major={review.profiles?.major}
                    graduationYear={review.profiles?.graduation_year}
                    clinicalHours={review.profiles?.clinical_hours}
                  />
                  <p className="text-xs text-muted-foreground mt-1 ml-9">
                    {format(new Date(review.created_at), "MMM d, yyyy")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StarDisplay rating={review.rating} />
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        setReviewToDelete(review.id);
                        setDeleteDialogOpen(true);
                      }}
                      title="Delete review (within 5 minutes)"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

            {review.comment && (
              <p className="text-sm text-foreground mb-3">{review.comment}</p>
            )}

            {/* Show individual ratings if provided */}
            <div className="flex flex-wrap gap-4 text-xs">
              {review.overall_experience && (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Experience:</span>
                  <StarDisplay rating={review.overall_experience} />
                </div>
              )}
              {review.staff_friendliness && (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Staff:</span>
                  <StarDisplay rating={review.staff_friendliness} />
                </div>
              )}
              {review.learning_opportunities && (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Learning:</span>
                  <StarDisplay rating={review.learning_opportunities} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        );
      })}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Review</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this review? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteReview}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={handleLoadMore}
          disabled={loading}
        >
          <ChevronDown className="h-4 w-4 mr-2" />
          {loading ? "Loading..." : `Show More Reviews (${totalCount - reviews.length} remaining)`}
        </Button>
      )}
    </div>
  );
};

export default ReviewsList;
