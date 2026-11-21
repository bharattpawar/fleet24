import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedUserPayload, CurrentUser, Roles } from '../auth/decorators/auth.decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  EatListMembershipDto,
  EatListPlanDto,
  EatListQueryDto,
  SaveEatListDto,
} from './eat-list.dto';
import { EatListService } from './eat-list.service';

@Controller('customer/eat-list')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('customer')
export class EatListController {
  constructor(private readonly service: EatListService) {}
  @Get() list(@CurrentUser() u: AuthenticatedUserPayload, @Query() query: EatListQueryDto) {
    return this.service.list(u.userId, query);
  }
  @Get('membership') membership(
    @CurrentUser() u: AuthenticatedUserPayload,
    @Query() q: EatListMembershipDto,
  ) {
    return this.service.membership(u.userId, q.outletId, q.itemIds);
  }
  @Get(':id') get(
    @CurrentUser() u: AuthenticatedUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.get(u.userId, id);
  }
  @Post() save(@CurrentUser() u: AuthenticatedUserPayload, @Body() dto: SaveEatListDto) {
    return this.service.save(u.userId, dto);
  }
  @Patch(':id') update(
    @CurrentUser() u: AuthenticatedUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: EatListPlanDto,
  ) {
    return this.service.update(u.userId, id, dto);
  }
  @Delete(':id') remove(
    @CurrentUser() u: AuthenticatedUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.remove(u.userId, id);
  }
}
