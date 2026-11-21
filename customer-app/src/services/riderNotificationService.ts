import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';
import { apiRequest } from '../api/client';

// Configure foreground notifications presentation behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class RiderNotificationService {
  private pushToken: string | null = null;

  /**
   * Register rider device push token with Expo / FCM
   */
  async registerForPushNotifications(): Promise<string | null> {
    if (Platform.OS === 'web') return null;

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return null;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync();
      this.pushToken = tokenData.data;

      // Optional: Send device push token to backend for persistence when push provider enabled
      try {
        await apiRequest('/riders/push-token', {
          method: 'POST',
          body: JSON.stringify({ token: this.pushToken }),
        });
      } catch {
        // Backend push token endpoint optional/logged
      }

      // Android Notification Channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('fleet24-offers', {
          name: 'Delivery Offers',
          importance: AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#28543F',
        });
      }

      return this.pushToken;
    } catch {
      return null;
    }
  }

  getPushToken(): string | null {
    return this.pushToken;
  }
}

export const riderNotificationService = new RiderNotificationService();

