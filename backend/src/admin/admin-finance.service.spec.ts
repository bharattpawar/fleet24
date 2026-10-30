import { Test, TestingModule } from '@nestjs/testing';
import { AdminFinanceService } from './admin-finance.service';
import { FinancialSettingsService } from './financial-settings.service';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';

describe('AdminFinanceService', () => {
  let service: AdminFinanceService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      transaction: jest.fn(),
    };

    const mockSettingsService = {
      getActiveSettings: jest.fn().mockResolvedValue({
        versionId: 'test-v1',
        versionNumber: 1,
        settings: FinancialSettingsService.DEFAULT_SETTINGS,
      }),
      calculateRiderEarning: jest.fn().mockReturnValue({
        baseFare: 30,
        distanceUsedKm: 0,
        distanceEarning: 0,
        incentives: 0,
        finalEarning: 30,
        calculationBreakdown: {},
      }),
      calculateRestaurantCommission: jest.fn().mockReturnValue({
        commissionBasisAmount: 500,
        commissionPercentage: 0,
        commissionAmount: 0,
        fixedCommission: 0,
        totalCommission: 0,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminFinanceService,
        {
          provide: DRIZZLE_CONNECTION,
          useValue: mockDb,
        },
        {
          provide: FinancialSettingsService,
          useValue: mockSettingsService,
        },
      ],
    }).compile();

    service = module.get<AdminFinanceService>(AdminFinanceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordTransaction', () => {
    it('should return existing entry if idempotency key exists', async () => {
      const existing = {
        id: 'ledger-uuid-1',
        idempotencyKey: 'key_123',
        amount: '30.00',
      };

      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([existing]),
        }),
      });

      const res = await service.recordTransaction({
        transactionReference: 'REF1',
        entityType: 'rider',
        entityId: 'rider-1',
        entryType: 'rider_delivery_earning',
        direction: 'credit',
        amount: '30.00',
        idempotencyKey: 'key_123',
      });

      expect(res).toEqual(existing);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should insert and return new entry if idempotency key is novel', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      const created = {
        id: 'new-ledger-id',
        idempotencyKey: 'key_novel',
        amount: '30.00',
      };

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([created]),
        }),
      });

      const res = await service.recordTransaction({
        transactionReference: 'REF2',
        entityType: 'rider',
        entityId: 'rider-1',
        entryType: 'rider_delivery_earning',
        direction: 'credit',
        amount: '30.00',
        idempotencyKey: 'key_novel',
      });

      expect(res).toEqual(created);
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('getRiderEarningsSummary', () => {
    it('should throw NotFoundException if rider does not exist', async () => {
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      await expect(service.getRiderEarningsSummary('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should correctly calculate total earned, paid, reserved, and available balance', async () => {
      // 1. Rider exists
      mockDb.select
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([
              { id: 'rider-1', fullName: 'Rajesh Rider' },
            ]),
          }),
        })
        // 2. Credits sum
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([{ totalCredits: '500.00' }]),
          }),
        })
        // 3. Debits sum
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([{ totalDebits: '200.00' }]),
          }),
        })
        // 4. Reserved pending sum
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([{ reservedAmount: '100.00' }]),
          }),
        });

      const summary = await service.getRiderEarningsSummary('rider-1');

      expect(summary).toEqual({
        riderId: 'rider-1',
        riderName: 'Rajesh Rider',
        totalEarned: '500.00',
        totalWithdrawn: '200.00',
        reservedPending: '100.00',
        availableBalance: '200.00', // 500 - 200 - 100 = 200
        currency: 'INR',
      });
    });
  });

  describe('requestRiderPayout', () => {
    it('should reject non-positive amounts', async () => {
      await expect(
        service.requestRiderPayout('rider-1', { amount: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if requested amount exceeds available balance', async () => {
      mockDb.transaction.mockImplementation(async (cb: any) => {
        const tx = {
          select: jest
            .fn()
            // Rider exists & approved
            .mockReturnValueOnce({
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                  for: jest.fn().mockResolvedValue([
                    { id: 'rider-1', verificationStatus: 'approved' },
                  ]),
                }),
              }),
            })
            // Credits
            .mockReturnValueOnce({
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue([{ totalCredits: '100.00' }]),
              }),
            })
            // Debits
            .mockReturnValueOnce({
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue([{ totalDebits: '50.00' }]),
              }),
            })
            // Pending reserved
            .mockReturnValueOnce({
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue([{ reservedAmount: '30.00' }]),
              }),
            }),
        };
        return cb(tx);
      });

      // Available is 100 - 50 - 30 = 20. Requesting 50 should throw
      await expect(
        service.requestRiderPayout('rider-1', { amount: 50 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create payout request when balance is sufficient', async () => {
      const payoutResult = { id: 'payout-1', amount: '20.00', status: 'requested' };

      mockDb.transaction.mockImplementation(async (cb: any) => {
        const tx = {
          select: jest
            .fn()
            .mockReturnValueOnce({
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                  for: jest.fn().mockResolvedValue([
                    { id: 'rider-1', verificationStatus: 'approved' },
                  ]),
                }),
              }),
            })
            .mockReturnValueOnce({
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue([{ totalCredits: '100.00' }]),
              }),
            })
            .mockReturnValueOnce({
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue([{ totalDebits: '0.00' }]),
              }),
            })
            .mockReturnValueOnce({
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue([{ reservedAmount: '0.00' }]),
              }),
            }),
          insert: jest.fn().mockReturnValue({
            values: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([payoutResult]),
            }),
          }),
        };
        return cb(tx);
      });

      const res = await service.requestRiderPayout('rider-1', { amount: 20 });
      expect(res).toEqual(payoutResult);
    });
  });

  describe('approveRiderPayout and rejectRiderPayout', () => {
    it('should approve requested payout', async () => {
      mockDb.transaction.mockImplementation(async (cb: any) => {
        const tx = {
          select: jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue({
                for: jest.fn().mockResolvedValue([
                  { id: 'payout-1', status: 'requested' },
                ]),
              }),
            }),
          }),
          update: jest.fn().mockReturnValue({
            set: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue({
                returning: jest.fn().mockResolvedValue([
                  { id: 'payout-1', status: 'approved' },
                ]),
              }),
            }),
          }),
        };
        return cb(tx);
      });

      const res = await service.approveRiderPayout('admin-1', 'payout-1');
      expect(res.status).toBe('approved');
    });

    it('should reject requested payout with mandatory reason', async () => {
      mockDb.transaction.mockImplementation(async (cb: any) => {
        const tx = {
          select: jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue({
                for: jest.fn().mockResolvedValue([
                  { id: 'payout-1', status: 'requested' },
                ]),
              }),
            }),
          }),
          update: jest.fn().mockReturnValue({
            set: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue({
                returning: jest.fn().mockResolvedValue([
                  { id: 'payout-1', status: 'rejected', rejectionReason: 'Bank details incorrect' },
                ]),
              }),
            }),
          }),
        };
        return cb(tx);
      });

      const res = await service.rejectRiderPayout('admin-1', 'payout-1', {
        rejectionReason: 'Bank details incorrect',
      });
      expect(res.status).toBe('rejected');
    });
  });

  describe('processRiderPayout', () => {
    it('should transition to processed and debit ledger upon provider success', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            {
              id: 'payout-1',
              riderId: 'rider-1',
              amount: '50.00',
              currency: 'INR',
              status: 'approved',
            },
          ]),
        }),
      });

      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      mockDb.transaction.mockImplementation(async (cb: any) => {
        const tx = {
          update: jest.fn().mockReturnValue({
            set: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue({
                returning: jest.fn().mockResolvedValue([
                  { id: 'payout-1', status: 'processed' },
                ]),
              }),
            }),
          }),
          select: jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue([]),
            }),
          }),
          insert: jest.fn().mockReturnValue({
            values: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([{ id: 'ledger-uuid' }]),
            }),
          }),
        };
        return cb(tx);
      });

      const res = await service.processRiderPayout('admin-1', 'payout-1');
      expect(res.status).toBe('processed');
    });
  });

  describe('generateRestaurantSettlement', () => {
    it('should throw BadRequestException if periodStart is after periodEnd', async () => {
      await expect(
        service.generateRestaurantSettlement('admin-1', {
          restaurantId: 'rest-1',
          periodStart: '2026-10-31T00:00:00.000Z',
          periodEnd: '2026-10-01T00:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if settlement for exact period already exists', async () => {
      mockDb.select
        // 1. Restaurant exists
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([{ id: 'rest-1', name: 'Pizza Place' }]),
          }),
        })
        // 2. Delivered orders
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            innerJoin: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue([
                { id: 'ord-1', itemTotal: '500.00', taxAmount: '25.00' },
              ]),
            }),
          }),
        })
        // 3. Refunds
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            innerJoin: jest.fn().mockReturnValue({
              innerJoin: jest.fn().mockReturnValue({
                innerJoin: jest.fn().mockReturnValue({
                  where: jest.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        })
        // 4. Duplicate idempotency check
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([{ id: 'existing-settle-id' }]),
          }),
        });

      await expect(
        service.generateRestaurantSettlement('admin-1', {
          restaurantId: 'rest-1',
          periodStart: '2026-10-01T00:00:00.000Z',
          periodEnd: '2026-10-15T00:00:00.000Z',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});

