import { AccessibilityInfo, Platform } from 'react-native';

interface AccessibilitySettings {
  isScreenReaderEnabled: boolean;
  isBoldTextEnabled: boolean;
  isHighContrastEnabled: boolean;
  preferredContentSizeCategory: string;
}

class AccessibilityManager {
  private settings: AccessibilitySettings = {
    isScreenReaderEnabled: false,
    isBoldTextEnabled: false,
    isHighContrastEnabled: false,
    preferredContentSizeCategory: 'medium',
  };

  async initialize(): Promise<void> {
    try {
      // Check if screen reader is enabled
      const isScreenReaderEnabled = await AccessibilityInfo.isScreenReaderEnabled();
      this.settings.isScreenReaderEnabled = isScreenReaderEnabled;

      // Check if bold text is enabled (iOS only)
      if (Platform.OS === 'ios') {
        const isBoldTextEnabled = await AccessibilityInfo.isBoldTextEnabled();
        this.settings.isBoldTextEnabled = isBoldTextEnabled;
      }

      // Check if high contrast is enabled (Android only)
      if (Platform.OS === 'android') {
        const isHighContrastEnabled = await AccessibilityInfo.isHighContrastEnabled();
        this.settings.isHighContrastEnabled = isHighContrastEnabled;
      }

      // Get preferred content size category
      const preferredContentSizeCategory = await AccessibilityInfo.getPreferredContentSizeCategory();
      this.settings.preferredContentSizeCategory = preferredContentSizeCategory;

      if (__DEV__) {
        console.log('🔍 Accessibility settings loaded:', this.settings);
      }
    } catch (error) {
      console.log('Error initializing accessibility settings:', error);
    }
  }

  getSettings(): AccessibilitySettings {
    return { ...this.settings };
  }

  isScreenReaderEnabled(): boolean {
    return this.settings.isScreenReaderEnabled;
  }

  isBoldTextEnabled(): boolean {
    return this.settings.isBoldTextEnabled;
  }

  isHighContrastEnabled(): boolean {
    return this.settings.isHighContrastEnabled;
  }

  getPreferredContentSizeCategory(): string {
    return this.settings.preferredContentSizeCategory;
  }

  // Generate accessibility props for components
  generateAccessibilityProps(options: {
    label?: string;
    hint?: string;
    role?: string;
    state?: {
      disabled?: boolean;
      selected?: boolean;
      checked?: boolean;
      expanded?: boolean;
    };
    actions?: Array<{
      name: string;
      label: string;
    }>;
  }) {
    const props: any = {};

    if (options.label) {
      props.accessibilityLabel = options.label;
    }

    if (options.hint) {
      props.accessibilityHint = options.hint;
    }

    if (options.role) {
      props.accessibilityRole = options.role;
    }

    if (options.state) {
      props.accessibilityState = options.state;
    }

    if (options.actions && options.actions.length > 0) {
      props.accessibilityActions = options.actions;
    }

    return props;
  }

  // Get dynamic font size based on user preferences
  getFontSize(baseSize: number): number {
    const category = this.settings.preferredContentSizeCategory;
    
    const sizeMultipliers: { [key: string]: number } = {
      'extraSmall': 0.8,
      'small': 0.9,
      'medium': 1.0,
      'large': 1.1,
      'extraLarge': 1.2,
      'extraExtraLarge': 1.3,
      'extraExtraExtraLarge': 1.4,
      'accessibilityMedium': 1.5,
      'accessibilityLarge': 1.6,
      'accessibilityExtraLarge': 1.7,
      'accessibilityExtraExtraLarge': 1.8,
      'accessibilityExtraExtraExtraLarge': 1.9,
    };

    const multiplier = sizeMultipliers[category] || 1.0;
    return Math.round(baseSize * multiplier);
  }

  // Get dynamic spacing based on user preferences
  getSpacing(baseSpacing: number): number {
    const category = this.settings.preferredContentSizeCategory;
    
    // Increase spacing for larger text sizes
    if (category.includes('extraLarge') || category.includes('accessibility')) {
      return Math.round(baseSpacing * 1.2);
    }
    
    return baseSpacing;
  }

  // Check if we should use high contrast colors
  shouldUseHighContrast(): boolean {
    return this.settings.isHighContrastEnabled;
  }

  // Check if we should use bold text
  shouldUseBoldText(): boolean {
    return this.settings.isBoldTextEnabled;
  }

  // Generate accessible color combinations
  getAccessibleColors(primaryColor: string, backgroundColor: string): {
    primary: string;
    background: string;
    contrast: string;
  } {
    if (this.shouldUseHighContrast()) {
      // Return high contrast colors
      return {
        primary: '#000000',
        background: '#ffffff',
        contrast: '#000000',
      };
    }

    return {
      primary: primaryColor,
      background: backgroundColor,
      contrast: this.getContrastColor(primaryColor, backgroundColor),
    };
  }

  private getContrastColor(foreground: string, background: string): string {
    // Simple contrast calculation - in a real app you might use a more sophisticated library
    const getLuminance = (color: string) => {
      const rgb = parseInt(color.replace('#', ''), 16);
      const r = (rgb >> 16) & 0xff;
      const g = (rgb >> 8) & 0xff;
      const b = (rgb >> 0) & 0xff;
      return 0.299 * r + 0.587 * g + 0.114 * b;
    };

    const fgLuminance = getLuminance(foreground);
    const bgLuminance = getLuminance(background);
    
    return fgLuminance > bgLuminance ? '#000000' : '#ffffff';
  }

  // Announce changes to screen reader
  announceForAccessibility(message: string): void {
    if (this.settings.isScreenReaderEnabled) {
      AccessibilityInfo.announceForAccessibility(message);
    }
  }

  // Set accessibility focus
  setAccessibilityFocus(ref: any): void {
    if (this.settings.isScreenReaderEnabled && ref) {
      AccessibilityInfo.setAccessibilityFocus(ref);
    }
  }
}

// Export singleton instance
export const accessibilityManager = new AccessibilityManager();

// Helper functions
export const initializeAccessibility = () => accessibilityManager.initialize();
export const getAccessibilitySettings = () => accessibilityManager.getSettings();
export const isScreenReaderEnabled = () => accessibilityManager.isScreenReaderEnabled();
export const getFontSize = (baseSize: number) => accessibilityManager.getFontSize(baseSize);
export const getSpacing = (baseSpacing: number) => accessibilityManager.getSpacing(baseSpacing);
export const generateAccessibilityProps = (options: any) => accessibilityManager.generateAccessibilityProps(options);
export const announceForAccessibility = (message: string) => accessibilityManager.announceForAccessibility(message);
