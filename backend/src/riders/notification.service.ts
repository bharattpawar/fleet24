import { Injectable, Logger } from '@nestjs/common';

export interface RiderNotificationPayload {
  riderId: string;
  orderId: string;
  deliveryId: string;
  type: 'offer_created' | 'offer_expired' | 'offer_cancelled' | 'delivery_assigned';
  title: string;
  body: string;
  data?: Record<string, any>;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  /**
   * Dispatches push/system notification to a rider.
   * If FCM/APNS or SMS provider is not yet configured, cleanly logs the dispatch intent
   * and provides a clean boundary for production push credentials.
   */
  async notifyRider(payload: RiderNotificationPayload): Promise<boolean> {
    this.logger.log(
      `[Notification] To Rider ${payload.riderId} | ${payload.type.toUpperCase()} | "${payload.title}": ${payload.body}`,
    );

    // Clean boundary: when FCM_SERVER_KEY / WEB_PUSH is configured, send external push here.
    return true;
  }
}

