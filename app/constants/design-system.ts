/**
 * What's The Call? Design System
 * 
 * This file defines the design language for the entire application.
 * All pages and components should reference these values for consistency.
 */

export const colors = {
  // Brand colors - warm gradient palette inspired by fencing energy
  brand: {
    primary: '#EA580C', // orange-600
    secondary: '#F59E0B', // amber-500
    accent: '#EAB308', // yellow-500
  },
  
  // Neutral colors
  neutral: {
    white: '#FFFFFF',
    gray50: '#F9FAFB',
    gray100: '#F3F4F6',
    gray700: '#374151',
    gray900: '#111827',
    black: '#000000',
  },
  
  // Semantic colors
  text: {
    primary: '#111827', // gray-900
    secondary: '#374151', // gray-700
    inverse: '#FFFFFF',
  },
  
  background: {
    light: '#F9FAFB', // gray-50
    white: '#FFFFFF',
    dark: '#111827', // gray-900
  },
} as const;

export const spacing = {
  section: {
    padding: {
      mobile: '3rem 1.5rem', // py-12 px-6
      desktop: '5rem 1.5rem', // py-20 px-6
    },
  },
  
  container: {
    maxWidth: {
      sm: '42rem', // max-w-2xl
      md: '48rem', // max-w-3xl
      lg: '64rem', // max-w-4xl
    },
  },
} as const;

export const typography = {
  // Display/Hero text
  display: {
    mobile: 'text-6xl', // 3.75rem
    tablet: 'md:text-7xl', // 4.5rem
    desktop: 'lg:text-8xl', // 6rem
  },
  
  // Section headings
  heading: {
    h1: 'text-4xl', // 2.25rem
    h2: 'text-3xl', // 1.875rem
    h3: 'text-2xl', // 1.5rem
  },
  
  // Body text
  body: {
    large: 'text-lg', // 1.125rem
    base: 'text-base', // 1rem
    small: 'text-sm', // 0.875rem
  },
} as const;

export const effects = {
  // Shadows
  shadow: {
    button: 'shadow-lg hover:shadow-xl',
    card: 'shadow-md',
  },
  
  // Transitions
  transition: {
    base: 'transition-all duration-300',
    fast: 'transition-all duration-200',
  },
  
  // Hover effects
  hover: {
    scale: 'hover:scale-105',
    lift: 'hover:-translate-y-1',
  },
} as const;

export const layout = {
  // Border radius
  rounded: {
    button: 'rounded-full',
    card: 'rounded-lg',
    input: 'rounded-md',
  },
  
  // Common layouts
  center: 'flex items-center justify-center',
  stack: 'flex flex-col',
} as const;

/**
 * Gradient overlays for hero sections
 * Creates the signature warm silhouette effect
 */
export const gradients = {
  heroOverlay: 'bg-gradient-to-br from-orange-600/90 via-amber-500/85 to-yellow-500/80 mix-blend-multiply',
  darkOverlay: 'bg-black/20',
} as const;

/**
 * Button variants
 * Predefined button styles for consistency
 */
export const buttonStyles = {
  primary: 'cursor-pointer px-10 py-4 bg-white text-gray-900 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 min-w-[160px]',
  secondary: 'cursor-pointer px-10 py-4 bg-gray-900 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 min-w-[160px]',
} as const;

/**
 * Container styles
 * Shared max-width and centering tokens
 */
export const containerStyles = {
  base: 'mx-auto w-full px-6 md:px-8',
  size: {
    sm: 'max-w-2xl',
    md: 'max-w-3xl',
    lg: 'max-w-4xl',
    xl: 'max-w-[1150px]',
  },
} as const;

/**
 * Section styles
 * Shared section spacing and variant backgrounds/layout
 */
export const sectionStyles = {
  base: 'w-full px-6 py-20',
  variant: {
    default: 'bg-white',
    gray: 'bg-gray-50',
    hero: 'relative min-h-screen flex items-center justify-center overflow-hidden',
  },
} as const;

/**
 * Splash page-specific tokens
 * Keeps page-level styling centralized and reusable.
 */
export const splashPageStyles = {
  root: 'min-h-screen',
  hero: {
    sectionPadding: 'py-16',
    backgroundLayer: 'absolute inset-0 z-0',
    backgroundImage: 'h-full w-full object-cover',
    content: 'relative z-10 text-center',
    title: 'mb-12 text-6xl text-white drop-shadow-lg md:text-7xl lg:text-8xl',
    actions: 'flex flex-col items-center justify-center gap-6 sm:flex-row',
  },
  about: {
    title: 'mb-8 text-center text-4xl text-gray-900',
    body: 'text-lg leading-relaxed text-gray-700',
  },
} as const;

/**
 * Modal styles
 * Shared modal shell/title tokens for auth popups.
 */
export const modalStyles = {
  backdrop: 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4',
  container: 'bg-white rounded-lg shadow-xl max-w-md w-full p-8 relative',
  closeButton: 'cursor-pointer absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors',
  title: 'text-3xl mb-6 text-gray-900',
} as const;

/**
 * Form styles
 * Shared auth form spacing and controls.
 */
export const formStyles = {
  inputGroup: 'mb-6',
  label: 'block text-sm mb-2 text-gray-700',
  input: 'w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent',
  submitButton: 'cursor-pointer w-full px-6 py-3 bg-orange-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105',
  link: 'cursor-pointer text-orange-600 hover:text-orange-700 transition-colors text-sm',
  helperText: 'mt-4 text-center text-sm text-gray-600',
} as const;
