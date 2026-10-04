/**
 * Class names shared by the small wrapper components and account forms.
 * Editorial color and type tokens live in app/editorial.css.
 */
export const buttonStyles = {
  primary: "primary-btn",
  secondary: "secondary-btn",
} as const;

export const containerStyles = {
  base: "site-container",
  size: {
    sm: "max-w-2xl",
    md: "max-w-3xl",
    lg: "max-w-4xl",
    xl: "max-w-[1180px]",
  },
} as const;

export const sectionStyles = {
  base: "w-full",
  variant: {
    default: "bg-white",
    gray: "bg-[var(--paper)]",
    hero: "relative min-h-screen",
  },
} as const;

export const modalStyles = {
  backdrop: "replay-backdrop",
  container: "replay-modal relative",
  closeButton: "ghost-btn absolute right-4 top-4",
} as const;

export const formStyles = {
  inputGroup: "form-field",
  label: "form-label",
  input: "form-input",
  submitButton: "primary-btn form-submit",
  link: "text-link",
  helperText: "auth-bottom",
} as const;
