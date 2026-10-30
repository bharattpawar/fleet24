import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { riderApi } from '../api/riderApi';

export const RIDER_LOCATION_TASK_NAME = 'FLEET24_RIDER_BACKGROUND_LOCATION_TASK';

// Define the background task for native platforms
if (Platform.OS !== 'web') {
  try {
    TaskManager.defineTask(RIDER_LOCATION_TASK_NAME, async ({ data, error }: any) => {
      if (error) {
        return;
      }

      if (data && data.locations && data.locations.length > 0) {
        const [latestLocation] = data.locations;
        const { coords, timestamp } = latestLocation;

        try {
          await riderApi.updateLocation({
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy || null,
            heading: coords.heading || null,
            speed: coords.speed || null,
            capturedAt: new Date(timestamp).toISOString(),
          });
        } catch {
          // Silent swallow for background updates; network retries handled automatically
        }
      }
    });
  } catch {
    // Task manager definition guarded
  }
}

class RiderLocationService {
  private foregroundSubscription: Location.LocationSubscription | null = null;
  private isTracking = false;

  /**
   * Request both foreground and background location permissions
   */
  async requestPermissions(): Promise<{ foreground: boolean; background: boolean }> {
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    const fgGranted = fgStatus === 'granted';

    let bgGranted = false;
    if (fgGranted && Platform.OS !== 'web') {
      try {
        const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
        bgGranted = bgStatus === 'granted';
      } catch {
        bgGranted = false;
      }
    }

    return { foreground: fgGranted, background: bgGranted };
  }

  /**
   * Starts GPS tracking (both foreground watcher and background geofencing/task if supported)
   */
  async startTracking(): Promise<boolean> {
    if (this.isTracking) return true;

    const { foreground } = await this.requestPermissions();
    if (!foreground) return false;

    this.isTracking = true;

    // 1. One immediate coordinate fix
    try {
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      await riderApi.updateLocation({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        accuracy: current.coords.accuracy || null,
        heading: current.coords.heading || null,
        speed: current.coords.speed || null,
        capturedAt: new Date(current.timestamp).toISOString(),
      });
    } catch {
      // Ignore initial ping error
    }

    // 2. Start Foreground Watcher (every 10s or 10 meters)
    try {
      this.foregroundSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000,
          distanceInterval: 10,
        },
        async (loc) => {
          try {
            await riderApi.updateLocation({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              accuracy: loc.coords.accuracy || null,
              heading: loc.coords.heading || null,
              speed: loc.coords.speed || null,
              capturedAt: new Date(loc.timestamp).toISOString(),
            });
          } catch {
            // Non-blocking
          }
        },
      );
    } catch {
      // Foreground watcher error
    }

    // 3. Start Background Task (if registered and on mobile)
    if (Platform.OS !== 'web') {
      try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(RIDER_LOCATION_TASK_NAME);
        if (isRegistered) {
          const hasStarted = await Location.hasStartedLocationUpdatesAsync(RIDER_LOCATION_TASK_NAME);
          if (!hasStarted) {
            await Location.startLocationUpdatesAsync(RIDER_LOCATION_TASK_NAME, {
              accuracy: Location.Accuracy.Balanced,
              timeInterval: 15000,
              distanceInterval: 15,
              foregroundService: {
                notificationTitle: 'Fleet24 Rider Active',
                notificationBody: 'Transmitting live GPS for assigned deliveries.',
                notificationColor: '#28543F',
              },
            });
          }
        }
      } catch {
        // Background update fallback
      }
    }

    return true;
  }

  /**
   * Stops all active GPS tracking (foreground and background)
   */
  async stopTracking(): Promise<void> {
    this.isTracking = false;

    if (this.foregroundSubscription) {
      this.foregroundSubscription.remove();
      this.foregroundSubscription = null;
    }

    if (Platform.OS !== 'web') {
      try {
        const hasStarted = await Location.hasStartedLocationUpdatesAsync(RIDER_LOCATION_TASK_NAME);
        if (hasStarted) {
          await Location.stopLocationUpdatesAsync(RIDER_LOCATION_TASK_NAME);
        }
      } catch {
        // Silent
      }
    }
  }

  getIsTracking(): boolean {
    return this.isTracking;
  }
}

export const riderLocationService = new RiderLocationService();

