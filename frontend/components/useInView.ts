import { useEffect, useRef, useState } from "react";

/**
 * Tiny scroll-reveal hook built on the native IntersectionObserver API —
 * no animation library dependency needed. Returns a ref to attach and a
 * boolean that flips to true once the element scrolls into view (and
 * stays true after, so content doesn't flicker on scroll-up).
 */
export function useInView<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
}
