import { Stack } from "expo-router";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { ThemeProvider, useTheme } from "../contexts/ThemeContext";

function ThemedStack() {
    const { theme } = useTheme();

    return (
        <Stack
            screenOptions={{
                headerStyle: {
                    backgroundColor: theme.colors.primary,
                },
                headerTintColor: "#fff",
                headerTitleStyle: {
                    fontWeight: "bold",
                },
            }}
        >
            <Stack.Screen name="index" />
            <Stack.Screen name="summary" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="backup" />
        </Stack>
    );
}

export default function RootLayout() {
    return (
        <ThemeProvider>
            <ErrorBoundary>
                <ThemedStack />
            </ErrorBoundary>
        </ThemeProvider>
    );
}
