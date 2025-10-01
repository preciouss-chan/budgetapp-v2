import * as SQLite from "expo-sqlite";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../contexts/ThemeContext";

// Database connection
const db = SQLite.openDatabaseSync("spending.db");

export default function SummaryScreen() {
    const { theme } = useTheme();
    const [spendingData, setSpendingData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalSpent: 0,
        averageSpending: 0,
        highestSpending: 0,
        lowestSpending: 0,
        totalTransactions: 0,
        thisMonthSpending: 0,
        lastMonthSpending: 0,
    });

    useEffect(() => {
        loadSummaryData();
    }, []);

    const loadSummaryData = async () => {
        try {
            setLoading(true);
            const data = await db.getAllAsync(
                "SELECT * FROM spending ORDER BY date DESC"
            );
            setSpendingData(data);
            calculateStats(data);
        } catch (error) {
            console.log("Error loading summary data:", error);
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (data: any[]) => {
        if (data.length === 0) {
            setStats({
                totalSpent: 0,
                averageSpending: 0,
                highestSpending: 0,
                lowestSpending: 0,
                totalTransactions: 0,
                thisMonthSpending: 0,
                lastMonthSpending: 0,
            });
            return;
        }

        const amounts = data.map((item) => item.amount);
        const totalSpent = amounts.reduce((sum, amount) => sum + amount, 0);

        const now = new Date();
        const thisMonth = now.getMonth();
        const thisYear = now.getFullYear();
        const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
        const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

        const thisMonthData = data.filter((item) => {
            const itemDate = new Date(item.date);
            return (
                itemDate.getMonth() === thisMonth &&
                itemDate.getFullYear() === thisYear
            );
        });

        const lastMonthData = data.filter((item) => {
            const itemDate = new Date(item.date);
            return (
                itemDate.getMonth() === lastMonth &&
                itemDate.getFullYear() === lastMonthYear
            );
        });

        const thisMonthSpending = thisMonthData.reduce(
            (sum, item) => sum + item.amount,
            0
        );
        const lastMonthSpending = lastMonthData.reduce(
            (sum, item) => sum + item.amount,
            0
        );

        setStats({
            totalSpent,
            averageSpending: totalSpent / data.length,
            highestSpending: Math.max(...amounts),
            lowestSpending: Math.min(...amounts),
            totalTransactions: data.length,
            thisMonthSpending,
            lastMonthSpending,
        });
    };

    const formatAmount = (amount: number) => {
        return `$${amount.toFixed(2)}`;
    };

    const formatMonth = (month: number, year: number) => {
        const months = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
        ];
        return `${months[month]} ${year}`;
    };

    const getMonthComparison = () => {
        if (stats.lastMonthSpending === 0) return "No previous month data";

        const difference = stats.thisMonthSpending - stats.lastMonthSpending;
        const percentage = Math.abs(
            (difference / stats.lastMonthSpending) * 100
        );

        if (difference > 0) {
            return `+${formatAmount(difference)} (+${percentage.toFixed(
                1
            )}%) vs last month`;
        } else if (difference < 0) {
            return `${formatAmount(difference)} (-${percentage.toFixed(
                1
            )}%) vs last month`;
        } else {
            return "Same as last month";
        }
    };

    if (loading) {
        return (
            <View
                style={[
                    styles.container,
                    styles.centered,
                    { backgroundColor: theme.colors.background },
                ]}
            >
                <Text
                    style={[
                        styles.loadingText,
                        { color: theme.colors.textSecondary },
                    ]}
                >
                    Loading summary...
                </Text>
            </View>
        );
    }

    const now = new Date();

    return (
        <ScrollView
            style={[
                styles.container,
                { backgroundColor: theme.colors.background },
            ]}
        >
            <View style={styles.header}>
                <Text style={[styles.title, { color: theme.colors.text }]}>
                    Spending Summary
                </Text>
                <Text
                    style={[
                        styles.subtitle,
                        { color: theme.colors.textSecondary },
                    ]}
                >
                    {formatMonth(now.getMonth(), now.getFullYear())}
                </Text>
            </View>

            <View style={styles.statsContainer}>
                <View
                    style={[
                        styles.statCard,
                        { backgroundColor: theme.colors.surface },
                    ]}
                >
                    <Text
                        style={[styles.statValue, { color: theme.colors.text }]}
                    >
                        {formatAmount(stats.totalSpent)}
                    </Text>
                    <Text
                        style={[
                            styles.statLabel,
                            { color: theme.colors.textSecondary },
                        ]}
                    >
                        Total Spent (All Time)
                    </Text>
                </View>

                <View
                    style={[
                        styles.statCard,
                        { backgroundColor: theme.colors.surface },
                    ]}
                >
                    <Text
                        style={[styles.statValue, { color: theme.colors.text }]}
                    >
                        {formatAmount(stats.thisMonthSpending)}
                    </Text>
                    <Text
                        style={[
                            styles.statLabel,
                            { color: theme.colors.textSecondary },
                        ]}
                    >
                        This Month
                    </Text>
                    <Text
                        style={[
                            styles.statSubtext,
                            { color: theme.colors.textSecondary },
                        ]}
                    >
                        {getMonthComparison()}
                    </Text>
                </View>

                <View
                    style={[
                        styles.statCard,
                        { backgroundColor: theme.colors.surface },
                    ]}
                >
                    <Text
                        style={[styles.statValue, { color: theme.colors.text }]}
                    >
                        {formatAmount(stats.averageSpending)}
                    </Text>
                    <Text
                        style={[
                            styles.statLabel,
                            { color: theme.colors.textSecondary },
                        ]}
                    >
                        Average per Transaction
                    </Text>
                </View>

                <View
                    style={[
                        styles.statCard,
                        { backgroundColor: theme.colors.surface },
                    ]}
                >
                    <Text
                        style={[styles.statValue, { color: theme.colors.text }]}
                    >
                        {stats.totalTransactions}
                    </Text>
                    <Text
                        style={[
                            styles.statLabel,
                            { color: theme.colors.textSecondary },
                        ]}
                    >
                        Total Transactions
                    </Text>
                </View>

                <View
                    style={[
                        styles.statCard,
                        { backgroundColor: theme.colors.surface },
                    ]}
                >
                    <Text
                        style={[styles.statValue, { color: theme.colors.text }]}
                    >
                        {formatAmount(stats.highestSpending)}
                    </Text>
                    <Text
                        style={[
                            styles.statLabel,
                            { color: theme.colors.textSecondary },
                        ]}
                    >
                        Highest Single Spending
                    </Text>
                </View>

                <View
                    style={[
                        styles.statCard,
                        { backgroundColor: theme.colors.surface },
                    ]}
                >
                    <Text
                        style={[styles.statValue, { color: theme.colors.text }]}
                    >
                        {formatAmount(stats.lowestSpending)}
                    </Text>
                    <Text
                        style={[
                            styles.statLabel,
                            { color: theme.colors.textSecondary },
                        ]}
                    >
                        Lowest Single Spending
                    </Text>
                </View>
            </View>

            <View
                style={[
                    styles.recentContainer,
                    { backgroundColor: theme.colors.surface },
                ]}
            >
                <Text
                    style={[styles.sectionTitle, { color: theme.colors.text }]}
                >
                    Recent Transactions
                </Text>
                {spendingData.slice(0, 5).map((item, index) => (
                    <View
                        key={item.id}
                        style={[
                            styles.recentItem,
                            { borderBottomColor: theme.colors.border },
                        ]}
                    >
                        <View style={styles.recentItemLeft}>
                            <Text
                                style={[
                                    styles.recentAmount,
                                    { color: theme.colors.error },
                                ]}
                            >
                                {formatAmount(item.amount)}
                            </Text>
                            <Text
                                style={[
                                    styles.recentDetails,
                                    { color: theme.colors.textSecondary },
                                ]}
                                numberOfLines={1}
                            >
                                {item.details}
                            </Text>
                        </View>
                        <Text
                            style={[
                                styles.recentDate,
                                { color: theme.colors.textSecondary },
                            ]}
                        >
                            {new Date(item.date).toLocaleDateString()}
                        </Text>
                    </View>
                ))}
                {spendingData.length === 0 && (
                    <Text
                        style={[
                            styles.noDataText,
                            { color: theme.colors.textSecondary },
                        ]}
                    >
                        No transactions found
                    </Text>
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f8f9fa",
        padding: 16,
    },
    centered: {
        justifyContent: "center",
        alignItems: "center",
    },
    loadingText: {
        fontSize: 16,
        color: "#7f8c8d",
    },
    header: {
        marginBottom: 24,
        paddingVertical: 16,
        alignItems: "center",
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
        marginBottom: 24,
    },
    statCard: {
        backgroundColor: "#ffffff",
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    statValue: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#2c3e50",
        textAlign: "center",
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 14,
        color: "#7f8c8d",
        textAlign: "center",
        fontWeight: "500",
    },
    statSubtext: {
        fontSize: 12,
        color: "#95a5a6",
        textAlign: "center",
        marginTop: 4,
        fontStyle: "italic",
    },
    recentContainer: {
        backgroundColor: "#ffffff",
        borderRadius: 12,
        padding: 16,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#2c3e50",
        marginBottom: 12,
    },
    recentItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: "#ecf0f1",
    },
    recentItemLeft: {
        flex: 1,
    },
    recentAmount: {
        fontSize: 16,
        fontWeight: "600",
        color: "#e74c3c",
    },
    recentDetails: {
        fontSize: 14,
        color: "#7f8c8d",
        marginTop: 2,
    },
    recentDate: {
        fontSize: 12,
        color: "#95a5a6",
        marginLeft: 12,
    },
    noDataText: {
        fontSize: 14,
        color: "#7f8c8d",
        textAlign: "center",
        fontStyle: "italic",
        paddingVertical: 20,
    },
});
