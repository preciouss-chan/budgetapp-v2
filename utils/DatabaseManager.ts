import * as SQLite from 'expo-sqlite';

// Track if database is already initialized to avoid multiple initializations
let databaseInitialized = false;

// Simple database operations without complex connection management
const createDatabase = () => {
    try {
        console.log("Creating new database connection...");
        const db = SQLite.openDatabaseSync("spending.db");
        console.log("Database connection established successfully");
        return db;
    } catch (error) {
        console.log("Error establishing database connection:", error);
        throw error;
    }
};

export const initializeDatabase = async (): Promise<void> => {
    if (databaseInitialized) {
        console.log("Database already initialized, skipping...");
        return;
    }
    
    try {
        console.log("Executing database schema creation...");
        const database = createDatabase();
        
        // Use the simplest possible approach
        await database.execAsync(`
            CREATE TABLE IF NOT EXISTS spending (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                amount REAL,
                details TEXT,
                date TEXT
            )
        `);
        console.log("Database initialized successfully");
        databaseInitialized = true;
    } catch (error) {
        console.log("Error initializing database:", error);
        // If initialization fails, assume table already exists
        console.log("Assuming table already exists, continuing...");
        databaseInitialized = true;
    }
};

// Export the getDatabase function for use in backup operations
export const getDatabase = async () => {
    await initializeDatabase();
    return createDatabase();
};

export const Database = {
    init: initializeDatabase,

    getAllSpending: async () => {
        try {
            // Ensure database is initialized
            await initializeDatabase();
            
            // Create a fresh database connection for this operation
            const database = createDatabase();
            const result = await database.getAllAsync(
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
            console.log("Database.addSpending called with:", { amount, details, date });
            
            // Ensure database is initialized
            await initializeDatabase();
            console.log("Database initialization check completed");
            
            // Check for potential duplicates (same amount and details within 5 minutes)
            const fiveMinutesAgo = new Date(
                Date.now() - 5 * 60 * 1000
            ).toISOString();
            console.log("Checking for duplicates since:", fiveMinutesAgo);
            
            // Create a fresh database connection for this operation
            const database = createDatabase();
            console.log("Fresh database connection created for addSpending");
            
            // Check for duplicates first
            const existing = await database.getAllAsync(
                "SELECT * FROM spending WHERE amount = ? AND details = ? AND date > ?",
                [amount, details, fiveMinutesAgo]
            );

            if (existing.length > 0) {
                console.log("Duplicate transaction detected, skipping");
                return { lastInsertRowId: (existing[0] as any).id, changes: 0 };
            }

            console.log("Inserting new spending record...");
            const result = await database.runAsync(
                "INSERT INTO spending (amount, details, date) VALUES (?, ?, ?)",
                [amount, details, date]
            );
            console.log("Successfully inserted spending record:", result);
            return result;
        } catch (error) {
            console.log("Error adding spending:", error);
            console.log("Error details:", {
                name: error instanceof Error ? error.name : 'Unknown',
                message: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : 'No stack trace'
            });
            throw error;
        }
    },

    updateSpending: async (
        id: number,
        amount: number,
        details: string,
        date: string
    ) => {
        try {
            await initializeDatabase();
            // Create a fresh database connection for this operation
            const database = createDatabase();
            const result = await database.runAsync(
                "UPDATE spending SET amount = ?, details = ?, date = ? WHERE id = ?",
                [amount, details, date, id]
            );
            return result;
        } catch (error) {
            console.log("Error updating spending:", error);
            throw error;
        }
    },

    deleteSpending: async (id: number) => {
        try {
            await initializeDatabase();
            // Create a fresh database connection for this operation
            const database = createDatabase();
            const result = await database.runAsync(
                "DELETE FROM spending WHERE id = ?",
                [id]
            );
            return result;
        } catch (error) {
            console.log("Error deleting spending:", error);
            throw error;
        }
    },
};
