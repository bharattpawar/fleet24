import 'reflect-metadata';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

describe('Security Guards', () => {
  describe('JwtAuthGuard', () => {
    let guard: JwtAuthGuard;
    let mockJwtService: any;
    let mockConfigService: any;

    beforeEach(() => {
      mockJwtService = {
        verifyAsync: jest.fn(),
      };
      mockConfigService = {
        get: jest.fn().mockReturnValue('test-secret'),
      };
      guard = new JwtAuthGuard(mockJwtService, mockConfigService);
    });

    it('should throw UnauthorizedException when authorization header is missing', async () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({ headers: {} }),
        }),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when scheme is not Bearer', async () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { authorization: 'Basic dXNlcjpwYXNz' },
          }),
        }),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should allow valid Bearer token and attach user to request', async () => {
      mockJwtService.verifyAsync.mockResolvedValueOnce({
        userId: 'user-uuid-1',
        sessionId: 'session-uuid-1',
        roles: ['customer'],
      });

      const requestObj: any = {
        headers: { authorization: 'Bearer valid_jwt_token' },
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => requestObj,
        }),
      } as unknown as ExecutionContext;

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(requestObj.user).toMatchObject({
        userId: 'user-uuid-1',
        sessionId: 'session-uuid-1',
      });
    });
  });

  describe('RolesGuard', () => {
    let rolesGuard: RolesGuard;
    let mockReflector: jest.Mocked<Reflector>;

    beforeEach(() => {
      mockReflector = {
        getAllAndOverride: jest.fn(),
      } as any;
      rolesGuard = new RolesGuard(mockReflector);
    });

    it('should allow access if no roles are required on route', () => {
      mockReflector.getAllAndOverride.mockReturnValueOnce(undefined);

      const context = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({ user: { roles: ['customer'] } }),
        }),
      } as unknown as ExecutionContext;

      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('should allow access if user has one of the required roles', () => {
      mockReflector.getAllAndOverride.mockReturnValueOnce(['admin', 'rider']);

      const context = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({ user: { roles: ['rider'] } }),
        }),
      } as unknown as ExecutionContext;

      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('should throw ForbiddenException if user lacks required roles', () => {
      mockReflector.getAllAndOverride.mockReturnValueOnce(['admin']);

      const context = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({ user: { roles: ['customer'] } }),
        }),
      } as unknown as ExecutionContext;

      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });
  });
});
