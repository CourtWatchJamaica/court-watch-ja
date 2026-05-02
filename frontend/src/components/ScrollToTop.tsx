"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 200);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollUp = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <button
      onClick={scrollUp}
      aria-label="Scroll to top"
      className={`fixed bottom-24 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-[#009B3A] text-white shadow-lg shadow-[#009B3A]/30 transition-all duration-300 hover:bg-[#009B3A]/85 hover:shadow-[#009B3A]/50 md:bottom-8 ${
        visible
          ? "translate-y-0 opacity-100 pointer-events-auto"
          : "translate-y-4 opacity-0 pointer-events-none"
      }`}
    >
      <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
    </button>
  );
}
