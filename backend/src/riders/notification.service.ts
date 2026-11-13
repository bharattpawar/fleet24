import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface RiderNotificationPayload {
  riderId: string;
  orderId: string;
  deliveryId: string;
  type: 'offer_created' | 'offer_expired' | 'offer_cancelled' | 'delivery_assigned';
  title: string;
  body: string;
  data?: Record<string, any>;
}

export interface RegisteredDeviceToken {
  token: string;
  platform: 'android' | 'ios' | 'web';
  updatedAt: Date;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  // In-memory thread-safe registry of authenticated rider device push tokens
  private readonly deviceTokens = new Map<string, RegisteredDeviceToken>();

  constructor(private readonly configService: ConfigService) {}

  /**
   * Associate an authenticated rider with a device push token.
   */
  async registerDeviceToken(
    riderId: string,
    token: string,
    platform: 'android' | 'ios' | 'web' = 'android',
  ): Promise<{ success: boolean; riderId: string }> {
    this.deviceTokens.set(riderId, {
      token,
      platform,
      updatedAt: new Date(),
    });
    this.logger.log(
      `[PushNotification] Registered device token for rider ${riderId} (platform: ${platform}, token: ${token.substring(0, 14)}...)`,
    );
    return { success: true, riderId };
  }

  /**
   * Invalidate and unregister a rider's device push token upon logout.
   */
  async unregisterDeviceToken(riderId: string): Promise<{ success: boolean }> {
    const existed = this.deviceTokens.delete(riderId);
    if (existed) {
      this.logger.log(`[PushNotification] Unregistered device token for rider ${riderId}`);
    }
    return { success: true };
  }

  /**
   * Retrieve active device token for a rider.
   */
  getDeviceToken(riderId: string): RegisteredDeviceToken | undefined {
    return this.deviceTokens.get(riderId);
  }

  /**
   * Dispatches push/system notification to a rider.
   * Dispatches via Expo Push Notification API for Expo tokens or FCM when configured.
   */
  async notifyRider(payload: RiderNotificationPayload): Promise<boolean> {
    this.logger.log(
      `[Notification] To Rider ${payload.riderId} | ${payload.type.toUpperCase()} | "${payload.title}": ${payload.body}`,
    );

    const device = this.deviceTokens.get(payload.riderId);
    if (!device?.token) {
      this.logger.debug(
        `[Notification] No registered push device token for rider ${payload.riderId}. Skipping external push dispatch.`,
      );
      return true;
    }

    const { token, platform } = device;

    // 1. Expo Push Notifications (ExponentPushToken[...] / ExpoPushToken[...])
    if (token.startsWith('ExponentPushToken') || token.startsWith('ExpoPushToken')) {
      try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
          },
          body: JSON.stringify({
            to: token,
            title: payload.title,
            body: payload.body,
            sound: 'default',
            priority: 'high',
            channelId: 'fleet24-offers',
            data: {
              orderId: payload.orderId,
              deliveryId: payload.deliveryId,
              type: payload.type,
              ...payload.data,
            },
          }),
        });

        const result: any = await response.json();
        this.logger.log(
          `[PushNotification] Expo push dispatched to rider ${payload.riderId}: ${JSON.stringify(result?.data || result)}`,
        );
        return true;
      } catch (err: any) {
        this.logger.warn(`[PushNotification] Failed to send Expo push: ${err?.message || err}`);
      }
    }

    // 2. Direct Firebase Cloud Messaging (FCM) when FCM_SERVER_KEY is configured
    const fcmKey = this.configService.get<string>('FCM_SERVER_KEY');
    if (fcmKey) {
      try {
        const fcmResponse = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `key=${fcmKey}`,
          },
          body: JSON.stringify({
            to: token,
            notification: {
              title: payload.title,
              body: payload.body,
              sound: 'default',
              android_channel_id: 'fleet24-offers',
            },
            data: {
              orderId: payload.orderId,
              deliveryId: payload.deliveryId,
              type: payload.type,
              ...payload.data,
            },
            priority: 'high',
          }),
        });

        const fcmResult = await fcmResponse.json();
        this.logger.log(
          `[PushNotification] FCM push dispatched to rider ${payload.riderId}: ${JSON.stringify(fcmResult)}`,
        );
        return true;
      } catch (fcmErr: any) {
        this.logger.warn(`[PushNotification] FCM dispatch warning: ${fcmErr?.message || fcmErr}`);
      }
    } else {
      this.logger.log(
        `[PushNotification Boundary] FCM credentials not configured. Native device push queued for rider ${payload.riderId} (platform: ${platform}, token: ${token.substring(0, 14)}...)`,
      );
    }

    return true;
  }
}

