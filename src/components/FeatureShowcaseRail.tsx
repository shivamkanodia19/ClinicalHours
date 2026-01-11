import { useRef, useState, useEffect, useCallback } from "react";
import { Hospital, Clock, MapPin, Heart, Users, Target, ChevronLeft, ChevronRight, LucideIcon } from "lucide-react";

/**
 * FEATURE SHOWCASE RAIL
 * =====================
 * A Squarespace-style horizontal scrolling feature showcase.
 * 
 * To customize:
 * - Edit the `features` array below to change content
 * - Adjust SCROLL_AMOUNT for how far each arrow click scrolls
 * - Modify transition timings in the component styles
 */

interface Feature {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  // Unique gradient for each card's glow effect
  glowColor: string;
}

// FEATURE CONTENT - Edit this array to update features
const features: Feature[] = [
  {
    id: "database",
    icon: Hospital,
    title: "Comprehensive Database",
    description: "Access thousands of hospitals, clinics, hospice centers, EMT programs, and volunteering opportunities across the nation.",
    glowColor: "rgba(59, 130, 246, 0.15)", // blue
  },
  {
    id: "requirements",
    icon: Clock,
    title: "Detailed Requirements",
    description: "View hours required, contact information, application deadlines, and acceptance likelihood for every opportunity.",
    glowColor: "rgba(168, 85, 247, 0.15)", // purple
  },
  {
    id: "location",
    icon: MapPin,
    title: "Location-Based Search",
    description: "Find opportunities near you with interactive maps, distance sorting, and powerful location filters.",
    glowColor: "rgba(34, 197, 94, 0.15)", // green
  },
  {
    id: "student",
    icon: Heart,
    title: "Student-Focused",
    description: "Built by students who understand the challenges of finding meaningful clinical experience.",
    glowColor: "rgba(244, 63, 94, 0.15)", // rose
  },
  {
    id: "community",
    icon: Users,
    title: "Community-Driven",
    description: "Learn from real experiences, ratings, and insights shared by other pre-med students.",
    glowColor: "rgba(251, 146, 60, 0.15)", // orange
  },
  {
    id: "transparent",
    icon: Target,
    title: "Transparent Process",
    description: "Clear, honest information on requirements, expected hours, and realistic acceptance rates.",
    glowColor: "rgba(45, 212, 191, 0.15)", // teal
  },
];

const FeatureShowcaseRail = () => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Update scroll state and active card based on scroll position
  const updateScrollState = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    
    // Update arrow visibility
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);

    // Find which card is most centered
    const containerCenter = scrollLeft + clientWidth / 2;
    let closestIndex = 0;
    let closestDistance = Infinity;

    cardRefs.current.forEach((card, index) => {
      if (!card) return;
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const distance = Math.abs(containerCenter - cardCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    setActiveIndex(closestIndex);
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener("scroll", updateScrollState, { passive: true });
    updateScrollState();

    return () => container.removeEventListener("scroll", updateScrollState);
  }, [updateScrollState]);

  // Scroll to center a specific card
  const scrollToCard = useCallback((index: number) => {
    const container = scrollContainerRef.current;
    const card = cardRefs.current[index];
    if (!container || !card) return;

    const containerWidth = container.clientWidth;
    const cardLeft = card.offsetLeft;
    const cardWidth = card.offsetWidth;
    
    // Calculate scroll position to center the card
    const scrollTo = cardLeft - (containerWidth / 2) + (cardWidth / 2);

    container.scrollTo({
      left: scrollTo,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [prefersReducedMotion]);

  const scroll = (direction: "left" | "right") => {
    const newIndex = direction === "left" 
      ? Math.max(0, activeIndex - 1)
      : Math.min(features.length - 1, activeIndex + 1);
    scrollToCard(newIndex);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      scroll("left");
    } else if (e.key === "ArrowRight") {
      scroll("right");
    }
  };

  // Transition style based on motion preference
  const transition = prefersReducedMotion ? "none" : "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)";

  return (
    <section
      className="py-32 bg-black relative overflow-hidden"
      style={{ fontFamily: '"Times New Roman", Times, serif' }}
    >
      {/* Background gradient that shifts based on active card */}
      <div
        className="absolute inset-0 opacity-50 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 80% 50% at 50% 50%, ${features[activeIndex].glowColor}, transparent)`,
          transition,
        }}
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 px-6">
          <h2
            className="text-4xl md:text-5xl lg:text-6xl text-white mb-8"
            style={{ fontWeight: 400 }}
          >
            Built for Pre-Med Success
          </h2>
          <p
            className="text-white/50 text-lg md:text-xl leading-relaxed"
            style={{ fontWeight: 400 }}
          >
            Everything you need to find, evaluate, and secure clinical opportunities.
          </p>
        </div>

        {/* Scrollable Rail Container */}
        <div className="relative">
          {/* Left Arrow */}
          <button
            onClick={() => scroll("left")}
            className={`absolute left-4 md:left-8 top-1/2 -translate-y-1/2 z-20 w-12 h-12 md:w-14 md:h-14 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-white/20 hover:scale-105 ${
              canScrollLeft ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            style={{ transition }}
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          {/* Right Arrow */}
          <button
            onClick={() => scroll("right")}
            className={`absolute right-4 md:right-8 top-1/2 -translate-y-1/2 z-20 w-12 h-12 md:w-14 md:h-14 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-white/20 hover:scale-105 ${
              canScrollRight ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            style={{ transition }}
            aria-label="Scroll right"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Gradient Fade Edges */}
          <div className="absolute left-0 top-0 bottom-0 w-16 md:w-32 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-16 md:w-32 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />

          {/* Horizontal Scroll Container */}
          <div
            ref={scrollContainerRef}
            className="flex gap-6 md:gap-8 overflow-x-auto scrollbar-hide px-8 md:px-24 lg:px-32 py-8 snap-x snap-mandatory"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role="region"
            aria-label="Feature cards"
          >
            {features.map((feature, index) => (
              <div
                key={feature.id}
                ref={(el) => { cardRefs.current[index] = el; }}
                className="flex-shrink-0 snap-center"
              >
                <FeatureCard
                  feature={feature}
                  isActive={index === activeIndex}
                  prefersReducedMotion={prefersReducedMotion}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Dot Indicators */}
        <div className="flex justify-center gap-2 mt-8">
          {features.map((feature, index) => (
            <button
              key={feature.id}
              onClick={() => scrollToCard(index)}
              className={`h-2 rounded-full transition-all duration-500 ${
                index === activeIndex
                  ? "w-8 bg-white"
                  : "w-2 bg-white/30 hover:bg-white/50"
              }`}
              aria-label={`Go to ${feature.title}`}
              aria-current={index === activeIndex}
            />
          ))}
        </div>
      </div>

      {/* Hide scrollbar CSS */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </section>
  );
};

interface FeatureCardProps {
  feature: Feature;
  isActive: boolean;
  prefersReducedMotion: boolean;
}

const FeatureCard = ({ feature, isActive, prefersReducedMotion }: FeatureCardProps) => {
  const Icon = feature.icon;
  const transition = prefersReducedMotion ? "none" : "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)";

  return (
    <div
      style={{
        transform: isActive ? "scale(1)" : "scale(0.95)",
        opacity: isActive ? 1 : 0.6,
        transition,
      }}
    >
      <div
        className="relative w-[340px] md:w-[400px] h-[420px] md:h-[480px] rounded-3xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)",
          boxShadow: isActive
            ? `0 25px 80px -12px ${feature.glowColor}, 0 0 0 1px rgba(255,255,255,0.1)`
            : "0 10px 40px -10px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
          transition,
        }}
      >
        {/* Inner glow effect */}
        <div
          className="absolute inset-0 opacity-0"
          style={{
            background: `radial-gradient(circle at 50% 0%, ${feature.glowColor}, transparent 70%)`,
            opacity: isActive ? 1 : 0,
            transition,
          }}
        />

        {/* Card Content */}
        <div className="relative z-10 h-full flex flex-col p-8 md:p-10">
          {/* Icon */}
          <div
            className="mb-8"
            style={{
              transform: isActive ? "translateY(0)" : "translateY(10px)",
              transition,
            }}
          >
            <div
              className="w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center"
              style={{
                background: isActive
                  ? "rgba(255,255,255,0.12)"
                  : "rgba(255,255,255,0.06)",
                border: isActive
                  ? "1px solid rgba(255,255,255,0.2)"
                  : "1px solid rgba(255,255,255,0.08)",
                transition,
              }}
            >
              <Icon
                className="w-8 h-8 md:w-10 md:h-10"
                style={{
                  color: isActive ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.5)",
                  transition,
                }}
                strokeWidth={1.2}
              />
            </div>
          </div>

          {/* Title */}
          <h3
            className="text-2xl md:text-3xl text-white mb-4"
            style={{
              fontWeight: 500,
              opacity: isActive ? 1 : 0.7,
              transform: isActive ? "translateY(0)" : "translateY(5px)",
              transition,
            }}
          >
            {feature.title}
          </h3>

          {/* Description */}
          <p
            className="text-base md:text-lg leading-relaxed flex-grow"
            style={{
              fontWeight: 400,
              color: isActive ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.4)",
              transform: isActive ? "translateY(0)" : "translateY(5px)",
              transition,
            }}
          >
            {feature.description}
          </p>

          {/* Bottom decorative element */}
          <div
            className="mt-auto pt-8"
            style={{
              opacity: isActive ? 1 : 0,
              transition,
            }}
          >
            <div
              className="h-1 w-16 rounded-full"
              style={{
                background: `linear-gradient(90deg, ${feature.glowColor.replace("0.15", "0.6")}, transparent)`,
              }}
            />
          </div>
        </div>

        {/* Corner accent */}
        <div
          className="absolute bottom-0 right-0 w-32 h-32"
          style={{
            background: `radial-gradient(circle at 100% 100%, ${feature.glowColor}, transparent 70%)`,
            opacity: isActive ? 1 : 0,
            transition,
          }}
        />
      </div>
    </div>
  );
};

export default FeatureShowcaseRail;

