import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

interface ThemeColors {
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    primary: string;
    secondary: string;
    accent: string;
    error: string;
    success: string;
    warning: string;
    border: string;
    shadow: string;
}

interface Theme {
    colors: ThemeColors;
    isDark: boolean;
}

const lightTheme: Theme = {
    isDark: false,
    colors: {
        background: "#f8f9fa",
        surface: "#ffffff",
        text: "#2c3e50",
        textSecondary: "#7f8c8d",
        primary: "#3498db",
        secondary: "#95a5a6",
        accent: "#f4511e",
        error: "#e74c3c",
        success: "#27ae60",
        warning: "#f39c12",
        border: "#ecf0f1",
        shadow: "#000000",
    },
};

const darkTheme: Theme = {
    isDark: true,
    colors: {
        background: "#1a1a1a",
        surface: "#2d2d2d",
        text: "#ffffff",
        textSecondary: "#b0b0b0",
        primary: "#4a9eff",
        secondary: "#6c7b7f",
        accent: "#ff6b35",
        error: "#ff4757",
        success: "#2ed573",
        warning: "#ffa502",
        border: "#404040",
        shadow: "#000000",
    },
};

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
    isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [isDark, setIsDark] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        try {
            const savedTheme = await AsyncStorage.getItem("theme_preference");
            if (savedTheme) {
                setIsDark(JSON.parse(savedTheme));
            }
        } catch (error) {
            console.log("Error loading theme:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleTheme = async () => {
        const newTheme = !isDark;
        setIsDark(newTheme);

        try {
            await AsyncStorage.setItem(
                "theme_preference",
                JSON.stringify(newTheme)
            );
        } catch (error) {
            console.log("Error saving theme:", error);
        }
    };

    const theme = isDark ? darkTheme : lightTheme;

    if (isLoading) {
        return null; // Or a loading component
    }

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, isDark }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = (): ThemeContextType => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
};

// Helper function to create themed styles
export const createThemedStyles = (styleFactory: (theme: Theme) => any) => {
    return (theme: Theme) => styleFactory(theme);
};

// Common themed components
export const ThemedView: React.FC<{
    children: React.ReactNode;
    style?: any;
}> = ({ children, style }) => {
    const { theme } = useTheme();
    const { View } = require("react-native");

    return (
        <View style={[{ backgroundColor: theme.colors.background }, style]}>
            {children}
        </View>
    );
};

export const ThemedText: React.FC<{
    children: React.ReactNode;
    style?: any;
    secondary?: boolean;
}> = ({ children, style, secondary = false }) => {
    const { theme } = useTheme();
    const { Text } = require("react-native");
    const textColor = secondary
        ? theme.colors.textSecondary
        : theme.colors.text;

    return <Text style={[{ color: textColor }, style]}>{children}</Text>;
};
