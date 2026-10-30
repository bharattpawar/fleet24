import { Test, TestingModule } from '@nestjs/testing';
import { OfferExpirationWorker } from './offer-expiration.worker';
import { RiderAssignmentService } from './rider-assignment.service';
import { NotificationService } from './notification.service';
import { DRIZZLE_CONNECTION } from '../database/database.constants';

describe('OfferExpirationWorker', () => {
  let worker: OfferExpirationWorker;
  let mockDb: any;
  let mockRiderAssignmentService: any;
  let mockNotificationService: any;

  beforeEach(async () => {
    mockDb = {
      select: jest.fn(),
      update: jest.fn(),
      transaction: jest.fn(async (cb) => cb(mockDb)),
    };

    mockRiderAssignmentService = {
      assignOrder: jest.fn().mockResolvedValue({ assigned: true }),
    };

    mockNotificationService = {
      notifyRider: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OfferExpirationWorker,
        { provide: DRIZZLE_CONNECTION, useValue: mockDb },
        { provide: RiderAssignmentService, useValue: mockRiderAssignmentService },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    worker = module.get<OfferExpirationWorker>(OfferExpirationWorker);
  });

  it('scans expired offers, updates attempt to expired, releases rider, and triggers reassignment', async () => {
    const expiredDelivery = {
      id: 'delivery-uuid-1',
      orderId: 'order-uuid-1',
      riderId: 'rider-uuid-1',
      status: 'assigned',
      offerExpiresAt: new Date(Date.now() - 30 * 1000),
    };

    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValueOnce({
        where: jest.fn().mockReturnValueOnce({
          for: jest.fn().mockReturnValueOnce({
            limit: jest.fn().mockResolvedValueOnce([expiredDelivery]),
          }),
        }),
      }),
    });

    mockDb.update
      // 1. Update attempt
      .mockReturnValueOnce({
        set: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockResolvedValueOnce([{}]),
        }),
      })
      // 2. Reset delivery
      .mockReturnValueOnce({
        set: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockResolvedValueOnce([{}]),
        }),
      });

    const count = await worker.processExpiredOffers();

    expect(count).toBe(1);
    expect(mockNotificationService.notifyRider).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'offer_expired',
        riderId: 'rider-uuid-1',
      }),
    );
    expect(mockRiderAssignmentService.assignOrder).toHaveBeenCalledWith('order-uuid-1');
  });

  it('returns 0 when no expired offers exist', async () => {
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValueOnce({
        where: jest.fn().mockReturnValueOnce({
          for: jest.fn().mockReturnValueOnce({
            limit: jest.fn().mockResolvedValueOnce([]),
          }),
        }),
      }),
    });

    const count = await worker.processExpiredOffers();
    expect(count).toBe(0);
    expect(mockRiderAssignmentService.assignOrder).not.toHaveBeenCalled();
  });
});

