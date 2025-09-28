import { createContext, useContext, useState, useEffect } from "react";

interface AccessibilitySettings {
  highContrast: boolean;
  reducedMotion: boolean;
  fontSize: 'normal' | 'large' | 'larger';
  screenReaderAnnouncements: boolean;
}

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  updateSettings: (settings: Partial<AccessibilitySettings>) => void;
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AccessibilitySettings>({
    highContrast: false,
    reducedMotion: false,
    fontSize: 'normal',
    screenReaderAnnouncements: true,
  });

  // Detect user preferences
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;
    
    setSettings(prev => ({
      ...prev,
      reducedMotion: prefersReducedMotion,
      highContrast: prefersHighContrast,
    }));

    // Apply accessibility classes to document
    document.documentElement.classList.toggle('high-contrast', prefersHighContrast);
    document.documentElement.classList.toggle('reduced-motion', prefersReducedMotion);
  }, []);

  // Update CSS custom properties based on settings
  useEffect(() => {
    const root = document.documentElement;
    
    // Font size scaling
    const fontSizeMap = {
      normal: '1',
      large: '1.125',
      larger: '1.25'
    };
    root.style.setProperty('--font-scale', fontSizeMap[settings.fontSize]);
    
    // High contrast mode
    root.classList.toggle('high-contrast', settings.highContrast);
    root.classList.toggle('reduced-motion', settings.reducedMotion);
  }, [settings]);

  const updateSettings = (newSettings: Partial<AccessibilitySettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!settings.screenReaderAnnouncements) return;

    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  };

  return (
    <AccessibilityContext.Provider value={{ settings, updateSettings, announce }}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within AccessibilityProvider');
  }
  return context;
}

// Skip link component for keyboard navigation
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="
        sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 
        bg-blue-600 text-white px-4 py-2 rounded-md z-50 
        focus:ring-2 focus:ring-blue-300 focus:outline-none
        transition-all duration-200
      "
    >
      Skip to main content
    </a>
  );
}

// Accessible button with proper focus management
interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function AccessibleButton({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  loading = false,
  disabled,
  ...props 
}: AccessibleButtonProps) {
  const { settings } = useAccessibility();

  const baseClasses = `
    relative inline-flex items-center justify-center font-medium rounded-md
    transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
    ${settings.reducedMotion ? '' : 'transform hover:scale-105 active:scale-95'}
  `;

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500',
    ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-gray-500'
  };

  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-3 text-base',
    lg: 'px-6 py-4 text-lg'
  };

  // High contrast adjustments
  const highContrastClasses = settings.highContrast ? 'border-2 border-current' : '';

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${highContrastClasses}`}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <span className={loading ? 'opacity-0' : 'opacity-100'}>
        {children}
      </span>
    </button>
  );
}

// Enhanced form field with proper labeling and error handling
interface AccessibleFieldProps {
  label: string;
  error?: string;
  help?: string;
  required?: boolean;
  children: React.ReactNode;
  id: string;
}

export function AccessibleField({ label, error, help, required, children, id }: AccessibleFieldProps) {
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="space-y-2">
      <label 
        htmlFor={id} 
        className="block text-sm font-medium text-gray-700"
      >
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-label="required">
            *
          </span>
        )}
      </label>
      
      <div className="relative">
        {children}
      </div>
      
      {help && (
        <p id={helpId} className="text-xs text-gray-500">
          {help}
        </p>
      )}
      
      {error && (
        <p id={errorId} className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// Accessible navigation with proper ARIA landmarks
export function AccessibleNav({ children }: { children: React.ReactNode }) {
  return (
    <nav role="navigation" aria-label="Main navigation">
      {children}
    </nav>
  );
}