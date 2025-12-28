import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { MessageCircle, ChevronUp, ChevronDown, Send, MessageSquare, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { useProfileComplete } from "@/hooks/useProfileComplete";
import { ProfileGate } from "@/components/ProfileGate";
import { UserProfileBadge } from "@/components/UserProfileBadge";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rateLimit";
import { moderateContent } from "@/lib/moderation";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
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

interface Question {
  id: string;
  title: string;
  body: string | null;
  author_name: string | null;
  author_university: string | null;
  author_major: string | null;
  author_graduation_year: number | null;
  author_clinical_hours: number | null;
  vote_count: number;
  answer_count: number;
  created_at: string;
  user_id: string;
}

interface Answer {
  id: string;
  body: string;
  author_name: string | null;
  author_university: string | null;
  author_major: string | null;
  author_graduation_year: number | null;
  author_clinical_hours: number | null;
  vote_count: number;
  is_accepted: boolean;
  created_at: string;
  user_id: string;
}

interface QASectionProps {
  opportunityId: string;
  opportunityName: string;
}

const INITIAL_QUESTIONS = 5;
const LOAD_MORE_COUNT = 5;
const INITIAL_ANSWERS = 3;

export function QASection({ opportunityId, opportunityName }: QASectionProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAskForm, setShowAskForm] = useState(false);
  const [newQuestion, setNewQuestion] = useState({ title: "", body: "" });
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer[]>>({});
  const [answerCounts, setAnswerCounts] = useState<Record<string, number>>({});
  const [newAnswer, setNewAnswer] = useState<Record<string, string>>({});
  const [userVotes, setUserVotes] = useState<Record<string, number>>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(INITIAL_QUESTIONS);
  const [totalQuestionCount, setTotalQuestionCount] = useState(0);
  const [answerDisplayCount, setAnswerDisplayCount] = useState<Record<string, number>>({});
  const [showProfileGate, setShowProfileGate] = useState(false);
  const [gateAction, setGateAction] = useState("participate");
  const { toast } = useToast();
  const { isComplete, isLoading: profileLoading, missingFields } = useProfileComplete();

  useEffect(() => {
    fetchQuestions();
    fetchUserId();
    fetchUserVotes();
  }, [opportunityId]);

  // Reset display count when opportunity changes
  useEffect(() => {
    setDisplayCount(INITIAL_QUESTIONS);
  }, [opportunityId]);

  const fetchUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id || null);
  };

  const fetchUserVotes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: votes } = await supabase
        .from("discussion_votes")
        .select("votable_id, value")
        .eq("user_id", user.id);

      if (votes) {
        const voteMap: Record<string, number> = {};
        votes.forEach(v => { voteMap[v.votable_id] = v.value; });
        setUserVotes(voteMap);
      }
    }
  };

  const fetchQuestions = async () => {
    setLoading(true);
    
    // Get total count
    const { count } = await supabase
      .from("questions_with_votes")
      .select("*", { count: "exact", head: true })
      .eq("opportunity_id", opportunityId);

    setTotalQuestionCount(count || 0);

    const { data, error } = await supabase
      .from("questions_with_votes")
      .select("*")
      .eq("opportunity_id", opportunityId)
      .order("vote_count", { ascending: false })
      .limit(displayCount);

    if (error) {
      logger.error("Error fetching questions", error);
    } else {
      setQuestions(data || []);
    }
    setLoading(false);
  };

  // Refetch when displayCount changes
  useEffect(() => {
    if (!loading) {
      fetchQuestions();
    }
  }, [displayCount]);

  const fetchAnswers = async (questionId: string) => {
    const limit = answerDisplayCount[questionId] || INITIAL_ANSWERS;
    
    // Get total count for this question
    const { count } = await supabase
      .from("answers_with_votes")
      .select("*", { count: "exact", head: true })
      .eq("question_id", questionId);

    setAnswerCounts(prev => ({ ...prev, [questionId]: count || 0 }));

    const { data, error } = await supabase
      .from("answers_with_votes")
      .select("*")
      .eq("question_id", questionId)
      .order("vote_count", { ascending: false })
      .limit(limit);

    if (error) {
      logger.error("Error fetching answers", error);
    } else {
      setAnswers(prev => ({ ...prev, [questionId]: data || [] }));
    }
  };

  const handleLoadMoreQuestions = () => {
    setDisplayCount(prev => prev + LOAD_MORE_COUNT);
  };

  const handleLoadMoreAnswers = (questionId: string) => {
    setAnswerDisplayCount(prev => ({
      ...prev,
      [questionId]: (prev[questionId] || INITIAL_ANSWERS) + LOAD_MORE_COUNT
    }));
  };

  // Refetch answers when display count changes
  useEffect(() => {
    Object.keys(answerDisplayCount).forEach(questionId => {
      if (expandedQuestion === questionId) {
        fetchAnswers(questionId);
      }
    });
  }, [answerDisplayCount]);

  const handleShowAskForm = () => {
    if (!userId) {
      toast({ title: "Please sign in to ask a question", variant: "destructive" });
      return;
    }
    // No profile check here - let user fill out the form first
    setShowAskForm(true);
  };

  const handleAskQuestion = async () => {
    if (!newQuestion.title.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Please sign in to ask a question", variant: "destructive" });
      return;
    }

    // Check profile completion at submission time - fetch fresh data
    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, university, major, graduation_year")
        .eq("id", user.id)
        .single();

      if (profileError) {
        toast({ title: "Error verifying profile", variant: "destructive" });
        return;
      }

      // Check required fields
      const REQUIRED_FIELDS = [
        { key: "full_name", label: "Full Name" },
        { key: "university", label: "University" },
        { key: "major", label: "Major" },
        { key: "graduation_year", label: "Graduation Year" },
      ];

      const missing: string[] = [];
      REQUIRED_FIELDS.forEach(({ key, label }) => {
        const value = profileData?.[key as keyof typeof profileData];
        if (!value || (typeof value === "string" && value.trim() === "")) {
          missing.push(label);
        }
      });

      if (missing.length > 0) {
        setGateAction("ask a question");
        setShowProfileGate(true);
        return;
      }
    } catch (error) {
      console.error("Error checking profile:", error);
      toast({ title: "Error verifying profile", variant: "destructive" });
      return;
    }

    // Profile is complete - proceed with moderation and submission

    // Check 5-minute spam prevention - prevent posting questions too quickly
    const lastQuestionKey = `last_question_time:${user.id}`;
    const lastQuestionTime = localStorage.getItem(lastQuestionKey);
    if (lastQuestionTime) {
      const timeSinceLastQuestion = Date.now() - parseInt(lastQuestionTime, 10);
      const fiveMinutes = 5 * 60 * 1000;
      if (timeSinceLastQuestion < fiveMinutes) {
        const minutesRemaining = Math.ceil((fiveMinutes - timeSinceLastQuestion) / 60000);
        toast({ 
          title: "Please wait before asking another question", 
          description: `You can ask another question in ${minutesRemaining} minute(s).`,
          variant: "destructive" 
        });
        return;
      }
    }

    // Client-side rate limiting (10 questions per hour per user)
    const rateLimitKey = `question:${user.id}`;
    const rateLimit = checkRateLimit(rateLimitKey, 10, 60 * 60 * 1000);
    
    if (!rateLimit.allowed) {
      const minutesUntilReset = Math.ceil((rateLimit.resetAt - Date.now()) / 60000);
      toast({ 
        title: "Rate limit exceeded", 
        description: `Please wait ${minutesUntilReset} minute(s) before asking another question.`,
        variant: "destructive" 
      });
      return;
    }

    // Moderate content before submission
    const questionText = `${newQuestion.title.trim()} ${newQuestion.body.trim() || ''}`.trim();
    if (questionText) {
      console.log('Running moderation for question...');
      const moderationResult = await moderateContent(questionText, 'question');
      console.log('Moderation result:', moderationResult);
      
      if (!moderationResult.approved) {
        console.error('Question rejected by moderation:', moderationResult);
        toast({ 
          title: "Question not approved", 
          description: moderationResult.reason || "Your question does not meet our community guidelines. Please revise and try again.",
          variant: "destructive" 
        });
        return;
      }
    }

    let { error } = await supabase.from("opportunity_questions").insert({
      opportunity_id: opportunityId,
      user_id: user.id,
      title: newQuestion.title.trim(),
      body: newQuestion.body.trim() || null,
      moderation_status: 'approved',
    });

    // If error is about moderation_status column not existing, retry without it
    if (error && (error.message?.includes("moderation_status") || error.message?.includes("column") || error.code === "42703")) {
      console.warn("moderation_status column may not exist, retrying without it");
      const retryResult = await supabase.from("opportunity_questions").insert({
        opportunity_id: opportunityId,
        user_id: user.id,
        title: newQuestion.title.trim(),
        body: newQuestion.body.trim() || null,
      });
      error = retryResult.error;
    }

    if (error) {
      console.error("Question submission error:", error);
      toast({ title: "Error posting question", description: error.message || "Please try again.", variant: "destructive" });
    } else {
      // Store timestamp for 5-minute spam prevention
      localStorage.setItem(`last_question_time:${user.id}`, Date.now().toString());
      
      toast({ title: "Question posted!" });
      setNewQuestion({ title: "", body: "" });
      setShowAskForm(false);
      fetchQuestions();
    }
  };

  const handleAnswer = async (questionId: string) => {
    const answerText = newAnswer[questionId]?.trim();
    if (!answerText) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Please sign in to answer", variant: "destructive" });
      return;
    }

    // Check profile completion at submission time - fetch fresh data
    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, university, major, graduation_year")
        .eq("id", user.id)
        .single();

      if (profileError) {
        toast({ title: "Error verifying profile", variant: "destructive" });
        return;
      }

      // Check required fields
      const REQUIRED_FIELDS = [
        { key: "full_name", label: "Full Name" },
        { key: "university", label: "University" },
        { key: "major", label: "Major" },
        { key: "graduation_year", label: "Graduation Year" },
      ];

      const missing: string[] = [];
      REQUIRED_FIELDS.forEach(({ key, label }) => {
        const value = profileData?.[key as keyof typeof profileData];
        if (!value || (typeof value === "string" && value.trim() === "")) {
          missing.push(label);
        }
      });

      if (missing.length > 0) {
        setGateAction("post an answer");
        setShowProfileGate(true);
        return;
      }
    } catch (error) {
      console.error("Error checking profile:", error);
      toast({ title: "Error verifying profile", variant: "destructive" });
      return;
    }

    // Profile is complete - proceed with moderation and submission

    // Client-side rate limiting (20 answers per hour per user)
    const rateLimitKey = `answer:${user.id}`;
    const rateLimit = checkRateLimit(rateLimitKey, 20, 60 * 60 * 1000);
    
    if (!rateLimit.allowed) {
      const minutesUntilReset = Math.ceil((rateLimit.resetAt - Date.now()) / 60000);
      toast({ 
        title: "Rate limit exceeded", 
        description: `Please wait ${minutesUntilReset} minute(s) before posting another answer.`,
        variant: "destructive" 
      });
      return;
    }

    // Moderate content before submission
    console.log('Running moderation for answer...');
    const moderationResult = await moderateContent(answerText, 'answer');
    console.log('Moderation result:', moderationResult);
    
    if (!moderationResult.approved) {
      console.error('Answer rejected by moderation:', moderationResult);
      toast({ 
        title: "Answer not approved", 
        description: moderationResult.reason || "Your answer does not meet our community guidelines. Please revise and try again.",
        variant: "destructive" 
      });
      return;
    }

    let { error } = await supabase.from("question_answers").insert({
      question_id: questionId,
      user_id: user.id,
      body: answerText,
      moderation_status: 'approved',
    });

    // If error is about moderation_status column not existing, retry without it
    if (error && (error.message?.includes("moderation_status") || error.message?.includes("column") || error.code === "42703")) {
      console.warn("moderation_status column may not exist, retrying without it");
      const retryResult = await supabase.from("question_answers").insert({
        question_id: questionId,
        user_id: user.id,
        body: answerText,
      });
      error = retryResult.error;
    }

    if (error) {
      console.error("Answer submission error:", error);
      toast({ title: "Error posting answer", description: error.message || "Please try again.", variant: "destructive" });
    } else {
      toast({ title: "Answer posted!" });
      setNewAnswer(prev => ({ ...prev, [questionId]: "" }));
      fetchAnswers(questionId);
      fetchQuestions(); // Update answer count
    }
  };

  const handleVote = async (votableId: string, votableType: "question" | "answer", value: 1 | -1) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Please sign in to vote", variant: "destructive" });
      return;
    }

    // Client-side rate limiting (50 votes per hour per user)
    const rateLimitKey = `vote:${user.id}`;
    const rateLimit = checkRateLimit(rateLimitKey, 50, 60 * 60 * 1000);
    
    if (!rateLimit.allowed) {
      const minutesUntilReset = Math.ceil((rateLimit.resetAt - Date.now()) / 60000);
      toast({ 
        title: "Rate limit exceeded", 
        description: `Please wait ${minutesUntilReset} minute(s) before voting again.`,
        variant: "destructive" 
      });
      return;
    }

    const currentVote = userVotes[votableId];

    if (currentVote === value) {
      // Remove vote
      await supabase
        .from("discussion_votes")
        .delete()
        .eq("user_id", user.id)
        .eq("votable_id", votableId);
      setUserVotes(prev => ({ ...prev, [votableId]: 0 }));
    } else {
      // Upsert vote
      await supabase
        .from("discussion_votes")
        .upsert({
          user_id: user.id,
          votable_id: votableId,
          votable_type: votableType,
          value,
        }, { onConflict: "user_id,votable_id,votable_type" });
      setUserVotes(prev => ({ ...prev, [votableId]: value }));
    }

    // Refresh data
    if (votableType === "question") {
      fetchQuestions();
    } else {
      const question = questions.find(q => answers[q.id]?.some(a => a.id === votableId));
      if (question) fetchAnswers(question.id);
    }
  };

  const toggleQuestion = (questionId: string) => {
    if (expandedQuestion === questionId) {
      setExpandedQuestion(null);
    } else {
      setExpandedQuestion(questionId);
      if (!answers[questionId]) {
        setAnswerDisplayCount(prev => ({ ...prev, [questionId]: INITIAL_ANSWERS }));
        fetchAnswers(questionId);
      }
    }
  };

  const canDeleteItem = (item: Question | Answer): boolean => {
    if (!userId || item.user_id !== userId) return false;
    const createdAt = new Date(item.created_at);
    const now = new Date();
    const minutesSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60);
    return minutesSinceCreation <= 5;
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete || !userId) return;

    try {
      if (itemToDelete.type === 'question') {
        const question = questions.find(q => q.id === itemToDelete.id);
        if (!question || !canDeleteItem(question)) {
          toast({
            title: "Cannot delete question",
            description: "You can only delete your own questions within 5 minutes of posting.",
            variant: "destructive",
          });
          setDeleteDialogOpen(false);
          setItemToDelete(null);
          return;
        }

        const { error } = await supabase
          .from("opportunity_questions")
          .delete()
          .eq("id", itemToDelete.id)
          .eq("user_id", userId);

        if (error) throw error;

        toast({ title: "Question deleted" });
        fetchQuestions();
      } else {
        const answer = Object.values(answers).flat().find(a => a.id === itemToDelete.id);
        if (!answer || !canDeleteItem(answer)) {
          toast({
            title: "Cannot delete answer",
            description: "You can only delete your own answers within 5 minutes of posting.",
            variant: "destructive",
          });
          setDeleteDialogOpen(false);
          setItemToDelete(null);
          return;
        }

        const { error } = await supabase
          .from("question_answers")
          .delete()
          .eq("id", itemToDelete.id)
          .eq("user_id", userId);

        if (error) throw error;

        toast({ title: "Answer deleted" });
        // Refresh answers for the question
        const question = questions.find(q => answers[q.id]?.some(a => a.id === itemToDelete.id));
        if (question) {
          fetchAnswers(question.id);
          fetchQuestions(); // Update answer count
        }
      }
    } catch (error) {
      console.error("Error deleting item:", error);
      toast({
        title: "Error deleting",
        description: "Unable to delete. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const hasMoreQuestions = questions.length < totalQuestionCount;

  return (
    <div className="space-y-4">
      <ProfileGate
        open={showProfileGate}
        onOpenChange={setShowProfileGate}
        missingFields={missingFields}
        action={gateAction}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageCircle className="h-4 w-4" />
          <span>{totalQuestionCount} questions</span>
        </div>
        {!showAskForm && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleShowAskForm}
          >
            Ask a Question
          </Button>
        )}
      </div>

      {showAskForm && (
        <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
          <Input
            placeholder="What's your question about this opportunity?"
            value={newQuestion.title}
            onChange={(e) => setNewQuestion(prev => ({ ...prev, title: e.target.value }))}
          />
          <Textarea
            placeholder="Add more details (optional)"
            value={newQuestion.body}
            onChange={(e) => setNewQuestion(prev => ({ ...prev, body: e.target.value }))}
            className="min-h-[60px]"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAskQuestion}>
              Post Question
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowAskForm(false);
                setNewQuestion({ title: "", body: "" });
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading questions...</p>
      ) : questions.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No questions yet. Be the first to ask!
        </p>
      ) : (
        <div className="space-y-3">
          {questions.map((question) => {
            const questionAnswers = answers[question.id] || [];
            const totalAnswers = answerCounts[question.id] || question.answer_count;
            const hasMoreAnswers = questionAnswers.length < totalAnswers;

            return (
              <div key={question.id} className="border rounded-lg overflow-hidden">
                <div
                  className="flex gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => toggleQuestion(question.id)}
                >
                  {/* Vote buttons */}
                  <div className="flex flex-col items-center gap-0.5 min-w-[40px]">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVote(question.id, "question", 1);
                      }}
                      className={`p-1 rounded hover:bg-muted ${
                        userVotes[question.id] === 1 ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-medium">{question.vote_count}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVote(question.id, "question", -1);
                      }}
                      className={`p-1 rounded hover:bg-muted ${
                        userVotes[question.id] === -1 ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Question content */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm">{question.title}</h4>
                    {question.body && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {question.body}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <UserProfileBadge
                          fullName={question.author_name}
                          university={question.author_university}
                          major={question.author_major}
                          graduationYear={question.author_graduation_year}
                          className="scale-90 origin-left"
                        />
                        <span>•</span>
                        <span>{formatDistanceToNow(new Date(question.created_at), { addSuffix: true })}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {totalAnswers} answers
                        </span>
                      </div>
                      {userId && question.user_id === userId && (() => {
                        const createdAt = new Date(question.created_at);
                        const now = new Date();
                        const minutesSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60);
                        const canDelete = minutesSinceCreation <= 5;
                        return canDelete ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setItemToDelete({ type: 'question', id: question.id });
                              setDeleteDialogOpen(true);
                            }}
                            title="Delete question (within 5 minutes)"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        ) : null;
                      })()}
                    </div>
                  </div>
                </div>

                {/* Expanded answers */}
                <Collapsible open={expandedQuestion === question.id}>
                  <CollapsibleContent>
                    <div className="border-t bg-muted/20 p-3 space-y-3">
                      {questionAnswers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No answers yet.</p>
                      ) : (
                        <>
                          {questionAnswers.map((answer) => (
                            <div key={answer.id} className="flex gap-3 p-2 rounded bg-background">
                              <div className="flex flex-col items-center gap-0.5 min-w-[32px]">
                                <button
                                  onClick={() => handleVote(answer.id, "answer", 1)}
                                  className={`p-0.5 rounded hover:bg-muted ${
                                    userVotes[answer.id] === 1 ? "text-primary" : "text-muted-foreground"
                                  }`}
                                >
                                  <ChevronUp className="h-3 w-3" />
                                </button>
                                <span className="text-xs font-medium">{answer.vote_count}</span>
                                <button
                                  onClick={() => handleVote(answer.id, "answer", -1)}
                                  className={`p-0.5 rounded hover:bg-muted ${
                                    userVotes[answer.id] === -1 ? "text-destructive" : "text-muted-foreground"
                                  }`}
                                >
                                  <ChevronDown className="h-3 w-3" />
                                </button>
                              </div>
                              <div className="flex-1">
                                <p className="text-sm">{answer.body}</p>
                                <div className="flex items-center justify-between mt-2">
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                    <UserProfileBadge
                                      fullName={answer.author_name}
                                      university={answer.author_university}
                                      major={answer.author_major}
                                      graduationYear={answer.author_graduation_year}
                                      className="scale-90 origin-left"
                                    />
                                    <span>•</span>
                                    <span>{formatDistanceToNow(new Date(answer.created_at), { addSuffix: true })}</span>
                                  </div>
                                  {userId && answer.user_id === userId && (() => {
                                    const createdAt = new Date(answer.created_at);
                                    const now = new Date();
                                    const minutesSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60);
                                    const canDelete = minutesSinceCreation <= 5;
                                    return canDelete ? (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                        onClick={() => {
                                          setItemToDelete({ type: 'answer', id: answer.id });
                                          setDeleteDialogOpen(true);
                                        }}
                                        title="Delete answer (within 5 minutes)"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    ) : null;
                                  })()}
                                </div>
                              </div>
                            </div>
                          ))}
                          
                          {hasMoreAnswers && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full"
                              onClick={() => handleLoadMoreAnswers(question.id)}
                            >
                              <ChevronDown className="h-4 w-4 mr-2" />
                              Show More Answers ({totalAnswers - questionAnswers.length} remaining)
                            </Button>
                          )}
                        </>
                      )}

                      {/* Answer form */}
                      <div className="flex gap-2 pt-2">
                        <Textarea
                          placeholder="Write an answer..."
                          value={newAnswer[question.id] || ""}
                          onChange={(e) => setNewAnswer(prev => ({ ...prev, [question.id]: e.target.value }))}
                          className="min-h-[40px] text-sm"
                        />
                        <Button
                          size="icon"
                          onClick={() => handleAnswer(question.id)}
                          disabled={!newAnswer[question.id]?.trim()}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            );
          })}
          
          {hasMoreQuestions && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={handleLoadMoreQuestions}
              disabled={loading}
            >
              <ChevronDown className="h-4 w-4 mr-2" />
              {loading ? "Loading..." : `Show More Questions (${totalQuestionCount - questions.length} remaining)`}
            </Button>
          )}
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {itemToDelete?.type === 'question' ? 'Question' : 'Answer'}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this {itemToDelete?.type === 'question' ? 'question' : 'answer'}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteItem}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
