import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
} from '@nestjs/common';
import { RiderAssignmentService } from './rider-assignment.service';
import { NotificationService } from './notification.service';
import { TrackingPublisherService } from '../tracking/tracking-publisher.service';
import { DRIZZLE_CONNECTION } from '../database/database.constants';

describe('RiderAssignmentService', () => {
  let service: RiderAssignmentService;
  let mockDb: any;
  let mockNotificationService: any;

  // Pari Chowk, Greater Noida
  const outletLat = 28.4682;
  const outletLon = 77.5117;

  // Mock Rider A: 1.2 km away
  const mockRiderA = {
    riderId: 'rider-uuid-a',
    userId: 'user-uuid-a',
    fullName: 'Rider Alpha',
    verificationStatus: 'approved',
    availabilityStatus: 'available',
    suspensionReason: null,
    currentActiveOrdersCount: 0,
    maxActiveOrders: 2,
    latitude: '28.4750000',
    longitude: '77.5150000',
    capturedAt: new Date(),
    updatedAt: new Date(),
  };

  // Mock Rider B: 2.1 km away
  const mockRiderB = {
    riderId: 'rider-uuid-b',
    userId: 'user-uuid-b',
    fullName: 'Rider Beta',
    verificationStatus: 'approved',
    availabilityStatus: 'available',
    suspensionReason: null,
    currentActiveOrdersCount: 0,
    maxActiveOrders: 2,
    latitude: '28.4744000',
    longitude: '77.4912000',
    capturedAt: new Date(),
    updatedAt: new Date(),
  };

  // Mock Rider C: 4.5 km away (outside 3 KM)
  const mockRiderC = {
    riderId: 'rider-uuid-c',
    userId: 'user-uuid-c',
    fullName: 'Rider Gamma',
    verificationStatus: 'approved',
    availabilityStatus: 'available',
    suspensionReason: null,
    currentActiveOrdersCount: 0,
    maxActiveOrders: 2,
    latitude: '28.4300000',
    longitude: '77.5400000',
    capturedAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockDb = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      transaction: jest.fn(async (callback) => callback(mockDb)),
    };

    mockNotificationService = {
      notifyRider: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiderAssignmentService,
        {
          provide: DRIZZLE_CONNECTION,
          useValue: mockDb,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
        {
          provide: TrackingPublisherService,
          useValue: {
            publishRiderAssigned: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RiderAssignmentService>(RiderAssignmentService);
  });

  describe('isLocationFresh', () => {
    it('returns true when updatedAt and capturedAt are within 300 seconds', () => {
      const freshDate = new Date(Date.now() - 30 * 1000);
      expect(service.isLocationFresh(freshDate, freshDate)).toBe(true);
    });

    it('returns false when updatedAt is null or older than 300 seconds', () => {
      expect(service.isLocationFresh(null, new Date())).toBe(false);
      const staleDate = new Date(Date.now() - 350 * 1000);
      expect(service.isLocationFresh(staleDate, new Date())).toBe(false);
    });

    it('returns false when capturedAt is older than 300 seconds even if updatedAt is recent', () => {
      const freshUpdate = new Date(Date.now() - 5 * 1000);
      const staleGps = new Date(Date.now() - 400 * 1000);
      expect(service.isLocationFresh(freshUpdate, staleGps)).toBe(false);
    });
  });

  describe('findBestCandidateRider', () => {
    it('selects nearest eligible rider when multiple riders are available within 3 KM', async () => {
      // Mock db.select for rawRiders and then activeOffers
      mockDb.select
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValueOnce({
            innerJoin: jest.fn().mockReturnValueOnce({
              where: jest.fn().mockResolvedValueOnce([mockRiderB, mockRiderA]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValueOnce({
            where: jest.fn().mockReturnValueOnce({
              groupBy: jest.fn().mockResolvedValueOnce([]), // no pending offers
            }),
          }),
        });

      const { bestCandidate, candidatesCount } = await service.findBestCandidateRider(
        outletLat,
        outletLon,
        mockDb,
      );

      expect(candidatesCount).toBe(2);
      expect(bestCandidate).toBeDefined();
      expect(bestCandidate?.riderId).toBe('rider-uuid-a'); // Rider A is closer than Rider B
      expect(bestCandidate?.distanceMeters).toBeLessThan(1500);
    });

    it('rejects rider outside 3 KM threshold', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValueOnce({
            innerJoin: jest.fn().mockReturnValueOnce({
              where: jest.fn().mockResolvedValueOnce([mockRiderC]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValueOnce({
            where: jest.fn().mockReturnValueOnce({
              groupBy: jest.fn().mockResolvedValueOnce([]),
            }),
          }),
        });

      const { bestCandidate, candidatesCount } = await service.findBestCandidateRider(
        outletLat,
        outletLon,
        mockDb,
      );

      expect(candidatesCount).toBe(0);
      expect(bestCandidate).toBeNull();
    });

    it('rejects rider whose capacity is full due to active orders or pending offers', async () => {
      const fullRider = {
        ...mockRiderA,
        currentActiveOrdersCount: 2, // max is 2
        maxActiveOrders: 2,
      };

      mockDb.select
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValueOnce({
            innerJoin: jest.fn().mockReturnValueOnce({
              where: jest.fn().mockResolvedValueOnce([fullRider]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValueOnce({
            where: jest.fn().mockReturnValueOnce({
              groupBy: jest.fn().mockResolvedValueOnce([]),
            }),
          }),
        });

      const { bestCandidate, candidatesCount } = await service.findBestCandidateRider(
        outletLat,
        outletLon,
        mockDb,
      );

      expect(candidatesCount).toBe(0);
      expect(bestCandidate).toBeNull();
    });

    it('rejects rider whose capacity is reserved by an active pending offer', async () => {
      const availableRider = {
        ...mockRiderA,
        currentActiveOrdersCount: 1,
        maxActiveOrders: 2,
      };

      mockDb.select
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValueOnce({
            innerJoin: jest.fn().mockReturnValueOnce({
              where: jest.fn().mockResolvedValueOnce([availableRider]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValueOnce({
            where: jest.fn().mockReturnValueOnce({
              groupBy: jest.fn().mockResolvedValueOnce([
                { riderId: availableRider.riderId, count: 1 }, // 1 pending offer
              ]),
            }),
          }),
        });

      const { bestCandidate, candidatesCount } = await service.findBestCandidateRider(
        outletLat,
        outletLon,
        mockDb,
      );

      // totalCommitted = 1 + 1 = 2 (max 2) => No remaining capacity
      expect(candidatesCount).toBe(0);
      expect(bestCandidate).toBeNull();
    });

    it('rejects rider with stale location (> 300s)', async () => {
      const staleRider = {
        ...mockRiderA,
        updatedAt: new Date(Date.now() - 400 * 1000),
      };

      mockDb.select
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValueOnce({
            innerJoin: jest.fn().mockReturnValueOnce({
              where: jest.fn().mockResolvedValueOnce([staleRider]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValueOnce({
            where: jest.fn().mockReturnValueOnce({
              groupBy: jest.fn().mockResolvedValueOnce([]),
            }),
          }),
        });

      const { bestCandidate, candidatesCount } = await service.findBestCandidateRider(
        outletLat,
        outletLon,
        mockDb,
      );

      expect(candidatesCount).toBe(0);
      expect(bestCandidate).toBeNull();
    });
  });

  describe('assignOrder', () => {
    const validOrder = {
      id: 'order-uuid-1',
      orderNumber: 'FL-20261030-1001',
      status: 'confirmed',
      outletId: 'outlet-uuid-1',
      deliveryLatitude: '28.4720000',
      deliveryLongitude: '77.5150000',
    };

    const validOutlet = {
      id: 'outlet-uuid-1',
      name: 'Burger Club Pari Chowk',
      latitude: '28.4682000',
      longitude: '77.5117000',
    };

    it('throws BadRequestException for unpaid order', async () => {
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            for: jest.fn().mockResolvedValueOnce([{ ...validOrder, status: 'pending_payment' }]),
          }),
        }),
      });

      await expect(service.assignOrder(validOrder.id)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for cancelled or rejected order', async () => {
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            for: jest.fn().mockResolvedValueOnce([{ ...validOrder, status: 'cancelled' }]),
          }),
        }),
      });

      await expect(service.assignOrder(validOrder.id)).rejects.toThrow(BadRequestException);
    });

    it('prevents duplicate assignment if order already has an active pending offer', async () => {
      const activeDelivery = {
        id: 'delivery-uuid-1',
        orderId: validOrder.id,
        riderId: 'rider-uuid-a',
        status: 'assigned',
        distanceMeters: '1100.50',
        offerExpiresAt: new Date(Date.now() + 45 * 1000), // unexpired offer
      };

      mockDb.select
        // 1. Order query
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValueOnce({
            where: jest.fn().mockReturnValueOnce({
              for: jest.fn().mockResolvedValueOnce([validOrder]),
            }),
          }),
        })
        // 2. Deliveries query
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValueOnce({
            where: jest.fn().mockReturnValueOnce({
              for: jest.fn().mockResolvedValueOnce([activeDelivery]),
            }),
          }),
        });

      const res = await service.assignOrder(validOrder.id);

      expect(res.assigned).toBe(true);
      expect(res.riderId).toBe('rider-uuid-a');
      expect(res.message).toBe('Order already has an active assignment');
    });

    it('records unassigned status and failure reason when no eligible rider is available', async () => {
      mockDb.select
        // 1. Order query
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValueOnce({
            where: jest.fn().mockReturnValueOnce({
              for: jest.fn().mockResolvedValueOnce([validOrder]),
            }),
          }),
        })
        // 2. Deliveries query (none)
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValueOnce({
            where: jest.fn().mockReturnValueOnce({
              for: jest.fn().mockResolvedValueOnce([]),
            }),
          }),
        })
        // 3. Outlet query
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValueOnce({
            where: jest.fn().mockResolvedValueOnce([validOutlet]),
          }),
        })
        // 4. Past attempts query (empty)
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValueOnce({
            where: jest.fn().mockResolvedValueOnce([]),
          }),
        })
        // 5. Candidate riders query (empty)
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValueOnce({
            innerJoin: jest.fn().mockReturnValueOnce({
              where: jest.fn().mockResolvedValueOnce([]),
            }),
          }),
        });

      mockDb.insert.mockReturnValueOnce({
        values: jest.fn().mockResolvedValueOnce([{}]),
      });

      const res = await service.assignOrder(validOrder.id);

      expect(res.assigned).toBe(false);
      expect(res.status).toBe('unassigned');
      expect(res.candidatesCount).toBe(0);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('successfully assigns order to nearest eligible rider and creates delivery offer', async () => {
      mockDb.select
        // 1. Order query
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValueOnce({
            where: jest.fn().mockReturnValueOnce({
              for: jest.fn().mockResolvedValueOnce([validOrder]),
            }),
          }),
        })
        // 2. Deliveries query (none)
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValueOnce({
            where: jest.fn().mockReturnValueOnce({
              for: jest.fn().mockResolvedValueOnce([]),
            }),
          }),
        })
        // 3. Outlet query
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValueOnce({
            where: jest.fn().mockResolvedValueOnce([validOutlet]),
          }),
        })
        // 4. Past attempts query (empty)
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValueOnce({
            where: jest.fn().mockResolvedValueOnce([]),
          }),
        })
        // 5. Candidate riders query
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValueOnce({
            innerJoin: jest.fn().mockReturnValueOnce({
              where: jest.fn().mockResolvedValueOnce([mockRiderA]),
            }),
          }),
        })
        // 6. Active offers query (empty)
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValueOnce({
            where: jest.fn().mockReturnValueOnce({
              groupBy: jest.fn().mockResolvedValueOnce([]),
            }),
          }),
        });

      const mockCreatedDelivery = {
        id: 'delivery-uuid-new',
        orderId: validOrder.id,
        riderId: mockRiderA.riderId,
        status: 'assigned',
        distanceMeters: '1150.00',
        offerExpiresAt: new Date(Date.now() + 60 * 1000),
      };

      mockDb.insert
        .mockReturnValueOnce({
          values: jest.fn().mockReturnValueOnce({
            returning: jest.fn().mockResolvedValueOnce([mockCreatedDelivery]),
          }),
        })
        .mockReturnValueOnce({
          values: jest.fn().mockResolvedValueOnce([{}]),
        });

      // 7. Order items for the real-time offer
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockResolvedValueOnce([{ name: 'Paneer Thali', quantity: 1 }]),
        }),
      });

      // Offer earning comes from admin Financial Settings, not a fixed amount
      const estimateRiderEarning = jest.fn().mockResolvedValue('52.50');
      (service as any).financialSettingsService = {
        getActiveSettings: jest.fn().mockRejectedValue(new Error('use default radius')),
        estimateRiderEarning,
      };
      const publishOfferCreated = jest.fn();
      (service as any).trackingPublisher.publishOfferCreated = publishOfferCreated;

      const res = await service.assignOrder(validOrder.id);

      expect(res.assigned).toBe(true);
      expect(res.riderId).toBe(mockRiderA.riderId);
      expect(res.status).toBe('assigned');
      expect(res.distanceMeters).toBe(1150);
      expect(res.offerExpiresAt).toBeDefined();
      expect(estimateRiderEarning).toHaveBeenCalledWith(
        expect.objectContaining({ distanceMeters: expect.any(Number) }),
      );
      expect(publishOfferCreated).toHaveBeenCalledWith(
        mockRiderA.riderId,
        expect.objectContaining({ estimatedEarnings: '52.50' }),
      );
    });
  });
});

