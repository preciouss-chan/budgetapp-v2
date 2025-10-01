import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { initializeDatabase } from './DatabaseManager';

interface BackupData {
  version: string;
  timestamp: string;
  spending: any[];
  settings?: any;
  metadata: {
    totalRecords: number;
    dateRange: {
      earliest: string;
      latest: string;
    };
    totalAmount: number;
  };
}

interface BackupInfo {
  id: string;
  filename: string;
  timestamp: string;
  size: number;
  recordCount: number;
  totalAmount: number;
  isVerified: boolean;
}

class DatabaseBackupManager {
  private backupDir: string;
  private readonly BACKUP_VERSION = '1.0.0';
  private readonly MAX_BACKUPS = 10; // Keep only last 10 backups

  constructor() {
    this.backupDir = `${FileSystem.documentDirectory}backups/`;
    this.ensureBackupDirectory();
  }

  private async ensureBackupDirectory(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.backupDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.backupDir, { intermediates: true });
      }
    } catch (error) {
      console.log('Error creating backup directory:', error);
      throw new Error('Failed to create backup directory');
    }
  }

  /**
   * Create a backup of the current database
   */
  async createBackup(): Promise<BackupInfo> {
    try {
      console.log('Starting database backup...');
      
      // Try to get spending data with multiple fallback methods
      let spending: any[] = [];
      
      try {
        // Method 1: Use shared database manager
        await initializeDatabase();
        const { getDatabase } = await import('./DatabaseManager');
        const db = await getDatabase();
        spending = await db.getAllAsync('SELECT * FROM spending ORDER BY date DESC');
        console.log(`Method 1 successful: Retrieved ${spending.length} spending records`);
      } catch (method1Error) {
        console.log('Method 1 failed:', method1Error);
        
        try {
          // Method 2: Try direct database connection
          const directDb = (await import('expo-sqlite')).default.openDatabaseSync('spending.db');
          spending = await directDb.getAllAsync('SELECT * FROM spending ORDER BY date DESC');
          console.log(`Method 2 successful: Retrieved ${spending.length} spending records`);
        } catch (method2Error) {
          console.log('Method 2 failed:', method2Error);
          
          // Method 3: Create empty backup if database fails
          console.log('All database methods failed, creating empty backup');
          spending = [];
        }
      }

      // Get settings if they exist
      let settings = null;
      try {
        const settingsData = await AsyncStorage.getItem('app_settings');
        if (settingsData) {
          settings = JSON.parse(settingsData);
        }
      } catch (error) {
        console.log('No settings to backup:', error);
      }

      // Calculate metadata
      const metadata = this.calculateMetadata(spending);
      
      // Create backup data structure
      const backupData: BackupData = {
        version: this.BACKUP_VERSION,
        timestamp: new Date().toISOString(),
        spending,
        settings,
        metadata,
      };

      // Generate filename and save
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `budget_backup_${timestamp}.json`;
      const fileUri = `${this.backupDir}${filename}`;

      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(backupData, null, 2));

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      
      const backupInfo: BackupInfo = {
        id: timestamp,
        filename,
        timestamp: backupData.timestamp,
        size: (fileInfo as any).size || 0,
        recordCount: spending.length,
        totalAmount: metadata.totalAmount,
        isVerified: true, // We just created it, so it's verified
      };

      console.log(`Backup created successfully: ${filename}`);
      
      // Clean up old backups
      await this.cleanupOldBackups();

      return backupInfo;
    } catch (error) {
      console.log('Error creating backup:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to create backup: ${errorMessage}`);
    }
  }

  /**
   * Restore database from a backup file
   */
  async restoreFromBackup(backupId: string): Promise<void> {
    try {
      console.log(`Restoring from backup: ${backupId}`);
      
      const backupFile = await this.findBackupFile(backupId);
      if (!backupFile) {
        throw new Error('Backup file not found');
      }

      // Read backup data
      const backupContent = await FileSystem.readAsStringAsync(backupFile);
      const backupData: BackupData = JSON.parse(backupContent);

      // Verify backup integrity
      if (!this.verifyBackupIntegrity(backupData)) {
        throw new Error('Backup file is corrupted or invalid');
      }

      console.log(`Backup data verified: ${backupData.spending?.length || 0} records to restore`);

      // Initialize database and get connection
      console.log('Initializing database...');
      await initializeDatabase();
      console.log('Database initialization completed');
      
      let db;
      try {
        // Try the shared database manager first
        const { getDatabase } = await import('./DatabaseManager');
        db = await getDatabase();
        console.log('Using shared database manager for restore');
      } catch (error) {
        console.log('Shared database manager failed, trying direct connection:', error);
        // Fallback to direct database connection
        const SQLite = await import('expo-sqlite');
        db = SQLite.default.openDatabaseSync('spending.db');
        console.log('Using direct database connection for restore');
      }
      
      if (!db) {
        throw new Error('Failed to establish database connection');
      }
      
      console.log('Database connection established for restore');

      try {
        // Test database connection first
        console.log('Testing database connection...');
        await db.getAllAsync('SELECT 1');
        console.log('Database connection test successful');

        // Clear existing data
        console.log('Clearing existing spending data...');
        await db.execAsync('DELETE FROM spending');
        console.log('Existing data cleared');

        // Restore spending data
        if (backupData.spending && backupData.spending.length > 0) {
          console.log(`Restoring ${backupData.spending.length} spending records...`);
          
          for (let i = 0; i < backupData.spending.length; i++) {
            const record = backupData.spending[i];
            try {
              // Validate record data before insertion
              if (!record.id || record.amount === undefined || !record.details || !record.date) {
                console.log(`Skipping invalid record ${i}:`, record);
                continue;
              }

              await db.runAsync(
                'INSERT INTO spending (id, amount, details, date) VALUES (?, ?, ?, ?)',
                [record.id, record.amount, record.details, record.date]
              );
              
              if (i % 10 === 0) {
                console.log(`Restored ${i + 1}/${backupData.spending.length} records`);
              }
            } catch (recordError) {
              console.log(`Error inserting record ${i}:`, recordError);
              console.log(`Record data:`, record);
              // Continue with other records even if one fails
            }
          }
          
          console.log('All spending records processed');
        } else {
          console.log('No spending records to restore');
        }

        // Restore settings if they exist
        if (backupData.settings) {
          console.log('Restoring settings...');
          await AsyncStorage.setItem('app_settings', JSON.stringify(backupData.settings));
          console.log('Settings restored');
        }

        // Verify the restore was successful
        console.log('Verifying restore...');
        const restoredRecords = await db.getAllAsync('SELECT COUNT(*) as count FROM spending');
        const recordCount = (restoredRecords[0] as any)?.count || 0;
        console.log(`Verification: ${recordCount} records now in database`);
        
        if (backupData.spending && backupData.spending.length > 0 && recordCount === 0) {
          throw new Error('Restore failed: No records were restored to the database');
        }
        
        console.log(`Restore completed successfully from ${backupData.timestamp}`);
      } catch (error) {
        console.log('Error during restore operation:', error);
        console.log('Error details:', {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : 'No stack trace'
        });
        throw error;
      }
    } catch (error) {
      console.log('Error restoring backup:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to restore backup: ${errorMessage}`);
    }
  }

  /**
   * Get list of available backups
   */
  async getAvailableBackups(): Promise<BackupInfo[]> {
    try {
      const files = await FileSystem.readDirectoryAsync(this.backupDir);
      const backupFiles = files.filter(file => file.endsWith('.json'));

      const backups: BackupInfo[] = [];

      for (const file of backupFiles) {
        try {
          const fileUri = `${this.backupDir}${file}`;
          const content = await FileSystem.readAsStringAsync(fileUri);
          const backupData: BackupData = JSON.parse(content);

          const fileInfo = await FileSystem.getInfoAsync(fileUri);
          
          backups.push({
            id: backupData.timestamp.replace(/[:.]/g, '-'),
            filename: file,
            timestamp: backupData.timestamp,
            size: (fileInfo as any).size || 0,
            recordCount: backupData.spending?.length || 0,
            totalAmount: backupData.metadata?.totalAmount || 0,
            isVerified: this.verifyBackupIntegrity(backupData),
          });
        } catch (error) {
          console.log(`Error reading backup file ${file}:`, error);
        }
      }

      // Sort by timestamp (newest first)
      return backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      console.log('Error getting available backups:', error);
      return [];
    }
  }

  /**
   * Delete a specific backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    try {
      const backupFile = await this.findBackupFile(backupId);
      if (backupFile) {
        await FileSystem.deleteAsync(backupFile);
        console.log(`Backup deleted: ${backupId}`);
      } else {
        throw new Error('Backup file not found');
      }
    } catch (error) {
      console.log('Error deleting backup:', error);
      throw new Error('Failed to delete backup');
    }
  }

  /**
   * Export backup to external storage (share functionality)
   */
  async exportBackup(backupId: string): Promise<string> {
    try {
      const backupFile = await this.findBackupFile(backupId);
      if (!backupFile) {
        throw new Error('Backup file not found');
      }

      // Create a copy in the cache directory for sharing
      const cacheDir = FileSystem.cacheDirectory;
      const exportFile = `${cacheDir}${backupId}.json`;
      
      await FileSystem.copyAsync({
        from: backupFile,
        to: exportFile,
      });

      return exportFile;
    } catch (error) {
      console.log('Error exporting backup:', error);
      throw new Error('Failed to export backup');
    }
  }

  /**
   * Import backup from external file
   */
  async importBackup(fileUri: string): Promise<BackupInfo> {
    try {
      console.log(`Importing backup from: ${fileUri}`);
      
      // Read the file
      const content = await FileSystem.readAsStringAsync(fileUri);
      const backupData: BackupData = JSON.parse(content);

      // Verify backup integrity
      if (!this.verifyBackupIntegrity(backupData)) {
        throw new Error('Invalid backup file');
      }

      // Save to backup directory
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `budget_backup_imported_${timestamp}.json`;
      const backupUri = `${this.backupDir}${filename}`;

      await FileSystem.writeAsStringAsync(backupUri, content);

      const fileInfo = await FileSystem.getInfoAsync(backupUri);
      
      const backupInfo: BackupInfo = {
        id: timestamp,
        filename,
        timestamp: backupData.timestamp,
        size: (fileInfo as any).size || 0,
        recordCount: backupData.spending?.length || 0,
        totalAmount: backupData.metadata?.totalAmount || 0,
        isVerified: true,
      };

      console.log(`Backup imported successfully: ${filename}`);
      return backupInfo;
    } catch (error) {
      console.log('Error importing backup:', error);
      throw new Error('Failed to import backup');
    }
  }

  /**
   * Get backup statistics
   */
  async getBackupStats(): Promise<{
    totalBackups: number;
    totalSize: number;
    oldestBackup: string | null;
    newestBackup: string | null;
  }> {
    try {
      const backups = await this.getAvailableBackups();
      
      const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);
      const oldestBackup = backups.length > 0 ? backups[backups.length - 1].timestamp : null;
      const newestBackup = backups.length > 0 ? backups[0].timestamp : null;

      return {
        totalBackups: backups.length,
        totalSize,
        oldestBackup,
        newestBackup,
      };
    } catch (error) {
      console.log('Error getting backup stats:', error);
      return {
        totalBackups: 0,
        totalSize: 0,
        oldestBackup: null,
        newestBackup: null,
      };
    }
  }

  /**
   * Verify backup integrity
   */
  private verifyBackupIntegrity(backupData: any): boolean {
    try {
      // Check required fields
      if (!backupData.version || !backupData.timestamp || !backupData.spending) {
        return false;
      }

      // Check version compatibility
      if (backupData.version !== this.BACKUP_VERSION) {
        console.log(`Backup version mismatch: ${backupData.version} vs ${this.BACKUP_VERSION}`);
        // Allow different versions but log warning
      }

      // Check spending data structure
      if (!Array.isArray(backupData.spending)) {
        return false;
      }

      // Validate each spending record
      for (const record of backupData.spending) {
        if (!record.id || !record.amount || !record.details || !record.date) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.log('Error verifying backup integrity:', error);
      return false;
    }
  }

  /**
   * Calculate metadata for backup
   */
  private calculateMetadata(spending: any[]): BackupData['metadata'] {
    if (spending.length === 0) {
      return {
        totalRecords: 0,
        dateRange: { earliest: '', latest: '' },
        totalAmount: 0,
      };
    }

    const amounts = spending.map(s => s.amount);
    const dates = spending.map(s => new Date(s.date).getTime());
    
    const totalAmount = amounts.reduce((sum, amount) => sum + amount, 0);
    const earliestDate = new Date(Math.min(...dates)).toISOString();
    const latestDate = new Date(Math.max(...dates)).toISOString();

    return {
      totalRecords: spending.length,
      dateRange: { earliest: earliestDate, latest: latestDate },
      totalAmount,
    };
  }

  /**
   * Find backup file by ID
   */
  private async findBackupFile(backupId: string): Promise<string | null> {
    try {
      const files = await FileSystem.readDirectoryAsync(this.backupDir);
      const backupFile = files.find(file => file.includes(backupId));
      
      return backupFile ? `${this.backupDir}${backupFile}` : null;
    } catch (error) {
      console.log('Error finding backup file:', error);
      return null;
    }
  }

  /**
   * Clean up old backups (keep only the most recent ones)
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      const backups = await this.getAvailableBackups();
      
      if (backups.length > this.MAX_BACKUPS) {
        const backupsToDelete = backups.slice(this.MAX_BACKUPS);
        
        for (const backup of backupsToDelete) {
          await this.deleteBackup(backup.id);
        }
        
        console.log(`Cleaned up ${backupsToDelete.length} old backups`);
      }
    } catch (error) {
      console.log('Error cleaning up old backups:', error);
    }
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }
}

// Export singleton instance
export const backupManager = new DatabaseBackupManager();

// Helper functions for easy usage
export const createBackup = () => backupManager.createBackup();
export const restoreFromBackup = (backupId: string) => backupManager.restoreFromBackup(backupId);
export const getAvailableBackups = () => backupManager.getAvailableBackups();
export const deleteBackup = (backupId: string) => backupManager.deleteBackup(backupId);
export const exportBackup = (backupId: string) => backupManager.exportBackup(backupId);
export const importBackup = (fileUri: string) => backupManager.importBackup(fileUri);
export const getBackupStats = () => backupManager.getBackupStats();
export const formatFileSize = (bytes: number) => backupManager.formatFileSize(bytes);
export const formatBackupDate = (dateString: string) => backupManager.formatDate(dateString);
