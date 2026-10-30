import { Test, TestingModule } from '@nestjs/testing';
import { AdminFinanceController } from './admin-finance.controller';
import { AdminFinanceService } from './admin-finance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('AdminFinanceController', () => {
  let controller: AdminFinanceController;
  let mockFinanceService: any;

  beforeEach(async () => {
    mockFinanceService = {
      getFinancialOverview: jest.fn(),
      runFinancialReconciliation: jest.fn(),
      getLedgerEntries: jest.fn(),
      listRiderEarnings: jest.fn(),
      getRiderEarningsSummary: jest.fn(),
      listRiderPayouts: jest.fn(),
      approveRiderPayout: jest.fn(),
      rejectRiderPayout: jest.fn(),
      processRiderPayout: jest.fn(),
      generateRestaurantSettlement: jest.fn(),
      listRestaurantSettlements: jest.fn(),
      approveRestaurantSettlement: jest.fn(),
      processRestaurantSettlement: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminFinanceController],
      providers: [
        {
          provide: AdminFinanceService,
          useValue: mockFinanceService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminFinanceController>(AdminFinanceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getOverview', () => {
    it('should delegate to service.getFinancialOverview', async () => {
      mockFinanceService.getFinancialOverview.mockResolvedValue({
        currency: 'INR',
        platformNetBalance: '15000.00',
      });

      const res = await controller.getOverview();
      expect(res.platformNetBalance).toBe('15000.00');
      expect(mockFinanceService.getFinancialOverview).toHaveBeenCalled();
    });
  });

  describe('runReconciliation', () => {
    it('should delegate to service.runFinancialReconciliation', async () => {
      mockFinanceService.runFinancialReconciliation.mockResolvedValue({
        status: 'healthy',
      });

      const res = await controller.runReconciliation();
      expect(res.status).toBe('healthy');
      expect(mockFinanceService.runFinancialReconciliation).toHaveBeenCalled();
    });
  });

  describe('approveRiderPayout', () => {
    it('should pass admin user ID and payout ID to service', async () => {
      const adminUser = {
        userId: 'admin-uuid-1',
        phone: '+919999999999',
        sessionId: 'sess-1',
        roles: ['admin'],
      };

      mockFinanceService.approveRiderPayout.mockResolvedValue({
        id: 'payout-uuid-1',
        status: 'approved',
      });

      const res = await controller.approveRiderPayout(adminUser, 'payout-uuid-1');
      expect(res.status).toBe('approved');
      expect(mockFinanceService.approveRiderPayout).toHaveBeenCalledWith(
        'admin-uuid-1',
        'payout-uuid-1',
      );
    });
  });
});

