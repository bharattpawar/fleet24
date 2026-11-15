/**
 * Fleet24: Controlled Google Routes API Connectivity Verification Script
 *
 * Requirements:
 * - Requires explicit `--live` flag to execute.
 * - Makes exactly ONE Compute Routes call and ONE Compute Route Matrix call (2 requests total).
 * - Read-only: Zero persistent state modifications, zero database connections.
 * - Security: Never logs or prints API keys or credentials.
 * - Fails clearly on HTTP 401/403 (auth), 429 (quota), or malformed response formats.
 *
 * Usage:
 *   npx ts-node scripts/verify-google-routes-connectivity.ts --live
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from backend/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const COMPUTE_ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const COMPUTE_ROUTE_MATRIX_URL = 'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix';

// Greater Noida Pilot Area Test Coordinates
const TEST_COORDINATES = {
  pariChowk: { latitude: 28.4744, longitude: 77.5040, name: 'Pari Chowk' },
  knowledgePark3: { latitude: 28.4610, longitude: 77.4980, name: 'Knowledge Park III' },
  alpha1Commercial: { latitude: 28.4720, longitude: 77.5130, name: 'Alpha 1 Commercial Belt' },
};

async function main() {
  const args = process.argv.slice(2);
  const isLive = args.includes('--live');

  console.log('================================================================');
  console.log(' Fleet24: Google Routes API Controlled Connectivity Test');
  console.log('================================================================');

  if (!isLive) {
    console.log('\n[DRY RUN MODE] The --live flag was not passed.');
    console.log('To execute the live verification, pass the --live flag:');
    console.log('  npx ts-node scripts/verify-google-routes-connectivity.ts --live\n');
    console.log('Planned verification requests:');
    console.log('  1. Compute Routes: Pari Chowk -> Alpha 1 Commercial Belt (1 billable request)');
    console.log('  2. Compute Route Matrix: [Pari Chowk, Knowledge Park III] -> [Alpha 1 Commercial Belt] (2 billable elements)');
    console.log('Total Billable Scope: 1 Compute Routes request + 2 Matrix elements.\n');
    process.exit(0);
  }

  const apiKey = process.env.GOOGLE_ROUTES_API_KEY?.trim();

  if (!apiKey) {
    console.error('\n[Error] GOOGLE_ROUTES_API_KEY is not configured in backend/.env or environment.');
    console.error('Please configure GOOGLE_ROUTES_API_KEY="<your-key>" in backend/.env and retry.\n');
    process.exit(1);
  }

  console.log('\nConfiguration verified:');
  console.log('  - Provider: Google Routes API v2');
  console.log('  - Key Status: Present in local environment (hidden)');
  console.log('  - Database Connection: None (Pure Read-Only HTTP test)');
  console.log('  - Retries: Disabled (Strict single attempt per test)\n');

  let routesSuccess = false;
  let matrixSuccess = false;

  // =========================================================================
  // TEST 1: Compute Routes (Point-to-Point)
  // =========================================================================
  console.log('----------------------------------------------------------------');
  console.log(' TEST 1: Compute Routes (Point-to-Point)');
  console.log(` Origin:      ${TEST_COORDINATES.pariChowk.name} (${TEST_COORDINATES.pariChowk.latitude}, ${TEST_COORDINATES.pariChowk.longitude})`);
  console.log(` Destination: ${TEST_COORDINATES.alpha1Commercial.name} (${TEST_COORDINATES.alpha1Commercial.latitude}, ${TEST_COORDINATES.alpha1Commercial.longitude})`);
  console.log('----------------------------------------------------------------');

  const routesPayload = {
    origin: {
      location: {
        latLng: {
          latitude: TEST_COORDINATES.pariChowk.latitude,
          longitude: TEST_COORDINATES.pariChowk.longitude,
        },
      },
    },
    destination: {
      location: {
        latLng: {
          latitude: TEST_COORDINATES.alpha1Commercial.latitude,
          longitude: TEST_COORDINATES.alpha1Commercial.longitude,
        },
      },
    },
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_UNAWARE',
    computeAlternativeRoutes: false,
  };

  const routesFieldMask = 'routes.distanceMeters,routes.duration';
  const startRoutesTime = Date.now();

  try {
    const res = await fetch(COMPUTE_ROUTES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': routesFieldMask,
      },
      body: JSON.stringify(routesPayload),
      signal: AbortSignal.timeout(5000),
    });

    const latencyMs = Date.now() - startRoutesTime;

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[FAIL] HTTP Error ${res.status} (${res.statusText}) in ${latencyMs}ms`);
      if (res.status === 401 || res.status === 403) {
        console.error('Reason: Authentication/Authorization failure. Ensure API key is valid and restricted to Routes API.');
      } else if (res.status === 429) {
        console.error('Reason: Quota / Rate limit exceeded.');
      }
      console.error(`Details: ${errBody}`);
    } else {
      const data = (await res.json()) as any;
      if (!data.routes || data.routes.length === 0) {
        console.error(`[FAIL] Response OK but returned zero routes in ${latencyMs}ms.`);
      } else {
        const route = data.routes[0];
        const distanceMeters = route.distanceMeters;
        const durationStr = route.duration;
        console.log(`[PASS] Success in ${latencyMs}ms`);
        console.log(`  - Distance: ${distanceMeters} metres (${(distanceMeters / 1000).toFixed(2)} km)`);
        console.log(`  - Duration: ${durationStr}`);
        console.log('  - FieldMask applied: Basic SKU (routes.distanceMeters,routes.duration)');
        routesSuccess = true;
      }
    }
  } catch (err: any) {
    const latencyMs = Date.now() - startRoutesTime;
    console.error(`[FAIL] Request failed in ${latencyMs}ms: ${err?.message || err}`);
  }

  // =========================================================================
  // TEST 2: Compute Route Matrix (2 Origins x 1 Destination)
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log(' TEST 2: Compute Route Matrix (2 Origins x 1 Destination)');
  console.log(` Origin 0:    ${TEST_COORDINATES.pariChowk.name}`);
  console.log(` Origin 1:    ${TEST_COORDINATES.knowledgePark3.name}`);
  console.log(` Destination: ${TEST_COORDINATES.alpha1Commercial.name}`);
  console.log('----------------------------------------------------------------');

  const matrixPayload = {
    origins: [
      {
        waypoint: {
          location: {
            latLng: {
              latitude: TEST_COORDINATES.pariChowk.latitude,
              longitude: TEST_COORDINATES.pariChowk.longitude,
            },
          },
        },
      },
      {
        waypoint: {
          location: {
            latLng: {
              latitude: TEST_COORDINATES.knowledgePark3.latitude,
              longitude: TEST_COORDINATES.knowledgePark3.longitude,
            },
          },
        },
      },
    ],
    destinations: [
      {
        waypoint: {
          location: {
            latLng: {
              latitude: TEST_COORDINATES.alpha1Commercial.latitude,
              longitude: TEST_COORDINATES.alpha1Commercial.longitude,
            },
          },
        },
      },
    ],
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_UNAWARE',
  };

  const matrixFieldMask = 'originIndex,destinationIndex,status,distanceMeters,duration,condition';
  const startMatrixTime = Date.now();

  try {
    const res = await fetch(COMPUTE_ROUTE_MATRIX_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': matrixFieldMask,
      },
      body: JSON.stringify(matrixPayload),
      signal: AbortSignal.timeout(5000),
    });

    const latencyMs = Date.now() - startMatrixTime;

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[FAIL] HTTP Error ${res.status} (${res.statusText}) in ${latencyMs}ms`);
      console.error(`Details: ${errBody}`);
    } else {
      const rawElements = (await res.json()) as any[];
      console.log(`[PASS] Success in ${latencyMs}ms. Received ${rawElements.length} matrix elements:`);

      for (const el of rawElements) {
        const oIdx = el.originIndex ?? 0;
        const dIdx = el.destinationIndex ?? 0;
        const originName = oIdx === 0 ? TEST_COORDINATES.pariChowk.name : TEST_COORDINATES.knowledgePark3.name;
        const destName = TEST_COORDINATES.alpha1Commercial.name;

        console.log(`  - [${oIdx} -> ${dIdx}] ${originName} -> ${destName}:`);
        console.log(`      Condition: ${el.condition || 'N/A'}`);
        console.log(`      Distance:  ${el.distanceMeters} metres (${(el.distanceMeters / 1000).toFixed(2)} km)`);
        console.log(`      Duration:  ${el.duration || 'N/A'}`);
      }

      matrixSuccess = rawElements.length === 2 && rawElements.every((el) => el.condition === 'ROUTE_EXISTS');
    }
  } catch (err: any) {
    const latencyMs = Date.now() - startMatrixTime;
    console.error(`[FAIL] Matrix request failed in ${latencyMs}ms: ${err?.message || err}`);
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n================================================================');
  console.log(' Verification Execution Summary');
  console.log('================================================================');
  console.log(` Compute Routes:       ${routesSuccess ? 'PASS' : 'FAIL'}`);
  console.log(` Compute Route Matrix: ${matrixSuccess ? 'PASS' : 'FAIL'}`);
  console.log(` Total HTTP Requests:  2`);
  console.log(` Total Billable Units: 1 Route call + 2 Matrix elements`);
  console.log(' Persistent DB State:  UNTOUCHED');
  console.log('================================================================\n');

  if (routesSuccess && matrixSuccess) {
    console.log('Google Routes API connectivity is fully verified and ready for Phase 2.\n');
    process.exit(0);
  } else {
    console.error('Google Routes connectivity test did not fully succeed. See above errors.\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[Fatal Error]', err);
  process.exit(1);
});
