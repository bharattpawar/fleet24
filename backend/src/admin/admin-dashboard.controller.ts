import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/auth.decorators';
import { AdminDashboardService } from './admin-dashboard.service';
import {
  AdminDashboardFilterDto,
  AdminRecentActivityQueryDto,
} from './dto/admin-dashboard.dto';

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminDashboardController {
  constructor(private readonly dashboardService: AdminDashboardService) {}

  /**
   * GET /api/v1/admin/dashboard/overview
   * Consolidated dashboard metrics across customers, restaurants, riders, orders, deliveries, and financials.
   */
  @Get('overview')
  async getOverview(@Query() filterDto: AdminDashboardFilterDto) {
    return this.dashboardService.getOverview(filterDto);
  }

  /**
   * GET /api/v1/admin/dashboard/orders
   * Detailed order breakdown and daily time series.
   */
  @Get('orders')
  async getOrdersAnalytics(@Query() filterDto: AdminDashboardFilterDto) {
    return this.dashboardService.getOrdersAnalytics(filterDto);
  }

  /**
   * GET /api/v1/admin/dashboard/revenue
   * Detailed financial analytics: customer collections, refunds, net money retained, and breakdowns.
   */
  @Get('revenue')
  async getRevenueAnalytics(@Query() filterDto: AdminDashboardFilterDto) {
    return this.dashboardService.getRevenueAnalytics(filterDto);
  }

  /**
   * GET /api/v1/admin/dashboard/riders
   * Rider verification, availability status, delivery performance and registration trends.
   */
  @Get('riders')
  async getRiderAnalytics(@Query() filterDto: AdminDashboardFilterDto) {
    return this.dashboardService.getRiderAnalytics(filterDto);
  }

  /**
   * GET /api/v1/admin/dashboard/restaurants
   * Restaurant & Outlet breakdown, orders by restaurant, completed vs cancelled.
   */
  @Get('restaurants')
  async getRestaurantAnalytics(@Query() filterDto: AdminDashboardFilterDto) {
    return this.dashboardService.getRestaurantAnalytics(filterDto);
  }

  /**
   * GET /api/v1/admin/dashboard/recent-activity
   * Operational activity feed assembled from orders, refunds, and user registration timestamps.
   */
  @Get('recent-activity')
  async getRecentActivity(@Query() queryDto: AdminRecentActivityQueryDto) {
    return this.dashboardService.getRecentActivity(queryDto);
  }
}

