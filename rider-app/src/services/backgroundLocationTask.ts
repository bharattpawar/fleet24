import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { riderLocationService } from './locationService';

export const FLEET24_RIDER_BACKGROUND_LOCATION = 'FLEET24_RIDER_BACKGROUND_LOCATION';

/**
 * Register background location task at module scope before application startup.
 * Avoids duplicate task registration and guarantees headless execution on Android/iOS.
 */
if (Platform.OS !== 'web') {
  if (!TaskManager.isTaskDefined(FLEET24_RIDER_BACKGROUND_LOCATION)) {
    TaskManager.defineTask(
      FLEET24_RIDER_BACKGROUND_LOCATION,
      async ({ data, error }: TaskManager.TaskManagerTaskBody<any>) => {
        if (error) {
          console.warn(`[BackgroundLocationTask] Task error: ${error.message}`);
          return;
        }

        if (data) {
          const { locations } = data as { locations: Location.LocationObject[] };
          if (!locations || locations.length === 0) return;

          // Pick the latest hardware fix
          const latest = locations[locations.length - 1];
          if (!latest?.coords) return;

          // Forward to singleton location service to handle throttling, offline caching, and backend API transmission
          await riderLocationService.handleBackgroundLocation({
            latitude: latest.coords.latitude,
            longitude: latest.coords.longitude,
            accuracy: latest.coords.accuracy ?? null,
            heading: latest.coords.heading ?? null,
            speed: latest.coords.speed ?? null,
            capturedAt: new Date(latest.timestamp).toISOString(),
          });
        }
      }
    );
  }
}

