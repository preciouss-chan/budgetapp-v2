import { StyleSheet, Text, View } from "react-native";

export default function SummaryScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Monthly Spending Summary</Text>
            <Text style={styles.subtitle}>Total: $0.00</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
    },
    subtitle: {
        fontSize: 18,
        color: "gray",
    },
});
