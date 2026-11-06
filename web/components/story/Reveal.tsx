"use client";
import { useInView } from "@/lib/story/hooks";

/** Fades/slides children in when scrolled into view. Reduced motion: shown as is (CSS). */
export function Reveal({ children, delay = 0, className = "", as: Tag = "div" }: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li" | "p";
}) {
  const [ref, inView] = useInView<HTMLElement>();
  return (
    <Tag
      ref={ref as React.Ref<never>}
      data-in={inView}
      className={`reveal ${className}`}
      style={{ transitionDelay: inView ? `${delay}ms` : "0ms" }}
    >
      {children}
    </Tag>
  );
}
