import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { RidersService } from './riders.service';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import { TrackingPublisherService } from '../tracking/tracking-publisher.service';

describe('RidersService', () => {
  let service: RidersService;
  let mockDb: any;

  const mockUser = {
    id: 'user-uuid-1',
    fullName: 'Ravi Kumar',
    phone: '+919876543210',
    email: 'ravi@example.com',
    isActive: true,
  };

  const mockRiderRecord = {
    id: 'rider-uuid-1',
    userId: 'user-uuid-1',
    fullName: 'Ravi Kumar',
    vehicleType: 'motorcycle',
    vehicleNumber: 'UP16AB1234',
    licenseNumber: 'DL-1234567890123',
    verificationStatus: 'pending',
    availabilityStatus: 'offline',
    suspensionReason: null,
    isOnline: false,
    isVerified: false,
    approvedAt: null,
    approvedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: mockUser,
  };

  beforeEach(async () => {
    mockDb = {
      query: {
        riders: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
        users: {
          findFirst: jest.fn(),
        },
        userRoles: {
          findFirst: jest.fn(),
        },
        riderLocations: {
          findFirst: jest.fn(),
        },
      },
      insert: jest.fn(),
      update: jest.fn(),
      select: jest.fn(),
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RidersService,
        {
          provide: DRIZZLE_CONNECTION,
          useValue: mockDb,
        },
        {
          provide: TrackingPublisherService,
          useValue: {
            publishLocationUpdate: jest.fn().mockReturnValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<RidersService>(RidersService);
  });

  describe('createProfile', () => {
    it('should throw ConflictException if rider profile already exists for user', async () => {
      mockDb.query.riders.findFirst.mockResolvedValueOnce(mockRiderRecord);

      await expect(
        service.createProfile('user-uuid-1', {
          fullName: 'Ravi Kumar',
          vehicleType: 'motorcycle',
          vehicleNumber: 'UP16AB1234',
          licenseNumber: 'DL-123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ForbiddenException if user account is inactive', async () => {
      mockDb.query.riders.findFirst.mockResolvedValueOnce(null);
      mockDb.query.users.findFirst.mockResolvedValueOnce({
        ...mockUser,
        isActive: false,
      });

      await expect(
        service.createProfile('user-uuid-1', {
          fullName: 'Ravi Kumar',
          vehicleType: 'motorcycle',
          vehicleNumber: 'UP16AB1234',
          licenseNumber: 'DL-123',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create rider profile with pending verification and offline availability and assign rider role', async () => {
      mockDb.query.riders.findFirst.mockResolvedValueOnce(null);
      mockDb.query.users.findFirst.mockResolvedValueOnce(mockUser);

      mockDb.transaction.mockImplementation(async (callback: any) => {
        const txMock = {
          query: {
            userRoles: {
              findFirst: jest.fn().mockResolvedValueOnce(null), // role does not exist yet
            },
          },
          insert: jest.fn().mockReturnValue({
            values: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValueOnce([mockRiderRecord]),
            }),
          }),
        };
        return callback(txMock);
      });

      const result = await service.createProfile('user-uuid-1', {
        fullName: 'Ravi Kumar',
        vehicleType: 'motorcycle',
        vehicleNumber: 'UP16AB1234',
        licenseNumber: 'DL-123',
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(mockRiderRecord.id);
      expect(result.verificationStatus).toBe('pending');
      expect(result.availabilityStatus).toBe('offline');
      expect(result.user.phone).toBe(mockUser.phone);
    });
  });

  describe('updateAvailability', () => {
    it('should throw ForbiddenException if an unverified rider tries to go available', async () => {
      mockDb.query.riders.findFirst.mockResolvedValueOnce({
        ...mockRiderRecord,
        verificationStatus: 'pending',
      });

      await expect(
        service.updateAvailability('user-uuid-1', {
          availabilityStatus: 'available',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if a rejected rider tries to go available', async () => {
      mockDb.query.riders.findFirst.mockResolvedValueOnce({
        ...mockRiderRecord,
        verificationStatus: 'rejected',
      });

      await expect(
        service.updateAvailability('user-uuid-1', {
          availabilityStatus: 'available',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if a suspended rider tries to go available', async () => {
      mockDb.query.riders.findFirst.mockResolvedValueOnce({
        ...mockRiderRecord,
        verificationStatus: 'approved',
        suspensionReason: 'Traffic violation under review',
      });

      await expect(
        service.updateAvailability('user-uuid-1', {
          availabilityStatus: 'available',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should successfully toggle availability to available if approved and not suspended', async () => {
      mockDb.query.riders.findFirst.mockResolvedValueOnce({
        ...mockRiderRecord,
        verificationStatus: 'approved',
        suspensionReason: null,
      });

      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValueOnce([
              {
                ...mockRiderRecord,
                verificationStatus: 'approved',
                availabilityStatus: 'available',
                isOnline: true,
                updatedAt: new Date(),
              },
            ]),
          }),
        }),
      });

      const res = await service.updateAvailability('user-uuid-1', {
        availabilityStatus: 'available',
      });

      expect(res.availabilityStatus).toBe('available');
      expect(res.isOnline).toBe(true);
    });

    it('should allow going offline at any time even if unverified', async () => {
      mockDb.query.riders.findFirst.mockResolvedValueOnce({
        ...mockRiderRecord,
        verificationStatus: 'pending',
      });

      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValueOnce([
              {
                ...mockRiderRecord,
                availabilityStatus: 'offline',
                isOnline: false,
                updatedAt: new Date(),
              },
            ]),
          }),
        }),
      });

      const res = await service.updateAvailability('user-uuid-1', {
        availabilityStatus: 'offline',
      });

      expect(res.availabilityStatus).toBe('offline');
      expect(res.isOnline).toBe(false);
    });
  });

  describe('adminVerifyRider', () => {
    it('should approve rider and record approvedBy and approvedAt timestamp', async () => {
      mockDb.query.riders.findFirst.mockResolvedValueOnce(mockRiderRecord);

      let setValues: any;
      mockDb.update.mockReturnValue({
        set: jest.fn().mockImplementation((val) => {
          setValues = val;
          return {
            where: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValueOnce([
                {
                  ...mockRiderRecord,
                  ...val,
                },
              ]),
            }),
          };
        }),
      });

      const res = await service.adminVerifyRider('admin-uuid-1', 'rider-uuid-1', {
        verificationStatus: 'approved',
      });

      expect(res.verificationStatus).toBe('approved');
      expect(setValues.verificationStatus).toBe('approved');
      expect(setValues.isVerified).toBe(true);
      expect(setValues.approvedBy).toBe('admin-uuid-1');
      expect(setValues.approvedAt).toBeInstanceOf(Date);
    });

    it('should force availability to offline when rejecting rider', async () => {
      mockDb.query.riders.findFirst.mockResolvedValueOnce({
        ...mockRiderRecord,
        availabilityStatus: 'available',
        isOnline: true,
      });

      let setValues: any;
      mockDb.update.mockReturnValue({
        set: jest.fn().mockImplementation((val) => {
          setValues = val;
          return {
            where: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValueOnce([
                {
                  ...mockRiderRecord,
                  ...val,
                },
              ]),
            }),
          };
        }),
      });

      const res = await service.adminVerifyRider('admin-uuid-1', 'rider-uuid-1', {
        verificationStatus: 'rejected',
        rejectionReason: 'Invalid driving license image',
      });

      expect(res.verificationStatus).toBe('rejected');
      expect(setValues.verificationStatus).toBe('rejected');
      expect(setValues.isVerified).toBe(false);
      expect(setValues.availabilityStatus).toBe('offline');
      expect(setValues.isOnline).toBe(false);
      expect(setValues.suspensionReason).toBe('Invalid driving license image');
    });
  });

  describe('adminSuspendRider', () => {
    it('should force availability to offline and set suspension reason', async () => {
      mockDb.query.riders.findFirst.mockResolvedValueOnce({
        ...mockRiderRecord,
        verificationStatus: 'approved',
        availabilityStatus: 'available',
        isOnline: true,
      });

      let setValues: any;
      mockDb.update.mockReturnValue({
        set: jest.fn().mockImplementation((val) => {
          setValues = val;
          return {
            where: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValueOnce([
                {
                  ...mockRiderRecord,
                  ...val,
                },
              ]),
            }),
          };
        }),
      });

      const res = await service.adminSuspendRider('admin-uuid-1', 'rider-uuid-1', {
        suspensionReason: 'Customer safety violation investigation',
      });

      expect(res.suspensionReason).toBe('Customer safety violation investigation');
      expect(setValues.suspensionReason).toBe('Customer safety violation investigation');
      expect(setValues.availabilityStatus).toBe('offline');
      expect(setValues.isOnline).toBe(false);
    });
  });

  describe('updateLocation', () => {
    const validLocationDto = {
      latitude: 28.4744,
      longitude: 77.504,
      accuracy: 12,
      heading: 180,
      speed: 5,
      capturedAt: new Date().toISOString(),
    };

    it('should throw NotFoundException if rider profile does not exist', async () => {
      mockDb.query.riders.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.updateLocation('user-uuid-1', validLocationDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if rider is not approved', async () => {
      mockDb.query.riders.findFirst.mockResolvedValueOnce({
        ...mockRiderRecord,
        verificationStatus: 'pending',
      });

      await expect(
        service.updateLocation('user-uuid-1', validLocationDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if rider is rejected', async () => {
      mockDb.query.riders.findFirst.mockResolvedValueOnce({
        ...mockRiderRecord,
        verificationStatus: 'rejected',
      });

      await expect(
        service.updateLocation('user-uuid-1', validLocationDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if rider is suspended', async () => {
      mockDb.query.riders.findFirst.mockResolvedValueOnce({
        ...mockRiderRecord,
        verificationStatus: 'approved',
        suspensionReason: 'Disciplinary check',
      });

      await expect(
        service.updateLocation('user-uuid-1', validLocationDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if rider is offline', async () => {
      mockDb.query.riders.findFirst.mockResolvedValueOnce({
        ...mockRiderRecord,
        verificationStatus: 'approved',
        availabilityStatus: 'offline',
        suspensionReason: null,
      });

      await expect(
        service.updateLocation('user-uuid-1', validLocationDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if capturedAt is in the future (> 60s drift)', async () => {
      mockDb.query.riders.findFirst.mockResolvedValueOnce({
        ...mockRiderRecord,
        verificationStatus: 'approved',
        availabilityStatus: 'available',
        suspensionReason: null,
      });

      const futureDate = new Date(Date.now() + 120 * 1000).toISOString();

      await expect(
        service.updateLocation('user-uuid-1', {
          ...validLocationDto,
          capturedAt: futureDate,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if capturedAt is too stale (> 600s old)', async () => {
      mockDb.query.riders.findFirst.mockResolvedValueOnce({
        ...mockRiderRecord,
        verificationStatus: 'approved',
        availabilityStatus: 'available',
        suspensionReason: null,
      });

      const oldDate = new Date(Date.now() - 700 * 1000).toISOString();

      await expect(
        service.updateLocation('user-uuid-1', {
          ...validLocationDto,
          capturedAt: oldDate,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully upsert location for available rider', async () => {
      mockDb.query.riders.findFirst.mockResolvedValueOnce({
        ...mockRiderRecord,
        verificationStatus: 'approved',
        availabilityStatus: 'available',
        suspensionReason: null,
      });

      const mockSavedLocation = {
        id: 'loc-uuid-1',
        riderId: mockRiderRecord.id,
        latitude: '28.4744000',
        longitude: '77.5040000',
        accuracy: '12.00',
        heading: '180.00',
        speed: '5.00',
        capturedAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          onConflictDoUpdate: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValueOnce([mockSavedLocation]),
          }),
        }),
      });

      const res = await service.updateLocation('user-uuid-1', validLocationDto);

      expect(res.riderId).toBe(mockRiderRecord.id);
      expect(res.latitude).toBe(28.4744);
      expect(res.longitude).toBe(77.504);
      expect(res.accuracy).toBe(12);
      expect(res.freshness).toBe('fresh');
      expect(res.ageSeconds).toBeLessThan(5);
    });

    it('should successfully upsert location for busy rider', async () => {
      mockDb.query.riders.findFirst.mockResolvedValueOnce({
        ...mockRiderRecord,
        verificationStatus: 'approved',
        availabilityStatus: 'busy',
        suspensionReason: null,
      });

      const mockSavedLocation = {
        id: 'loc-uuid-1',
        riderId: mockRiderRecord.id,
        latitude: '28.4744000',
        longitude: '77.5040000',
        accuracy: null,
        heading: null,
        speed: null,
        capturedAt: null,
        updatedAt: new Date(),
      };

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          onConflictDoUpdate: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValueOnce([mockSavedLocation]),
          }),
        }),
      });

      const res = await service.updateLocation('user-uuid-1', {
        latitude: 28.4744,
        longitude: 77.504,
      });

      expect(res.riderId).toBe(mockRiderRecord.id);
      expect(res.freshness).toBe('fresh');
    });
  });

  describe('getLocation', () => {
    it('should throw NotFoundException if rider does not exist', async () => {
      mockDb.query.riders.findFirst.mockResolvedValueOnce(null);

      await expect(service.getLocation('user-uuid-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if rider has no recorded location', async () => {
      mockDb.query.riders.findFirst.mockResolvedValueOnce(mockRiderRecord);
      mockDb.query.riderLocations.findFirst.mockResolvedValueOnce(null);

      await expect(service.getLocation('user-uuid-1')).rejects.toThrow(NotFoundException);
    });

    it('should return location and mark freshness as fresh if within 300 seconds', async () => {
      mockDb.query.riders.findFirst.mockResolvedValueOnce(mockRiderRecord);
      mockDb.query.riderLocations.findFirst.mockResolvedValueOnce({
        id: 'loc-uuid-1',
        riderId: mockRiderRecord.id,
        latitude: '28.4744000',
        longitude: '77.5040000',
        accuracy: '10.00',
        heading: '90.00',
        speed: '15.00',
        capturedAt: new Date(),
        updatedAt: new Date(Date.now() - 60 * 1000), // 60s ago
      });

      const res = await service.getLocation('user-uuid-1');
      expect(res.riderId).toBe(mockRiderRecord.id);
      expect(res.freshness).toBe('fresh');
      expect(res.ageSeconds).toBeGreaterThanOrEqual(59);
    });

    it('should return location and mark freshness as stale if older than 300 seconds', async () => {
      mockDb.query.riders.findFirst.mockResolvedValueOnce(mockRiderRecord);
      mockDb.query.riderLocations.findFirst.mockResolvedValueOnce({
        id: 'loc-uuid-1',
        riderId: mockRiderRecord.id,
        latitude: '28.4744000',
        longitude: '77.5040000',
        accuracy: '10.00',
        heading: '90.00',
        speed: '15.00',
        capturedAt: new Date(Date.now() - 400 * 1000),
        updatedAt: new Date(Date.now() - 400 * 1000), // 400s ago
      });

      const res = await service.getLocation('user-uuid-1');
      expect(res.riderId).toBe(mockRiderRecord.id);
      expect(res.freshness).toBe('stale');
      expect(res.ageSeconds).toBeGreaterThanOrEqual(399);
    });
  });
});

