import { type ReactNode } from "react";
import { containerStyles } from "../constants/design-system";

interface ContainerProps {
  children: ReactNode;
  size?: keyof typeof containerStyles.size;
  className?: string;
}

/**
 * Reusable Container component
 * Centers content with max-width constraints
 */
export function Container({
  children,
  size = "md",
  className = "",
}: ContainerProps) {
  return (
    <div className={`${containerStyles.size[size]} ${containerStyles.base} ${className}`}>
      {children}
    </div>
  );
}
