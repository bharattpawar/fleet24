import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RestaurantsService } from './restaurants.service';
import { MenusService } from './menus.service';
import {
  CreateRestaurantDto,
  UpdateRestaurantDto,
  UpdateRestaurantStatusDto,
  CreateOutletDto,
  UpdateOutletDto,
  UpdateOrderAcceptanceDto,
  OperatingHourDayDto,
  CreateMenuCategoryDto,
  UpdateMenuCategoryDto,
  CreateMenuItemDto,
  UpdateMenuItemDto,
  UpdateMenuItemAvailabilityDto,
  OutletMenuItemOverrideDto,
  PaginationQueryDto,
} from './dto/restaurant.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, CurrentUser, AuthenticatedUserPayload } from '../auth/decorators/auth.decorators';

@Controller()
export class RestaurantsController {
  constructor(
    private readonly restaurantsService: RestaurantsService,
    private readonly menusService: MenusService,
  ) {}

  // ==========================================
  // PUBLIC DISCOVERY (No Auth Required)
  // ==========================================

  @Get('public/outlets')
  async getPublicOutlets() {
    return this.menusService.getPublicActiveOutlets();
  }

  @Get('public/outlets/:outletId/menu')
  async getPublicOutletMenu(@Param('outletId') outletId: string) {
    return this.menusService.listMenuItemsForOutlet(outletId);
  }

  // ==========================================
  // RESTAURANTS (Admin Only)
  // ==========================================

  @Post('restaurants')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  async createRestaurant(
    @Body() dto: CreateRestaurantDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.restaurantsService.createRestaurant(dto, user);
  }

  @Get('restaurants')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async listRestaurants(@Query() query: PaginationQueryDto) {
    return this.restaurantsService.listRestaurants(query);
  }

  @Get('restaurants/:restaurantId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getRestaurant(@Param('restaurantId') restaurantId: string) {
    return this.restaurantsService.getRestaurantById(restaurantId);
  }

  @Patch('restaurants/:restaurantId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateRestaurant(
    @Param('restaurantId') restaurantId: string,
    @Body() dto: UpdateRestaurantDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.restaurantsService.updateRestaurant(restaurantId, dto, user);
  }

  @Patch('restaurants/:restaurantId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateRestaurantStatus(
    @Param('restaurantId') restaurantId: string,
    @Body() dto: UpdateRestaurantStatusDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.restaurantsService.updateRestaurantStatus(restaurantId, dto.isActive, user);
  }

  // ==========================================
  // OUTLETS (Admin & Authorized Staff)
  // ==========================================

  @Post('restaurants/:restaurantId/outlets')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  async createOutlet(
    @Param('restaurantId') restaurantId: string,
    @Body() dto: CreateOutletDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.restaurantsService.createOutlet(restaurantId, dto, user);
  }

  @Get('outlets')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'restaurant_staff')
  async listOutlets(@CurrentUser() user: AuthenticatedUserPayload) {
    return this.restaurantsService.listOutlets(user);
  }

  @Get('outlets/:outletId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'restaurant_staff')
  async getOutlet(
    @Param('outletId') outletId: string,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.restaurantsService.getOutletDetails(outletId, user);
  }

  @Patch('outlets/:outletId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'restaurant_staff')
  async updateOutlet(
    @Param('outletId') outletId: string,
    @Body() dto: UpdateOutletDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.restaurantsService.updateOutlet(outletId, dto, user);
  }

  @Patch('outlets/:outletId/order-acceptance')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'restaurant_staff')
  async updateOrderAcceptance(
    @Param('outletId') outletId: string,
    @Body() dto: UpdateOrderAcceptanceDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.restaurantsService.updateOrderAcceptance(outletId, dto.isAcceptingOrders, user);
  }

  // ==========================================
  // OPERATING HOURS
  // ==========================================

  @Get('outlets/:outletId/operating-hours')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'restaurant_staff')
  async getOperatingHours(
    @Param('outletId') outletId: string,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.restaurantsService.getOutletOperatingHours(outletId, user);
  }

  @Put('outlets/:outletId/operating-hours')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'restaurant_staff')
  async saveOperatingHours(
    @Param('outletId') outletId: string,
    @Body() days: OperatingHourDayDto[],
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.restaurantsService.saveOutletOperatingHours(outletId, days, user);
  }

  // ==========================================
  // MENU CATEGORIES
  // ==========================================

  @Post('outlets/:outletId/menu/categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'restaurant_staff')
  @HttpCode(HttpStatus.CREATED)
  async createCategory(
    @Param('outletId') outletId: string,
    @Body() dto: CreateMenuCategoryDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.menusService.createCategory(outletId, dto, user);
  }

  @Get('outlets/:outletId/menu/categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'restaurant_staff')
  async listCategories(@Param('outletId') outletId: string) {
    return this.menusService.listCategoriesByOutlet(outletId);
  }

  @Patch('menu/categories/:categoryId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'restaurant_staff')
  async updateCategory(
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateMenuCategoryDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.menusService.updateCategory(categoryId, dto, user);
  }

  // ==========================================
  // MENU ITEMS & OVERRIDES
  // ==========================================

  @Post('outlets/:outletId/menu/items')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'restaurant_staff')
  @HttpCode(HttpStatus.CREATED)
  async createMenuItem(
    @Param('outletId') outletId: string,
    @Body() dto: CreateMenuItemDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.menusService.createMenuItem(outletId, dto, user);
  }

  @Get('outlets/:outletId/menu/items')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'restaurant_staff')
  async listMenuItems(@Param('outletId') outletId: string) {
    return this.menusService.listMenuItemsForOutlet(outletId);
  }

  @Get('menu/items/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'restaurant_staff')
  async getMenuItem(@Param('itemId') itemId: string) {
    return this.menusService.getMenuItemById(itemId);
  }

  @Patch('menu/items/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'restaurant_staff')
  async updateMenuItem(
    @Param('itemId') itemId: string,
    @Body() dto: UpdateMenuItemDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.menusService.updateMenuItem(itemId, dto, user);
  }

  @Patch('menu/items/:itemId/availability')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'restaurant_staff')
  async updateMenuItemAvailability(
    @Param('itemId') itemId: string,
    @Body() dto: UpdateMenuItemAvailabilityDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.menusService.setMenuItemAvailability(itemId, dto.isAvailable, user);
  }

  @Put('outlets/:outletId/menu/items/:itemId/override')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'restaurant_staff')
  async setOutletMenuItemOverride(
    @Param('outletId') outletId: string,
    @Param('itemId') itemId: string,
    @Body() dto: OutletMenuItemOverrideDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.menusService.setOutletMenuItemOverride(outletId, itemId, dto, user);
  }
}
