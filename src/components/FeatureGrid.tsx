import { useEffect, useState, useRef } from "react";
import { Hospital, Clock, MapPin, Heart, Users, Target, LucideIcon } from "lucide-react";

/**
 * FEATURE GRID COMPONENT
 * ======================
 * A premium, animated feature grid inspired by Squarespace aesthetics.
 * 
 * ANIMATION TIMING (adjust these values):
 * - STAGGER_DELAY: Time between each card's entrance (ms)
 * - CARD_DURATION: How long each card takes to animate in (ms)
 * - HOVER_DURATION: Hover transition speed (ms)
 */
const STAGGER_DELAY = 100; // ms between each card animation
const CARD_DURATION = 600; // ms for card entrance animation
const HOVER_DURATION = 400; // ms for hover transitions

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

const features: Feature[] = [
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

const FeatureGrid = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Intersection Observer for scroll-triggered animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.15, rootMargin: "-50px" }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Animation classes based on motion preference
  const getTransitionStyle = (delay: number = 0) => {
    if (prefersReducedMotion) {
      return { opacity: isVisible ? 1 : 0 };
    }
    return {
      opacity: isVisible ? 1 : 0,
      transform: isVisible ? "translateY(0)" : "translateY(30px)",
      transition: `opacity ${CARD_DURATION}ms ease-out ${delay}ms, transform ${CARD_DURATION}ms ease-out ${delay}ms`,
    };
  };

  return (
    <section
      ref={sectionRef}
      className="py-40 bg-black relative overflow-hidden"
      style={{ fontFamily: '"Times New Roman", Times, serif' }}
    >
      {/* Subtle grid lines for visual rhythm */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Horizontal guide lines */}
        <div className="absolute top-1/4 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        <div className="absolute top-3/4 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        {/* Vertical guide lines - desktop only */}
        <div className="hidden lg:block absolute top-0 bottom-0 left-1/3 w-px bg-gradient-to-b from-transparent via-white/5 to-transparent" />
        <div className="hidden lg:block absolute top-0 bottom-0 right-1/3 w-px bg-gradient-to-b from-transparent via-white/5 to-transparent" />
      </div>

      {/* Gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/40 pointer-events-none" />

      <div className="container mx-auto px-6 relative z-10">
        {/* Header with staggered animation */}
        <div ref={headlineRef} className="text-center max-w-3xl mx-auto mb-32">
          {/* Headline */}
          <h2
            className="text-4xl md:text-5xl lg:text-6xl text-white mb-10"
            style={{
              fontWeight: 400,
              ...getTransitionStyle(0),
            }}
          >
            Built for Pre-Med Success
          </h2>
          
          {/* Subheadline with delay */}
          <p
            className="text-white/50 text-lg md:text-xl leading-relaxed"
            style={{
              fontWeight: 400,
              ...getTransitionStyle(150), // 150ms delay after headline
            }}
          >
            Everything you need to find, evaluate, and secure clinical opportunities.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="max-w-7xl mx-auto">
          {/* Grid with gap between cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {features.map((feature, index) => (
              <FeatureCard
                key={index}
                feature={feature}
                index={index}
                isVisible={isVisible}
                prefersReducedMotion={prefersReducedMotion}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

interface FeatureCardProps {
  feature: Feature;
  index: number;
  isVisible: boolean;
  prefersReducedMotion: boolean;
}

const FeatureCard = ({ feature, index, isVisible, prefersReducedMotion }: FeatureCardProps) => {
  const Icon = feature.icon;
  
  // Calculate stagger delay based on index
  // Cards animate in a cascade: 0, 100ms, 200ms, etc.
  const staggerDelay = 300 + index * STAGGER_DELAY; // 300ms base delay after header

  const cardStyle = prefersReducedMotion
    ? { opacity: isVisible ? 1 : 0 }
    : {
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0) scale(1)" : "translateY(50px) scale(0.95)",
        transition: `opacity ${CARD_DURATION}ms ease-out ${staggerDelay}ms, transform ${CARD_DURATION}ms ease-out ${staggerDelay}ms`,
      };

  // Hover transition duration
  const hoverTransition = prefersReducedMotion ? "" : `${HOVER_DURATION}ms`;

  return (
    <div
      className="group relative"
      style={cardStyle}
    >
      {/* Card with visible border and background */}
      <div className="relative p-10 md:p-12 min-h-[320px] flex flex-col bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.08] rounded-xl overflow-hidden group-hover:border-white/20 group-hover:from-white/[0.06] group-hover:to-white/[0.02]"
        style={{ transition: `all ${hoverTransition} ease-out` }}
      >
        {/* Animated gradient overlay on hover */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-white/0 via-white/[0.02] to-white/[0.05] opacity-0 group-hover:opacity-100"
          style={{ transition: `opacity ${hoverTransition} ease-out` }}
        />

        {/* Icon container - lifts on hover with glow */}
        <div className="relative mb-10 group-hover:-translate-y-1"
          style={{ transition: prefersReducedMotion ? "none" : `transform ${hoverTransition} ease-out` }}
        >
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/[0.05] border border-white/[0.08] group-hover:bg-white/[0.10] group-hover:border-white/20"
            style={{
              transition: prefersReducedMotion ? "none" : `all ${hoverTransition} ease-out`,
            }}
          >
            <Icon
              className="h-8 w-8 text-white/60 group-hover:text-white group-hover:scale-110"
              strokeWidth={1.2}
              style={{
                transition: prefersReducedMotion ? "none" : `all ${hoverTransition} ease-out`,
              }}
            />
          </div>
          
          {/* Glow effect on hover */}
          <div
            className="absolute -inset-2 rounded-2xl blur-2xl bg-white/0 group-hover:bg-white/10 -z-10"
            style={{ transition: `background-color ${hoverTransition} ease-out` }}
          />
        </div>

        {/* Title - shifts up on hover */}
        <h3
          className="text-xl md:text-2xl text-white mb-4 group-hover:-translate-y-1"
          style={{
            fontWeight: 500,
            transition: prefersReducedMotion ? "none" : `transform ${hoverTransition} ease-out`,
          }}
        >
          {feature.title}
        </h3>

        {/* Description - becomes more visible on hover */}
        <p
          className="text-white/40 group-hover:text-white/70 leading-relaxed text-base group-hover:-translate-y-1"
          style={{
            fontWeight: 400,
            transition: prefersReducedMotion ? "none" : `all ${hoverTransition} ease-out`,
          }}
        >
          {feature.description}
        </p>

        {/* Corner accent */}
        <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-tl from-white/[0.03] to-transparent rounded-tl-3xl opacity-0 group-hover:opacity-100"
          style={{ transition: `opacity ${hoverTransition} ease-out` }}
        />
      </div>
    </div>
  );
};

export default FeatureGrid;

