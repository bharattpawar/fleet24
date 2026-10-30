import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { HealthController } from './health.controller';
import { DatabaseService } from '../database/database.service';

describe('HealthController', () => {
  let controller: HealthController;
  let databaseService: jest.Mocked<DatabaseService>;

  beforeEach(async () => {
    const mockDatabaseService = {
      checkConnection: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    databaseService = module.get(DatabaseService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHealth', () => {
    it('should return health status ok', async () => {
      const response = await controller.getHealth();
      expect(response).toMatchObject({
        status: 'ok',
        service: 'fleet24-backend',
      });
      expect(typeof response.uptime).toBe('number');
      expect(typeof response.timestamp).toBe('string');
    });
  });

  describe('getLiveness', () => {
    it('should return live status ok', () => {
      const response = controller.getLiveness();
      expect(response.status).toBe('ok');
      expect(typeof response.uptime).toBe('number');
    });
  });

  describe('getReadiness', () => {
    it('should return 200 OK when database is reachable', async () => {
      databaseService.checkConnection.mockResolvedValueOnce({
        ok: true,
        latencyMs: 3,
      });

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await controller.getReadiness(res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          statusCode: 200,
          data: expect.objectContaining({
            status: 'ready',
            database: { connected: true, latencyMs: 3 },
          }),
        }),
      );
    });

    it('should return 503 SERVICE UNAVAILABLE when database is unreachable', async () => {
      databaseService.checkConnection.mockResolvedValueOnce({
        ok: false,
        error: 'ECONNREFUSED',
      });

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await controller.getReadiness(res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: 503,
          data: expect.objectContaining({
            status: 'degraded',
            database: { connected: false, error: 'ECONNREFUSED' },
          }),
        }),
      );
    });
  });
});
