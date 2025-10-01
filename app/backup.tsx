import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import React, { useEffect, useState } from "react";
import {
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import {
    getBackupSchedule,
    isBackgroundFetchAvailable,
    saveBackupSchedule,
    testBackup,
} from "../utils/AutoBackupScheduler";
import {
    createBackup,
    deleteBackup,
    exportBackup,
    formatBackupDate,
    formatFileSize,
    getAvailableBackups,
    getBackupStats,
    importBackup,
    restoreFromBackup,
} from "../utils/DatabaseBackup";

interface BackupInfo {
    id: string;
    filename: string;
    timestamp: string;
    size: number;
    recordCount: number;
    totalAmount: number;
    isVerified: boolean;
}

interface BackupSchedule {
    enabled: boolean;
    frequency: "daily" | "weekly" | "monthly";
    time: string;
    lastBackup: string | null;
}

export default function BackupScreen() {
    const { theme } = useTheme();
    const [backups, setBackups] = useState<BackupInfo[]>([]);
    const [stats, setStats] = useState({
        totalBackups: 0,
        totalSize: 0,
        oldestBackup: null as string | null,
        newestBackup: null as string | null,
    });
    const [schedule, setSchedule] = useState<BackupSchedule>({
        enabled: false,
        frequency: "weekly",
        time: "02:00",
        lastBackup: null,
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [backgroundFetchAvailable, setBackgroundFetchAvailable] =
        useState(false);

    useEffect(() => {
        loadBackups();
        loadSchedule();
    }, []);

    const loadBackups = async () => {
        try {
            setLoading(true);
            const [backupsData, statsData] = await Promise.all([
                getAvailableBackups(),
                getBackupStats(),
            ]);
            setBackups(backupsData);
            setStats(statsData);
        } catch (error) {
            console.log("Error loading backups:", error);
            Alert.alert("Error", "Failed to load backups");
        } finally {
            setLoading(false);
        }
    };

    const loadSchedule = async () => {
        try {
            const [scheduleData, backgroundFetchAvailable] = await Promise.all([
                getBackupSchedule(),
                isBackgroundFetchAvailable(),
            ]);
            setSchedule(scheduleData);
            setBackgroundFetchAvailable(backgroundFetchAvailable);
        } catch (error) {
            console.log("Error loading schedule:", error);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadBackups();
        await loadSchedule();
        setRefreshing(false);
    };

    const handleToggleSchedule = async () => {
        try {
            const newSchedule = { ...schedule, enabled: !schedule.enabled };
            await saveBackupSchedule(newSchedule);
            setSchedule(newSchedule);

            if (newSchedule.enabled) {
                Alert.alert(
                    "Auto Backup Enabled",
                    `Automatic backups will be created ${newSchedule.frequency} at ${newSchedule.time}`
                );
            } else {
                Alert.alert(
                    "Auto Backup Disabled",
                    "Automatic backups have been disabled"
                );
            }
        } catch (error) {
            console.log("Error toggling schedule:", error);
            Alert.alert("Error", "Failed to update backup schedule");
        }
    };

    const handleChangeFrequency = async () => {
        Alert.alert(
            "Backup Frequency",
            "Select how often to create automatic backups:",
            [
                {
                    text: "Daily",
                    onPress: () => updateSchedule({ frequency: "daily" }),
                },
                {
                    text: "Weekly",
                    onPress: () => updateSchedule({ frequency: "weekly" }),
                },
                {
                    text: "Monthly",
                    onPress: () => updateSchedule({ frequency: "monthly" }),
                },
                { text: "Cancel", style: "cancel" },
            ]
        );
    };

    const handleChangeTime = async () => {
        Alert.prompt(
            "Backup Time",
            "Enter the time for automatic backups (HH:MM):",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Set",
                    onPress: (time) => {
                        if (
                            time &&
                            /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)
                        ) {
                            updateSchedule({ time });
                        } else {
                            Alert.alert(
                                "Error",
                                "Please enter a valid time in HH:MM format"
                            );
                        }
                    },
                },
            ],
            "plain-text",
            schedule.time
        );
    };

    const updateSchedule = async (updates: Partial<BackupSchedule>) => {
        try {
            const newSchedule = { ...schedule, ...updates };
            await saveBackupSchedule(newSchedule);
            setSchedule(newSchedule);
        } catch (error) {
            console.log("Error updating schedule:", error);
            Alert.alert("Error", "Failed to update backup schedule");
        }
    };

    const handleTestBackup = async () => {
        try {
            setLoading(true);
            const success = await testBackup();
            if (success) {
                Alert.alert("Success", "Test backup created successfully!");
                await loadBackups();
            } else {
                Alert.alert("Error", "Test backup failed");
            }
        } catch (error) {
            console.log("Error testing backup:", error);
            Alert.alert("Error", "Failed to create test backup");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateBackup = async () => {
        try {
            setLoading(true);
            const newBackup = await createBackup();
            await loadBackups();
            Alert.alert(
                "Success",
                `Backup created successfully!\nRecords: ${
                    newBackup.recordCount
                }\nSize: ${formatFileSize(newBackup.size)}`
            );
        } catch (error) {
            console.log("Error creating backup:", error);
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "Unknown error occurred";
            Alert.alert(
                "Error",
                `Failed to create backup: ${errorMessage}. Please check your device storage and try again.`
            );
        } finally {
            setLoading(false);
        }
    };

    const handleRestoreBackup = (backup: BackupInfo) => {
        Alert.alert(
            "Restore Backup",
            `Are you sure you want to restore this backup?\n\nRecords: ${
                backup.recordCount
            }\nTotal Amount: $${backup.totalAmount.toFixed(
                2
            )}\nDate: ${formatBackupDate(
                backup.timestamp
            )}\n\nThis will replace all current data!`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Restore",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setLoading(true);
                            await restoreFromBackup(backup.id);
                            Alert.alert(
                                "Success",
                                "Backup restored successfully!"
                            );
                            await loadBackups();
                        } catch (error) {
                            console.log("Error restoring backup:", error);
                            Alert.alert("Error", "Failed to restore backup");
                        } finally {
                            setLoading(false);
                        }
                    },
                },
            ]
        );
    };

    const handleDeleteBackup = (backup: BackupInfo) => {
        Alert.alert(
            "Delete Backup",
            `Are you sure you want to delete this backup?\n\n${formatBackupDate(
                backup.timestamp
            )}\nRecords: ${backup.recordCount}`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteBackup(backup.id);
                            await loadBackups();
                            Alert.alert(
                                "Success",
                                "Backup deleted successfully"
                            );
                        } catch (error) {
                            console.log("Error deleting backup:", error);
                            Alert.alert("Error", "Failed to delete backup");
                        }
                    },
                },
            ]
        );
    };

    const handleExportBackup = async (backup: BackupInfo) => {
        try {
            setLoading(true);
            const exportFile = await exportBackup(backup.id);

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(exportFile, {
                    mimeType: "application/json",
                    dialogTitle: `Export Backup - ${formatBackupDate(
                        backup.timestamp
                    )}`,
                });
            } else {
                Alert.alert("Error", "Sharing is not available on this device");
            }
        } catch (error) {
            console.log("Error exporting backup:", error);
            Alert.alert("Error", "Failed to export backup");
        } finally {
            setLoading(false);
        }
    };

    const handleImportBackup = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: "application/json",
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets && result.assets[0]) {
                const asset = result.assets[0];

                Alert.alert(
                    "Import Backup",
                    `Import backup from: ${asset.name}\n\nThis will add the backup to your backup list.`,
                    [
                        { text: "Cancel", style: "cancel" },
                        {
                            text: "Import",
                            onPress: async () => {
                                try {
                                    setLoading(true);
                                    const importedBackup = await importBackup(
                                        asset.uri
                                    );
                                    await loadBackups();
                                    Alert.alert(
                                        "Success",
                                        `Backup imported successfully!\nRecords: ${
                                            importedBackup.recordCount
                                        }\nSize: ${formatFileSize(
                                            importedBackup.size
                                        )}`
                                    );
                                } catch (error) {
                                    console.log(
                                        "Error importing backup:",
                                        error
                                    );
                                    Alert.alert(
                                        "Error",
                                        "Failed to import backup. File may be corrupted."
                                    );
                                } finally {
                                    setLoading(false);
                                }
                            },
                        },
                    ]
                );
            }
        } catch (error) {
            console.log("Error importing backup:", error);
            Alert.alert("Error", "Failed to import backup");
        }
    };

    const handleClearAllBackups = () => {
        Alert.alert(
            "Clear All Backups",
            `Are you sure you want to delete all ${backups.length} backups?\n\nThis action cannot be undone.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete All",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setLoading(true);
                            for (const backup of backups) {
                                await deleteBackup(backup.id);
                            }
                            await loadBackups();
                            Alert.alert(
                                "Success",
                                "All backups deleted successfully"
                            );
                        } catch (error) {
                            console.log("Error clearing backups:", error);
                            Alert.alert("Error", "Failed to clear all backups");
                        } finally {
                            setLoading(false);
                        }
                    },
                },
            ]
        );
    };

    if (loading && backups.length === 0) {
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
                    Loading backups...
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
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={theme.colors.primary}
                />
            }
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
                    Backup & Restore
                </Text>
                <Text
                    style={[
                        styles.subtitle,
                        { color: theme.colors.textSecondary },
                    ]}
                >
                    Manage your spending data backups
                </Text>
            </View>

            {/* Stats Section */}
            <View
                style={[
                    styles.statsContainer,
                    { backgroundColor: theme.colors.surface },
                ]}
            >
                <Text style={[styles.statsTitle, { color: theme.colors.text }]}>
                    Backup Statistics
                </Text>
                <View style={styles.statsGrid}>
                    <View style={styles.statItem}>
                        <Text
                            style={[
                                styles.statValue,
                                { color: theme.colors.primary },
                            ]}
                        >
                            {stats.totalBackups}
                        </Text>
                        <Text
                            style={[
                                styles.statLabel,
                                { color: theme.colors.textSecondary },
                            ]}
                        >
                            Total Backups
                        </Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text
                            style={[
                                styles.statValue,
                                { color: theme.colors.primary },
                            ]}
                        >
                            {formatFileSize(stats.totalSize)}
                        </Text>
                        <Text
                            style={[
                                styles.statLabel,
                                { color: theme.colors.textSecondary },
                            ]}
                        >
                            Total Size
                        </Text>
                    </View>
                </View>
                {stats.newestBackup && (
                    <Text
                        style={[
                            styles.statSubtext,
                            { color: theme.colors.textSecondary },
                        ]}
                    >
                        Latest: {formatBackupDate(stats.newestBackup)}
                    </Text>
                )}
            </View>

            {/* Automatic Backup Settings */}
            <View
                style={[
                    styles.autoBackupContainer,
                    { backgroundColor: theme.colors.surface },
                ]}
            >
                <Text
                    style={[
                        styles.autoBackupTitle,
                        { color: theme.colors.text },
                    ]}
                >
                    Automatic Backups
                </Text>

                <View
                    style={[
                        styles.scheduleItem,
                        { borderBottomColor: theme.colors.border },
                    ]}
                >
                    <Text
                        style={[
                            styles.scheduleLabel,
                            { color: theme.colors.text },
                        ]}
                    >
                        Enable Auto Backup
                    </Text>
                    <TouchableOpacity
                        style={[
                            styles.toggleButton,
                            {
                                backgroundColor: schedule.enabled
                                    ? theme.colors.success
                                    : theme.colors.border,
                            },
                        ]}
                        onPress={handleToggleSchedule}
                        disabled={!backgroundFetchAvailable}
                    >
                        <Text style={styles.toggleButtonText}>
                            {schedule.enabled ? "ON" : "OFF"}
                        </Text>
                    </TouchableOpacity>
                </View>

                {!backgroundFetchAvailable && (
                    <Text
                        style={[
                            styles.warningText,
                            { color: theme.colors.warning },
                        ]}
                    >
                        Background tasks are not available on this device
                    </Text>
                )}

                {schedule.enabled && (
                    <>
                        <View
                            style={[
                                styles.scheduleItem,
                                { borderBottomColor: theme.colors.border },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.scheduleLabel,
                                    { color: theme.colors.text },
                                ]}
                            >
                                Frequency
                            </Text>
                            <TouchableOpacity
                                style={styles.scheduleButton}
                                onPress={handleChangeFrequency}
                            >
                                <Text
                                    style={[
                                        styles.scheduleButtonText,
                                        { color: theme.colors.primary },
                                    ]}
                                >
                                    {schedule.frequency
                                        .charAt(0)
                                        .toUpperCase() +
                                        schedule.frequency.slice(1)}
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

                        <View
                            style={[
                                styles.scheduleItem,
                                { borderBottomColor: theme.colors.border },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.scheduleLabel,
                                    { color: theme.colors.text },
                                ]}
                            >
                                Time
                            </Text>
                            <TouchableOpacity
                                style={styles.scheduleButton}
                                onPress={handleChangeTime}
                            >
                                <Text
                                    style={[
                                        styles.scheduleButtonText,
                                        { color: theme.colors.primary },
                                    ]}
                                >
                                    {schedule.time}
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

                        {schedule.lastBackup && (
                            <Text
                                style={[
                                    styles.scheduleInfo,
                                    { color: theme.colors.textSecondary },
                                ]}
                            >
                                Last backup:{" "}
                                {formatBackupDate(schedule.lastBackup)}
                            </Text>
                        )}
                    </>
                )}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
                <TouchableOpacity
                    style={[
                        styles.actionButton,
                        { backgroundColor: theme.colors.success },
                    ]}
                    onPress={handleCreateBackup}
                    disabled={loading}
                >
                    <Text style={styles.actionButtonText}>Create Backup</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.actionButton,
                        { backgroundColor: theme.colors.primary },
                    ]}
                    onPress={handleImportBackup}
                    disabled={loading}
                >
                    <Text style={styles.actionButtonText}>Import Backup</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.actionButton,
                        { backgroundColor: theme.colors.warning },
                    ]}
                    onPress={handleTestBackup}
                    disabled={loading}
                >
                    <Text style={styles.actionButtonText}>Test Backup</Text>
                </TouchableOpacity>
            </View>

            {/* Backups List */}
            <View
                style={[
                    styles.backupsContainer,
                    { backgroundColor: theme.colors.surface },
                ]}
            >
                <View
                    style={[
                        styles.backupsHeader,
                        { borderBottomColor: theme.colors.border },
                    ]}
                >
                    <Text
                        style={[
                            styles.backupsTitle,
                            { color: theme.colors.text },
                        ]}
                    >
                        Available Backups
                    </Text>
                    {backups.length > 0 && (
                        <TouchableOpacity
                            style={[
                                styles.clearAllButton,
                                { backgroundColor: theme.colors.error },
                            ]}
                            onPress={handleClearAllBackups}
                        >
                            <Text style={styles.clearAllButtonText}>
                                Clear All
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {backups.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text
                            style={[
                                styles.emptyText,
                                { color: theme.colors.textSecondary },
                            ]}
                        >
                            No backups found
                        </Text>
                        <Text
                            style={[
                                styles.emptySubtext,
                                { color: theme.colors.textSecondary },
                            ]}
                        >
                            Create your first backup to protect your data
                        </Text>
                    </View>
                ) : (
                    backups.map((backup) => (
                        <View
                            key={backup.id}
                            style={[
                                styles.backupItem,
                                { borderBottomColor: theme.colors.border },
                            ]}
                        >
                            <View style={styles.backupInfo}>
                                <View style={styles.backupHeader}>
                                    <Text
                                        style={[
                                            styles.backupDate,
                                            { color: theme.colors.text },
                                        ]}
                                    >
                                        {formatBackupDate(backup.timestamp)}
                                    </Text>
                                    {backup.isVerified ? (
                                        <Text
                                            style={[
                                                styles.verifiedBadge,
                                                { color: theme.colors.success },
                                            ]}
                                        >
                                            ✓ Verified
                                        </Text>
                                    ) : (
                                        <Text
                                            style={[
                                                styles.unverifiedBadge,
                                                { color: theme.colors.warning },
                                            ]}
                                        >
                                            ⚠ Unverified
                                        </Text>
                                    )}
                                </View>
                                <Text
                                    style={[
                                        styles.backupDetails,
                                        { color: theme.colors.textSecondary },
                                    ]}
                                >
                                    {backup.recordCount} records •{" "}
                                    {formatFileSize(backup.size)} • $
                                    {backup.totalAmount.toFixed(2)}
                                </Text>
                            </View>

                            <View style={styles.backupActions}>
                                <TouchableOpacity
                                    style={[
                                        styles.backupActionButton,
                                        {
                                            backgroundColor:
                                                theme.colors.primary,
                                        },
                                    ]}
                                    onPress={() => handleRestoreBackup(backup)}
                                    disabled={loading}
                                >
                                    <Text style={styles.restoreButtonText}>
                                        Restore
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.backupActionButton,
                                        {
                                            backgroundColor:
                                                theme.colors.warning,
                                        },
                                    ]}
                                    onPress={() => handleExportBackup(backup)}
                                    disabled={loading}
                                >
                                    <Text style={styles.exportButtonText}>
                                        Export
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.backupActionButton,
                                        { backgroundColor: theme.colors.error },
                                    ]}
                                    onPress={() => handleDeleteBackup(backup)}
                                    disabled={loading}
                                >
                                    <Text style={styles.deleteButtonText}>
                                        Delete
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}
            </View>

            {/* Info Section */}
            <View
                style={[
                    styles.infoContainer,
                    { backgroundColor: theme.colors.surface },
                ]}
            >
                <Text style={[styles.infoTitle, { color: theme.colors.text }]}>
                    About Backups
                </Text>
                <Text
                    style={[
                        styles.infoText,
                        { color: theme.colors.textSecondary },
                    ]}
                >
                    • Backups contain all your spending records and settings
                </Text>
                <Text
                    style={[
                        styles.infoText,
                        { color: theme.colors.textSecondary },
                    ]}
                >
                    • Backups are stored locally on your device
                </Text>
                <Text
                    style={[
                        styles.infoText,
                        { color: theme.colors.textSecondary },
                    ]}
                >
                    • You can export backups to share or store elsewhere
                </Text>
                <Text
                    style={[
                        styles.infoText,
                        { color: theme.colors.textSecondary },
                    ]}
                >
                    • Only the last 10 backups are kept automatically
                </Text>
            </View>
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
    subtitle: {
        fontSize: 16,
        color: "#7f8c8d",
        textAlign: "center",
        marginTop: 4,
    },
    statsContainer: {
        backgroundColor: "#ffffff",
        margin: 16,
        padding: 16,
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    statsTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#2c3e50",
        marginBottom: 12,
        textAlign: "center",
    },
    statsGrid: {
        flexDirection: "row",
        justifyContent: "space-around",
    },
    statItem: {
        alignItems: "center",
    },
    statValue: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#3498db",
    },
    statLabel: {
        fontSize: 14,
        color: "#7f8c8d",
        marginTop: 4,
    },
    statSubtext: {
        fontSize: 12,
        color: "#95a5a6",
        textAlign: "center",
        marginTop: 12,
        fontStyle: "italic",
    },
    autoBackupContainer: {
        backgroundColor: "#ffffff",
        margin: 16,
        marginTop: 0,
        padding: 16,
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    autoBackupTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#2c3e50",
        marginBottom: 16,
        textAlign: "center",
    },
    scheduleItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#ecf0f1",
    },
    scheduleLabel: {
        fontSize: 16,
        color: "#2c3e50",
        flex: 1,
    },
    toggleButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: "#bdc3c7",
        minWidth: 60,
        alignItems: "center",
    },
    toggleButtonActive: {
        backgroundColor: "#27ae60",
    },
    toggleButtonText: {
        color: "#ffffff",
        fontSize: 14,
        fontWeight: "600",
    },
    toggleButtonTextActive: {
        color: "#ffffff",
    },
    scheduleButton: {
        flexDirection: "row",
        alignItems: "center",
    },
    scheduleButtonText: {
        fontSize: 16,
        color: "#3498db",
        marginRight: 8,
    },
    arrow: {
        fontSize: 18,
        color: "#bdc3c7",
    },
    warningText: {
        fontSize: 14,
        color: "#f39c12",
        textAlign: "center",
        marginTop: 8,
        fontStyle: "italic",
    },
    scheduleInfo: {
        fontSize: 14,
        color: "#7f8c8d",
        textAlign: "center",
        marginTop: 12,
        fontStyle: "italic",
    },
    actionsContainer: {
        flexDirection: "row",
        paddingHorizontal: 16,
        marginBottom: 16,
        gap: 8,
    },
    actionButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: "center",
    },
    createButton: {
        backgroundColor: "#27ae60",
    },
    importButton: {
        backgroundColor: "#3498db",
    },
    testButton: {
        backgroundColor: "#f39c12",
    },
    actionButtonText: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "600",
    },
    backupsContainer: {
        backgroundColor: "#ffffff",
        margin: 16,
        marginTop: 0,
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    backupsHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#ecf0f1",
    },
    backupsTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#2c3e50",
    },
    clearAllButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: "#e74c3c",
        borderRadius: 6,
    },
    clearAllButtonText: {
        color: "#ffffff",
        fontSize: 12,
        fontWeight: "600",
    },
    emptyContainer: {
        padding: 40,
        alignItems: "center",
    },
    emptyText: {
        fontSize: 16,
        color: "#7f8c8d",
        fontWeight: "600",
    },
    emptySubtext: {
        fontSize: 14,
        color: "#95a5a6",
        marginTop: 8,
        textAlign: "center",
    },
    backupItem: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#ecf0f1",
    },
    backupInfo: {
        marginBottom: 12,
    },
    backupHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4,
    },
    backupDate: {
        fontSize: 16,
        fontWeight: "600",
        color: "#2c3e50",
    },
    verifiedBadge: {
        fontSize: 12,
        color: "#27ae60",
        fontWeight: "500",
    },
    unverifiedBadge: {
        fontSize: 12,
        color: "#f39c12",
        fontWeight: "500",
    },
    backupDetails: {
        fontSize: 14,
        color: "#7f8c8d",
    },
    backupActions: {
        flexDirection: "row",
        gap: 8,
    },
    backupActionButton: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
        alignItems: "center",
    },
    restoreButton: {
        backgroundColor: "#3498db",
    },
    exportButton: {
        backgroundColor: "#f39c12",
    },
    deleteButton: {
        backgroundColor: "#e74c3c",
    },
    restoreButtonText: {
        color: "#ffffff",
        fontSize: 14,
        fontWeight: "600",
    },
    exportButtonText: {
        color: "#ffffff",
        fontSize: 14,
        fontWeight: "600",
    },
    deleteButtonText: {
        color: "#ffffff",
        fontSize: 14,
        fontWeight: "600",
    },
    infoContainer: {
        backgroundColor: "#ffffff",
        margin: 16,
        marginTop: 0,
        padding: 16,
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#2c3e50",
        marginBottom: 8,
    },
    infoText: {
        fontSize: 14,
        color: "#7f8c8d",
        marginBottom: 4,
        lineHeight: 20,
    },
});
