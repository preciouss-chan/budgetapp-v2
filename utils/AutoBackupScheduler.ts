import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { createBackup } from './DatabaseBackup';

const BACKGROUND_FETCH_TASK = 'background-backup-task';

interface BackupSchedule {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string; // HH:MM format
  lastBackup: string | null;
}

const DEFAULT_SCHEDULE: BackupSchedule = {
  enabled: false,
  frequency: 'weekly',
  time: '02:00',
  lastBackup: null,
};

class AutoBackupScheduler {
  private schedule: BackupSchedule = DEFAULT_SCHEDULE;

  constructor() {
    this.loadSchedule();
    this.setupBackgroundTask();
  }

  /**
   * Load backup schedule from storage
   */
  async loadSchedule(): Promise<void> {
    try {
      const savedSchedule = await AsyncStorage.getItem('backup_schedule');
      if (savedSchedule) {
        this.schedule = { ...DEFAULT_SCHEDULE, ...JSON.parse(savedSchedule) };
      }
    } catch (error) {
      console.log('Error loading backup schedule:', error);
    }
  }

  /**
   * Save backup schedule to storage
   */
  async saveSchedule(schedule: Partial<BackupSchedule>): Promise<void> {
    try {
      this.schedule = { ...this.schedule, ...schedule };
      await AsyncStorage.setItem('backup_schedule', JSON.stringify(this.schedule));
      
      // Update background fetch if enabled
      if (this.schedule.enabled) {
        await this.enableBackgroundBackup();
      } else {
        await this.disableBackgroundBackup();
      }
    } catch (error) {
      console.log('Error saving backup schedule:', error);
    }
  }

  /**
   * Get current backup schedule
   */
  getSchedule(): BackupSchedule {
    return { ...this.schedule };
  }

  /**
   * Check if it's time for a backup
   */
  private shouldCreateBackup(): boolean {
    if (!this.schedule.enabled || !this.schedule.lastBackup) {
      return true; // First backup
    }

    const lastBackupDate = new Date(this.schedule.lastBackup);
    const now = new Date();
    const timeDiff = now.getTime() - lastBackupDate.getTime();

    switch (this.schedule.frequency) {
      case 'daily':
        return timeDiff >= 24 * 60 * 60 * 1000; // 24 hours
      case 'weekly':
        return timeDiff >= 7 * 24 * 60 * 60 * 1000; // 7 days
      case 'monthly':
        return timeDiff >= 30 * 24 * 60 * 60 * 1000; // 30 days
      default:
        return false;
    }
  }

  /**
   * Check if backup should run at current time
   */
  private isBackupTime(): boolean {
    if (!this.schedule.enabled) return false;

    const now = new Date();
    const [hours, minutes] = this.schedule.time.split(':').map(Number);
    const backupTime = new Date();
    backupTime.setHours(hours, minutes, 0, 0);

    // Check if current time is within 5 minutes of scheduled time
    const timeDiff = Math.abs(now.getTime() - backupTime.getTime());
    return timeDiff <= 5 * 60 * 1000; // 5 minutes tolerance
  }

  /**
   * Create automatic backup
   */
  async createAutomaticBackup(): Promise<boolean> {
    try {
      if (!this.shouldCreateBackup()) {
        console.log('Backup not needed yet');
        return false;
      }

      if (!this.isBackupTime()) {
        console.log('Not backup time yet');
        return false;
      }

      console.log('Creating automatic backup...');
      const backup = await createBackup();
      
      // Update last backup time
      await this.saveSchedule({
        lastBackup: new Date().toISOString(),
      });

      console.log(`Automatic backup created: ${backup.filename}`);
      return true;
    } catch (error) {
      console.log('Error creating automatic backup:', error);
      return false;
    }
  }

  /**
   * Setup background task for automatic backups
   */
  private setupBackgroundTask(): void {
    // Define the background task
    TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
      try {
        console.log('Background backup task started');
        const success = await this.createAutomaticBackup();
        
        return success ? BackgroundFetch.BackgroundFetchResult.NewData : BackgroundFetch.BackgroundFetchResult.NoData;
      } catch (error) {
        console.log('Background backup task error:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });
  }

  /**
   * Enable background backup
   */
  async enableBackgroundBackup(): Promise<void> {
    try {
      const status = await BackgroundFetch.getStatusAsync();
      
      if (status === BackgroundFetch.BackgroundFetchStatus.Available) {
        await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
          minimumInterval: this.getMinimumInterval(),
          stopOnTerminate: false,
          startOnBoot: true,
        });
        console.log('Background backup enabled');
      } else {
        console.log('Background fetch not available');
        throw new Error('Background fetch not available');
      }
    } catch (error) {
      console.log('Error enabling background backup:', error);
      throw error;
    }
  }

  /**
   * Disable background backup
   */
  async disableBackgroundBackup(): Promise<void> {
    try {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
      console.log('Background backup disabled');
    } catch (error) {
      console.log('Error disabling background backup:', error);
    }
  }

  /**
   * Get minimum interval for background fetch based on frequency
   */
  private getMinimumInterval(): number {
    switch (this.schedule.frequency) {
      case 'daily':
        return 24 * 60; // 24 hours in minutes
      case 'weekly':
        return 7 * 24 * 60; // 7 days in minutes
      case 'monthly':
        return 30 * 24 * 60; // 30 days in minutes
      default:
        return 24 * 60; // Default to daily
    }
  }

  /**
   * Check if background fetch is available
   */
  async isBackgroundFetchAvailable(): Promise<boolean> {
    try {
      const status = await BackgroundFetch.getStatusAsync();
      return status === BackgroundFetch.BackgroundFetchStatus.Available;
    } catch (error) {
      console.log('Error checking background fetch availability:', error);
      return false;
    }
  }

  /**
   * Get next backup time
   */
  getNextBackupTime(): Date | null {
    if (!this.schedule.enabled || !this.schedule.lastBackup) {
      return null;
    }

    const lastBackup = new Date(this.schedule.lastBackup);
    const nextBackup = new Date(lastBackup);

    switch (this.schedule.frequency) {
      case 'daily':
        nextBackup.setDate(lastBackup.getDate() + 1);
        break;
      case 'weekly':
        nextBackup.setDate(lastBackup.getDate() + 7);
        break;
      case 'monthly':
        nextBackup.setMonth(lastBackup.getMonth() + 1);
        break;
    }

    // Set the scheduled time
    const [hours, minutes] = this.schedule.time.split(':').map(Number);
    nextBackup.setHours(hours, minutes, 0, 0);

    return nextBackup;
  }

  /**
   * Format next backup time for display
   */
  formatNextBackupTime(): string {
    const nextBackup = this.getNextBackupTime();
    if (!nextBackup) {
      return 'Not scheduled';
    }

    const now = new Date();
    const timeDiff = nextBackup.getTime() - now.getTime();

    if (timeDiff <= 0) {
      return 'Overdue';
    }

    const days = Math.floor(timeDiff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((timeDiff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

    if (days > 0) {
      return `In ${days} day${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `In ${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      return 'Soon';
    }
  }

  /**
   * Test backup functionality
   */
  async testBackup(): Promise<boolean> {
    try {
      console.log('Testing automatic backup...');
      const backup = await createBackup();
      console.log(`Test backup created: ${backup.filename}`);
      return true;
    } catch (error) {
      console.log('Test backup failed:', error);
      return false;
    }
  }

  /**
   * Get backup schedule status
   */
  getStatus(): {
    enabled: boolean;
    frequency: string;
    time: string;
    nextBackup: string;
    lastBackup: string | null;
    backgroundFetchAvailable: boolean;
  } {
    return {
      enabled: this.schedule.enabled,
      frequency: this.schedule.frequency,
      time: this.schedule.time,
      nextBackup: this.formatNextBackupTime(),
      lastBackup: this.schedule.lastBackup,
      backgroundFetchAvailable: false, // Will be set by calling component
    };
  }
}

// Export singleton instance
export const autoBackupScheduler = new AutoBackupScheduler();

// Helper functions
export const getBackupSchedule = () => autoBackupScheduler.getSchedule();
export const saveBackupSchedule = (schedule: Partial<BackupSchedule>) => 
  autoBackupScheduler.saveSchedule(schedule);
export const getNextBackupTime = () => autoBackupScheduler.getNextBackupTime();
export const formatNextBackupTime = () => autoBackupScheduler.formatNextBackupTime();
export const testBackup = () => autoBackupScheduler.testBackup();
export const getBackupStatus = () => autoBackupScheduler.getStatus();
export const isBackgroundFetchAvailable = () => autoBackupScheduler.isBackgroundFetchAvailable();
