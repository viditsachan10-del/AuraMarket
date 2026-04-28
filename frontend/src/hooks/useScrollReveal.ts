"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function useScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    const observerOptions = {
      threshold: 0.12,
      rootMargin: "0px 0px -50px 0px",
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        }
      });
    }, observerOptions);

    const reveals = document.querySelectorAll(".reveal");
    reveals.forEach((el) => observer.observe(el));

    return () => {
      reveals.forEach((el) => observer.unobserve(el));
      observer.disconnect();
    };
  }, [pathname]); // Re-run on route change
}
