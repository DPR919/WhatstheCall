import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { buttonStyles } from "../constants/design-system";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof buttonStyles;
  children: ReactNode;
}

/**
 * Reusable Button component
 * Implements the What's The Call? design system
 */
export function Button({
  variant = "primary",
  children,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${buttonStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
