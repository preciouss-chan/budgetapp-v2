import { Link, router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    Alert,
    AppRegistry,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import RNAndroidNotificationListener, {
    RNAndroidNotificationListenerHeadlessJsName,
} from "react-native-android-notification-listener";
import { useTheme } from "../contexts/ThemeContext";
import { performanceMonitor } from "../utils/PerformanceMonitor";

// Import shared database manager
import { Database } from "../utils/DatabaseManager";

const ALLOWED_APPS = [
    "com.discoverfinancial.mobile",
    "com.mfoundry.mb.android.mb_731",
    "com.android.chrome",
];
// Move permission status check and request into the component

// RNAndroidNotificationListener.requestPermission(); // Optionally move this into useEffect as well

const headlessNotificationListener = async ({
    notification,
}: {
    notification: any;
}) => {
    try {
        if (notification) {
            let notificationObj;
            try {
                notificationObj =
                    typeof notification === "string"
                        ? JSON.parse(notification)
                        : notification;
            } catch (e) {
                console.log("Failed to parse notification:", notification);
                return;
            }

            console.log(
                "Notification text:",
                notificationObj.text,
                notificationObj.app
            );

            // Test parseNotification
            const parsedAmount = parseNotification(notificationObj.text);
            if (
                parsedAmount !== null &&
                ALLOWED_APPS.includes(notificationObj.app)
            ) {
                console.log("Parsed amount from notification:", parsedAmount);

                // Extract description based on app
                // For Discover notifications, extract only the capitalized merchant name
                // For other apps, use the full notification text
                let description = notificationObj.text;
                if (notificationObj.app === "com.discoverfinancial.mobile") {
                    description = extractDiscoverMerchant(notificationObj.text);
                    console.log("Extracted Discover merchant:", description);
                }

                try {
                    await Database.addSpending(
                        parsedAmount,
                        description,
                        new Date().toISOString()
                    );
                } catch (dbError) {
                    console.log(
                        "Error saving notification to database:",
                        dbError
                    );
                }
            }
        }
    } catch (error) {
        console.log("Error in headless notification listener:", error);
    }
};

AppRegistry.registerHeadlessTask(
    RNAndroidNotificationListenerHeadlessJsName,
    () => headlessNotificationListener
);

// Data validation utilities
const DataValidator = {
    validateAmount: (
        amount: string
    ): { isValid: boolean; value?: number; error?: string } => {
        if (!amount || amount.trim() === "") {
            return { isValid: false, error: "Amount is required" };
        }

        const numAmount = parseFloat(amount);
        if (isNaN(numAmount)) {
            return { isValid: false, error: "Amount must be a valid number" };
        }

        if (numAmount <= 0) {
            return { isValid: false, error: "Amount must be greater than 0" };
        }

        if (numAmount > 999999.99) {
            return { isValid: false, error: "Amount seems unrealistic" };
        }

        // Check for reasonable decimal places
        const decimalPlaces = (amount.split(".")[1] || "").length;
        if (decimalPlaces > 2) {
            return {
                isValid: false,
                error: "Amount cannot have more than 2 decimal places",
            };
        }

        return { isValid: true, value: numAmount };
    },

    validateDetails: (
        details: string
    ): { isValid: boolean; value?: string; error?: string } => {
        if (!details || details.trim() === "") {
            return { isValid: false, error: "Details are required" };
        }

        const sanitized = details.trim();
        if (sanitized.length > 200) {
            return {
                isValid: false,
                error: "Details cannot exceed 200 characters",
            };
        }

        // Basic XSS protection
        const dangerousChars = /<script|javascript:|on\w+\s*=/i;
        if (dangerousChars.test(sanitized)) {
            return { isValid: false, error: "Invalid characters in details" };
        }

        return { isValid: true, value: sanitized };
    },

    validateDate: (
        dateString: string
    ): { isValid: boolean; value?: string; error?: string } => {
        if (!dateString || dateString.trim() === "") {
            return { isValid: false, error: "Date is required" };
        }

        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return { isValid: false, error: "Invalid date format" };
        }

        const now = new Date();
        const oneYearAgo = new Date(
            now.getFullYear() - 1,
            now.getMonth(),
            now.getDate()
        );
        const oneMonthFromNow = new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            now.getDate()
        );

        if (date < oneYearAgo || date > oneMonthFromNow) {
            return {
                isValid: false,
                error: "Date must be within the last year and not more than a month in the future",
            };
        }

        return { isValid: true, value: dateString };
    },
};

const parseNotification = (text: string): number | null => {
    const regex = /(\d+(\.\d{1,2})?)/;
    const match = text.match(regex);
    if (match) {
        return parseFloat(match[0]);
    }
    return null;
};

const extractDiscoverMerchant = (text: string): string => {
    // Look for capitalized merchant names in Discover notifications
    // Pattern: "A transaction of $X.XX has been initiated at MERCHANT NAME on date"
    // We want to extract the capitalized part (MERCHANT NAME)

    console.log("Extracting merchant from Discover notification:", text);

    // First, try to find the pattern with "at" followed by capitalized text
    const atPattern = /at\s+([A-Z][A-Z\s]+[A-Z])\s+on/i;
    const atMatch = text.match(atPattern);
    if (atMatch && atMatch[1]) {
        const merchant = atMatch[1].trim();
        console.log("Found merchant with 'at' pattern:", merchant);
        return merchant;
    }

    // Fallback: look for any sequence of 2+ consecutive capitalized words
    const capitalizedPattern = /\b([A-Z][A-Z\s]{2,}[A-Z])\b/;
    const capitalizedMatch = text.match(capitalizedPattern);
    if (capitalizedMatch && capitalizedMatch[1]) {
        const merchant = capitalizedMatch[1].trim();
        console.log("Found merchant with capitalized pattern:", merchant);
        return merchant;
    }

    // If no capitalized merchant found, return the original text
    console.log(
        "No capitalized merchant found in Discover notification, using original text"
    );
    return text;
};

export default function MonthlySpendingScreen() {
    const { theme } = useTheme();
    const [spendingData, setSpendingData] = useState<any[]>([]);
    const [filteredData, setFilteredData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<"date" | "amount" | "details">("date");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [newSpending, setNewSpending] = useState({
        amount: "",
        details: "",
        date: new Date().toISOString().split("T")[0],
    });
    const [permissionStatus, setPermissionStatus] = useState<string | null>(
        null
    );

    useEffect(() => {
        const initializeApp = async () => {
            try {
                // Start performance monitoring
                performanceMonitor.startMemoryMonitoring();
                performanceMonitor.startTiming("app_initialization");

                // Add timeout to prevent infinite hanging
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(
                        () => reject(new Error("Initialization timeout")),
                        10000
                    ); // 10 second timeout
                });

                const initPromise = (async () => {
                    await initializeDatabase();

                    // Check notification permission status and request if needed (non-blocking)
                    const checkPermission = async () => {
                        try {
                            performanceMonitor.startTiming("permission_check");
                            const status =
                                await RNAndroidNotificationListener.getPermissionStatus();
                            setPermissionStatus(status);
                            console.log(
                                "Notification permission status:",
                                status
                            );

                            if (status !== "authorized") {
                                RNAndroidNotificationListener.requestPermission();
                            }
                            performanceMonitor.endTiming("permission_check");
                        } catch (error) {
                            console.log(
                                "Error checking notification permissions:",
                                error
                            );
                            setPermissionStatus("error");
                            // Don't throw error - this is not critical for app functionality
                        }
                    };

                    // Run permission check but don't wait for it to complete
                    checkPermission().catch((error) => {
                        console.log("Permission check failed:", error);
                        setPermissionStatus("error");
                    });
                })();

                await Promise.race([initPromise, timeoutPromise]);
                performanceMonitor.endTiming("app_initialization");

                // Log performance report in development
                if (__DEV__) {
                    console.log(performanceMonitor.generateReport());
                }
            } catch (error) {
                console.log("Error initializing app:", error);
                performanceMonitor.endTiming("app_initialization");
                // Ensure loading state is set to false even if initialization fails
                setLoading(false);

                // Set empty data to allow app to function
                setSpendingData([]);
                setFilteredData([]);

                if (
                    error instanceof Error &&
                    error.message === "Initialization timeout"
                ) {
                    Alert.alert(
                        "Initialization Timeout",
                        "App is taking too long to load. Please check your device storage and restart the app."
                    );
                } else {
                    console.log("Initialization error details:", error);
                    // Show a more helpful error message
                    const errorMessage =
                        error instanceof Error
                            ? error.message
                            : "Unknown error";
                    Alert.alert(
                        "Initialization Warning",
                        `Some features may not work properly. Error: ${errorMessage}. You can still use the app to add transactions.`
                    );
                }
            }
        };

        initializeApp();

        // Cleanup performance monitoring on unmount
        return () => {
            performanceMonitor.stopMemoryMonitoring();
        };
    }, []);

    const initializeDatabase = async () => {
        try {
            console.log("Starting database initialization...");
            await Database.init();
            console.log(
                "Database initialization completed, loading spending data..."
            );
            await loadSpendingData();
            console.log("Database initialization fully completed");
        } catch (error) {
            console.log("Error initializing database:", error);
            // Set empty data instead of throwing error
            setSpendingData([]);
            setFilteredData([]);
            setLoading(false);

            // Only throw error if it's a critical database issue
            if (error instanceof Error && error.message.includes("database")) {
                throw error;
            } else {
                console.log(
                    "Non-critical database error, continuing with empty data"
                );
            }
        }
    };

    const loadSpendingData = async () => {
        try {
            setLoading(true);
            const data = await performanceMonitor.monitorDatabaseOperation(
                () => Database.getAllSpending(),
                "get_all_spending"
            );
            setSpendingData(data as any[]);
            applyFiltersAndSort(data as any[]);
        } catch (error) {
            console.log("Error loading spending data:", error);
            setSpendingData([]); // Set empty array as fallback
            setFilteredData([]);
        } finally {
            setLoading(false);
        }
    };

    const applyFiltersAndSort = (data: any[] = spendingData) => {
        let filtered = [...data];

        // Apply search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                (item) =>
                    item.details.toLowerCase().includes(query) ||
                    item.amount.toString().includes(query) ||
                    formatDate(item.date).toLowerCase().includes(query)
            );
        }

        // Apply sorting
        filtered.sort((a, b) => {
            let aValue, bValue;

            switch (sortBy) {
                case "amount":
                    aValue = a.amount;
                    bValue = b.amount;
                    break;
                case "details":
                    aValue = a.details.toLowerCase();
                    bValue = b.details.toLowerCase();
                    break;
                case "date":
                default:
                    aValue = new Date(a.date).getTime();
                    bValue = new Date(b.date).getTime();
                    break;
            }

            if (sortOrder === "asc") {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });

        setFilteredData(filtered);
    };

    // Update filtered data when search or sort changes
    useEffect(() => {
        applyFiltersAndSort();
    }, [searchQuery, sortBy, sortOrder, spendingData]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadSpendingData();
        setRefreshing(false);
    };

    const addNewSpending = async () => {
        // Validate all fields
        const amountValidation = DataValidator.validateAmount(
            newSpending.amount
        );
        const detailsValidation = DataValidator.validateDetails(
            newSpending.details
        );
        const dateValidation = DataValidator.validateDate(newSpending.date);

        // Check for validation errors
        const validationErrors = [
            amountValidation.error,
            detailsValidation.error,
            dateValidation.error,
        ].filter(Boolean);

        if (validationErrors.length > 0) {
            Alert.alert("Validation Error", validationErrors.join("\n"));
            return;
        }

        try {
            console.log("Attempting to add spending:", {
                amount: amountValidation.value,
                details: detailsValidation.value,
                date: dateValidation.value,
            });

            await Database.addSpending(
                amountValidation.value!,
                detailsValidation.value!,
                dateValidation.value!
            );

            console.log("Successfully added spending");

            setModalVisible(false);
            setNewSpending({
                amount: "",
                details: "",
                date: new Date().toISOString().split("T")[0],
            });

            await loadSpendingData(); // Refresh the data
        } catch (error) {
            console.log("Error adding spending:", error);
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "Unknown error occurred";
            Alert.alert(
                "Error",
                `Failed to add spending: ${errorMessage}. Please try again.`
            );
        }
    };

    const editSpending = (item: any) => {
        setEditingItem(item);
        setNewSpending({
            amount: item.amount.toString(),
            details: item.details,
            date: item.date.split("T")[0],
        });
        setEditModalVisible(true);
    };

    const updateSpending = async () => {
        if (!editingItem) return;

        // Validate all fields
        const amountValidation = DataValidator.validateAmount(
            newSpending.amount
        );
        const detailsValidation = DataValidator.validateDetails(
            newSpending.details
        );
        const dateValidation = DataValidator.validateDate(newSpending.date);

        const validationErrors = [
            amountValidation.error,
            detailsValidation.error,
            dateValidation.error,
        ].filter(Boolean);

        if (validationErrors.length > 0) {
            Alert.alert("Validation Error", validationErrors.join("\n"));
            return;
        }

        try {
            await Database.updateSpending(
                editingItem.id,
                amountValidation.value!,
                detailsValidation.value!,
                dateValidation.value!
            );

            setEditModalVisible(false);
            setEditingItem(null);
            setNewSpending({
                amount: "",
                details: "",
                date: new Date().toISOString().split("T")[0],
            });

            await loadSpendingData();
        } catch (error) {
            Alert.alert("Error", "Failed to update spending");
        }
    };

    const deleteSpending = async (id: number) => {
        Alert.alert(
            "Delete Spending",
            "Are you sure you want to delete this spending record?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await Database.deleteSpending(id);
                            await loadSpendingData();
                        } catch (error) {
                            Alert.alert("Error", "Failed to delete spending");
                        }
                    },
                },
            ]
        );
    };

    const formatDate = (dateString: string | number | Date) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    const formatAmount = (amount: number) => {
        return `$${amount.toFixed(2)}`;
    };

    const calculateTotal = () => {
        return filteredData.reduce((sum, item) => sum + item.amount, 0);
    };

    const calculateOriginalTotal = () => {
        return spendingData.reduce((sum, item) => sum + item.amount, 0);
    };

    if (loading) {
        return (
            <View
                style={[
                    styles.container,
                    {
                        justifyContent: "center",
                        alignItems: "center",
                        backgroundColor: theme.colors.background,
                    },
                ]}
            >
                <Text style={{ color: theme.colors.text }}>Loading...</Text>
            </View>
        );
    }

    return (
        <View
            style={[
                styles.container,
                { backgroundColor: theme.colors.background },
            ]}
        >
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerContent}>
                    <View>
                        <Text
                            style={[
                                styles.headerTitle,
                                { color: theme.colors.text },
                            ]}
                        >
                            Monthly Spending
                        </Text>
                        <Text
                            style={[
                                styles.headerSubtitle,
                                { color: theme.colors.textSecondary },
                            ]}
                        >
                            {new Date().toLocaleDateString("en-US", {
                                month: "long",
                                year: "numeric",
                            })}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={[
                            styles.settingsButton,
                            { backgroundColor: theme.colors.surface },
                        ]}
                        onPress={() => router.push("/settings" as any)}
                    >
                        <Text style={styles.settingsButtonText}>⚙️</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Search and Filter Controls */}
            <View style={styles.controlsContainer}>
                <TextInput
                    style={[
                        styles.searchInput,
                        {
                            backgroundColor: theme.colors.surface,
                            borderColor: theme.colors.border,
                            color: theme.colors.text,
                        },
                    ]}
                    placeholder="Search spending..."
                    placeholderTextColor={theme.colors.textSecondary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />

                <View style={styles.sortControls}>
                    <TouchableOpacity
                        style={[
                            styles.sortButton,
                            { backgroundColor: theme.colors.surface },
                            sortBy === "date" && {
                                backgroundColor: theme.colors.primary,
                            },
                        ]}
                        onPress={() => setSortBy("date")}
                    >
                        <Text
                            style={[
                                styles.sortButtonText,
                                { color: theme.colors.text },
                                sortBy === "date" && { color: "#ffffff" },
                            ]}
                        >
                            Date
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.sortButton,
                            { backgroundColor: theme.colors.surface },
                            sortBy === "amount" && {
                                backgroundColor: theme.colors.primary,
                            },
                        ]}
                        onPress={() => setSortBy("amount")}
                    >
                        <Text
                            style={[
                                styles.sortButtonText,
                                { color: theme.colors.text },
                                sortBy === "amount" && { color: "#ffffff" },
                            ]}
                        >
                            Amount
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.sortOrderButton,
                            { backgroundColor: theme.colors.secondary },
                        ]}
                        onPress={() =>
                            setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                        }
                    >
                        <Text style={styles.sortOrderButtonText}>
                            {sortOrder === "asc" ? "↑" : "↓"}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Add Spending Button */}
            <TouchableOpacity
                style={[
                    styles.addButton,
                    { backgroundColor: theme.colors.primary },
                ]}
                onPress={() => setModalVisible(true)}
            >
                <Text style={styles.addButtonText}>+ Add Spending</Text>
            </TouchableOpacity>

            {/* Table Container */}
            <ScrollView
                style={[
                    styles.tableContainer,
                    { backgroundColor: theme.colors.surface },
                ]}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={theme.colors.primary}
                    />
                }
            >
                {/* Table Header */}
                <View
                    style={[
                        styles.tableHeader,
                        { backgroundColor: theme.colors.primary },
                    ]}
                >
                    <Text style={[styles.headerCell, styles.amountColumn]}>
                        Amount
                    </Text>
                    <Text style={[styles.headerCell, styles.detailsColumn]}>
                        Details
                    </Text>
                    <Text style={[styles.headerCell, styles.dateColumn]}>
                        Date
                    </Text>
                </View>

                {/* Table Rows */}
                {filteredData.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text
                            style={[
                                styles.emptyText,
                                { color: theme.colors.textSecondary },
                            ]}
                        >
                            {spendingData.length === 0
                                ? "No spending records found"
                                : "No results found for your search"}
                        </Text>
                        <Text
                            style={[
                                styles.emptySubtext,
                                { color: theme.colors.textSecondary },
                            ]}
                        >
                            {spendingData.length === 0
                                ? 'Tap "Add Spending" to get started'
                                : "Try adjusting your search or filters"}
                        </Text>
                    </View>
                ) : (
                    filteredData.map((item, index) => (
                        <View
                            key={item.id}
                            style={[
                                styles.tableRow,
                                { borderBottomColor: theme.colors.border },
                                index % 2 === 0
                                    ? { backgroundColor: theme.colors.surface }
                                    : {
                                          backgroundColor:
                                              theme.colors.background,
                                      },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.cell,
                                    styles.amountColumn,
                                    { color: theme.colors.error },
                                    styles.amountText,
                                ]}
                            >
                                {formatAmount(item.amount)}
                            </Text>
                            <Text
                                style={[
                                    styles.cell,
                                    styles.detailsColumn,
                                    { color: theme.colors.text },
                                ]}
                                numberOfLines={2}
                            >
                                {item.details}
                            </Text>
                            <Text
                                style={[
                                    styles.cell,
                                    styles.dateColumn,
                                    { color: theme.colors.text },
                                ]}
                            >
                                {formatDate(item.date)}
                            </Text>
                            <View style={styles.actionColumn}>
                                <TouchableOpacity
                                    style={[
                                        styles.editButton,
                                        {
                                            backgroundColor:
                                                theme.colors.warning,
                                        },
                                    ]}
                                    onPress={() => editSpending(item)}
                                >
                                    <Text style={styles.editButtonText}>
                                        ✏️
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.deleteButton,
                                        { backgroundColor: theme.colors.error },
                                    ]}
                                    onPress={() => deleteSpending(item.id)}
                                >
                                    <Text style={styles.deleteButtonText}>
                                        🗑️
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>

            {/* Summary Section */}
            <View style={styles.summarySection}>
                <Text style={[styles.totalText, { color: theme.colors.text }]}>
                    {searchQuery.trim() ? "Filtered Total" : "Total Spent"}:{" "}
                    {formatAmount(calculateTotal())}
                </Text>
                {searchQuery.trim() && (
                    <Text
                        style={[
                            styles.originalTotalText,
                            { color: theme.colors.textSecondary },
                        ]}
                    >
                        Total Spent: {formatAmount(calculateOriginalTotal())}
                    </Text>
                )}

                <Link href="/summary" style={styles.linkContainer}>
                    <View
                        style={[
                            styles.summaryButton,
                            { backgroundColor: theme.colors.success },
                        ]}
                    >
                        <Text style={styles.buttonText}>
                            View Spending Summary
                        </Text>
                    </View>
                </Link>
            </View>

            {/* Add Spending Modal */}
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
                            Add New Spending
                        </Text>

                        <TextInput
                            style={[
                                styles.input,
                                {
                                    borderColor: theme.colors.border,
                                    backgroundColor: theme.colors.background,
                                    color: theme.colors.text,
                                },
                            ]}
                            placeholder="Amount (e.g., 25.99)"
                            placeholderTextColor={theme.colors.textSecondary}
                            value={newSpending.amount}
                            onChangeText={(text) =>
                                setNewSpending({ ...newSpending, amount: text })
                            }
                            keyboardType="numeric"
                        />

                        <TextInput
                            style={[
                                styles.input,
                                {
                                    borderColor: theme.colors.border,
                                    backgroundColor: theme.colors.background,
                                    color: theme.colors.text,
                                },
                            ]}
                            placeholder="Details (e.g., Coffee at Starbucks)"
                            placeholderTextColor={theme.colors.textSecondary}
                            value={newSpending.details}
                            onChangeText={(text) =>
                                setNewSpending({
                                    ...newSpending,
                                    details: text,
                                })
                            }
                            multiline
                        />

                        <TextInput
                            style={[
                                styles.input,
                                {
                                    borderColor: theme.colors.border,
                                    backgroundColor: theme.colors.background,
                                    color: theme.colors.text,
                                },
                            ]}
                            placeholder="Date (YYYY-MM-DD)"
                            placeholderTextColor={theme.colors.textSecondary}
                            value={newSpending.date}
                            onChangeText={(text) =>
                                setNewSpending({ ...newSpending, date: text })
                            }
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[
                                    styles.modalButton,
                                    styles.cancelButton,
                                ]}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={styles.cancelButtonText}>
                                    Cancel
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalButton, styles.saveButton]}
                                onPress={addNewSpending}
                            >
                                <Text style={styles.saveButtonText}>
                                    Add Spending
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Edit Spending Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={editModalVisible}
                onRequestClose={() => setEditModalVisible(false)}
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
                            Edit Spending
                        </Text>

                        <TextInput
                            style={[
                                styles.input,
                                {
                                    borderColor: theme.colors.border,
                                    backgroundColor: theme.colors.background,
                                    color: theme.colors.text,
                                },
                            ]}
                            placeholder="Amount (e.g., 25.99)"
                            placeholderTextColor={theme.colors.textSecondary}
                            value={newSpending.amount}
                            onChangeText={(text) =>
                                setNewSpending({ ...newSpending, amount: text })
                            }
                            keyboardType="numeric"
                        />

                        <TextInput
                            style={[
                                styles.input,
                                {
                                    borderColor: theme.colors.border,
                                    backgroundColor: theme.colors.background,
                                    color: theme.colors.text,
                                },
                            ]}
                            placeholder="Details (e.g., Coffee at Starbucks)"
                            placeholderTextColor={theme.colors.textSecondary}
                            value={newSpending.details}
                            onChangeText={(text) =>
                                setNewSpending({
                                    ...newSpending,
                                    details: text,
                                })
                            }
                            multiline
                        />

                        <TextInput
                            style={[
                                styles.input,
                                {
                                    borderColor: theme.colors.border,
                                    backgroundColor: theme.colors.background,
                                    color: theme.colors.text,
                                },
                            ]}
                            placeholder="Date (YYYY-MM-DD)"
                            placeholderTextColor={theme.colors.textSecondary}
                            value={newSpending.date}
                            onChangeText={(text) =>
                                setNewSpending({ ...newSpending, date: text })
                            }
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[
                                    styles.modalButton,
                                    styles.cancelButton,
                                ]}
                                onPress={() => setEditModalVisible(false)}
                            >
                                <Text style={styles.cancelButtonText}>
                                    Cancel
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalButton, styles.saveButton]}
                                onPress={updateSpending}
                            >
                                <Text style={styles.saveButtonText}>
                                    Update Spending
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f8f9fa",
        padding: 16,
    },
    header: {
        marginBottom: 20,
        paddingVertical: 10,
    },
    headerContent: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: "bold",
        color: "#2c3e50",
        textAlign: "left",
    },
    headerSubtitle: {
        fontSize: 16,
        color: "#7f8c8d",
        textAlign: "left",
        marginTop: 4,
    },
    settingsButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: "#ecf0f1",
    },
    settingsButtonText: {
        fontSize: 20,
    },
    addButton: {
        backgroundColor: "#3498db",
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignItems: "center",
        marginBottom: 16,
    },
    addButtonText: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "600",
    },
    tableContainer: {
        flex: 1,
        backgroundColor: "#ffffff",
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    tableHeader: {
        flexDirection: "row",
        backgroundColor: "#3498db",
        paddingVertical: 15,
        paddingHorizontal: 12,
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
    },
    headerCell: {
        color: "#ffffff",
        fontWeight: "bold",
        fontSize: 14,
        textAlign: "center",
    },
    tableRow: {
        flexDirection: "row",
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#ecf0f1",
    },
    evenRow: {
        backgroundColor: "#ffffff",
    },
    oddRow: {
        backgroundColor: "#f8f9fa",
    },
    cell: {
        fontSize: 13,
        color: "#2c3e50",
        textAlign: "left",
    },
    amountText: {
        fontWeight: "600",
        color: "#e74c3c",
    },
    emptyContainer: {
        padding: 40,
        alignItems: "center",
    },
    emptyText: {
        fontSize: 18,
        color: "#7f8c8d",
        fontWeight: "600",
    },
    emptySubtext: {
        fontSize: 14,
        color: "#95a5a6",
        marginTop: 8,
    },
    summarySection: {
        marginTop: 16,
        paddingTop: 16,
        alignItems: "center",
    },
    totalText: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#2c3e50",
        marginBottom: 16,
    },
    linkContainer: {
        width: "100%",
    },
    summaryButton: {
        backgroundColor: "#27ae60",
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 8,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.15,
        shadowRadius: 3,
        elevation: 3,
    },
    buttonText: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "600",
    },
    // Modal styles
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
        marginBottom: 20,
    },
    input: {
        borderWidth: 1,
        borderColor: "#bdc3c7",
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        fontSize: 16,
        backgroundColor: "#f8f9fa",
    },
    modalButtons: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 10,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: "center",
        marginHorizontal: 5,
    },
    cancelButton: {
        backgroundColor: "#95a5a6",
    },
    saveButton: {
        backgroundColor: "#27ae60",
    },
    cancelButtonText: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "600",
    },
    saveButtonText: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "600",
    },
    // New styles for search and filter controls
    controlsContainer: {
        marginBottom: 16,
    },
    searchInput: {
        borderWidth: 1,
        borderColor: "#bdc3c7",
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        backgroundColor: "#ffffff",
        marginBottom: 12,
    },
    sortControls: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    sortButton: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
        backgroundColor: "#ecf0f1",
        marginHorizontal: 4,
        alignItems: "center",
    },
    sortButtonActive: {
        backgroundColor: "#3498db",
    },
    sortButtonText: {
        fontSize: 14,
        color: "#2c3e50",
        fontWeight: "500",
    },
    sortButtonTextActive: {
        color: "#ffffff",
    },
    sortOrderButton: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
        backgroundColor: "#95a5a6",
        marginLeft: 8,
        alignItems: "center",
    },
    sortOrderButtonText: {
        fontSize: 16,
        color: "#ffffff",
        fontWeight: "bold",
    },
    // Action column styles
    actionColumn: {
        flex: 0.8,
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
        paddingHorizontal: 4,
    },
    editButton: {
        padding: 6,
        borderRadius: 4,
        backgroundColor: "#f39c12",
    },
    editButtonText: {
        fontSize: 16,
    },
    deleteButton: {
        padding: 6,
        borderRadius: 4,
        backgroundColor: "#e74c3c",
    },
    deleteButtonText: {
        fontSize: 16,
    },
    // Updated column styles to accommodate actions
    amountColumn: {
        flex: 1,
        textAlign: "right",
        paddingRight: 8,
    },
    detailsColumn: {
        flex: 2.5,
        paddingHorizontal: 8,
    },
    dateColumn: {
        flex: 1.2,
        textAlign: "center",
    },
    // Original total text style
    originalTotalText: {
        fontSize: 14,
        color: "#7f8c8d",
        marginBottom: 8,
        textAlign: "center",
    },
});
