import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ForbiddenException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { RiderOffersService } from './rider-offers.service';
import { RiderAssignmentService } from './rider-assignment.service';
import { NotificationService } from './notification.service';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import { DeliveryOtpUtil } from '../common/utils/delivery-otp.util';
import { TrackingPublisherService } from '../tracking/tracking-publisher.service';
import { AdminFinanceService } from '../admin/admin-finance.service';
import { FinancialSettingsService } from '../admin/financial-settings.service';
import { RidersService } from './riders.service';

describe('RiderOffersService', () => {
  let service: RiderOffersService;
  let mockDb: any;
  let mockRiderAssignmentService: any;
  let mockNotificationService: any;
  let mockConfigService: any;

  const mockRider = {
    id: 'rider-uuid-1',
    userId: 'user-uuid-1',
    fullName: 'Ravi Rider',
    verificationStatus: 'approved',
    availabilityStatus: 'available',
    isOnline: true,
    currentActiveOrdersCount: 1,
    maxActiveOrders: 2,
  };

  const mockDelivery = {
    id: 'delivery-uuid-1',
    orderId: 'order-uuid-1',
    riderId: 'rider-uuid-1',
    status: 'assigned',
    distanceMeters: '1200.00',
    offerExpiresAt: new Date(Date.now() + 50 * 1000), // unexpired
  };

  beforeEach(async () => {
    mockDb = {
      query: {
        riders: {
          findFirst: jest.fn().mockResolvedValue(mockRider),
        },
        deliveries: {
          findMany: jest.fn(),
          findFirst: jest.fn(),
        },
        orders: {
          findFirst: jest.fn(),
        },
        riderLocations: {
          findFirst: jest.fn(),
        },
      },
      select: jest.fn(),
      update: jest.fn(),
      insert: jest.fn(),
      transaction: jest.fn(async (callback) => callback(mockDb)),
    };

    mockRiderAssignmentService = {
      assignOrder: jest.fn().mockResolvedValue({ assigned: true }),
    };

    mockNotificationService = {
      notifyRider: jest.fn().mockResolvedValue(true),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue('mock-delivery-otp-secret'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiderOffersService,
        {
          provide: DRIZZLE_CONNECTION,
          useValue: mockDb,
        },
        {
          provide: RiderAssignmentService,
          useValue: mockRiderAssignmentService,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: TrackingPublisherService,
          useValue: {
            publishStatusUpdated: jest.fn(),
            publishDeliveryCompleted: jest.fn(),
            publishDeliveryCancelled: jest.fn(),
          },
        },
        {
          provide: RidersService,
          useValue: {
            calculateLocationFreshness: jest.fn().mockReturnValue({ freshness: 'fresh', ageSeconds: 15 }),
          },
        },
        {
          provide: AdminFinanceService,
          useValue: {
            recordDeliveryEarning: jest.fn().mockResolvedValue({ id: 'earning-1' }),
          },
        },
        {
          provide: FinancialSettingsService,
          useValue: {
            consumeRestaurantDeliveryCredit: jest.fn().mockResolvedValue({ usedCredits: 1 }),
          },
        },
      ],
    }).compile();

    service = module.get<RiderOffersService>(RiderOffersService);
  });

  describe('getPendingOffers', () => {
    it('returns active unexpired offers for the authenticated rider', async () => {
      mockDb.query.deliveries.findMany.mockResolvedValueOnce([
        {
          ...mockDelivery,
          order: {
            orderNumber: 'FL-20261030-999',
            itemTotal: '450.00',
            totalPayable: '500.00',
            deliveryAddressSnapshot: {
              label: 'Home',
              city: 'Greater Noida',
              postalCode: '201310',
            },
            outlet: {
              name: 'Burger Point',
              address: 'Commercial Belt, Alpha 1',
              phone: '+919999888877',
            },
          },
        },
      ]);

      const offers = await service.getPendingOffers('user-uuid-1');

      expect(offers).toHaveLength(1);
      expect(offers[0].orderId).toBe('order-uuid-1');
      expect(offers[0].outletName).toBe('Burger Point');
      expect(offers[0].remainingSeconds).toBeGreaterThan(0);
      expect(offers[0].distanceMeters).toBe(1200);
    });
  });

  describe('acceptOffer', () => {
    it('successfully accepts offer, increments capacity, and updates status to accepted', async () => {
      mockDb.select
        // 1. Delivery lock
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValueOnce({
            where: jest.fn().mockReturnValueOnce({
              for: jest.fn().mockResolvedValueOnce([mockDelivery]),
            }),
          }),
        })
        // 2. Rider lock
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValueOnce({
            where: jest.fn().mockReturnValueOnce({
              for: jest.fn().mockResolvedValueOnce([mockRider]),
            }),
          }),
        });

      mockDb.update
        // 1. Rider capacity update
        .mockReturnValueOnce({
          set: jest.fn().mockReturnValueOnce({
            where: jest.fn().mockResolvedValueOnce([{}]),
          }),
        })
        // 2. Delivery status update
        .mockReturnValueOnce({
          set: jest.fn().mockReturnValueOnce({
            where: jest.fn().mockReturnValueOnce({
              returning: jest.fn().mockResolvedValueOnce([{ ...mockDelivery, status: 'accepted' }]),
            }),
          }),
        })
        // 3. Assignment attempt update
        .mockReturnValueOnce({
          set: jest.fn().mockReturnValueOnce({
            where: jest.fn().mockResolvedValueOnce([{}]),
          }),
        });

      const res = await service.acceptOffer('user-uuid-1', 'order-uuid-1');

      expect(res.status).toBe('accepted');
      expect(mockDb.update).toHaveBeenCalledTimes(3);
    });

    it('returns idempotently if delivery is already accepted by this rider', async () => {
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            for: jest.fn().mockResolvedValueOnce([{ ...mockDelivery, status: 'accepted' }]),
          }),
        }),
      });

      const res = await service.acceptOffer('user-uuid-1', 'order-uuid-1');

      expect(res.status).toBe('accepted');
      expect(res.message).toContain('already accepted');
    });

    it('throws ForbiddenException if offer belongs to a different rider', async () => {
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            for: jest.fn().mockResolvedValueOnce([{ ...mockDelivery, riderId: 'other-rider-uuid' }]),
          }),
        }),
      });

      await expect(service.acceptOffer('user-uuid-1', 'order-uuid-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException if offer has expired', async () => {
      const expiredDelivery = {
        ...mockDelivery,
        offerExpiresAt: new Date(Date.now() - 10 * 1000), // 10s ago
      };

      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            for: jest.fn().mockResolvedValueOnce([expiredDelivery]),
          }),
        }),
      });

      await expect(service.acceptOffer('user-uuid-1', 'order-uuid-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ConflictException if rider has no remaining active capacity', async () => {
      const fullRider = {
        ...mockRider,
        currentActiveOrdersCount: 2,
        maxActiveOrders: 2,
      };

      mockDb.select
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValueOnce({
            where: jest.fn().mockReturnValueOnce({
              for: jest.fn().mockResolvedValueOnce([mockDelivery]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValueOnce({
            where: jest.fn().mockReturnValueOnce({
              for: jest.fn().mockResolvedValueOnce([fullRider]),
            }),
          }),
        });

      await expect(service.acceptOffer('user-uuid-1', 'order-uuid-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('rejectOffer', () => {
    it('successfully rejects offer, updates attempt record, releases reservation, and triggers reassignment', async () => {
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            for: jest.fn().mockResolvedValueOnce([mockDelivery]),
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

      const res = await service.rejectOffer('user-uuid-1', 'order-uuid-1', {
        reason: 'Vehicle flat tyre',
      });

      expect(res.status).toBe('rejected');
      expect(mockRiderAssignmentService.assignOrder).toHaveBeenCalledWith('order-uuid-1');
    });

    it('throws ForbiddenException if rejecting an offer belonging to another rider', async () => {
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            for: jest.fn().mockResolvedValueOnce([{ ...mockDelivery, riderId: 'other-rider' }]),
          }),
        }),
      });

      await expect(
        service.rejectOffer('user-uuid-1', 'order-uuid-1', { reason: 'Busy' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('State transitions: confirmArrival and confirmPickup', () => {
    it('transitions from accepted to at_restaurant upon arrival confirmation', async () => {
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            for: jest.fn().mockResolvedValueOnce([{ ...mockDelivery, status: 'accepted' }]),
          }),
        }),
      });

      mockDb.update.mockReturnValueOnce({
        set: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            returning: jest.fn().mockResolvedValueOnce([{ ...mockDelivery, status: 'at_restaurant' }]),
          }),
        }),
      });

      const res = await service.confirmArrival('user-uuid-1', 'order-uuid-1');
      expect(res.status).toBe('at_restaurant');
    });

    it('rejects confirmArrival if current delivery status is not accepted', async () => {
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            for: jest.fn().mockResolvedValueOnce([{ ...mockDelivery, status: 'assigned' }]),
          }),
        }),
      });

      await expect(service.confirmArrival('user-uuid-1', 'order-uuid-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('transitions from at_restaurant to picked_up and advances order to out_for_delivery', async () => {
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            for: jest.fn().mockResolvedValueOnce([{ ...mockDelivery, status: 'at_restaurant' }]),
          }),
        }),
      });

      mockDb.update
        // 1. Deliveries update
        .mockReturnValueOnce({
          set: jest.fn().mockReturnValueOnce({
            where: jest.fn().mockReturnValueOnce({
              returning: jest.fn().mockResolvedValueOnce([{ ...mockDelivery, status: 'picked_up' }]),
            }),
          }),
        })
        // 2. Orders update
        .mockReturnValueOnce({
          set: jest.fn().mockReturnValueOnce({
            where: jest.fn().mockResolvedValueOnce([{}]),
          }),
        });

      mockDb.insert.mockReturnValueOnce({
        values: jest.fn().mockResolvedValueOnce([{}]),
      });

      const res = await service.confirmPickup('user-uuid-1', 'order-uuid-1');
      expect(res.status).toBe('picked_up');
    });
  });

  describe('confirmArrivedCustomer', () => {
    it('transitions from picked_up to arrived_customer successfully', async () => {
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            for: jest.fn().mockResolvedValueOnce([{ ...mockDelivery, status: 'picked_up' }]),
          }),
        }),
      });

      mockDb.update.mockReturnValueOnce({
        set: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            returning: jest.fn().mockResolvedValueOnce([{
              ...mockDelivery,
              status: 'arrived_customer',
              arrivedCustomerAt: new Date(),
            }]),
          }),
        }),
      });

      const res = await service.confirmArrivedCustomer('user-uuid-1', 'order-uuid-1');
      expect(res.status).toBe('arrived_customer');
      expect(res.arrivedCustomerAt).toBeDefined();
    });

    it('returns idempotently if already arrived_customer', async () => {
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            for: jest.fn().mockResolvedValueOnce([{
              ...mockDelivery,
              status: 'arrived_customer',
              arrivedCustomerAt: new Date(),
            }]),
          }),
        }),
      });

      const res = await service.confirmArrivedCustomer('user-uuid-1', 'order-uuid-1');
      expect(res.status).toBe('arrived_customer');
    });

    it('rejects confirmArrivedCustomer if delivery status is not picked_up or arrived_customer', async () => {
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            for: jest.fn().mockResolvedValueOnce([{ ...mockDelivery, status: 'at_restaurant' }]),
          }),
        }),
      });

      await expect(service.confirmArrivedCustomer('user-uuid-1', 'order-uuid-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('completeDelivery', () => {
    const rawOtp = '654321';
    const validHash = DeliveryOtpUtil.hashOtp(rawOtp, 'mock-delivery-otp-secret', 'order-uuid-1');

    it('successfully completes delivery with valid OTP and releases rider capacity', async () => {
      // 1. Delivery select with row lock
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            for: jest.fn().mockResolvedValueOnce([{
              ...mockDelivery,
              status: 'arrived_customer',
              deliveryOtpHash: validHash,
              otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
              otpAttemptsCount: 0,
            }]),
          }),
        }),
      });

      // 2. Rider select for lock
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            for: jest.fn().mockResolvedValueOnce([mockRider]),
          }),
        }),
      });

      // 3. Rider update capacity
      mockDb.update.mockReturnValueOnce({
        set: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockResolvedValueOnce([{ ...mockRider, currentActiveOrdersCount: 0 }]),
        }),
      });

      // 4. Deliveries update (completed)
      mockDb.update.mockReturnValueOnce({
        set: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            returning: jest.fn().mockResolvedValueOnce([{
              ...mockDelivery,
              status: 'completed',
              completedAt: new Date(),
            }]),
          }),
        }),
      });

      // 5. Orders update (delivered)
      mockDb.update.mockReturnValueOnce({
        set: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockResolvedValueOnce([{ id: 'order-uuid-1' }]),
        }),
      });

      // 6. Order status history insert
      mockDb.insert.mockReturnValueOnce({
        values: jest.fn().mockResolvedValueOnce([{}]),
      });

      // 7. Order select for financial accounting
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockResolvedValueOnce([{
            orderNumber: 'FL-20261030-1001',
            outletId: 'outlet-uuid-1',
          }]),
        }),
      });

      // 8. Outlet select for restaurantId
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockResolvedValueOnce([{
            restaurantId: 'rest-uuid-1',
          }]),
        }),
      });

      const res = await service.completeDelivery('user-uuid-1', 'order-uuid-1', { otp: rawOtp });
      expect(res.status).toBe('completed');
      expect(mockDb.update).toHaveBeenCalledTimes(3);
    });

    it('is idempotent if delivery is already completed', async () => {
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            for: jest.fn().mockResolvedValueOnce([{
              ...mockDelivery,
              status: 'completed',
              completedAt: new Date(),
            }]),
          }),
        }),
      });

      const res = await service.completeDelivery('user-uuid-1', 'order-uuid-1', { otp: rawOtp });
      expect(res.status).toBe('completed');
    });

    it('rejects completion with BadRequestException if OTP has expired', async () => {
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            for: jest.fn().mockResolvedValueOnce([{
              ...mockDelivery,
              status: 'arrived_customer',
              deliveryOtpHash: validHash,
              otpExpiresAt: new Date(Date.now() - 5 * 1000), // expired
              otpAttemptsCount: 0,
            }]),
          }),
        }),
      });

      await expect(
        service.completeDelivery('user-uuid-1', 'order-uuid-1', { otp: rawOtp }),
      ).rejects.toThrow(BadRequestException);
    });

    it('increments attempts on invalid OTP and throws BadRequestException with remaining attempts', async () => {
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            for: jest.fn().mockResolvedValueOnce([{
              ...mockDelivery,
              status: 'arrived_customer',
              deliveryOtpHash: validHash,
              otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
              otpAttemptsCount: 1,
            }]),
          }),
        }),
      });

      mockDb.update.mockReturnValueOnce({
        set: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockResolvedValueOnce([{}]),
        }),
      });

      await expect(
        service.completeDelivery('user-uuid-1', 'order-uuid-1', { otp: '000000' }),
      ).rejects.toThrow(BadRequestException);

      expect(mockDb.update).toHaveBeenCalled();
    });

    it('throws ForbiddenException when maximum OTP attempts exceeded', async () => {
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            for: jest.fn().mockResolvedValueOnce([{
              ...mockDelivery,
              status: 'arrived_customer',
              deliveryOtpHash: validHash,
              otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
              otpAttemptsCount: 5,
            }]),
          }),
        }),
      });

      await expect(
        service.completeDelivery('user-uuid-1', 'order-uuid-1', { otp: rawOtp }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getDeliveryForCustomer', () => {
    it('returns delivery tracking and unhashed OTP when requested by order owner', async () => {
      mockDb.query.orders.findFirst.mockResolvedValueOnce({
        id: 'order-uuid-1',
        customerId: 'customer-user-uuid',
        orderNumber: 'ORD-1234',
        status: 'out_for_delivery',
        placedAt: new Date(),
        confirmedAt: new Date(),
        outlet: {
          name: 'Tasty Bites',
          address: '123 Food Street',
          phone: '+919999988888',
        },
        deliveryAddressSnapshot: { address: 'Flat 101' },
      });

      const plainOtp = '999888';
      const encKey = 'mock-delivery-otp-secret';
      const encryptedOtp = DeliveryOtpUtil.encryptOtp(plainOtp, encKey);

      mockDb.query.deliveries.findFirst.mockResolvedValueOnce({
        ...mockDelivery,
        status: 'picked_up',
        deliveryOtpHash: 'valid-hash',
        encryptedDeliveryOtp: encryptedOtp,
        otpExpiresAt: new Date(Date.now() + 1800 * 1000),
        rider: {
          id: 'rider-uuid-1',
          fullName: 'Ravi Rider',
          vehicleType: 'motorcycle',
          vehicleNumber: 'KA-01-AB-1234',
        },
      });

      const res = await service.getDeliveryForCustomer('customer-user-uuid', 'order-uuid-1');
      expect(res.orderId).toBe('order-uuid-1');
      expect(res.deliveryOtp).toBe('999888');
      expect(res.rider?.fullName).toBe('Ravi Rider');
    });

    it('throws NotFoundException if customer does not own the order or order does not exist', async () => {
      mockDb.query.orders.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.getDeliveryForCustomer('customer-user-uuid', 'order-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

