import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Hospital, Clock, Search, MapPin, Users, Star, ArrowRight } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import heroImage from "@/assets/hero-medical-purple.png";
import heroVideo from "@/assets/hero-video.mp4";

const Home = () => {
  const features = [
    {
      icon: Hospital,
      title: "Comprehensive Database",
      description: "Access hospitals, clinics, hospice centers, EMT programs, and volunteering opportunities all in one place.",
    },
    {
      icon: Clock,
      title: "Detailed Requirements",
      description: "View hours required, contact information, and acceptance likelihood for each opportunity.",
    },
    {
      icon: MapPin,
      title: "Location-Based Search",
      description: "Find clinical opportunities near you with our interactive map and powerful search features.",
    },
  ];

  const stats = [
    { value: "500+", label: "Clinical Opportunities" },
    { value: "50+", label: "Cities Covered" },
    { value: "95%", label: "Student Success Rate" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero Section with Video Background */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden">
        {/* Video Background */}
        <div className="absolute inset-0 overflow-hidden">
          <video
            autoPlay
            muted
            loop
            playsInline
            poster={heroImage}
            className="w-full h-full object-cover scale-110 origin-top-left"
          >
            <source src={heroVideo} type="video/mp4" />
          </video>
          {/* Gradient Overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/70 to-background/30" />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-2xl space-y-8">
            <div className="space-y-6">
              <span className="inline-block px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium backdrop-blur-sm border border-primary/20 animate-fade-in-up">
                🩺 The #1 Platform for Pre-Med Students
              </span>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-foreground leading-tight animate-fade-in-up-delay-1">
                Find Your Perfect{" "}
                <span className="text-primary">Clinical Experience</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed animate-fade-in-up-delay-2">
                The crowdsourced platform helping pre-med students discover and secure 
                clinical opportunities. Get real insights from students who've been there.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 animate-fade-in-up-delay-3">
              <Button asChild size="lg" className="text-base px-8 py-6 shadow-lg hover:shadow-xl transition-all">
                <Link to="/opportunities">
                  <Search className="mr-2 h-5 w-5" />
                  Explore Opportunities
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-base px-8 py-6 bg-background/50 backdrop-blur-sm hover:bg-background/80 border-border/50">
                <Link to="/about">
                  Learn More
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>

            {/* Social Proof */}
            <div className="flex items-center gap-6 pt-4 animate-fade-in-up-delay-3">
              <div className="flex -space-x-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center backdrop-blur-sm">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div className="w-10 h-10 rounded-full bg-primary/30 border-2 border-background flex items-center justify-center backdrop-blur-sm">
                  <Star className="h-5 w-5 text-primary" />
                </div>
                <div className="w-10 h-10 rounded-full bg-primary/40 border-2 border-background flex items-center justify-center text-primary font-semibold text-sm backdrop-blur-sm">
                  +
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">1,000+</span> pre-med students 
                have found opportunities
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-primary/5 border-y border-border">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center group">
                <div className="text-4xl md:text-5xl font-bold text-primary mb-2 group-hover:scale-110 transition-transform">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-primary font-medium text-sm uppercase tracking-wider">Features</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-4">Why Choose ClinicalHours?</h2>
            <p className="text-muted-foreground text-lg">
              Everything you need to find, evaluate, and secure clinical opportunities in one place.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className="group border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 hover:shadow-lg transition-all duration-300"
              >
                <CardHeader>
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="h-7 w-7 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-[hsl(280,65%,55%)] animate-gradient" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iNCIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <h2 className="text-3xl md:text-5xl font-bold text-primary-foreground">
              Ready to Start Your Clinical Journey?
            </h2>
            <p className="text-xl text-primary-foreground/90 leading-relaxed">
              Join thousands of pre-med students who have found their clinical opportunities through our platform.
            </p>
            <Button 
              asChild 
              size="lg" 
              variant="secondary" 
              className="text-base px-10 py-6 shadow-xl hover:shadow-2xl transition-all"
            >
              <Link to="/auth">
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Home;
