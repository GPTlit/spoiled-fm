import { useRef, useState, useEffect, useCallback, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface SeamlessSlideTrackProps {
  children: ReactNode;
  className?: string;
  showArrows?: boolean;
}

export function SeamlessSlideTrack({
  children,
  className = "",
  showArrows = true,
}: SeamlessSlideTrackProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const slideBarRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [canScroll, setCanScroll] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  const updateScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll > 4) {
      setCanScroll(true);
      const progress = Math.max(0, Math.min(1, el.scrollLeft / maxScroll));
      setScrollProgress(progress);
      setCanScrollLeft(el.scrollLeft > 6);
      setCanScrollRight(el.scrollLeft < maxScroll - 6);
    } else {
      setCanScroll(false);
      setScrollProgress(0);
      setCanScrollLeft(false);
      setCanScrollRight(false);
    }
  }, []);

  useEffect(() => {
    updateScroll();
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScroll, { passive: true });
    window.addEventListener("resize", updateScroll);
    return () => {
      el.removeEventListener("scroll", updateScroll);
      window.removeEventListener("resize", updateScroll);
    };
  }, [children, updateScroll]);

  // Smooth scroll helper
  const scrollBy = (amount: number) => {
    if (!containerRef.current) return;
    containerRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  // Drag on container
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

  // Click or drag on the green slide bar itself to slide left/right smoothly
  const handleSlideBarPointer = (
    e: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>,
  ) => {
    const bar = slideBarRef.current;
    const container = containerRef.current;
    if (!bar || !container) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const maxScroll = container.scrollWidth - container.clientWidth;
    container.scrollTo({ left: ratio * maxScroll, behavior: "smooth" });
  };

  return (
    <div className={`relative w-full ${className}`}>
      {/* Scrollable Items Container: Native gray scrollbars 100% removed */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        className="seamless-slide-container flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth cursor-grab active:cursor-grabbing py-1 px-0.5 touch-pan-x select-none"
        style={{
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {children}
      </div>

      {/* Visual Green Slide Bar Indicator (Only the green one down here is visible) */}
      {canScroll && (
        <div className="flex items-center justify-between gap-3 pt-2 pb-1 px-1">
          {showArrows && (
            <button
              onClick={() => scrollBy(-180)}
              disabled={!canScrollLeft}
              className={`h-6 w-6 rounded-full flex items-center justify-center transition-all ${
                canScrollLeft
                  ? "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white shadow-xs border border-slate-300/80 dark:border-slate-700/80"
                  : "opacity-25 cursor-not-allowed text-muted-foreground"
              }`}
              title="Slide left to see previous items"
              aria-label="Slide left"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Interactive Slide Bar Track with Sliding Green Indicator */}
          <div
            ref={slideBarRef}
            onClick={handleSlideBarPointer}
            className="flex-1 max-w-[220px] mx-auto h-2 rounded-full bg-slate-200/90 dark:bg-slate-800/90 border border-slate-300/80 dark:border-slate-700/80 p-0.5 cursor-pointer relative overflow-hidden"
            title="Slide left or right to explore"
          >
            <div
              className="h-full bg-emerald-500 rounded-full shadow-xs transition-transform duration-75"
              style={{
                width: "30%",
                transform: `translateX(${scrollProgress * 233}%)`,
              }}
            />
          </div>

          {showArrows && (
            <button
              onClick={() => scrollBy(180)}
              disabled={!canScrollRight}
              className={`h-6 w-6 rounded-full flex items-center justify-center transition-all ${
                canScrollRight
                  ? "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white shadow-xs border border-slate-300/80 dark:border-slate-700/80"
                  : "opacity-25 cursor-not-allowed text-muted-foreground"
              }`}
              title="Slide right to see more items"
              aria-label="Slide right"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
