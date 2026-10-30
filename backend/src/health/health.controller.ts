import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { DatabaseService } from '../database/database.service';

@Controller('health')
export class HealthController {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * General health / liveness check.
   * Confirms the NestJS application process is running and responding.
   */
  @Get()
  async getHealth() {
    return {
      status: 'ok',
      service: 'fleet24-backend',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /**
   * Liveness probe endpoint.
   */
  @Get('live')
  getLiveness() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness probe endpoint.
   * Performs an actual database connectivity ping (SELECT 1).
   * Returns 200 OK if healthy, or 503 SERVICE UNAVAILABLE if the database is unreachable.
   */
  @Get('ready')
  async getReadiness(@Res() res: Response) {
    const dbStatus = await this.databaseService.checkConnection();

    if (!dbStatus.ok) {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        success: false,
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        data: {
          status: 'degraded',
          database: {
            connected: false,
            error: dbStatus.error,
          },
          timestamp: new Date().toISOString(),
        },
      });
    }

    return res.status(HttpStatus.OK).json({
      success: true,
      statusCode: HttpStatus.OK,
      data: {
        status: 'ready',
        database: {
          connected: true,
          latencyMs: dbStatus.latencyMs,
        },
        timestamp: new Date().toISOString(),
      },
    });
  }
}
