import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import RNAndroidNotificationListener from "react-native-android-notification-listener";
import { useTheme } from "../contexts/ThemeContext";

interface Settings {
    currency: string;
    notificationSound: boolean;
    autoBackup: boolean;
    maxAmount: number;
    allowedApps: string[];
}

const DEFAULT_SETTINGS: Settings = {
    currency: "USD",
    notificationSound: true,
    autoBackup: false,
    maxAmount: 10000,
    allowedApps: [
        "com.discoverfinancial.mobile",
        "com.mfoundry.mb.android.mb_731",
        "com.android.chrome",
    ],
};

export default function SettingsScreen() {
    const { theme, toggleTheme, isDark } = useTheme();
    const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [newApp, setNewApp] = useState("");

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const savedSettings = await AsyncStorage.getItem("app_settings");
            if (savedSettings) {
                const parsedSettings = JSON.parse(savedSettings);
                // Remove darkMode from old settings and use theme context instead
                const { darkMode, ...otherSettings } = parsedSettings;
                setSettings({ ...DEFAULT_SETTINGS, ...otherSettings });
            }
        } catch (error) {
            console.log("Error loading settings:", error);
        } finally {
            setLoading(false);
        }
    };

    const saveSettings = async (newSettings: Settings) => {
        try {
            await AsyncStorage.setItem(
                "app_settings",
                JSON.stringify(newSettings)
            );
            setSettings(newSettings);
        } catch (error) {
            console.log("Error saving settings:", error);
            Alert.alert("Error", "Failed to save settings");
        }
    };

    const updateSetting = <K extends keyof Settings>(
        key: K,
        value: Settings[K]
    ) => {
        const newSettings = { ...settings, [key]: value };
        saveSettings(newSettings);
    };

    const addAllowedApp = () => {
        if (!newApp.trim()) {
            Alert.alert("Error", "Please enter a valid app package name");
            return;
        }

        if (settings.allowedApps.includes(newApp.trim())) {
            Alert.alert("Error", "This app is already in the allowed list");
            return;
        }

        const newApps = [...settings.allowedApps, newApp.trim()];
        updateSetting("allowedApps", newApps);
        setNewApp("");
        setModalVisible(false);
    };

    const removeAllowedApp = (appToRemove: string) => {
        Alert.alert(
            "Remove App",
            `Are you sure you want to remove ${appToRemove} from the allowed list?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Remove",
                    style: "destructive",
                    onPress: () => {
                        const newApps = settings.allowedApps.filter(
                            (app) => app !== appToRemove
                        );
                        updateSetting("allowedApps", newApps);
                    },
                },
            ]
        );
    };

    const resetSettings = () => {
        Alert.alert(
            "Reset Settings",
            "Are you sure you want to reset all settings to default?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Reset",
                    style: "destructive",
                    onPress: () => {
                        saveSettings(DEFAULT_SETTINGS);
                    },
                },
            ]
        );
    };

    const clearAllData = () => {
        Alert.alert(
            "Clear All Data",
            "This will delete all spending records. This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear All",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            // Clear database
                            const { openDatabaseSync } = require("expo-sqlite");
                            const db = openDatabaseSync("spending.db");
                            await db.execAsync("DELETE FROM spending");
                            Alert.alert("Success", "All data has been cleared");
                        } catch (error) {
                            Alert.alert("Error", "Failed to clear data");
                        }
                    },
                },
            ]
        );
    };

    const checkNotificationPermission = async () => {
        try {
            const status =
                await RNAndroidNotificationListener.getPermissionStatus();
            Alert.alert(
                "Notification Permission",
                `Current status: ${status}\n\nTo change permissions, go to your device Settings > Apps > Budget App > Permissions`
            );
        } catch (error) {
            Alert.alert("Error", "Failed to check notification permission");
        }
    };

    if (loading) {
        return (
            <View
                style={[
                    styles.loadingContainer,
                    { backgroundColor: theme.colors.background },
                ]}
            >
                <Text
                    style={[
                        styles.loadingText,
                        { color: theme.colors.textSecondary },
                    ]}
                >
                    Loading settings...
                </Text>
            </View>
        );
    }

    return (
        <ScrollView
            style={[
                styles.container,
                { backgroundColor: theme.colors.background },
            ]}
        >
            <View
                style={[
                    styles.header,
                    {
                        backgroundColor: theme.colors.surface,
                        borderBottomColor: theme.colors.border,
                    },
                ]}
            >
                <Text style={[styles.title, { color: theme.colors.text }]}>
                    Settings
                </Text>
            </View>

            {/* Appearance Settings */}
            <View
                style={[
                    styles.section,
                    { backgroundColor: theme.colors.surface },
                ]}
            >
                <Text
                    style={[styles.sectionTitle, { color: theme.colors.text }]}
                >
                    Appearance
                </Text>

                <View
                    style={[
                        styles.settingItem,
                        { borderBottomColor: theme.colors.border },
                    ]}
                >
                    <Text
                        style={[
                            styles.settingLabel,
                            { color: theme.colors.text },
                        ]}
                    >
                        Dark Mode
                    </Text>
                    <Switch
                        value={isDark}
                        onValueChange={toggleTheme}
                        trackColor={{
                            false: theme.colors.border,
                            true: theme.colors.primary,
                        }}
                        thumbColor={isDark ? theme.colors.surface : "#f4f3f4"}
                    />
                </View>

                <View
                    style={[
                        styles.settingItem,
                        { borderBottomColor: theme.colors.border },
                    ]}
                >
                    <Text
                        style={[
                            styles.settingLabel,
                            { color: theme.colors.text },
                        ]}
                    >
                        Currency
                    </Text>
                    <TouchableOpacity
                        style={styles.currencyButton}
                        onPress={() => {
                            Alert.alert("Currency", "Select currency:", [
                                {
                                    text: "USD ($)",
                                    onPress: () =>
                                        updateSetting("currency", "USD"),
                                },
                                {
                                    text: "EUR (€)",
                                    onPress: () =>
                                        updateSetting("currency", "EUR"),
                                },
                                {
                                    text: "GBP (£)",
                                    onPress: () =>
                                        updateSetting("currency", "GBP"),
                                },
                                { text: "Cancel", style: "cancel" },
                            ]);
                        }}
                    >
                        <Text
                            style={[
                                styles.currencyText,
                                { color: theme.colors.primary },
                            ]}
                        >
                            {settings.currency}
                        </Text>
                        <Text
                            style={[
                                styles.arrow,
                                { color: theme.colors.textSecondary },
                            ]}
                        >
                            ›
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Notification Settings */}
            <View
                style={[
                    styles.section,
                    { backgroundColor: theme.colors.surface },
                ]}
            >
                <Text
                    style={[styles.sectionTitle, { color: theme.colors.text }]}
                >
                    Notifications
                </Text>

                <TouchableOpacity
                    style={[
                        styles.settingItem,
                        { borderBottomColor: theme.colors.border },
                    ]}
                    onPress={checkNotificationPermission}
                >
                    <Text
                        style={[
                            styles.settingLabel,
                            { color: theme.colors.text },
                        ]}
                    >
                        Notification Permission
                    </Text>
                    <Text
                        style={[
                            styles.arrow,
                            { color: theme.colors.textSecondary },
                        ]}
                    >
                        ›
                    </Text>
                </TouchableOpacity>

                <View
                    style={[
                        styles.settingItem,
                        { borderBottomColor: theme.colors.border },
                    ]}
                >
                    <Text
                        style={[
                            styles.settingLabel,
                            { color: theme.colors.text },
                        ]}
                    >
                        Notification Sound
                    </Text>
                    <Switch
                        value={settings.notificationSound}
                        onValueChange={(value) =>
                            updateSetting("notificationSound", value)
                        }
                        trackColor={{
                            false: theme.colors.border,
                            true: theme.colors.primary,
                        }}
                        thumbColor={
                            settings.notificationSound
                                ? theme.colors.surface
                                : "#f4f3f4"
                        }
                    />
                </View>
            </View>

            {/* Allowed Apps */}
            <View
                style={[
                    styles.section,
                    { backgroundColor: theme.colors.surface },
                ]}
            >
                <Text
                    style={[styles.sectionTitle, { color: theme.colors.text }]}
                >
                    Allowed Apps
                </Text>
                <Text
                    style={[
                        styles.sectionDescription,
                        { color: theme.colors.textSecondary },
                    ]}
                >
                    Apps that can automatically record spending from
                    notifications
                </Text>

                {settings.allowedApps.map((app, index) => (
                    <View
                        key={index}
                        style={[
                            styles.appItem,
                            { borderBottomColor: theme.colors.border },
                        ]}
                    >
                        <Text
                            style={[
                                styles.appText,
                                { color: theme.colors.text },
                            ]}
                            numberOfLines={1}
                        >
                            {app}
                        </Text>
                        <TouchableOpacity
                            style={styles.removeButton}
                            onPress={() => removeAllowedApp(app)}
                        >
                            <Text style={styles.removeButtonText}>Remove</Text>
                        </TouchableOpacity>
                    </View>
                ))}

                <TouchableOpacity
                    style={[
                        styles.addButton,
                        { backgroundColor: theme.colors.primary },
                    ]}
                    onPress={() => setModalVisible(true)}
                >
                    <Text style={styles.addButtonText}>+ Add App</Text>
                </TouchableOpacity>
            </View>

            {/* Data Settings */}
            <View
                style={[
                    styles.section,
                    { backgroundColor: theme.colors.surface },
                ]}
            >
                <Text
                    style={[styles.sectionTitle, { color: theme.colors.text }]}
                >
                    Data
                </Text>

                <View
                    style={[
                        styles.settingItem,
                        { borderBottomColor: theme.colors.border },
                    ]}
                >
                    <Text
                        style={[
                            styles.settingLabel,
                            { color: theme.colors.text },
                        ]}
                    >
                        Auto Backup
                    </Text>
                    <Switch
                        value={settings.autoBackup}
                        onValueChange={(value) =>
                            updateSetting("autoBackup", value)
                        }
                        trackColor={{
                            false: theme.colors.border,
                            true: theme.colors.primary,
                        }}
                        thumbColor={
                            settings.autoBackup
                                ? theme.colors.surface
                                : "#f4f3f4"
                        }
                    />
                </View>

                <View
                    style={[
                        styles.settingItem,
                        { borderBottomColor: theme.colors.border },
                    ]}
                >
                    <Text
                        style={[
                            styles.settingLabel,
                            { color: theme.colors.text },
                        ]}
                    >
                        Max Amount Alert
                    </Text>
                    <TouchableOpacity
                        style={styles.amountButton}
                        onPress={() => {
                            Alert.prompt(
                                "Max Amount Alert",
                                "Set the maximum amount for spending alerts:",
                                [
                                    { text: "Cancel", style: "cancel" },
                                    {
                                        text: "Set",
                                        onPress: (value) => {
                                            const amount = parseFloat(
                                                value || "0"
                                            );
                                            if (amount > 0) {
                                                updateSetting(
                                                    "maxAmount",
                                                    amount
                                                );
                                            }
                                        },
                                    },
                                ],
                                "plain-text",
                                settings.maxAmount.toString()
                            );
                        }}
                    >
                        <Text
                            style={[
                                styles.amountText,
                                { color: theme.colors.primary },
                            ]}
                        >
                            ${settings.maxAmount}
                        </Text>
                        <Text
                            style={[
                                styles.arrow,
                                { color: theme.colors.textSecondary },
                            ]}
                        >
                            ›
                        </Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={[
                        styles.backupButton,
                        { backgroundColor: theme.colors.primary },
                    ]}
                    onPress={() => router.push("/backup" as any)}
                >
                    <Text style={styles.backupButtonText}>Manage Backups</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.dangerButton}
                    onPress={clearAllData}
                >
                    <Text style={styles.dangerButtonText}>Clear All Data</Text>
                </TouchableOpacity>
            </View>

            {/* Reset Settings */}
            <View
                style={[
                    styles.section,
                    { backgroundColor: theme.colors.surface },
                ]}
            >
                <TouchableOpacity
                    style={styles.resetButton}
                    onPress={resetSettings}
                >
                    <Text style={styles.resetButtonText}>
                        Reset to Defaults
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Add App Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View
                        style={[
                            styles.modalContent,
                            { backgroundColor: theme.colors.surface },
                        ]}
                    >
                        <Text
                            style={[
                                styles.modalTitle,
                                { color: theme.colors.text },
                            ]}
                        >
                            Add Allowed App
                        </Text>
                        <Text
                            style={[
                                styles.modalDescription,
                                { color: theme.colors.textSecondary },
                            ]}
                        >
                            Enter the package name of the app you want to allow
                            (e.g., com.example.app)
                        </Text>

                        <TextInput
                            style={[
                                styles.modalInput,
                                {
                                    borderColor: theme.colors.border,
                                    backgroundColor: theme.colors.background,
                                    color: theme.colors.text,
                                },
                            ]}
                            placeholder="com.example.app"
                            placeholderTextColor={theme.colors.textSecondary}
                            value={newApp}
                            onChangeText={setNewApp}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[
                                    styles.modalButton,
                                    styles.cancelModalButton,
                                ]}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={styles.cancelModalButtonText}>
                                    Cancel
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.modalButton,
                                    styles.addModalButton,
                                ]}
                                onPress={addAllowedApp}
                            >
                                <Text style={styles.addModalButtonText}>
                                    Add
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f8f9fa",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#f8f9fa",
    },
    loadingText: {
        fontSize: 16,
        color: "#7f8c8d",
    },
    header: {
        padding: 20,
        paddingTop: 40,
        backgroundColor: "#ffffff",
        borderBottomWidth: 1,
        borderBottomColor: "#ecf0f1",
    },
    title: {
        fontSize: 28,
        fontWeight: "bold",
        color: "#2c3e50",
        textAlign: "center",
    },
    section: {
        backgroundColor: "#ffffff",
        marginTop: 16,
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#2c3e50",
        marginBottom: 8,
    },
    sectionDescription: {
        fontSize: 14,
        color: "#7f8c8d",
        marginBottom: 16,
        lineHeight: 20,
    },
    settingItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#ecf0f1",
    },
    settingLabel: {
        fontSize: 16,
        color: "#2c3e50",
        flex: 1,
    },
    currencyButton: {
        flexDirection: "row",
        alignItems: "center",
    },
    currencyText: {
        fontSize: 16,
        color: "#3498db",
        marginRight: 8,
    },
    arrow: {
        fontSize: 18,
        color: "#bdc3c7",
    },
    amountButton: {
        flexDirection: "row",
        alignItems: "center",
    },
    amountText: {
        fontSize: 16,
        color: "#3498db",
        marginRight: 8,
    },
    appItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: "#ecf0f1",
    },
    appText: {
        fontSize: 14,
        color: "#2c3e50",
        flex: 1,
        fontFamily: "monospace",
    },
    removeButton: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: "#e74c3c",
        borderRadius: 4,
    },
    removeButtonText: {
        fontSize: 12,
        color: "#ffffff",
        fontWeight: "500",
    },
    addButton: {
        backgroundColor: "#3498db",
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: "center",
        marginTop: 12,
    },
    addButtonText: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "600",
    },
    backupButton: {
        backgroundColor: "#3498db",
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: "center",
        marginTop: 16,
    },
    backupButtonText: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "600",
    },
    dangerButton: {
        backgroundColor: "#e74c3c",
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: "center",
        marginTop: 16,
    },
    dangerButtonText: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "600",
    },
    resetButton: {
        backgroundColor: "#95a5a6",
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: "center",
    },
    resetButtonText: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "600",
    },
    modalOverlay: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    modalContent: {
        backgroundColor: "#ffffff",
        borderRadius: 12,
        padding: 20,
        width: "90%",
        maxWidth: 400,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#2c3e50",
        textAlign: "center",
        marginBottom: 12,
    },
    modalDescription: {
        fontSize: 14,
        color: "#7f8c8d",
        textAlign: "center",
        marginBottom: 20,
        lineHeight: 20,
    },
    modalInput: {
        borderWidth: 1,
        borderColor: "#bdc3c7",
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        backgroundColor: "#f8f9fa",
        marginBottom: 20,
    },
    modalButtons: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    modalButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: "center",
        marginHorizontal: 5,
    },
    cancelModalButton: {
        backgroundColor: "#95a5a6",
    },
    addModalButton: {
        backgroundColor: "#27ae60",
    },
    cancelModalButtonText: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "600",
    },
    addModalButtonText: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "600",
    },
});
