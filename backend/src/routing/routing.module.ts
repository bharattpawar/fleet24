import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RoutingService } from './routing.service';
import { RoutingCacheService } from './routing-cache.service';
import { GoogleRoutesProvider } from './providers/google-routes.provider';
import { ROUTING_PROVIDER_TOKEN } from './providers/routing-provider.interface';

@Module({
  providers: [
    RoutingCacheService,
    GoogleRoutesProvider,
    {
      provide: ROUTING_PROVIDER_TOKEN,
      useFactory: (configService: ConfigService, googleProvider: GoogleRoutesProvider) => {
        const provider = configService.get<string>('ROUTING_PROVIDER', 'google')?.toLowerCase();
        if (provider !== 'google') {
          throw new Error(
            `[RoutingModule] Unsupported ROUTING_PROVIDER '${provider}'. In Phase 1, only 'google' is supported.`,
          );
        }
        return googleProvider;
      },
      inject: [ConfigService, GoogleRoutesProvider],
    },
    RoutingService,
  ],
  exports: [RoutingService, RoutingCacheService],
})
export class RoutingModule {}

