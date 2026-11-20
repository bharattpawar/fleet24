(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  StyleSheet: { create: (s: any) => s, absoluteFill: {} },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native-maps', () => {
  const React = require('react');
  const MapView = React.forwardRef(function MockMapView(props: any, ref: any) {
    React.useImperativeHandle(ref, () => ({ fitToCoordinates: jest.fn(), animateToRegion: jest.fn() }));
    return React.createElement('MapView', props, props.children);
  });
  return { __esModule: true, default: MapView, Marker: 'Marker' };
});

import { TrackingMap } from './TrackingMap';

const restaurant = { latitude: 28.4744, longitude: 77.504 };
const dropoff = { latitude: 28.4855, longitude: 77.5135 };
const rider = { latitude: 28.48, longitude: 77.509 };

const markerIds = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAllByType('Marker' as any).map((m) => m.props.identifier);
const textOf = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAllByType('Text' as any).map((t) => [].concat(t.props.children).join('')).join(' | ');

describe('TrackingMap', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows the restaurant, drop-off and the rider at their real GPS position', async () => {
    let r!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      r = TestRenderer.create(
        <TrackingMap restaurant={restaurant} dropoff={dropoff} rider={rider} restaurantName="Tasty Bites" deliveryStatus="picked_up" isStaleLocation={false} />,
      );
    });
    expect(markerIds(r)).toEqual(['restaurant', 'dropoff', 'rider']);
    const riderMarker = r.root.findByProps({ identifier: 'rider' });
    expect(riderMarker.props.coordinate).toEqual(rider);
    expect(textOf(r)).toContain('Live rider location');
  });

  it('moves the rider marker when a new GPS point arrives', async () => {
    let r!: TestRenderer.ReactTestRenderer;
    const props = { restaurant, dropoff, restaurantName: 'Tasty Bites', deliveryStatus: 'picked_up', isStaleLocation: false };
    await act(async () => {
      r = TestRenderer.create(<TrackingMap {...props} rider={rider} />);
    });
    const moved = { latitude: 28.483, longitude: 77.511 };
    await act(async () => {
      r.update(<TrackingMap {...props} rider={moved} />);
    });
    expect(r.root.findByProps({ identifier: 'rider' }).props.coordinate).toEqual(moved);
  });

  it('waits for the rider without a rider marker', async () => {
    let r!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      r = TestRenderer.create(
        <TrackingMap restaurant={restaurant} dropoff={dropoff} rider={null} restaurantName="Tasty Bites" deliveryStatus="assigned" isStaleLocation={false} />,
      );
    });
    expect(markerIds(r)).toEqual(['restaurant', 'dropoff']);
    expect(textOf(r)).toContain('Waiting for rider location');
  });

  it('shows a message instead of a map when there are no coordinates at all', async () => {
    let r!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      r = TestRenderer.create(
        <TrackingMap restaurant={null} dropoff={null} rider={null} restaurantName="Tasty Bites" deliveryStatus="assigned" isStaleLocation={false} />,
      );
    });
    expect(r.root.findAllByType('MapView' as any)).toHaveLength(0);
    expect(textOf(r)).toContain('Map will appear once the order has a location.');
  });
});
