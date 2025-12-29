import { useState, useEffect, useRef, useCallback } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import heroVideo1 from "@/assets/hero-video-1.mp4";
import heroVideo2 from "@/assets/hero-video-2.mp4";
import heroVideo3 from "@/assets/hero-video-3.mp4";
import heroVideo4 from "@/assets/hero-video-4.mp4";

const videos = [heroVideo4, heroVideo3, heroVideo2, heroVideo1];

const HeroVideoCarousel = () => {
  const [activeVideo, setActiveVideo] = useState(0);
  const [slideDirection, setSlideDirection] = useState<"none" | "left">("none");
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const isMobileDevice = useIsMobile();

  const handleVideoEnd = useCallback(() => {
    // Reset next video to beginning BEFORE transition starts
    const nextIndex = (activeVideo + 1) % videos.length;
    const nextVideo = videoRefs.current[nextIndex];
    if (nextVideo) {
      nextVideo.currentTime = 0;
      nextVideo.pause();
    }
    
    setSlideDirection("left");
    
    // After slide animation, switch to next video
    setTimeout(() => {
      setActiveVideo(nextIndex);
      setSlideDirection("none");
    }, 1000);
  }, [activeVideo]);

  // Play active video when it changes
  useEffect(() => {
    const video = videoRefs.current[activeVideo];
    if (video) {
      video.currentTime = 0;
      // On mobile, try to play but don't force (autoplay may be blocked)
      if (!isMobileDevice) {
        video.play().catch(() => {});
      } else {
        // On mobile, only attempt play if user has interacted
        video.play().catch(() => {
          // Autoplay blocked on mobile - this is expected behavior
        });
      }
    }
  }, [activeVideo, isMobileDevice]);

  // Set up video end listener
  useEffect(() => {
    const video = videoRefs.current[activeVideo];
    if (!video) return;

    video.addEventListener("ended", handleVideoEnd);
    return () => video.removeEventListener("ended", handleVideoEnd);
  }, [activeVideo, handleVideoEnd]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <style>{`
        /* Hide all video controls on mobile */
        video::-webkit-media-controls {
          display: none !important;
        }
        video::-webkit-media-controls-enclosure {
          display: none !important;
        }
        video::-webkit-media-controls-panel {
          display: none !important;
        }
        video::-webkit-media-controls-play-button {
          display: none !important;
        }
        video::-webkit-media-controls-start-playback-button {
          display: none !important;
        }
        /* Hide native controls */
        video[controls] {
          display: none;
        }
      `}</style>
      {videos.map((src, index) => {
        const isActive = index === activeVideo;
        const isNext = index === (activeVideo + 1) % videos.length;
        
        let transform = "translate-x-full"; // Off screen right by default
        let opacity = "opacity-0";
        
        if (isActive) {
          if (slideDirection === "left") {
            transform = "-translate-x-full";
            opacity = "opacity-0";
          } else {
            transform = "translate-x-0";
            opacity = "opacity-100";
          }
        } else if (isNext && slideDirection === "left") {
          transform = "translate-x-0";
          opacity = "opacity-100";
        }

        return (
          <div
            key={index}
            className={`absolute inset-0 transition-all duration-1000 ease-in-out ${transform} ${opacity}`}
          >
            <video
              ref={(el) => (videoRefs.current[index] = el)}
              muted
              playsInline
              autoPlay={index === 0 && !isMobileDevice}
              controls={false}
              disablePictureInPicture
              disableRemotePlayback
              preload={index === 0 ? (isMobileDevice ? "metadata" : "auto") : "none"}
              className="w-full h-full object-cover pointer-events-none"
              style={{ 
                WebkitPlaysinline: true,
                playsInline: true,
              }}
            >
              <source src={src} type="video/mp4" />
            </video>
          </div>
        );
      })}

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Extra blend during transition */}
      <div 
        className={`absolute inset-0 bg-black/40 transition-opacity duration-500 ease-in-out ${
          slideDirection === "left" ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
};

export default HeroVideoCarousel;
