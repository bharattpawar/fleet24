import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, CurrentUser, AuthenticatedUserPayload } from '../auth/decorators/auth.decorators';
import { FinancialSettingsService } from './financial-settings.service';
import {
  CreateFinancialSettingsDraftDto,
  UpdateFinancialSettingsDraftDto,
  PublishFinancialSettingsDto,
  PreviewCalculationDto,
  AdminSettingsHistoryQueryDto,
} from './dto/financial-settings.dto';

@Controller('admin/finance/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class FinancialSettingsController {
  constructor(private readonly settingsService: FinancialSettingsService) {}

  /**
   * GET /api/v1/admin/finance/settings
   * Returns currently active financial configuration
   */
  @Get()
  async getActiveSettings() {
    return this.settingsService.getActiveSettings();
  }

  /**
   * GET /api/v1/admin/finance/settings/history
   * Paginated list of historical and draft configuration versions
   */
  @Get('history')
  async getSettingsHistory(@Query() query: AdminSettingsHistoryQueryDto) {
    return this.settingsService.getSettingsHistory(query);
  }

  /**
   * POST /api/v1/admin/finance/settings
   * Creates a new draft configuration version
   */
  @Post()
  async createDraftSettings(
    @CurrentUser() adminUser: AuthenticatedUserPayload,
    @Body() dto: CreateFinancialSettingsDraftDto,
  ) {
    return this.settingsService.createDraftSettings(adminUser.userId, dto);
  }

  /**
   * PATCH /api/v1/admin/finance/settings/:versionId
   * Modifies an existing draft configuration version
   */
  @Patch(':versionId')
  async updateDraftSettings(
    @CurrentUser() adminUser: AuthenticatedUserPayload,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: UpdateFinancialSettingsDraftDto,
  ) {
    return this.settingsService.updateDraftSettings(adminUser.userId, versionId, dto);
  }

  /**
   * POST /api/v1/admin/finance/settings/:versionId/publish
   * Activates or schedules a draft configuration
   */
  @Post(':versionId/publish')
  async publishSettings(
    @CurrentUser() adminUser: AuthenticatedUserPayload,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: PublishFinancialSettingsDto,
  ) {
    return this.settingsService.publishSettings(adminUser.userId, versionId, dto);
  }

  /**
   * POST /api/v1/admin/finance/settings/preview
   * Simulates calculations with sample inputs without database mutation
   */
  @Post('preview')
  async previewSettings(@Body() dto: PreviewCalculationDto) {
    return this.settingsService.previewSettings(dto);
  }
}

