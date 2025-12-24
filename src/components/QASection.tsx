import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { MessageCircle, ChevronUp, ChevronDown, Send, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Question {
  id: string;
  title: string;
  body: string | null;
  author_name: string | null;
  vote_count: number;
  answer_count: number;
  created_at: string;
  user_id: string;
}

interface Answer {
  id: string;
  body: string;
  author_name: string | null;
  vote_count: number;
  is_accepted: boolean;
  created_at: string;
  user_id: string;
}

interface QASectionProps {
  opportunityId: string;
  opportunityName: string;
}

export function QASection({ opportunityId, opportunityName }: QASectionProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAskForm, setShowAskForm] = useState(false);
  const [newQuestion, setNewQuestion] = useState({ title: "", body: "" });
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer[]>>({});
  const [newAnswer, setNewAnswer] = useState<Record<string, string>>({});
  const [userVotes, setUserVotes] = useState<Record<string, number>>({});
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchQuestions();
    fetchUserId();
  }, [opportunityId]);

  const fetchUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id || null);
  };

  const fetchQuestions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("questions_with_votes")
      .select("*")
      .eq("opportunity_id", opportunityId)
      .order("vote_count", { ascending: false });

    if (error) {
      console.error("Error fetching questions:", error);
    } else {
      setQuestions(data || []);
    }
    setLoading(false);
  };

  const fetchAnswers = async (questionId: string) => {
    const { data, error } = await supabase
      .from("answers_with_votes")
      .select("*")
      .eq("question_id", questionId)
      .order("vote_count", { ascending: false });

    if (error) {
      console.error("Error fetching answers:", error);
    } else {
      setAnswers(prev => ({ ...prev, [questionId]: data || [] }));
    }

    // Fetch user's votes for this question and its answers
    if (userId) {
      const { data: votes } = await supabase
        .from("discussion_votes")
        .select("votable_id, value")
        .eq("user_id", userId);

      if (votes) {
        const voteMap: Record<string, number> = {};
        votes.forEach(v => { voteMap[v.votable_id] = v.value; });
        setUserVotes(prev => ({ ...prev, ...voteMap }));
      }
    }
  };

  const handleAskQuestion = async () => {
    if (!newQuestion.title.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Please sign in to ask a question", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("opportunity_questions").insert({
      opportunity_id: opportunityId,
      user_id: user.id,
      title: newQuestion.title.trim(),
      body: newQuestion.body.trim() || null,
    });

    if (error) {
      toast({ title: "Error posting question", variant: "destructive" });
    } else {
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

    const { error } = await supabase.from("question_answers").insert({
      question_id: questionId,
      user_id: user.id,
      body: answerText,
    });

    if (error) {
      toast({ title: "Error posting answer", variant: "destructive" });
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
        fetchAnswers(questionId);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageCircle className="h-4 w-4" />
          <span>{questions.length} questions</span>
        </div>
        {!showAskForm && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAskForm(true)}
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
          {questions.map((question) => (
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
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{question.author_name || "Anonymous"}</span>
                    <span>•</span>
                    <span>{formatDistanceToNow(new Date(question.created_at), { addSuffix: true })}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {question.answer_count} answers
                    </span>
                  </div>
                </div>
              </div>

              {/* Expanded answers */}
              <Collapsible open={expandedQuestion === question.id}>
                <CollapsibleContent>
                  <div className="border-t bg-muted/20 p-3 space-y-3">
                    {answers[question.id]?.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No answers yet.</p>
                    ) : (
                      answers[question.id]?.map((answer) => (
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
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <span>{answer.author_name || "Anonymous"}</span>
                              <span>•</span>
                              <span>{formatDistanceToNow(new Date(answer.created_at), { addSuffix: true })}</span>
                            </div>
                          </div>
                        </div>
                      ))
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
          ))}
        </div>
      )}
    </div>
  );
}
