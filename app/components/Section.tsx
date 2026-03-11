import { type ReactNode } from "react";
import { sectionStyles } from "../constants/design-system";

interface SectionProps {
  children: ReactNode;
  variant?: keyof typeof sectionStyles.variant;
  className?: string;
}

/**
 * Reusable Section wrapper component
 * Provides consistent spacing and background colors
 */
export function Section({
  children,
  variant = "default",
  className = "",
}: SectionProps) {
  return (
    <section className={`${sectionStyles.base} ${sectionStyles.variant[variant]} ${className}`}>
      {children}
    </section>
  );
}
