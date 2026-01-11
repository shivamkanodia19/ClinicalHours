import { useEffect, useRef, useState } from "react";
import { MapPin, ClipboardCheck, Star, MessageCircle, LucideIcon } from "lucide-react";

/**
 * HOW IT WORKS TIMELINE
 * =====================
 * A scroll-reveal timeline component with alternating left/right cards on desktop.
 * 
 * CUSTOMIZATION:
 * - REVEAL_THRESHOLD: How much of the step must be visible to trigger (0-1)
 * - ANIMATION_DURATION: How long the reveal animation takes (ms)
 * - STAGGER_DELAY: Delay between spine fill and content reveal (ms)
 */

// Adjust these values to tweak animation timing
const REVEAL_THRESHOLD = 0.3; // 30% of element must be visible
const ANIMATION_DURATION = 600; // ms
const STAGGER_DELAY = 100; // ms delay for content after spine

interface Step {
  stepNumber: number;
  title: string;
  description: string;
  icon: LucideIcon;
}

// STEP CONTENT - Edit this array to update steps
const steps: Step[] = [
  {
    stepNumber: 1,
    title: "Discover",
    description: "Browse opportunities sorted by distance with acceptance likelihood.",
    icon: MapPin,
  },
  {
    stepNumber: 2,
    title: "Track",
    description: "Save and track your application progress in one dashboard.",
    icon: ClipboardCheck,
  },
  {
    stepNumber: 3,
    title: "Review",
    description: "Read real ratings from students who've been there.",
    icon: Star,
  },
  {
    stepNumber: 4,
    title: "Connect",
    description: "Ask questions and get answers from the community.",
    icon: MessageCircle,
  },
];

const HowItWorksTimeline = () => {
  const [activeSteps, setActiveSteps] = useState<Set<number>>(new Set());
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    
    // If reduced motion, show all steps immediately
    if (mediaQuery.matches) {
      setActiveSteps(new Set(steps.map((_, i) => i)));
    }
    
    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
      if (e.matches) {
        setActiveSteps(new Set(steps.map((_, i) => i)));
      }
    };
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // IntersectionObserver for scroll-triggered reveals
  useEffect(() => {
    if (prefersReducedMotion) return;

    const observers: IntersectionObserver[] = [];

    stepRefs.current.forEach((ref, index) => {
      if (!ref) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveSteps((prev) => new Set([...prev, index]));
          }
        },
        {
          threshold: REVEAL_THRESHOLD,
          rootMargin: "-10% 0px -10% 0px", // Trigger slightly after entering viewport
        }
      );

      observer.observe(ref);
      observers.push(observer);
    });

    return () => observers.forEach((obs) => obs.disconnect());
  }, [prefersReducedMotion]);

  // Calculate highest active step for spine fill
  const highestActiveStep = Math.max(...Array.from(activeSteps), -1);

  // Transition styles
  const transition = prefersReducedMotion ? "none" : `all ${ANIMATION_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1)`;

  return (
    <section
      ref={sectionRef}
      className="py-24 md:py-32 bg-black relative overflow-hidden"
      style={{ fontFamily: '"Times New Roman", Times, serif' }}
    >
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.01] to-transparent pointer-events-none" />

      <div className="container mx-auto px-6 relative z-10">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16 md:mb-20">
          <h2
            className="text-4xl md:text-5xl lg:text-6xl text-white mb-6"
            style={{ fontWeight: 400 }}
          >
            How It Works
          </h2>
          <p
            className="text-white/50 text-lg leading-relaxed"
            style={{ fontWeight: 400 }}
          >
            Four steps to your clinical experience.
          </p>
        </div>

        {/* Timeline Container */}
        <div className="relative max-w-4xl mx-auto">
          {/* Center Spine - Desktop only */}
          <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2">
            {/* Background spine (muted) */}
            <div className="absolute inset-0 bg-white/10" />
            
            {/* Filled spine (glows as user scrolls) */}
            <div
              className="absolute top-0 left-0 right-0 bg-gradient-to-b from-white/60 via-white/40 to-white/20"
              style={{
                height: `${((highestActiveStep + 1) / steps.length) * 100}%`,
                transition,
                boxShadow: "0 0 20px rgba(255,255,255,0.3)",
              }}
            />
          </div>

          {/* Mobile Spine - Left aligned */}
          <div className="md:hidden absolute left-6 top-0 bottom-0 w-px">
            {/* Background spine */}
            <div className="absolute inset-0 bg-white/10" />
            
            {/* Filled spine */}
            <div
              className="absolute top-0 left-0 right-0 bg-gradient-to-b from-white/60 to-white/20"
              style={{
                height: `${((highestActiveStep + 1) / steps.length) * 100}%`,
                transition,
              }}
            />
          </div>

          {/* Steps */}
          <div className="relative space-y-12 md:space-y-16">
            {steps.map((step, index) => (
              <TimelineStep
                key={step.stepNumber}
                step={step}
                index={index}
                isActive={activeSteps.has(index)}
                isEven={index % 2 === 0}
                prefersReducedMotion={prefersReducedMotion}
                ref={(el) => { stepRefs.current[index] = el; }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

interface TimelineStepProps {
  step: Step;
  index: number;
  isActive: boolean;
  isEven: boolean;
  prefersReducedMotion: boolean;
}

import { forwardRef } from "react";

const TimelineStep = forwardRef<HTMLDivElement, TimelineStepProps>(
  ({ step, index, isActive, isEven, prefersReducedMotion }, ref) => {
    const Icon = step.icon;
    const transition = prefersReducedMotion
      ? "none"
      : `all ${ANIMATION_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1) ${STAGGER_DELAY}ms`;
    const dotTransition = prefersReducedMotion
      ? "none"
      : `all ${ANIMATION_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1)`;

    return (
      <div
        ref={ref}
        className={`relative flex items-start md:items-center ${
          // Desktop: alternate left/right
          isEven ? "md:flex-row" : "md:flex-row-reverse"
        }`}
      >
        {/* Dot/Node on the spine */}
        {/* Mobile: positioned on left spine */}
        <div
          className="absolute left-6 md:left-1/2 -translate-x-1/2 flex items-center justify-center z-10"
          style={{
            opacity: isActive ? 1 : 0.4,
            transform: `translateX(-50%) scale(${isActive ? 1 : 0.8})`,
            transition: dotTransition,
          }}
        >
          <div
            className="w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center border-2"
            style={{
              backgroundColor: isActive ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,1)",
              borderColor: isActive ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.15)",
              boxShadow: isActive ? "0 0 30px rgba(255,255,255,0.2)" : "none",
              transition: dotTransition,
            }}
          >
            <Icon
              className="w-5 h-5 md:w-6 md:h-6"
              style={{
                color: isActive ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
                transition: dotTransition,
              }}
              strokeWidth={1.5}
            />
          </div>
          
          {/* Step number badge */}
          <div
            className="absolute -top-1 -right-1 w-5 h-5 md:w-6 md:h-6 rounded-full bg-black border flex items-center justify-center text-xs font-medium"
            style={{
              borderColor: isActive ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)",
              color: isActive ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.5)",
              transition: dotTransition,
            }}
          >
            {step.stepNumber}
          </div>
        </div>

        {/* Content Card */}
        {/* Mobile: offset from left spine */}
        {/* Desktop: alternates sides */}
        <div
          className={`pl-20 md:pl-0 md:w-[calc(50%-40px)] ${
            isEven ? "md:pr-8 md:text-right" : "md:pl-8 md:text-left"
          }`}
          style={{
            opacity: isActive ? 1 : 0,
            transform: isActive
              ? "translateY(0) scale(1)"
              : prefersReducedMotion
              ? "translateY(0) scale(1)"
              : "translateY(20px) scale(0.98)",
            transition,
          }}
        >
          <div
            className={`p-6 md:p-8 rounded-2xl border ${
              isEven ? "md:ml-auto" : "md:mr-auto"
            }`}
            style={{
              maxWidth: "360px",
              backgroundColor: isActive
                ? "rgba(255,255,255,0.03)"
                : "rgba(255,255,255,0.01)",
              borderColor: isActive
                ? "rgba(255,255,255,0.1)"
                : "rgba(255,255,255,0.05)",
              transition,
            }}
          >
            <h3
              className="text-xl md:text-2xl text-white mb-3"
              style={{
                fontWeight: 500,
                opacity: isActive ? 1 : 0.6,
                transition,
              }}
            >
              {step.title}
            </h3>
            <p
              className="text-sm md:text-base leading-relaxed"
              style={{
                fontWeight: 400,
                color: isActive ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.35)",
                transition,
              }}
            >
              {step.description}
            </p>
          </div>
        </div>

        {/* Spacer for the other side on desktop */}
        <div className="hidden md:block md:w-[calc(50%-40px)]" />
      </div>
    );
  }
);

TimelineStep.displayName = "TimelineStep";

export default HowItWorksTimeline;

