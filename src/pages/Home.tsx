import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Hospital, Clock, MapPin, Users, Star, Building2, ClipboardCheck, MessageCircle, Heart, Target } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import AnimatedCounter from "@/components/AnimatedCounter";
import { useInView } from "@/hooks/useInView";
import { useAuth } from "@/hooks/useAuth";
import HeroVideoCarousel from "@/components/HeroVideoCarousel";
import communityImage from "@/assets/community-illustration.png";

const Home = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);
  
  const { ref: statsRef, isInView: statsInView } = useInView({ threshold: 0.2 });
  const { ref: storyRef, isInView: storyInView } = useInView({ threshold: 0.2 });
  const { ref: featuresRef, isInView: featuresInView } = useInView({ threshold: 0.1 });
  const { ref: howItWorksRef, isInView: howItWorksInView } = useInView({ threshold: 0.1 });
  const { ref: ctaRef, isInView: ctaInView } = useInView({ threshold: 0.2 });

  const howItWorksSteps = [
    {
      icon: MapPin,
      step: 1,
      title: "Discover",
      description: "Browse opportunities sorted by distance with acceptance likelihood.",
    },
    {
      icon: ClipboardCheck,
      step: 2,
      title: "Track",
      description: "Save and track your application progress in one dashboard.",
    },
    {
      icon: Star,
      step: 3,
      title: "Review",
      description: "Read real ratings from students who've been there.",
    },
    {
      icon: MessageCircle,
      step: 4,
      title: "Connect",
      description: "Ask questions and get answers from the community.",
    },
  ];

  const features = [
    {
      icon: Hospital,
      title: "Comprehensive Database",
      description: "Hospitals, clinics, hospice centers, EMT programs, and volunteering opportunities.",
    },
    {
      icon: Clock,
      title: "Detailed Requirements",
      description: "Hours required, contact info, and acceptance likelihood for each opportunity.",
    },
    {
      icon: MapPin,
      title: "Location-Based Search",
      description: "Find opportunities near you with interactive maps and powerful filters.",
    },
    {
      icon: Heart,
      title: "Student-Focused",
      description: "Built by students who understand the clinical experience hunt.",
    },
    {
      icon: Users,
      title: "Community-Driven",
      description: "Learn from real experiences shared by other pre-med students.",
    },
    {
      icon: Target,
      title: "Transparent Process",
      description: "Clear information on requirements, hours, and acceptance rates.",
    },
  ];

  const stats = [
    { value: 4700, suffix: "+", label: "Opportunities", icon: Building2 },
    { value: 3000, suffix: "+", label: "Locations", icon: MapPin },
    { value: 100, suffix: "%", label: "Free", icon: Heart },
  ];

  return (
    <div className="min-h-screen font-mono">
      <Navigation />

      {/* Hero Section - Full-screen immersive Squarespace style */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden bg-black">
        {/* Video Background Carousel */}
        <HeroVideoCarousel />
        
        {/* Gradient overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 z-[5]"></div>
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-normal text-white leading-[1.05] tracking-tight animate-fade-in-up drop-shadow-[0_2px_20px_rgba(0,0,0,0.5)]">
              Find Your<br />Clinical Future
            </h1>
            <p className="text-lg md:text-xl text-white/70 max-w-xl mx-auto leading-relaxed font-light animate-fade-in-up-delay-1 drop-shadow-[0_2px_10px_rgba(0,0,0,0.3)]">
              The crowdsourced platform helping pre-med students discover clinical opportunities.
            </p>
            
            <div className="pt-8 animate-fade-in-up-delay-2">
              <Link 
                to="/auth"
                className="group inline-block text-sm uppercase tracking-widest px-12 py-5 bg-white text-black hover:bg-white/90 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] relative overflow-hidden"
              >
                <span className="relative z-10">Get Started</span>
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></span>
              </Link>
              <p className="mt-6 text-xs text-white/50 uppercase tracking-widest animate-pulse">
                Free forever. No credit card required.
              </p>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 animate-fade-in-up-delay-3">
          <div className="flex flex-col items-center gap-2">
            <div className="w-px h-20 bg-gradient-to-b from-white/60 via-white/40 to-transparent animate-scroll-indicator" />
            <div className="w-1 h-1 rounded-full bg-white/60 animate-bounce" />
          </div>
        </div>
      </section>

      {/* Stats Section - Minimal, clean */}
      <section 
        ref={statsRef}
        className="py-32 bg-black relative overflow-hidden"
      >
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-transparent pointer-events-none"></div>
        <div className="container mx-auto px-6 relative z-10">
          <div className="flex flex-col md:flex-row justify-center items-center gap-20 md:gap-32">
            {stats.map((stat, index) => (
              <div 
                key={index} 
                className={`text-center group cursor-default ${
                  statsInView ? 'animate-fade-in-up' : 'opacity-0'
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="relative inline-block mb-3">
                  <div className="text-6xl md:text-7xl font-normal text-white relative z-10 group-hover:scale-110 transition-transform duration-300">
                    {statsInView ? (
                      <AnimatedCounter 
                        end={stat.value} 
                        suffix={stat.suffix}
                        duration={2000}
                      />
                    ) : (
                      `0${stat.suffix}`
                    )}
                  </div>
                  <div className="absolute inset-0 blur-xl opacity-0 group-hover:opacity-30 bg-white transition-opacity duration-300"></div>
                </div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <stat.icon className="h-4 w-4 text-white/40 group-hover:text-white/70 transition-colors duration-300" />
                  <div className="text-xs text-white/50 uppercase tracking-[0.2em] group-hover:text-white/80 transition-colors duration-300">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section - Clean cards on dark background */}
      <section ref={featuresRef} className="py-32 bg-black relative overflow-hidden">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/30 pointer-events-none"></div>
        <div className="container mx-auto px-6 relative z-10">
          <div className={`text-center max-w-2xl mx-auto mb-24 ${featuresInView ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-normal text-white mb-8">
              Built for Pre-Med Success
            </h2>
            <p className="text-white/60 text-lg leading-relaxed font-light">
              Everything you need to find, evaluate, and secure clinical opportunities.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <div 
                key={index} 
                className={`group relative p-12 bg-black hover:bg-white/5 transition-all duration-500 overflow-hidden ${
                  featuresInView ? 'animate-fade-in-up' : 'opacity-0'
                }`}
                style={{ animationDelay: `${index * 80}ms` }}
              >
                {/* Gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-white/0 to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                
                {/* Border glow effect */}
                <div className="absolute inset-0 border border-transparent group-hover:border-white/10 transition-colors duration-500"></div>
                
                {/* Content */}
                <div className="relative z-10">
                  <div className="relative inline-block mb-8">
                    <feature.icon className="h-8 w-8 text-white/60 group-hover:text-white transition-all duration-500 group-hover:scale-110" strokeWidth={1} />
                    <div className="absolute inset-0 blur-md opacity-0 group-hover:opacity-30 bg-white transition-opacity duration-500"></div>
                  </div>
                  <h3 className="text-xl font-normal text-white mb-4 group-hover:translate-x-1 transition-transform duration-500">{feature.title}</h3>
                  <p className="text-white/50 leading-relaxed font-light group-hover:text-white/70 transition-colors duration-500">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section ref={howItWorksRef} className="py-32 bg-black relative overflow-hidden">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-transparent pointer-events-none"></div>
        <div className="container mx-auto px-6 relative z-10">
          <div className={`text-center max-w-2xl mx-auto mb-24 ${howItWorksInView ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-normal text-white mb-8">
              How It Works
            </h2>
            <p className="text-white/50 text-lg leading-relaxed font-light">
              Four steps to your clinical experience.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 max-w-5xl mx-auto">
            {howItWorksSteps.map((item, index) => (
              <div
                key={index}
                className={`group text-center cursor-default ${
                  howItWorksInView ? 'animate-fade-in-up' : 'opacity-0'
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="relative w-20 h-20 mx-auto mb-8 border border-white/10 flex items-center justify-center group-hover:border-white/30 transition-all duration-500 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                  <item.icon className="h-8 w-8 text-white/60 group-hover:text-white transition-all duration-500 group-hover:scale-110" strokeWidth={1} />
                  <div className="absolute inset-0 blur-lg opacity-0 group-hover:opacity-20 bg-white transition-opacity duration-500"></div>
                  {/* Step number badge */}
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-white/10 border border-white/20 rounded-full flex items-center justify-center text-xs text-white/60 group-hover:bg-white/20 group-hover:text-white transition-all duration-500">
                    {item.step}
                  </div>
                </div>
                <div className="text-xs text-white/40 uppercase tracking-[0.2em] mb-4 group-hover:text-white/60 transition-colors duration-500">
                  Step {item.step}
                </div>
                <h3 className="text-2xl font-normal text-white mb-4 group-hover:translate-y-[-2px] transition-transform duration-500">
                  {item.title}
                </h3>
                <p className="text-white/50 leading-relaxed font-light group-hover:text-white/70 transition-colors duration-500">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section ref={ctaRef} className="py-40 bg-black relative overflow-hidden">
        {/* Gradient overlay for emphasis */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/40 pointer-events-none"></div>
        <div className="container mx-auto px-6 relative z-10">
          <div className={`max-w-3xl mx-auto text-center space-y-10 ${ctaInView ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <h2 className="text-4xl md:text-5xl lg:text-7xl font-normal text-white leading-tight drop-shadow-[0_2px_20px_rgba(0,0,0,0.5)]">
              Ready to Start?
            </h2>
            <p className="text-xl text-white/60 max-w-xl mx-auto font-light drop-shadow-[0_2px_10px_rgba(0,0,0,0.3)]">
              Join students discovering clinical opportunities through our platform.
            </p>
            <div className="pt-6">
              <Link 
                to="/auth"
                className="group inline-block text-sm uppercase tracking-widest px-16 py-6 bg-white text-black hover:bg-white/90 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.6)] relative overflow-hidden"
              >
                <span className="relative z-10">Get Started Free</span>
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Our Story Section */}
      <section ref={storyRef} className="py-32 bg-black">
        <div className="container mx-auto px-6 relative z-10">
          <div className={`max-w-5xl mx-auto ${storyInView ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <div className="grid md:grid-cols-2 gap-16 items-center">
              <div className="order-2 md:order-1 space-y-8">
                <div className="text-xs text-white/40 uppercase tracking-[0.2em]">Our Story</div>
                <h2 className="text-4xl md:text-5xl font-normal text-white">How It Started</h2>
                <p className="text-white/50 leading-relaxed font-light">
                  As college students—one pre-med, one engineering—we saw how frustrating it was to find real clinical experience. The pre-med among us spent weeks calling hospitals and clinics, only to learn that many didn't accept volunteers, had limited spots, or required certifications that were hard to get.
                </p>
                <p className="text-white/50 leading-relaxed font-light">
                  Together, we set out to build a centralized platform where students could share verified opportunities and insights to make the process smoother for everyone pursuing healthcare.
                </p>
              </div>
              <div className="order-1 md:order-2 flex justify-center">
                <div className="relative w-80 h-80 bg-white/5 flex items-center justify-center group hover:bg-white/10 transition-all duration-500 hover:scale-105">
                  <div className="absolute inset-0 border border-white/10 group-hover:border-white/20 transition-colors duration-500"></div>
                  <img src={communityImage} alt="" className="w-56 opacity-60 group-hover:opacity-80 transition-opacity duration-500 relative z-10" />
                  <div className="absolute inset-0 blur-2xl opacity-0 group-hover:opacity-20 bg-white transition-opacity duration-500"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Home;
