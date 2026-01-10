import { useState, useEffect, useCallback } from "react";
import { useInView } from "@/hooks/useInView";

interface Feature {
  id: string;
  title: string;
  description: string;
  image: string;
}

const features: Feature[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    description: "Track saved opportunities, monitor progress, and manage your clinical journey in one place.",
    image: "/screenshots/dashboard.png",
  },
  {
    id: "opportunities",
    title: "Opportunities",
    description: "Browse thousands of opportunities sorted by distance. Filter by type and add to your tracker.",
    image: "/screenshots/opportunities.png",
  },
  {
    id: "map",
    title: "Map",
    description: "Explore opportunities with our interactive map. Set a radius and visualize clusters near you.",
    image: "/screenshots/map.png",
  },
  {
    id: "profile",
    title: "Profile",
    description: "Keep your information up to date. Personalize recommendations and track hours automatically.",
    image: "/screenshots/profile.png",
  },
];

// Auto-rotate interval in milliseconds
const AUTO_ROTATE_INTERVAL = 5000;

const FeatureShowcase = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const { ref, isInView } = useInView({ threshold: 0.2 });

  const goToFeature = useCallback((index: number) => {
    if (index === activeIndex || isTransitioning) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveIndex(index);
      setTimeout(() => setIsTransitioning(false), 50);
    }, 300);
  }, [activeIndex, isTransitioning]);

  // Auto-rotate
  useEffect(() => {
    if (!isInView) return;
    
    const interval = setInterval(() => {
      const nextIndex = (activeIndex + 1) % features.length;
      goToFeature(nextIndex);
    }, AUTO_ROTATE_INTERVAL);

    return () => clearInterval(interval);
  }, [activeIndex, isInView, goToFeature]);

  const activeFeature = features[activeIndex];

  return (
    <section 
      ref={ref}
      className="py-32 bg-white relative overflow-hidden"
      style={{ fontFamily: '"Times New Roman", Times, serif' }}
    >
      <div className="container mx-auto px-6">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-4xl md:text-5xl lg:text-6xl text-black mb-6" style={{ fontWeight: 400 }}>
            Everything you need
          </h2>
          <p className="text-black/60 text-lg leading-relaxed" style={{ fontWeight: 400 }}>
            A complete platform to discover, track, and secure clinical experiences.
          </p>
        </div>

        {/* Feature Tabs */}
        <div className="flex flex-wrap justify-center gap-2 md:gap-4 mb-16">
          {features.map((feature, index) => (
            <button
              key={feature.id}
              onClick={() => goToFeature(index)}
              className={`px-6 py-3 text-sm md:text-base transition-all duration-300 border ${
                activeIndex === index
                  ? "bg-black text-white border-black"
                  : "bg-transparent text-black/70 border-black/20 hover:border-black/40 hover:text-black"
              }`}
              style={{ fontWeight: activeIndex === index ? 700 : 400 }}
            >
              {feature.title}
            </button>
          ))}
        </div>

        {/* Feature Content */}
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-5 gap-8 md:gap-12 items-center">
            {/* Text Content - Takes up less space */}
            <div 
              className={`md:col-span-2 space-y-5 transition-all duration-300 ${
                isTransitioning ? "opacity-0 translate-x-[-20px]" : "opacity-100 translate-x-0"
              }`}
            >
              <h3 
                className="text-2xl md:text-3xl text-black"
                style={{ fontWeight: 700 }}
              >
                {activeFeature.title}
              </h3>
              <p 
                className="text-black/60 text-base leading-relaxed"
                style={{ fontWeight: 400 }}
              >
                {activeFeature.description}
              </p>
              
              {/* Progress dots */}
              <div className="flex gap-2 pt-2">
                {features.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => goToFeature(index)}
                    className={`h-2 rounded-full transition-all duration-500 ${
                      activeIndex === index 
                        ? "w-8 bg-black" 
                        : "w-2 bg-black/20 hover:bg-black/40"
                    }`}
                    aria-label={`Go to feature ${index + 1}`}
                  />
                ))}
              </div>
            </div>

            {/* Image - Takes up more space */}
            <div 
              className={`md:col-span-3 relative transition-all duration-500 ${
                isTransitioning ? "opacity-0 translate-x-[20px]" : "opacity-100 translate-x-0"
              }`}
            >
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-black/10">
                <img
                  src={activeFeature.image}
                  alt={`${activeFeature.title} screenshot`}
                  className="w-full h-auto object-cover"
                  style={{ aspectRatio: "16/10" }}
                />
                {/* Subtle overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent pointer-events-none rounded-2xl" />
              </div>
              
              {/* Decorative elements with rounded corners */}
              <div className="absolute -bottom-4 -right-4 w-28 h-28 bg-black/5 rounded-xl -z-10" />
              <div className="absolute -top-4 -left-4 w-20 h-20 bg-black/5 rounded-xl -z-10" />
            </div>
          </div>
        </div>

        {/* Navigation arrows */}
        <div className="flex justify-center gap-4 mt-12">
          <button
            onClick={() => goToFeature((activeIndex - 1 + features.length) % features.length)}
            className="p-3 border border-black/20 hover:border-black hover:bg-black hover:text-white transition-all duration-300"
            aria-label="Previous feature"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => goToFeature((activeIndex + 1) % features.length)}
            className="p-3 border border-black/20 hover:border-black hover:bg-black hover:text-white transition-all duration-300"
            aria-label="Next feature"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
};

export default FeatureShowcase;

