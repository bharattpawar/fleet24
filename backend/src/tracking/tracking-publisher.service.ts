import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { TrackingGateway } from './tracking.gateway';
import {
  DeliveryLocationPayload,
  DeliveryRiderAssignedPayload,
  DeliveryStatusUpdatedPayload,
  DeliveryCompletedPayload,
  DeliveryCancelledPayload,
} from './tracking.constants';

@Injectable()
export class TrackingPublisherService {
  private readonly logger = new Logger(TrackingPublisherService.name);

  constructor(
    @Inject(forwardRef(() => TrackingGateway))
    private readonly trackingGateway: TrackingGateway,
  ) {}

  /**
   * Publish rider location update to subscribers of the specific active order delivery.
   */
  publishLocationUpdate(payload: DeliveryLocationPayload): boolean {
    return this.trackingGateway.broadcastLocationUpdate(payload);
  }

  /**
   * Publish rider assignment event.
   */
  publishRiderAssigned(payload: DeliveryRiderAssignedPayload) {
    this.logger.log(`Publishing rider assigned event for order ${payload.orderId}`);
    this.trackingGateway.broadcastRiderAssigned(payload);
  }

  /**
   * Publish delivery lifecycle status update.
   */
  publishStatusUpdated(payload: DeliveryStatusUpdatedPayload) {
    this.logger.log(
      `Publishing delivery status updated for order ${payload.orderId}: ${payload.status}`,
    );
    this.trackingGateway.broadcastStatusUpdated(payload);
  }

  /**
   * Publish delivery completion event.
   */
  publishDeliveryCompleted(payload: DeliveryCompletedPayload) {
    this.logger.log(`Publishing delivery completed event for order ${payload.orderId}`);
    this.trackingGateway.broadcastCompleted(payload);
  }

  /**
   * Publish delivery cancellation event.
   */
  publishDeliveryCancelled(payload: DeliveryCancelledPayload) {
    this.logger.log(`Publishing delivery cancelled event for order ${payload.orderId}`);
    this.trackingGateway.broadcastCancelled(payload);
  }
}

