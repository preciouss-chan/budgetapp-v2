import { Link } from "expo-router";
import * as SQLite from "expo-sqlite";
import React, { useEffect, useState } from "react";
import {
    Alert,
    AppRegistry,
    Modal,
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

// For Expo SDK 49+, use SQLite.openDatabaseSync
// For older versions, use SQLite.openDatabase
const db = SQLite.openDatabaseSync("spending.db");
console.log("Hello world! THIS MESSAGE IS BEING PRINTED!");
// Move permission status check and request into the component

// RNAndroidNotificationListener.requestPermission(); // Optionally move this into useEffect as well

const headlessNotificationListener = async ({
    notification,
}: {
    notification: any;
}) => {
    if (notification) {
        // Here you can process the notification data
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
        console.log("Notification text:", notificationObj.text);

        // Example: parse the text and save to your database
        // await Database.addSpending(amount, details, new Date().toISOString());
    }
};

AppRegistry.registerHeadlessTask(
    RNAndroidNotificationListenerHeadlessJsName,
    () => headlessNotificationListener
);

const Database = {
    init: async () => {
        try {
            await db.execAsync(`
                CREATE TABLE IF NOT EXISTS spending (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    amount REAL,
                    details TEXT,
                    date TEXT
                );
            `);
            console.log("Database initialized successfully");
        } catch (error) {
            console.log("Error initializing database:", error);
        }
    },

    getAllSpending: async () => {
        try {
            const result = await db.getAllAsync(
                "SELECT * FROM spending ORDER BY date DESC"
            );
            return result;
        } catch (error) {
            console.log("Error fetching spending:", error);
            return [];
        }
    },

    addSpending: async (amount: number, details: string, date: string) => {
        try {
            const result = await db.runAsync(
                "INSERT INTO spending (amount, details, date) VALUES (?, ?, ?)",
                [amount, details, date]
            );
            return result;
        } catch (error) {
            console.log("Error adding spending:", error);
            throw error;
        }
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

export default function MonthlySpendingScreen() {
    const [spendingData, setSpendingData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [newSpending, setNewSpending] = useState({
        amount: "",
        details: "",
        date: new Date().toISOString().split("T")[0],
    });
    const [permissionStatus, setPermissionStatus] = useState<string | null>(
        null
    );

    useEffect(() => {
        initializeDatabase();
        // Check notification permission status and request if needed
        const checkPermission = async () => {
            const status =
                await RNAndroidNotificationListener.getPermissionStatus();
            setPermissionStatus(status);
            console.log("Notification permission status:", status);
            // Optionally request permission here

            if (status !== "authorized") {
                RNAndroidNotificationListener.requestPermission();
            }
        };
        checkPermission();
    }, []);

    const initializeDatabase = async () => {
        await Database.init();
        await loadSpendingData();
    };

    const loadSpendingData = async () => {
        setLoading(true);
        const data = await Database.getAllSpending();
        setSpendingData(data);
        setLoading(false);
    };

    const addNewSpending = async () => {
        if (!newSpending.amount || !newSpending.details) {
            Alert.alert("Error", "Please fill in all fields");
            return;
        }

        try {
            await Database.addSpending(
                parseFloat(newSpending.amount),
                newSpending.details,
                newSpending.date
            );

            setModalVisible(false);
            setNewSpending({
                amount: "",
                details: "",
                date: new Date().toISOString().split("T")[0],
            });

            await loadSpendingData(); // Refresh the data
        } catch (error) {
            Alert.alert("Error", "Failed to add spending");
        }
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
        return spendingData.reduce((sum, item) => sum + item.amount, 0);
    };

    if (loading) {
        return (
            <View
                style={[
                    styles.container,
                    { justifyContent: "center", alignItems: "center" },
                ]}
            >
                <Text>Loading...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Monthly Spending</Text>
                <Text style={styles.headerSubtitle}>August 2024</Text>
            </View>

            {/* Add Spending Button */}
            <TouchableOpacity
                style={styles.addButton}
                onPress={() => setModalVisible(true)}
            >
                <Text style={styles.addButtonText}>+ Add Spending</Text>
            </TouchableOpacity>

            {/* Table Container */}
            <ScrollView style={styles.tableContainer}>
                {/* Table Header */}
                <View style={styles.tableHeader}>
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
                {spendingData.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>
                            No spending records found
                        </Text>
                        <Text style={styles.emptySubtext}>
                            Tap "Add Spending" to get started
                        </Text>
                    </View>
                ) : (
                    spendingData.map((item, index) => (
                        <View
                            key={item.id}
                            style={[
                                styles.tableRow,
                                index % 2 === 0
                                    ? styles.evenRow
                                    : styles.oddRow,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.cell,
                                    styles.amountColumn,
                                    styles.amountText,
                                ]}
                            >
                                {formatAmount(item.amount)}
                            </Text>
                            <Text
                                style={[styles.cell, styles.detailsColumn]}
                                numberOfLines={2}
                            >
                                {item.details}
                            </Text>
                            <Text style={[styles.cell, styles.dateColumn]}>
                                {formatDate(item.date)}
                            </Text>
                        </View>
                    ))
                )}
            </ScrollView>

            {/* Summary Section */}
            <View style={styles.summarySection}>
                <Text style={styles.totalText}>
                    Total Spent: {formatAmount(calculateTotal())}
                </Text>

                <Link href="/summary" style={styles.linkContainer}>
                    <View style={styles.summaryButton}>
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
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Add New Spending</Text>

                        <TextInput
                            style={styles.input}
                            placeholder="Amount (e.g., 25.99)"
                            value={newSpending.amount}
                            onChangeText={(text) =>
                                setNewSpending({ ...newSpending, amount: text })
                            }
                            keyboardType="numeric"
                        />

                        <TextInput
                            style={styles.input}
                            placeholder="Details (e.g., Coffee at Starbucks)"
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
                            style={styles.input}
                            placeholder="Date (YYYY-MM-DD)"
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
    headerTitle: {
        fontSize: 28,
        fontWeight: "bold",
        color: "#2c3e50",
        textAlign: "center",
    },
    headerSubtitle: {
        fontSize: 16,
        color: "#7f8c8d",
        textAlign: "center",
        marginTop: 4,
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
});
