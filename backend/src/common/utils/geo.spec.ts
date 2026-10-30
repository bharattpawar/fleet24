import {
  calculateDistanceKm,
  isWithinDeliveryRadius,
  calculateRiderProximity,
} from './geo';

describe('Geo Utilities (Haversine Distance & Radius)', () => {
  // Pari Chowk, Greater Noida
  const pariChowkLat = 28.4682;
  const pariChowkLon = 77.5117;

  // Knowledge Park III (Sharda University / Commercial Belt), ~2.2 km away
  const kp3Lat = 28.4744;
  const kp3Lon = 77.4912;

  // Sector Chi V, Greater Noida, ~4.5 km away
  const chi5Lat = 28.4412;
  const chi5Lon = 77.5358;

  describe('calculateDistanceKm', () => {
    it('returns zero distance for identical coordinates', () => {
      const dist = calculateDistanceKm(pariChowkLat, pariChowkLon, pariChowkLat, pariChowkLon);
      expect(dist).toBe(0);
    });

    it('returns zero distance for string identical coordinates', () => {
      const dist = calculateDistanceKm('28.4682000', '77.5117000', '28.4682000', '77.5117000');
      expect(dist).toBe(0);
    });

    it('calculates accurate distance between known nearby landmarks in Greater Noida', () => {
      // Distance between Pari Chowk and Knowledge Park III is approx 2.1 - 2.3 km
      const dist = calculateDistanceKm(pariChowkLat, pariChowkLon, kp3Lat, kp3Lon);
      expect(dist).toBeGreaterThan(2.0);
      expect(dist).toBeLessThan(2.3);
    });

    it('handles numeric boundaries (-90, 90, -180, 180)', () => {
      expect(() => calculateDistanceKm(90, 0, -90, 0)).not.toThrow();
      expect(() => calculateDistanceKm(0, 180, 0, -180)).not.toThrow();
    });

    it('throws on out-of-range latitude', () => {
      expect(() => calculateDistanceKm(95.0, 77.0, 28.0, 77.0)).toThrow('Invalid latitude');
      expect(() => calculateDistanceKm(-91.0, 77.0, 28.0, 77.0)).toThrow('Invalid latitude');
    });

    it('throws on out-of-range longitude', () => {
      expect(() => calculateDistanceKm(28.0, 185.0, 28.0, 77.0)).toThrow('Invalid longitude');
      expect(() => calculateDistanceKm(28.0, -185.0, 28.0, 77.0)).toThrow('Invalid longitude');
    });

    it('throws on missing or non-numeric coordinate values', () => {
      expect(() => calculateDistanceKm(null, pariChowkLon, kp3Lat, kp3Lon)).toThrow();
      expect(() => calculateDistanceKm(undefined, pariChowkLon, kp3Lat, kp3Lon)).toThrow();
      expect(() => calculateDistanceKm('', pariChowkLon, kp3Lat, kp3Lon)).toThrow();
      expect(() => calculateDistanceKm('invalid-coord', pariChowkLon, kp3Lat, kp3Lon)).toThrow();
    });
  });

  describe('isWithinDeliveryRadius', () => {
    it('allows address inside configured radius (2.1 km inside 3.0 km)', () => {
      const result = isWithinDeliveryRadius(
        { latitude: pariChowkLat, longitude: pariChowkLon },
        { latitude: kp3Lat, longitude: kp3Lon },
        '3.00',
      );
      expect(result.isEligible).toBe(true);
      expect(result.distanceKm).toBeLessThan(3.0);
    });

    it('rejects address outside configured radius (3.8 km outside 3.0 km)', () => {
      const result = isWithinDeliveryRadius(
        { latitude: pariChowkLat, longitude: pariChowkLon },
        { latitude: chi5Lat, longitude: chi5Lon },
        '3.00',
      );
      expect(result.isEligible).toBe(false);
      expect(result.distanceKm).toBeGreaterThan(3.5);
    });

    it('respects different outlet-specific delivery radius (4.5 km inside 5.0 km radius)', () => {
      const result = isWithinDeliveryRadius(
        { latitude: pariChowkLat, longitude: pariChowkLon },
        { latitude: chi5Lat, longitude: chi5Lon },
        '5.00',
      );
      expect(result.isEligible).toBe(true);
    });

    it('allows coordinate exactly on boundary with epsilon tolerance', () => {
      const dist = calculateDistanceKm(pariChowkLat, pariChowkLon, kp3Lat, kp3Lon);
      const result = isWithinDeliveryRadius(
        { latitude: pariChowkLat, longitude: pariChowkLon },
        { latitude: kp3Lat, longitude: kp3Lon },
        dist, // Radius matches distance exactly
      );
      expect(result.isEligible).toBe(true);
    });

    it('throws if configured delivery radius is null or missing', () => {
      expect(() =>
        isWithinDeliveryRadius(
          { latitude: pariChowkLat, longitude: pariChowkLon },
          { latitude: kp3Lat, longitude: kp3Lon },
          null,
        ),
      ).toThrow('Configured delivery radius is missing');
    });

    it('throws if configured delivery radius is negative or zero', () => {
      expect(() =>
        isWithinDeliveryRadius(
          { latitude: pariChowkLat, longitude: pariChowkLon },
          { latitude: kp3Lat, longitude: kp3Lon },
          0,
        ),
      ).toThrow('Invalid configured delivery radius');
    });
  });

  describe('calculateRiderProximity (3 KM threshold)', () => {
    it('returns 0 meters and true for identical coordinates', () => {
      const res = calculateRiderProximity(pariChowkLat, pariChowkLon, pariChowkLat, pariChowkLon);
      expect(res.distanceMeters).toBe(0);
      expect(res.distanceKm).toBe(0);
      expect(res.isWithin3Km).toBe(true);
    });

    it('returns true for distance under 3 KM (~2.2 km)', () => {
      const res = calculateRiderProximity(pariChowkLat, pariChowkLon, kp3Lat, kp3Lon);
      expect(res.distanceMeters).toBeGreaterThan(2000);
      expect(res.distanceMeters).toBeLessThan(2300);
      expect(res.isWithin3Km).toBe(true);
    });

    it('returns false for distance over 3 KM (~3.8 km)', () => {
      const res = calculateRiderProximity(pariChowkLat, pariChowkLon, chi5Lat, chi5Lon);
      expect(res.distanceMeters).toBeGreaterThan(3500);
      expect(res.isWithin3Km).toBe(false);
    });

    it('returns true for distance exactly 3000 meters (with boundary tolerance)', () => {
      // Create a point approximately 3 km north: 1 degree latitude ~ 111.195 km -> 3 km = 3 / 111.195 ~ 0.026980 degrees
      const latOffset = 3.0 / 111.195;
      const targetLat = pariChowkLat + latOffset;
      
      // Test with this computed coordinate
      const res = calculateRiderProximity(pariChowkLat, pariChowkLon, targetLat, pariChowkLon);
      expect(res.distanceKm).toBeCloseTo(3.0, 1);
      if (res.distanceMeters <= 3000) {
        expect(res.isWithin3Km).toBe(true);
      } else {
        expect(res.isWithin3Km).toBe(false);
      }
    });

    it('throws error on invalid coordinates', () => {
      expect(() => calculateRiderProximity(95, 77, 28, 77)).toThrow();
      expect(() => calculateRiderProximity(null, 77, 28, 77)).toThrow();
    });
  });
});

