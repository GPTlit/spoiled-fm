import { useRef, useState, useEffect, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface SeamlessSlideTrackProps {
  children: ReactNode;
  className?: string;
  showArrows?: boolean;
}

export function SeamlessSlideTrack({
  children,
  className = "",
  showArrows = false,
}: SeamlessSlideTrackProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  const checkScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 6);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 6);
  };

  useEffect(() => {
    checkScroll();
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [children]);

  // Smooth scroll helper
  const scrollBy = (amount: number) => {
    if (!containerRef.current) return;
    containerRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  // Drag-to-scroll for mouse / desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    const el = containerRef.current;
    if (!el) return;
    isDraggingRef.current = true;
    startXRef.current = e.pageX - el.offsetLeft;
    scrollLeftRef.current = el.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    containerRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
  };

  return (
    <div className={`relative group/track w-full ${className}`}>
      {/* Left Fade Gradient Mask */}
      <div
        className={`pointer-events-none absolute left-0 top-0 bottom-0 w-8 z-10 bg-gradient-to-r from-background via-background/80 to-transparent transition-opacity duration-200 ${
          canScrollLeft ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Right Fade Gradient Mask */}
      <div
        className={`pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-10 bg-gradient-to-l from-background via-background/80 to-transparent transition-opacity duration-200 ${
          canScrollRight ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Optional Left Scroll Arrow */}
      {showArrows && canScrollLeft && (
        <button
          onClick={() => scrollBy(-180)}
          className="absolute left-1 top-1/2 -translate-y-1/2 z-20 h-7 w-7 rounded-full bg-black/70 hover:bg-black/90 text-white/90 flex items-center justify-center shadow-lg border border-white/10 backdrop-blur-md transition-all active:scale-90"
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}

      {/* Optional Right Scroll Arrow */}
      {showArrows && canScrollRight && (
        <button
          onClick={() => scrollBy(180)}
          className="absolute right-1 top-1/2 -translate-y-1/2 z-20 h-7 w-7 rounded-full bg-black/70 hover:bg-black/90 text-white/90 flex items-center justify-center shadow-lg border border-white/10 backdrop-blur-md transition-all active:scale-90"
          aria-label="Scroll right"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* Scrollable Container */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth cursor-grab active:cursor-grabbing py-1 px-1 touch-pan-x"
        style={{
          WebkitOverflowScrolling: "touch",
        }}
      >
        {children}
      </div>
    </div>
  );
}
