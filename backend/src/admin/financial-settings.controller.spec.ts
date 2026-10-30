import { Test, TestingModule } from '@nestjs/testing';
import { FinancialSettingsController } from './financial-settings.controller';
import { FinancialSettingsService } from './financial-settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('FinancialSettingsController', () => {
  let controller: FinancialSettingsController;
  let mockSettingsService: any;

  beforeEach(async () => {
    mockSettingsService = {
      getActiveSettings: jest.fn(),
      getSettingsHistory: jest.fn(),
      createDraftSettings: jest.fn(),
      updateDraftSettings: jest.fn(),
      publishSettings: jest.fn(),
      previewSettings: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinancialSettingsController],
      providers: [
        {
          provide: FinancialSettingsService,
          useValue: mockSettingsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<FinancialSettingsController>(FinancialSettingsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getActiveSettings', () => {
    it('should return active configuration', async () => {
      mockSettingsService.getActiveSettings.mockResolvedValue({
        versionId: 'v-1',
        versionNumber: 1,
        settings: FinancialSettingsService.DEFAULT_SETTINGS,
      });

      const res = await controller.getActiveSettings();
      expect(res.versionNumber).toBe(1);
      expect(mockSettingsService.getActiveSettings).toHaveBeenCalled();
    });
  });

  describe('publishSettings', () => {
    it('should pass admin user ID and version ID to service', async () => {
      const adminUser = {
        userId: 'admin-uuid-1',
        phone: '+919999999999',
        sessionId: 'sess-1',
        roles: ['admin'],
      };

      mockSettingsService.publishSettings.mockResolvedValue({
        id: 'v-2',
        status: 'active',
      });

      const res = await controller.publishSettings(adminUser, 'v-2', { notes: 'Go live' });
      expect(res.status).toBe('active');
      expect(mockSettingsService.publishSettings).toHaveBeenCalledWith(
        'admin-uuid-1',
        'v-2',
        { notes: 'Go live' },
      );
    });
  });

  describe('previewSettings', () => {
    it('should execute non-mutating preview calculation', async () => {
      mockSettingsService.previewSettings.mockResolvedValue({
        simulatedAt: '2026-10-30T13:00:00.000Z',
      });

      const res = await controller.previewSettings({
        proposedSettings: FinancialSettingsService.DEFAULT_SETTINGS,
      });

      expect(res.simulatedAt).toBeDefined();
      expect(mockSettingsService.previewSettings).toHaveBeenCalled();
    });
  });
});

