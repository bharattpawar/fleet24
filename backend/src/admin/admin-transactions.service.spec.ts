import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PgDialect } from 'drizzle-orm/pg-core';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminTransactionsController } from './admin-transactions.controller';
import { AdminTransactionsService } from './admin-transactions.service';
import { AdminPaymentQueryDto, AdminRefundQueryDto } from './dto/admin-transactions.dto';

describe('Admin transactions', () => {
  it('restricts transaction reads to admins', () => {
    const guard = new RolesGuard(new Reflector());
    const context = (roles?: string[]) => ({
      getClass: () => AdminTransactionsController,
      getHandler: () => AdminTransactionsController.prototype.listRefunds,
      switchToHttp: () => ({ getRequest: () => ({ user: roles && { roles } }) }),
    }) as unknown as ExecutionContext;
    expect(guard.canActivate(context(['admin']))).toBe(true);
    expect(() => guard.canActivate(context(['customer']))).toThrow();
    expect(() => guard.canActivate(context())).toThrow();
  });

  it('validates status, review flag, dates and pagination', async () => {
    const refund = plainToInstance(AdminRefundQueryDto, { status: 'captured', needsReview: 'yes', from: 'invalid', page: '0', limit: '101' });
    expect((await validate(refund)).map((error) => error.property)).toEqual(
      expect.arrayContaining(['status', 'needsReview', 'from', 'page', 'limit']),
    );
    expect(await validate(plainToInstance(AdminPaymentQueryDto, { status: 'captured', page: '2', limit: '20' }))).toEqual([]);
  });

  it('filters and pages payment attempts without collapsing order IDs', async () => {
    const attempts = [{ id: 'p2', orderId: 'o1', status: 'failed' }, { id: 'p1', orderId: 'o1', status: 'captured' }];
    const rows = {
      from: jest.fn().mockReturnThis(), innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(),
      as: jest.fn().mockReturnValue({}), limit: jest.fn().mockReturnThis(), offset: jest.fn().mockResolvedValue(attempts),
    };
    const count = { from: jest.fn().mockResolvedValue([{ total: 22 }]) };
    const service = new AdminTransactionsService({ select: jest.fn().mockReturnValueOnce(rows).mockReturnValueOnce(count).mockReturnValueOnce(rows) } as any);
    const result = await service.listPayments({ search: 'pay_123', page: 2, limit: 20 });
    expect(result).toMatchObject({ data: attempts, page: 2, totalPages: 2 });
    expect(rows.offset).toHaveBeenCalledWith(20);
    expect(rows.orderBy.mock.calls[0]).toHaveLength(2);
    const filter = new PgDialect().sqlToQuery(rows.where.mock.calls[0][0]);
    expect(filter.sql).toContain('provider_payment_id');
    expect(filter.params).toContain('%pay\\_123%');
  });
});
