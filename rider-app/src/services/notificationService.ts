import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { riderApi } from '../api/riderApi';

class RiderNotificationService {
  private devicePushToken: string | null = null;
  private activeForegroundOfferId: string | null = null;
  private isConfigured: boolean = false;
  private notificationListener: Notifications.EventSubscription | null = null;
  private responseListener: Notifications.EventSubscription | null = null;

  constructor() {
    this.configureNotificationHandler();
  }

  /**
   * Configure global foreground notification behavior.
   * Suppresses audible/visual notification if Socket.IO already delivered the same offer in the foreground.
   */
  private configureNotificationHandler(): void {
    if (Platform.OS === 'web') return;

    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const data = notification.request.content.data;
        const orderId = (data?.orderId as string) || '';

        // Deduplication: If Socket.IO already delivered and displayed this offer in foreground, suppress duplicate alert
        const isDuplicateForeground = this.isOfferActiveInForeground(orderId);

        return {
          shouldShowAlert: !isDuplicateForeground,
          shouldPlaySound: !isDuplicateForeground,
          shouldSetBadge: false,
          shouldPresentBanner: !isDuplicateForeground,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        };
      },
    });
  }

  /**
   * Initialize Android high-importance notification channels and listeners.
   */
  public async initialize(): Promise<void> {
    if (this.isConfigured || Platform.OS === 'web') return;

    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('fleet24-offers', {
          name: 'Delivery Offers',
          description: 'High-priority notifications for new incoming delivery offers and dispatch updates.',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#193B2C',
          enableLights: true,
          enableVibrate: true,
          sound: 'default',
        });
      }

      this.notificationListener = Notifications.addNotificationReceivedListener((notification) => {
        const data = notification.request.content.data;
        console.log('[NotificationService] Notification received:', notification.request.content.title, data);
      });

      this.responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        console.log('[NotificationService] User interacted with notification:', data);
      });

      this.isConfigured = true;
    } catch (err: any) {
      console.warn('[NotificationService] Initialization error:', err?.message || err);
    }
  }

  /**
   * Request push notification permission and register token with backend.
   */
  public async registerForPushNotifications(): Promise<string | null> {
    if (Platform.OS === 'web') return null;

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('[NotificationService] Push notification permissions not granted by user.');
        return null;
      }

      // Try Expo Push Token first, fallback to native Device Push Token
      let pushToken: string | null = null;
      try {
        const tokenRes = await Notifications.getExpoPushTokenAsync();
        pushToken = tokenRes?.data || null;
      } catch {
        const nativeToken = await Notifications.getDevicePushTokenAsync().catch(() => null);
        pushToken = nativeToken?.data || null;
      }

      if (pushToken) {
        this.devicePushToken = pushToken;
        await riderApi.registerDeviceToken(pushToken, Platform.OS as 'android' | 'ios');
        console.log('[NotificationService] Registered device push token with Fleet24 backend.');
      }

      return pushToken;
    } catch (err: any) {
      console.warn('[NotificationService] Push registration warning:', err?.message || err);
      return null;
    }
  }

  /**
   * Invalidate and unregister token upon rider logout.
   */
  public async unregisterPushNotifications(): Promise<void> {
    if (this.devicePushToken) {
      try {
        await riderApi.unregisterDeviceToken();
      } catch (err: any) {
        console.warn('[NotificationService] Unregister token error:', err?.message || err);
      }
      this.devicePushToken = null;
    }

    if (this.notificationListener) {
      this.notificationListener.remove();
      this.notificationListener = null;
    }
    if (this.responseListener) {
      this.responseListener.remove();
      this.responseListener = null;
    }
    this.isConfigured = false;
  }

  /**
   * Track currently active foreground offer ID to prevent duplicate alerts when Socket.IO is active.
   */
  public setActiveForegroundOffer(orderId: string | null): void {
    this.activeForegroundOfferId = orderId;
  }

  public isOfferActiveInForeground(orderId?: string): boolean {
    if (!orderId || !this.activeForegroundOfferId) return false;
    return this.activeForegroundOfferId === orderId;
  }

  public getDevicePushToken(): string | null {
    return this.devicePushToken;
  }
}

export const riderNotificationService = new RiderNotificationService();

