import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

class StorageWrapper {
  async getItemAsync(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        return localStorage.getItem(key);
      } catch (error) {
        console.error('Error getting item from localStorage:', error);
        return null;
      }
    } else {
      return await SecureStore.getItemAsync(key);
    }
  }

  async setItemAsync(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        console.error('Error setting item to localStorage:', error);
      }
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  }

  async deleteItemAsync(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error('Error deleting item from localStorage:', error);
      }
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  }
}

export const storage = new StorageWrapper();
