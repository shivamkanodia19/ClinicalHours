import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { UserProfileBadge } from "@/components/UserProfileBadge";
import { REQUIRED_FIELDS } from "@/hooks/useProfileComplete";
import { toast } from "sonner";
import { Upload, Loader2, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";
import { logger } from "@/lib/logger";
import { sanitizeErrorMessage } from "@/lib/errorUtils";
import { logProfileUpdate, logFileAccess } from "@/lib/auditLogger";
import { 
  validatePhoneNumber, 
  validateGPA, 
  validateGraduationYear, 
  validateLinkedInURL,
  sanitizeProfileData 
} from "@/lib/inputValidation";
import { useAutoSave } from "@/hooks/useAutoSave";
import { UnifiedAutocomplete } from "@/components/UnifiedAutocomplete";
import { US_STATES } from "@/lib/data/usStates";
import { COMMON_MAJORS } from "@/lib/data/majors";
import { COMMON_UNIVERSITIES } from "@/lib/data/universities";
import { getGraduationYears } from "@/lib/data/graduationYears";

const Profile = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [resumeSignedUrl, setResumeSignedUrl] = useState<string | null>(null);
  const [profile, setProfile] = useState({
    full_name: "",
    city: "",
    state: "",
    phone: "",
    university: "",
    major: "",
    gpa: "",
    graduation_year: "",
    clinical_hours: "",
    pre_med_track: "",
    bio: "",
    career_goals: "",
    research_experience: "",
    linkedin_url: "",
    resume_url: "",
  });

  // Calculate profile completeness for required fields
  const getCompletenessInfo = () => {
    const requiredFieldKeys = REQUIRED_FIELDS.map(f => f.key);
    const filledCount = requiredFieldKeys.filter(key => {
      const value = profile[key as keyof typeof profile];
      return value && String(value).trim() !== "";
    }).length;
    
    const percentage = (filledCount / requiredFieldKeys.length) * 100;
    const missingFields = REQUIRED_FIELDS.filter(f => {
      const value = profile[f.key as keyof typeof profile];
      return !value || String(value).trim() === "";
    });

    return { percentage, filledCount, total: requiredFieldKeys.length, missingFields };
  };

  const completeness = getCompletenessInfo();
  const isProfileComplete = completeness.percentage === 100;

  // Auto-save profile data
  const { loadSavedData, clearSavedData } = useAutoSave(profile, "profile-form-draft", true);

  // Get graduation years list
  const graduationYears = useMemo(() => getGraduationYears(), []);

  // Generate signed URL for resume viewing
  const getSignedResumeUrl = useCallback(async (path: string) => {
    if (!path) return null;
    try {
      const { data, error } = await supabase.storage
        .from("resumes")
        .createSignedUrl(path, 900); // Valid for 15 minutes (reduced from 1 hour for security)
      if (error) throw error;
      
      // Log file access for audit purposes
      logFileAccess("resume", path);
      
      return data?.signedUrl || null;
    } catch (error) {
      logger.error("Error getting signed URL", error);
      return null;
    }
  }, []);

  // Handle resume download/viewing
  const handleResumeView = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!resumeSignedUrl || !profile.resume_url) return;

    try {
      // Fetch the file as a blob to avoid exposing the URL
      const response = await fetch(resumeSignedUrl);
      if (!response.ok) {
        throw new Error("Failed to load resume");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary anchor element to trigger download
      const link = document.createElement("a");
      link.href = url;
      link.download = `resume_${profile.full_name || "resume"}.${profile.resume_url.split(".").pop() || "pdf"}`;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      logger.error("Error viewing resume", error);
      toast.error("Unable to open resume. Please try again.");
    }
  }, [resumeSignedUrl, profile.resume_url, profile.full_name]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      } else if (user) {
      loadProfile();
      // Load auto-saved draft if available
      const savedDraft = loadSavedData();
      if (savedDraft && Object.keys(savedDraft).length > 0) {
        // Only load draft if profile hasn't been loaded yet (to avoid overwriting saved data)
        if (!profile.full_name && !profile.university) {
          setProfile(savedDraft);
        }
      }
      // CSRF protection is handled by Supabase's built-in JWT token validation
    }
  }, [user, authLoading, navigate]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();

      if (error) throw error;

      if (data) {
        setProfile({
          full_name: data.full_name || "",
          city: data.city || "",
          state: data.state || "",
          phone: data.phone || "",
          university: data.university || "",
          major: data.major || "",
          gpa: data.gpa?.toString() || "",
          graduation_year: data.graduation_year?.toString() || "",
          clinical_hours: data.clinical_hours?.toString() || "",
          pre_med_track: data.pre_med_track || "",
          bio: data.bio || "",
          career_goals: data.career_goals || "",
          research_experience: data.research_experience || "",
          linkedin_url: data.linkedin_url || "",
          resume_url: data.resume_url || "",
        });
        
        // Generate signed URL for viewing resume
        if (data.resume_url) {
          const signedUrl = await getSignedResumeUrl(data.resume_url);
          setResumeSignedUrl(signedUrl);
        }
      }
    } catch (error: unknown) {
      logger.error("Error loading profile", error);
      toast.error(sanitizeErrorMessage(error));
    }
  };

  const handleUploadResume = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!e.target.files || e.target.files.length === 0) {
        setUploading(false);
        return;
      }

      const file = e.target.files[0];
      
      // Validate file size (max 5MB)
      const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
      if (file.size > MAX_FILE_SIZE) {
        toast.error("File size must be less than 5MB. Please choose a smaller file.");
        setUploading(false);
        return;
      }

      // Validate file type
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      const allowedExtensions = ['pdf', 'doc', 'docx'];
      const fileExt = file.name.split(".").pop()?.toLowerCase();
      const fileType = file.type.toLowerCase();
      
      if (!fileExt || !allowedExtensions.includes(fileExt)) {
        toast.error("Invalid file type. Please upload a PDF, DOC, or DOCX file.");
        setUploading(false);
        return;
      }
      
      // Additional MIME type check (if available)
      if (fileType && !allowedTypes.some(type => fileType.includes(type.split('/')[1]))) {
        // MIME type doesn't match, but extension is valid - warn but allow
        logger.warn("File MIME type doesn't match extension", { fileType, fileExt });
      }

      const filePath = `${user?.id}/${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Store just the file path, not a public URL
      setProfile({ ...profile, resume_url: filePath });
      
      // Generate a signed URL for viewing
      const signedUrl = await getSignedResumeUrl(filePath);
      setResumeSignedUrl(signedUrl);
      
      toast.success("Resume uploaded successfully!");
    } catch (error: unknown) {
      logger.error("Error uploading resume", error);
      toast.error(sanitizeErrorMessage(error) || "Failed to upload resume. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Authorization check: ensure user is updating their own profile
      if (!user?.id) {
        toast.error("You must be signed in to update your profile");
        setLoading(false);
        return;
      }

      // Validate phone number
      const phoneValidation = validatePhoneNumber(profile.phone);
      if (!phoneValidation.valid) {
        toast.error(phoneValidation.error || "Invalid phone number");
        setLoading(false);
        return;
      }

      // Validate GPA
      const gpaValidation = validateGPA(profile.gpa);
      if (!gpaValidation.valid) {
        toast.error(gpaValidation.error || "Invalid GPA");
        setLoading(false);
        return;
      }

      // Validate graduation year
      const yearValidation = validateGraduationYear(profile.graduation_year);
      if (!yearValidation.valid) {
        toast.error(yearValidation.error || "Invalid graduation year");
        setLoading(false);
        return;
      }

      // Validate LinkedIn URL
      const linkedInValidation = validateLinkedInURL(profile.linkedin_url);
      if (!linkedInValidation.valid) {
        toast.error(linkedInValidation.error || "Invalid LinkedIn URL");
        setLoading(false);
        return;
      }

      // Sanitize all inputs before submission
      const sanitizedData = sanitizeProfileData(profile);

      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id, // Explicitly use user.id to ensure authorization
          full_name: sanitizedData.full_name,
          city: sanitizedData.city,
          state: sanitizedData.state,
          phone: sanitizedData.phone,
          university: sanitizedData.university,
          major: sanitizedData.major,
          gpa: sanitizedData.gpa ? parseFloat(sanitizedData.gpa) : null,
          graduation_year: sanitizedData.graduation_year ? parseInt(sanitizedData.graduation_year) : null,
          clinical_hours: sanitizedData.clinical_hours ? parseInt(sanitizedData.clinical_hours) : 0,
          pre_med_track: sanitizedData.pre_med_track,
          bio: sanitizedData.bio,
          career_goals: sanitizedData.career_goals,
          research_experience: sanitizedData.research_experience,
          linkedin_url: sanitizedData.linkedin_url,
          resume_url: sanitizedData.resume_url,
        });

      if (error) throw error;

      // Log profile update for audit
      const updatedFields = Object.keys(sanitizedData).filter(key => sanitizedData[key] !== undefined);
      logProfileUpdate(updatedFields);

      // Clear auto-saved draft after successful save
      clearSavedData();

      toast.success("Profile updated successfully!");
    } catch (error: unknown) {
      logger.error("Error updating profile", error);
      toast.error(sanitizeErrorMessage(error) || "Failed to update profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const isFieldRequired = (fieldKey: string) => {
    return REQUIRED_FIELDS.some(f => f.key === fieldKey);
  };

  const RequiredBadge = () => (
    <span className="text-destructive ml-1">*</span>
  );

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 pt-28 pb-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Profile Completeness Card */}
          <Card className={isProfileComplete ? "border-primary/50 bg-primary/5" : "border-destructive/30 bg-destructive/5"}>
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isProfileComplete ? "bg-primary/20" : "bg-destructive/20"
                }`}>
                  {isProfileComplete ? (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">
                      {isProfileComplete ? "Profile Complete!" : "Complete Your Profile"}
                    </h3>
                    <span className="text-sm text-muted-foreground">
                      {completeness.filledCount}/{completeness.total} required fields
                    </span>
                  </div>
                  <Progress value={completeness.percentage} className="h-2" />
                  {!isProfileComplete && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Fill in the required fields to participate in reviews and Q&A discussions.
                      Missing: {completeness.missingFields.map(f => f.label).join(", ")}
                    </p>
                  )}
                  {isProfileComplete && (
                    <p className="text-sm text-muted-foreground mt-2">
                      You can now leave reviews and participate in Q&A discussions.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Author Card Preview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Your Author Card Preview</CardTitle>
              <CardDescription>
                This is how you'll appear in reviews and Q&A discussions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UserProfileBadge
                fullName={profile.full_name || null}
                university={profile.university || null}
                major={profile.major || null}
                graduationYear={profile.graduation_year ? parseInt(profile.graduation_year) : null}
                clinicalHours={profile.clinical_hours ? parseInt(profile.clinical_hours) : null}
                variant="full"
              />
            </CardContent>
          </Card>

          {/* Main Profile Form */}
          <Card>
            <CardHeader>
              <CardTitle>My Profile</CardTitle>
              <CardDescription>
                Update your information to get personalized clinical opportunity recommendations.
                Fields marked with <span className="text-destructive">*</span> are required for participation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Basic Information</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="full_name">
                        Full Name
                        {isFieldRequired("full_name") && <RequiredBadge />}
                      </Label>
                      <Input
                        id="full_name"
                        value={profile.full_name}
                        onChange={(e) => setProfile({ ...profile, full_name: e.target.value.slice(0, 100) })}
                        maxLength={100}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={profile.phone}
                        onChange={(e) => setProfile({ ...profile, phone: e.target.value.slice(0, 20) })}
                        maxLength={20}
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <UnifiedAutocomplete
                        value={profile.city}
                        onValueChange={(value) => setProfile({ ...profile, city: value })}
                        searchFunction={async (query) => {
                          const { searchCities } = await import("@/lib/api/citySearch");
                          return searchCities(query, 10);
                        }}
                        placeholder="Select city..."
                        searchPlaceholder="Search for a city..."
                        emptyMessage="No cities found."
                        disabled={loading}
                        allowCustom={true}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <UnifiedAutocomplete
                        value={profile.state}
                        onValueChange={(value) => setProfile({ ...profile, state: value })}
                        options={US_STATES}
                        placeholder="Select state..."
                        searchPlaceholder="Search states..."
                        emptyMessage="No states found."
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>

                {/* Academic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Academic Information</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="university">
                        University
                        {isFieldRequired("university") && <RequiredBadge />}
                      </Label>
                      <UnifiedAutocomplete
                        value={profile.university}
                        onValueChange={(value) => setProfile({ ...profile, university: value })}
                        options={COMMON_UNIVERSITIES}
                        placeholder="Select university..."
                        searchPlaceholder="Search universities..."
                        emptyMessage="No universities found."
                        disabled={loading}
                        allowCustom={true}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="major">
                        Major
                        {isFieldRequired("major") && <RequiredBadge />}
                      </Label>
                      <UnifiedAutocomplete
                        value={profile.major}
                        onValueChange={(value) => setProfile({ ...profile, major: value })}
                        options={COMMON_MAJORS}
                        placeholder="Select major..."
                        searchPlaceholder="Search majors..."
                        emptyMessage="No majors found."
                        disabled={loading}
                        allowCustom={true}
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="gpa">GPA</Label>
                      <Input
                        id="gpa"
                        type="number"
                        step="0.01"
                        min="0"
                        max="4"
                        value={profile.gpa}
                        onChange={(e) => setProfile({ ...profile, gpa: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="graduation_year">
                        Graduation Year
                        {isFieldRequired("graduation_year") && <RequiredBadge />}
                      </Label>
                      <UnifiedAutocomplete
                        value={profile.graduation_year}
                        onValueChange={(value) => setProfile({ ...profile, graduation_year: value })}
                        options={graduationYears}
                        placeholder="Select graduation year..."
                        searchPlaceholder="Search years..."
                        emptyMessage="No years found."
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="clinical_hours">Clinical Hours</Label>
                      <Input
                        id="clinical_hours"
                        type="number"
                        value={profile.clinical_hours}
                        onChange={(e) => setProfile({ ...profile, clinical_hours: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pre_med_track">Pre-Med Track</Label>
                    <Input
                      id="pre_med_track"
                      value={profile.pre_med_track}
                      onChange={(e) => setProfile({ ...profile, pre_med_track: e.target.value.slice(0, 100) })}
                      placeholder="e.g., Traditional, Post-Bacc, Career Changer"
                      maxLength={100}
                    />
                  </div>
                </div>

                {/* Professional Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Professional Information</h3>
                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      value={profile.bio}
                      onChange={(e) => setProfile({ ...profile, bio: e.target.value.slice(0, 2000) })}
                      placeholder="Tell us about yourself..."
                      rows={4}
                      maxLength={2000}
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {profile.bio.length}/2000 characters
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="career_goals">Career Goals</Label>
                    <Textarea
                      id="career_goals"
                      value={profile.career_goals}
                      onChange={(e) => setProfile({ ...profile, career_goals: e.target.value.slice(0, 2000) })}
                      placeholder="What are your medical career aspirations?"
                      rows={3}
                      maxLength={2000}
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {profile.career_goals.length}/2000 characters
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="research_experience">Research Experience</Label>
                    <Textarea
                      id="research_experience"
                      value={profile.research_experience}
                      onChange={(e) => setProfile({ ...profile, research_experience: e.target.value.slice(0, 2000) })}
                      placeholder="Describe your research experience..."
                      rows={3}
                      maxLength={2000}
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {profile.research_experience.length}/2000 characters
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="linkedin_url">LinkedIn URL</Label>
                      <Input
                        id="linkedin_url"
                        type="url"
                        value={profile.linkedin_url}
                        onChange={(e) => setProfile({ ...profile, linkedin_url: e.target.value.slice(0, 500) })}
                        placeholder="https://linkedin.com/in/yourprofile"
                        maxLength={500}
                      />
                  </div>
                </div>

                {/* Resume Upload */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Resume</h3>
                  <div className="space-y-2">
                    <Label htmlFor="resume">Upload Resume</Label>
                    <div className="flex items-center gap-4">
                      <Input
                        id="resume"
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={handleUploadResume}
                        disabled={uploading}
                        className="flex-1"
                      />
                      {uploading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                    </div>
                    {profile.resume_url && resumeSignedUrl && (
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        Current resume:{" "}
                        <button
                          type="button"
                          onClick={handleResumeView}
                          className="text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          Download Resume <ExternalLink className="h-3 w-3" />
                        </button>
                      </p>
                    )}
                  </div>
                </div>


                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Profile"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Profile;
