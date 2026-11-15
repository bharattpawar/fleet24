import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/auth.decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminTransactionsService } from './admin-transactions.service';
import { AdminPaymentQueryDto, AdminRefundQueryDto } from './dto/admin-transactions.dto';

@Controller('admin/finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminTransactionsController {
  constructor(private readonly transactions: AdminTransactionsService) {}

  @Get('payments')
  listPayments(@Query() query: AdminPaymentQueryDto) {
    return this.transactions.listPayments(query);
  }

  @Get('payments/outlets')
  listOutlets() {
    return this.transactions.listOutlets();
  }

  @Get('payments/:id')
  getPayment(@Param('id', ParseUUIDPipe) id: string) {
    return this.transactions.getPayment(id);
  }

  @Get('refunds')
  listRefunds(@Query() query: AdminRefundQueryDto) {
    return this.transactions.listRefunds(query);
  }

  @Get('refunds/:id')
  getRefund(@Param('id', ParseUUIDPipe) id: string) {
    return this.transactions.getRefund(id);
  }
}
