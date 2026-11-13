import { Platform, Alert } from 'react-native';
import * as Location from 'expo-location';
import { riderApi, RiderLocationUpdate } from '../api/riderApi';
import { FLEET24_RIDER_BACKGROUND_LOCATION } from './backgroundLocationTask';

export type LocationPermissionStatus = 'undetermined' | 'granted' | 'denied';

export type GpsStatus =
  | 'initializing'
  | 'requesting_permission'
  | 'permission_denied'
  | 'services_disabled'
  | 'acquiring'
  | 'active'
  | 'stale'
  | 'error';

class RiderLocationService {
  private subscription: Location.LocationSubscription | null = null;
  private webWatchId: number | null = null;
  private isTracking: boolean = false;
  private lastLocation: RiderLocationUpdate | null = null;
  private lastAcquiredMs: number = 0;
  private locationListeners: Array<(location: RiderLocationUpdate) => void> = [];
  private statusListeners: Array<(status: GpsStatus) => void> = [];
  private currentStatus: GpsStatus = 'initializing';
  private isMockMode: boolean = false;
  private isDelivering: boolean = false;

  // Throttling state to avoid excessive backend API calls
  private lastSentAtMs: number = 0;
  private lastSentCoords: { latitude: number; longitude: number } | null = null;
  private offlinePendingLocation: RiderLocationUpdate | null = null;

  public setMockMode(enabled: boolean) {
    this.isMockMode = enabled;
  }

  public setDelivering(delivering: boolean) {
    const previous = this.isDelivering;
    this.isDelivering = delivering;

    if (this.isTracking && previous !== delivering && !this.isWebEnvironment() && Platform.OS !== 'web') {
      this.startNativeBackgroundTracking().catch((err) => {
        console.warn('[LocationService] Error updating background tracking options:', err);
      });
    }
  }

  private isWebEnvironment(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      !navigator.product?.includes('ReactNative')
    );
  }

  /**
   * Request foreground location permission.
   */
  public async requestForegroundPermission(): Promise<{
    status: LocationPermissionStatus;
    canAskAgain: boolean;
  }> {
    if (this.isMockMode) {
      this.setStatus('active');
      return { status: 'granted', canAskAgain: true };
    }

    this.setStatus('requesting_permission');

    if (this.isWebEnvironment()) {
      if (typeof navigator.permissions !== 'undefined') {
        try {
          const res = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          if (res.state === 'granted') {
            this.setStatus('active');
            return { status: 'granted', canAskAgain: true };
          } else if (res.state === 'denied') {
            this.setStatus('permission_denied');
            return { status: 'denied', canAskAgain: false };
          }
        } catch {
          // Permissions query not universally supported; proceed to prompt
        }
      }
      return new Promise((resolve) => {
        if (!navigator.geolocation) {
          this.setStatus('services_disabled');
          resolve({ status: 'denied', canAskAgain: false });
          return;
        }
        navigator.geolocation.getCurrentPosition(
          () => {
            this.setStatus('active');
            resolve({ status: 'granted', canAskAgain: true });
          },
          (err) => {
            if (err.code === 1) {
              this.setStatus('permission_denied');
            } else if (err.code === 2) {
              this.setStatus('services_disabled');
            } else {
              this.setStatus('error');
            }
            resolve({ status: 'denied', canAskAgain: true });
          },
          { timeout: 8000 }
        );
      });
    }

    // Native Mobile (Expo Location)
    try {
      const response = await Location.requestForegroundPermissionsAsync();
      const status: LocationPermissionStatus = response.status === 'granted' ? 'granted' : 'denied';
      if (status === 'granted') {
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) {
          this.setStatus('services_disabled');
        } else {
          this.setStatus('acquiring');
        }
      } else {
        this.setStatus('permission_denied');
      }
      return {
        status,
        canAskAgain: response.canAskAgain,
      };
    } catch (e) {
      console.warn('[LocationService] Failed to request foreground permissions:', e);
      this.setStatus('error');
      return { status: 'denied', canAskAgain: false };
    }
  }

  /**
   * Check existing permission status without prompting.
   */
  public async getPermissionStatus(): Promise<LocationPermissionStatus> {
    if (this.isMockMode) return 'granted';

    if (this.isWebEnvironment()) {
      if (typeof navigator !== 'undefined' && typeof navigator.permissions !== 'undefined') {
        try {
          const res = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          if (res.state === 'granted') return 'granted';
          if (res.state === 'denied') return 'denied';
          return 'undetermined';
        } catch {
          return 'granted';
        }
      }
      return 'granted';
    }

    try {
      const response = await Location.getForegroundPermissionsAsync();
      return response.status === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  }

  /**
   * Request background location permission with educational pre-prompt.
   * Required on Android 11+ to explain background access before system settings prompt.
   */
  public async requestBackgroundPermission(): Promise<{
    status: LocationPermissionStatus;
    canAskAgain: boolean;
  }> {
    if (this.isMockMode || this.isWebEnvironment() || Platform.OS === 'web') {
      return { status: 'granted', canAskAgain: true };
    }

    try {
      const existing = await Location.getBackgroundPermissionsAsync();
      if (existing.status === 'granted') {
        return { status: 'granted', canAskAgain: true };
      }

      // Educational prompt explaining the necessity of background location
      await new Promise<void>((resolve) => {
        Alert.alert(
          'Background Location Required',
          'Fleet24 Rider requires background location access to provide customers and dispatch with accurate delivery ETAs while your screen is locked or while using navigation apps.',
          [{ text: 'Continue', onPress: () => resolve() }],
          { cancelable: false }
        );
      });

      const response = await Location.requestBackgroundPermissionsAsync();
      return {
        status: response.status === 'granted' ? 'granted' : 'denied',
        canAskAgain: response.canAskAgain,
      };
    } catch (e) {
      console.warn('[LocationService] Failed to request background permissions:', e);
      return { status: 'denied', canAskAgain: false };
    }
  }

  public async getBackgroundPermissionStatus(): Promise<LocationPermissionStatus> {
    if (this.isMockMode || this.isWebEnvironment() || Platform.OS === 'web') {
      return 'granted';
    }

    try {
      const response = await Location.getBackgroundPermissionsAsync();
      return response.status === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  }

  /**
   * Fetch actual GPS coordinates using real hardware or browser geolocation.
   * Returns null if permission is missing, GPS is disabled, or no fix is available.
   * NEVER returns hardcoded fake coordinates as live GPS.
   */
  public async getCurrentPosition(): Promise<RiderLocationUpdate | null> {
    // 1. Explicit Mock Mode check
    if (this.isMockMode) {
      const mockUpdate: RiderLocationUpdate = {
        latitude: 28.4744,
        longitude: 77.504,
        accuracy: 5,
        heading: 90,
        speed: 0,
        capturedAt: new Date().toISOString(),
      };
      this.lastLocation = mockUpdate;
      this.lastAcquiredMs = Date.now();
      this.setStatus('active');
      this.notifyListeners(mockUpdate);
      return mockUpdate;
    }

    // 2. Web Browser Implementation
    if (this.isWebEnvironment()) {
      if (!navigator.geolocation) {
        this.setStatus('services_disabled');
        return null;
      }

      this.setStatus('acquiring');
      return new Promise<RiderLocationUpdate | null>((resolve) => {
        const handleSuccess = (pos: GeolocationPosition) => {
          const update: RiderLocationUpdate = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? null,
            heading: pos.coords.heading ?? null,
            speed: pos.coords.speed ?? null,
            capturedAt: new Date(pos.timestamp).toISOString(),
          };
          this.lastLocation = update;
          this.lastAcquiredMs = Date.now();
          this.setStatus('active');
          this.notifyListeners(update);
          this.throttledSendToBackend(update);
          resolve(update);
        };

        const tryLowAccuracy = () => {
          navigator.geolocation.getCurrentPosition(
            handleSuccess,
            (err) => {
              console.warn('[LocationService] Browser fallback geolocation error:', err.code, err.message);
              if (err.code === 1) {
                this.setStatus('permission_denied');
              } else if (err.code === 2) {
                this.setStatus('services_disabled');
              } else {
                this.setStatus('error');
              }
              resolve(null);
            },
            { enableHighAccuracy: false, timeout: 6000, maximumAge: 30000 }
          );
        };

        // Try high accuracy first with 3s timeout; if desktop/timeout occurs, fall back to low accuracy
        navigator.geolocation.getCurrentPosition(
          handleSuccess,
          (err) => {
            if (err.code === 1) {
              this.setStatus('permission_denied');
              resolve(null);
            } else {
              tryLowAccuracy();
            }
          },
          { enableHighAccuracy: true, timeout: 3000, maximumAge: 5000 }
        );
      });
    }

    // 3. Native Mobile (Expo Location) Implementation
    try {
      const permStatus = await this.getPermissionStatus();
      if (permStatus !== 'granted') {
        const req = await this.requestForegroundPermission();
        if (req.status !== 'granted') {
          this.setStatus('permission_denied');
          return null;
        }
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        this.setStatus('services_disabled');
        return null;
      }

      this.setStatus('acquiring');

      let position: Location.LocationObject | null = null;
      try {
        // Fast balanced attempt with timeout
        position = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error('GPS timeout')), 5000)),
        ]);
      } catch {
        // Fallback to cached last known position on mobile device
        position = await Location.getLastKnownPositionAsync();
      }

      if (!position) {
        this.setStatus('error');
        return null;
      }

      const update: RiderLocationUpdate = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy ?? null,
        heading: position.coords.heading ?? null,
        speed: position.coords.speed ?? null,
        capturedAt: new Date(position.timestamp).toISOString(),
      };

      this.lastLocation = update;
      this.lastAcquiredMs = Date.now();
      this.setStatus('active');
      this.notifyListeners(update);
      this.throttledSendToBackend(update);

      return update;
    } catch (err: any) {
      console.warn('[LocationService] Error fetching native GPS position:', err);
      this.setStatus('error');
      return null;
    }
  }

  /**
   * Start live foreground location watching.
   */
  public async startTracking(onUpdate?: (loc: RiderLocationUpdate) => void): Promise<boolean> {
    if (this.isTracking) return true;

    // Explicit Mock Mode
    if (this.isMockMode) {
      this.isTracking = true;
      this.getCurrentPosition().then((pos) => {
        if (pos && onUpdate) onUpdate(pos);
      });
      return true;
    }

    // Web Browser watchPosition
    if (this.isWebEnvironment()) {
      if (!navigator.geolocation) {
        this.setStatus('services_disabled');
        return false;
      }

      this.isTracking = true;
      this.setStatus('acquiring');

      // Fetch initial position immediately
      this.getCurrentPosition().then((pos) => {
        if (pos && onUpdate) onUpdate(pos);
      });

      this.webWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          const update: RiderLocationUpdate = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? null,
            heading: pos.coords.heading ?? null,
            speed: pos.coords.speed ?? null,
            capturedAt: new Date(pos.timestamp).toISOString(),
          };

          this.lastLocation = update;
          this.lastAcquiredMs = Date.now();
          this.setStatus('active');
          if (onUpdate) onUpdate(update);
          this.notifyListeners(update);
          this.throttledSendToBackend(update);
        },
        (err) => {
          console.warn('[LocationService] Web watchPosition error:', err.code, err.message);
          if (err.code === 1) {
            this.setStatus('permission_denied');
          } else if (err.code === 2) {
            this.setStatus('services_disabled');
          } else {
            this.setStatus('error');
          }
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 10000 }
      );

      return true;
    }

    // Native Mobile (Expo Location) watchPositionAsync
    const perm = await this.getPermissionStatus();
    if (perm !== 'granted') {
      const req = await this.requestForegroundPermission();
      if (req.status !== 'granted') {
        this.setStatus('permission_denied');
        return false;
      }
    }

    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      this.setStatus('services_disabled');
      return false;
    }

    this.isTracking = true;
    this.setStatus('acquiring');

    // Fetch immediate current location
    this.getCurrentPosition().then((pos) => {
      if (pos && onUpdate) onUpdate(pos);
    });

    try {
      this.subscription = await Location.watchPositionAsync(
        {
          accuracy: this.isDelivering ? Location.Accuracy.High : Location.Accuracy.Balanced,
          timeInterval: this.isDelivering ? 5000 : 10000,
          distanceInterval: this.isDelivering ? 5 : 15,
        },
        (loc) => {
          const update: RiderLocationUpdate = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            accuracy: loc.coords.accuracy ?? null,
            heading: loc.coords.heading ?? null,
            speed: loc.coords.speed ?? null,
            capturedAt: new Date(loc.timestamp).toISOString(),
          };

          this.lastLocation = update;
          this.lastAcquiredMs = Date.now();
          this.setStatus('active');
          if (onUpdate) onUpdate(update);
          this.notifyListeners(update);
          this.throttledSendToBackend(update);
        }
      );
    } catch (e) {
      console.warn('[LocationService] Error starting watchPositionAsync:', e);
    }

    // Launch native background tracking with Android foreground service
    if (Platform.OS !== 'web') {
      this.startNativeBackgroundTracking().catch((err) => {
        console.warn('[LocationService] Native background start error:', err?.message || err);
      });
    }

    return true;
  }

  /**
   * Start or reconfigure native background location updates with Android foreground service notification.
   */
  public async startNativeBackgroundTracking(): Promise<boolean> {
    if (this.isMockMode || this.isWebEnvironment() || Platform.OS === 'web') {
      return true;
    }

    try {
      const bgPerm = await this.getBackgroundPermissionStatus();
      if (bgPerm !== 'granted') {
        const req = await this.requestBackgroundPermission();
        if (req.status !== 'granted') {
          console.warn('[LocationService] Background location permission denied by user.');
        }
      }

      const hasStarted = await Location.hasStartedLocationUpdatesAsync(
        FLEET24_RIDER_BACKGROUND_LOCATION
      );

      const taskOptions: Location.LocationTaskOptions = {
        accuracy: this.isDelivering ? Location.Accuracy.High : Location.Accuracy.Balanced,
        timeInterval: this.isDelivering ? 5000 : 12000,
        distanceInterval: this.isDelivering ? 5 : 15,
        deferredUpdatesInterval: this.isDelivering ? 5000 : 15000,
        deferredUpdatesDistance: this.isDelivering ? 5 : 15,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: this.isDelivering
            ? 'Fleet24 Delivery in Progress'
            : 'Fleet24 Rider Online',
          notificationBody: this.isDelivering
            ? 'Live route tracking active for customer delivery.'
            : 'Connected to Fleet24 live dispatch network.',
          notificationColor: '#193B2C',
          killServiceOnDestroy: false,
        },
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.AutomotiveNavigation,
      };

      if (hasStarted) {
        // Reconfigure by stopping then restarting with new intervals/notification
        await Location.stopLocationUpdatesAsync(FLEET24_RIDER_BACKGROUND_LOCATION);
      }

      await Location.startLocationUpdatesAsync(FLEET24_RIDER_BACKGROUND_LOCATION, taskOptions);
      return true;
    } catch (err: any) {
      console.warn('[LocationService] Native background location start warning:', err?.message || err);
      return false;
    }
  }

  /**
   * Process background GPS fix delivered by FLEET24_RIDER_BACKGROUND_LOCATION task.
   */
  public async handleBackgroundLocation(update: RiderLocationUpdate): Promise<void> {
    if (this.isMockMode) return; // Strict: Never send simulated coordinates in Live Mode

    this.lastLocation = update;
    this.lastAcquiredMs = Date.now();
    this.setStatus('active');
    this.notifyListeners(update);
    await this.throttledSendToBackend(update);
  }

  public stopTracking(): void {
    if (this.webWatchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.webWatchId);
      this.webWatchId = null;
    }
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }

    if (!this.isWebEnvironment() && Platform.OS !== 'web') {
      Location.hasStartedLocationUpdatesAsync(FLEET24_RIDER_BACKGROUND_LOCATION)
        .then((hasStarted) => {
          if (hasStarted) {
            return Location.stopLocationUpdatesAsync(FLEET24_RIDER_BACKGROUND_LOCATION);
          }
        })
        .catch((err) => {
          console.warn('[LocationService] Error stopping native background location:', err);
        });
    }

    this.isTracking = false;
  }

  public getLastKnownLocation(): RiderLocationUpdate | null {
    return this.lastLocation;
  }

  public getStatus(): GpsStatus {
    // If tracking is active but no location in last 60 seconds, flag as stale
    if (
      this.isTracking &&
      this.currentStatus === 'active' &&
      this.lastAcquiredMs > 0 &&
      Date.now() - this.lastAcquiredMs > 60000
    ) {
      return 'stale';
    }
    return this.currentStatus;
  }

  public onLocationChange(listener: (loc: RiderLocationUpdate) => void): () => void {
    this.locationListeners.push(listener);
    if (this.lastLocation) {
      listener(this.lastLocation);
    }
    return () => {
      this.locationListeners = this.locationListeners.filter((l) => l !== listener);
    };
  }

  public onStatusChange(listener: (status: GpsStatus) => void): () => void {
    this.statusListeners.push(listener);
    listener(this.getStatus());
    return () => {
      this.statusListeners = this.statusListeners.filter((s) => s !== listener);
    };
  }

  private setStatus(status: GpsStatus) {
    this.currentStatus = status;
    this.statusListeners.forEach((s) => {
      try {
        s(status);
      } catch (e) {
        console.error('Error in status listener:', e);
      }
    });
  }

  private notifyListeners(loc: RiderLocationUpdate): void {
    this.locationListeners.forEach((l) => {
      try {
        l(loc);
      } catch (e) {
        console.error('Error in location listener:', e);
      }
    });
  }

  /**
   * Dispatch location to backend POST /api/v1/riders/location with intelligent rate-limiting.
   */
  private async throttledSendToBackend(update: RiderLocationUpdate): Promise<void> {
    if (this.isMockMode) return;

    const now = Date.now();
    const elapsedMs = now - this.lastSentAtMs;

    // Minimum interval: 5s if delivering, 12s if idle
    const minIntervalMs = this.isDelivering ? 5000 : 12000;
    // Minimum distance: 5m if delivering, 15m if idle
    const minDistanceMeters = this.isDelivering ? 5 : 15;

    let shouldSend = false;

    if (!this.lastSentCoords) {
      shouldSend = true;
    } else {
      const distanceMovedMeters = this.calculateDistanceMeters(
        this.lastSentCoords.latitude,
        this.lastSentCoords.longitude,
        update.latitude,
        update.longitude
      );

      // Send if:
      // 1. Min interval passed AND moved minimum distance
      // 2. Significant movement reached immediately
      // 3. Heartbeat limit (30s) reached to keep rider presence active in dispatch
      if (
        elapsedMs >= 30000 ||
        (elapsedMs >= minIntervalMs && distanceMovedMeters >= minDistanceMeters) ||
        distanceMovedMeters >= minDistanceMeters * 2
      ) {
        shouldSend = true;
      }
    }

    if (!shouldSend) return;

    this.lastSentAtMs = now;
    this.lastSentCoords = {
      latitude: update.latitude,
      longitude: update.longitude,
    };

    try {
      await riderApi.updateLocation(update);
      this.offlinePendingLocation = null;
    } catch (err: any) {
      // Temporary network failure: cache latest valid location to retry on reconnection
      this.offlinePendingLocation = update;
      console.warn('[LocationService] Location update failed (cached offline):', err?.message || err);
    }
  }

  private calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}

export const riderLocationService = new RiderLocationService();
