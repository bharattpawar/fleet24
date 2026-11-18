import { Test, TestingModule } from '@nestjs/testing';
import { FinancialSettingsService } from './financial-settings.service';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import { BadRequestException } from '@nestjs/common';
import { FinancialSettingsPayload } from '../database/schema/financial-settings';

describe('FinancialSettingsService', () => {
  let service: FinancialSettingsService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialSettingsService,
        {
          provide: DRIZZLE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<FinancialSettingsService>(FinancialSettingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getActiveSettings', () => {
    it('should return default settings if no versions exist in DB', async () => {
      // scheduled check returns none
      mockDb.select
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              orderBy: jest.fn().mockResolvedValue([]),
            }),
          }),
        })
        // pointer check returns none
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([]),
          }),
        })
        // direct active check returns none
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              orderBy: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue([]),
              }),
            }),
          }),
        });

      const res = await service.getActiveSettings();
      expect(res.versionId).toBe('default-v0');
      expect(res.versionNumber).toBe(0);
      expect(res.settings.riderEarnings.baseEarning).toBe(30);
      expect(res.settings.restaurantCommission.commissionPercentage).toBe(0);
      expect(res.settings.customerDeliveryFee.freeOrderThresholdCount).toBe(3);
    });
  });

  describe('estimateRiderEarning (offer amount)', () => {
    it('uses the active settings, the same formula as the payout', async () => {
      const settings = {
        ...FinancialSettingsService.DEFAULT_SETTINGS,
        riderEarnings: { calculationStrategy: 'base_plus_distance' as const, baseEarning: 20, additionalPerKmRate: 10 },
      };
      jest.spyOn(service, 'getActiveSettings').mockResolvedValue({ settings } as any);
      await expect(service.estimateRiderEarning({ distanceMeters: 2500 })).resolves.toBe(
        service.calculateRiderEarning({ settings, distanceMeters: 2500 }).finalEarning.toFixed(2),
      );
    });

    it('falls back to the default settings, never a fixed amount', async () => {
      jest.spyOn(service, 'getActiveSettings').mockRejectedValue(new Error('db down'));
      await expect(service.estimateRiderEarning({ distanceMeters: 1000 })).resolves.toBe(
        service
          .calculateRiderEarning({ settings: FinancialSettingsService.DEFAULT_SETTINGS, distanceMeters: 1000 })
          .finalEarning.toFixed(2),
      );
    });
  });

  describe('Rider Earning Calculations', () => {
    it('fixed_per_delivery strategy computes base earning regardless of distance', () => {
      const settings: FinancialSettingsPayload = {
        ...FinancialSettingsService.DEFAULT_SETTINGS,
        riderEarnings: {
          calculationStrategy: 'fixed_per_delivery',
          baseEarning: 35.0,
        },
      };

      const result = service.calculateRiderEarning({
        settings,
        distanceMeters: 5000, // 5 km
      });

      expect(result.finalEarning).toBe(35.0);
      expect(result.baseFare).toBe(35.0);
      expect(result.distanceEarning).toBe(0.0);
    });

    it('base_plus_distance strategy computes base + (km * rate)', () => {
      const settings: FinancialSettingsPayload = {
        ...FinancialSettingsService.DEFAULT_SETTINGS,
        riderEarnings: {
          calculationStrategy: 'base_plus_distance',
          baseEarning: 20.0,
          additionalPerKmRate: 6.0,
        },
      };

      const result = service.calculateRiderEarning({
        settings,
        distanceMeters: 4000, // 4 km
      });

      // 20 + (4 * 6) = 44
      expect(result.finalEarning).toBe(44.0);
      expect(result.baseFare).toBe(20.0);
      expect(result.distanceEarning).toBe(24.0);
    });

    it('distance_slabs strategy matches correct tier', () => {
      const settings: FinancialSettingsPayload = {
        ...FinancialSettingsService.DEFAULT_SETTINGS,
        riderEarnings: {
          calculationStrategy: 'distance_slabs',
          baseEarning: 15.0,
          distanceSlabs: [
            { upToKm: 2, rate: 10.0 },
            { upToKm: 5, rate: 25.0 },
            { upToKm: 10, rate: 50.0 },
          ],
        },
      };

      // 3.5 km falls into <= 5 km slab (rate 25)
      const res = service.calculateRiderEarning({
        settings,
        distanceMeters: 3500,
      });

      // base 15 + slab 25 = 40
      expect(res.distanceEarning).toBe(25.0);
      expect(res.finalEarning).toBe(40.0);
    });

    it('applies min and max delivery earning limits correctly', () => {
      const settings: FinancialSettingsPayload = {
        ...FinancialSettingsService.DEFAULT_SETTINGS,
        riderEarnings: {
          calculationStrategy: 'base_plus_distance',
          baseEarning: 10.0,
          additionalPerKmRate: 2.0,
          minDeliveryEarning: 25.0,
          maxDeliveryEarning: 50.0,
        },
      };

      // 1 km = 10 + 2 = 12 -> clamped to min 25
      const lowResult = service.calculateRiderEarning({
        settings,
        distanceMeters: 1000,
      });
      expect(lowResult.finalEarning).toBe(25.0);

      // 30 km = 10 + 60 = 70 -> clamped to max 50
      const highResult = service.calculateRiderEarning({
        settings,
        distanceMeters: 30000,
      });
      expect(highResult.finalEarning).toBe(50.0);
    });
  });

  describe('Restaurant Commission Calculations', () => {
    it('defaults to 0% commission baseline', () => {
      const settings: FinancialSettingsPayload = FinancialSettingsService.DEFAULT_SETTINGS;

      const res = service.calculateRestaurantCommission({
        settings,
        itemTotal: 650.0,
      });

      expect(res.commissionPercentage).toBe(0);
      expect(res.totalCommission).toBe(0.0);
    });

    it('calculates commission on configured item_total basis', () => {
      const settings: FinancialSettingsPayload = {
        ...FinancialSettingsService.DEFAULT_SETTINGS,
        restaurantCommission: {
          commissionPercentage: 10.0,
          fixedCommissionPerOrder: 5.0,
          commissionBasis: 'item_total',
        },
      };

      const res = service.calculateRestaurantCommission({
        settings,
        itemTotal: 400.0,
      });

      // 10% of 400 = 40 + fixed 5 = 45
      expect(res.commissionAmount).toBe(40.0);
      expect(res.fixedCommission).toBe(5.0);
      expect(res.totalCommission).toBe(45.0);
    });

    it('calculates commission on item_total_minus_discounts basis', () => {
      const settings: FinancialSettingsPayload = {
        ...FinancialSettingsService.DEFAULT_SETTINGS,
        restaurantCommission: {
          commissionPercentage: 10.0,
          commissionBasis: 'item_total_minus_discounts',
        },
      };

      const res = service.calculateRestaurantCommission({
        settings,
        itemTotal: 500.0,
        discountAmount: 100.0,
      });

      // 10% of (500 - 100) = 40.0
      expect(res.commissionBasisAmount).toBe(400.0);
      expect(res.totalCommission).toBe(40.0);
    });
  });

  describe('Customer Delivery Fee Calculations', () => {
    it('grants free delivery for initial 3 eligible orders', () => {
      const settings = FinancialSettingsService.DEFAULT_SETTINGS;

      // Order 1 (0 prior)
      const res0 = service.calculateCustomerDeliveryFee({
        settings,
        priorEligibleOrdersCount: 0,
      });
      expect(res0.isFreeDelivery).toBe(true);
      expect(res0.deliveryFee).toBe(0.0);

      // Order 3 (2 prior)
      const res2 = service.calculateCustomerDeliveryFee({
        settings,
        priorEligibleOrdersCount: 2,
      });
      expect(res2.isFreeDelivery).toBe(true);
      expect(res2.deliveryFee).toBe(0.0);

      // Order 4 (3 prior) -> Exhausted
      const res3 = service.calculateCustomerDeliveryFee({
        settings,
        priorEligibleOrdersCount: 3,
      });
      expect(res3.isFreeDelivery).toBe(false);
      expect(res3.deliveryFee).toBe(30.0);
    });
  });

  describe('Simulation Preview (Non-mutating)', () => {
    it('simulates rider, restaurant and customer calculations without database writes', async () => {
      const preview = await service.previewSettings({
        proposedSettings: {
          ...FinancialSettingsService.DEFAULT_SETTINGS,
          riderEarnings: {
            calculationStrategy: 'base_plus_distance',
            baseEarning: 20.0,
            additionalPerKmRate: 5.0,
          },
          restaurantCommission: {
            commissionPercentage: 12.0,
            commissionBasis: 'item_total',
          },
        },
        riderSample: {
          distanceKm: 4,
        },
        restaurantSample: {
          itemTotal: 300,
        },
        customerSample: {
          customerPriorCompletedOrdersCount: 4,
        },
      });

      expect(preview.riderCalculation?.finalEarning).toBe(40.0); // 20 + (4 * 5)
      expect(preview.restaurantCalculation?.totalCommission).toBe(36.0); // 12% of 300
      expect(preview.customerCalculation?.isFreeDelivery).toBe(false);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe('createDraftSettings and publishSettings', () => {
    it('creates draft version with auto-incremented version number and audit log', async () => {
      const draftResult = {
        id: 'draft-uuid-3',
        versionNumber: 3,
        status: 'draft',
      };

      mockDb.transaction.mockImplementation(async (cb: any) => {
        const tx = {
          execute: jest.fn().mockResolvedValue([]),
          select: jest.fn().mockReturnValue({
            from: jest.fn().mockResolvedValue([{ maxVersion: 2 }]),
          }),
          insert: jest
            .fn()
            .mockReturnValueOnce({
              values: jest.fn().mockReturnValue({
                returning: jest.fn().mockResolvedValue([draftResult]),
              }),
            })
            .mockReturnValueOnce({
              values: jest.fn().mockResolvedValue([]),
            }),
        };
        return cb(tx);
      });

      const res = await service.createDraftSettings('admin-1', {
        settingsPayload: FinancialSettingsService.DEFAULT_SETTINGS,
        changeReason: 'Updated festival pricing',
      });

      expect(res.versionNumber).toBe(3);
      expect(res.status).toBe('draft');
    });

    it('prevents publishing non-draft versions', async () => {
      mockDb.transaction.mockImplementation(async (cb: any) => {
        const tx = {
          select: jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue({
                for: jest.fn().mockResolvedValue([
                  { id: 'v-1', status: 'active' },
                ]),
              }),
            }),
          }),
        };
        return cb(tx);
      });

      await expect(
        service.publishSettings('admin-1', 'v-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

