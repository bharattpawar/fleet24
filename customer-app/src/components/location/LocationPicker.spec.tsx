(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

jest.mock('react-native', () => {
  const base = jest.requireActual('../../../test/react-native-mock.js');
  const anim = () => {
    const v: any = { setValue: jest.fn(), interpolate: () => 0 };
    return v;
  };
  return {
    ...base,
    View: 'View',
    Text: 'Text',
    TextInput: 'TextInput',
    ScrollView: 'ScrollView',
    Pressable: 'Pressable',
    ActivityIndicator: 'ActivityIndicator',
    KeyboardAvoidingView: 'KeyboardAvoidingView',
    StyleSheet: { create: (s: any) => s, absoluteFill: {} },
    AccessibilityInfo: {
      isReduceMotionEnabled: () => Promise.resolve(true),
      addEventListener: () => ({ remove: () => undefined }),
    },
    Animated: {
      ...base.Animated,
      Value: function () {
        return anim();
      },
      View: 'Animated.View',
      timing: () => ({ start: (cb?: () => void) => cb && cb() }),
      spring: () => ({ start: (cb?: () => void) => cb && cb() }),
    },
  };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({ coords: { latitude: 28.4721, longitude: 77.4912 } }),
  Accuracy: { High: 4 },
}));
jest.mock('./MapPinView', () => ({ MapPinView: 'MapPinView' }));
jest.mock('../../api/geo', () => ({
  newPlacesSessionToken: () => 'session_token_123',
  searchPlaces: jest.fn().mockResolvedValue([
    { placeId: 'ChIJsharda0001', primaryText: 'Sharda University', secondaryText: 'Knowledge Park III, Greater Noida' },
  ]),
  getPlaceLocation: jest.fn().mockResolvedValue({
    latitude: 28.4731235, longitude: 77.4831235, formattedAddress: 'Plot 32, Knowledge Park III, Greater Noida 201310',
    area: 'Knowledge Park III', city: 'Greater Noida', state: 'Uttar Pradesh', postalCode: '201310',
  }),
  reverseGeocode: jest.fn().mockResolvedValue({
    latitude: 28.4721, longitude: 77.4912, formattedAddress: 'Alpha 2, Greater Noida 201310',
    area: 'Alpha 2', city: 'Greater Noida', state: 'Uttar Pradesh', postalCode: '201310',
  }),
  isServiceable: jest.fn().mockResolvedValue(true),
}));

import { LocationPicker } from './LocationPicker';
import * as geo from '../../api/geo';

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const textOf = (root: TestRenderer.ReactTestInstance) =>
  root.findAllByType('Text' as any).map((t) => [].concat(t.props.children as any).join('')).join(' | ');
const pressByLabel = (root: TestRenderer.ReactTestInstance, text: string) => {
  const target = root.findAll((n) => (n.type as any) === 'Pressable' && textOf(n).includes(text))[0];
  if (!target) throw new Error(`No pressable with text "${text}"`);
  return act(async () => { await target.props.onPress(); });
};

describe('LocationPicker', () => {
  const mounted: TestRenderer.ReactTestRenderer[] = [];
  const mount = async (el: React.ReactElement) => {
    let r!: TestRenderer.ReactTestRenderer;
    await act(async () => { r = TestRenderer.create(el); });
    mounted.push(r);
    return r;
  };
  beforeEach(() => jest.useFakeTimers({ doNotFake: ['setTimeout'] }));
  // Unmount so pending geocode replies cannot update a finished test (they used to log after Jest finished).
  afterEach(async () => {
    await act(async () => { mounted.splice(0).forEach((r) => r.unmount()); });
    jest.useRealTimers();
  });

  it('search → pick place → confirm pin → details → saves real coordinates', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const renderer = await mount(<LocationPicker onCancel={jest.fn()} onSubmit={onSubmit} />);
    const root = renderer.root;
    expect(textOf(root)).toContain('Use my current location');

    await act(async () => { root.findByType('TextInput' as any).props.onChangeText('sharda'); });
    await act(async () => { await new Promise((r) => setTimeout(r, 350)); });
    await flush();
    expect(geo.searchPlaces).toHaveBeenCalledWith('sharda', 'session_token_123', undefined);

    await pressByLabel(root, 'Sharda University');
    await flush();
    expect(geo.getPlaceLocation).toHaveBeenCalledWith('ChIJsharda0001', 'session_token_123');
    expect(root.findByType('MapPinView' as any).props.latitude).toBeCloseTo(28.4731235);
    expect(textOf(root)).toContain('Knowledge Park III');

    await pressByLabel(root, 'Confirm location');
    // Area, city and PIN are prefilled; flat is required.
    await pressByLabel(root, 'Save address');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(textOf(root)).toContain('Add your house / flat / floor');

    const flat = root.findAllByType('TextInput' as any).find((i) => i.props.accessibilityLabel === 'House / flat / floor');
    await act(async () => { flat!.props.onChangeText('Flat 402, Tower B'); });
    await pressByLabel(root, 'Save address');

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      addressLine1: 'Flat 402, Tower B',
      addressLine2: 'Knowledge Park III',
      city: 'Greater Noida',
      postalCode: '201310',
      latitude: '28.4731235',
      longitude: '77.4831235',
      label: 'Home',
    }));
  });

  it('uses the phone GPS point and reverse-geocodes it', async () => {
    const renderer = await mount(<LocationPicker onCancel={jest.fn()} onSubmit={jest.fn()} />);
    await pressByLabel(renderer.root, 'Use my current location');
    await flush();
    expect(geo.reverseGeocode).toHaveBeenCalledWith(28.4721, 77.4912);
    expect(textOf(renderer.root)).toContain('Alpha 2');
  });

  it('a late geocode reply for an earlier pin does not replace a place picked from search', async () => {
    const held: Array<(v: unknown) => void> = [];
    const finishGps = (v: unknown) => held.splice(0).forEach((resolve) => resolve(v));
    (geo.reverseGeocode as jest.Mock).mockImplementation(() => new Promise((resolve) => { held.push(resolve); }));
    const renderer = await mount(<LocationPicker onCancel={jest.fn()} onSubmit={jest.fn()} />);
    const root = renderer.root;

    await pressByLabel(root, 'Use my current location'); // GPS pin is still resolving...
    await flush();
    await pressByLabel(root, 'Change');
    await act(async () => { root.findByType('TextInput' as any).props.onChangeText('sharda'); });
    await act(async () => { await new Promise((r) => setTimeout(r, 350)); });
    await flush();
    await pressByLabel(root, 'Sharda University');
    await flush();
    expect(textOf(root)).toContain('Knowledge Park III');

    await act(async () => {
      finishGps({ latitude: 28.4721, longitude: 77.4912, formattedAddress: 'Alpha 2, Greater Noida 201310', area: 'Alpha 2', city: 'Greater Noida', state: 'Uttar Pradesh', postalCode: '201310' });
    });
    await flush();
    expect(root.findByType('MapPinView' as any).props.latitude).toBeCloseTo(28.4731235);
    expect(textOf(root)).toContain('Knowledge Park III');
    expect(textOf(root)).not.toContain('Alpha 2');
    (geo.reverseGeocode as jest.Mock).mockResolvedValue({
      latitude: 28.4721, longitude: 77.4912, formattedAddress: 'Alpha 2, Greater Noida 201310',
      area: 'Alpha 2', city: 'Greater Noida', state: 'Uttar Pradesh', postalCode: '201310',
    });
  });

  it('opens an unconfirmed legacy address in search, not on the fake point', async () => {
    const renderer = await mount(
      <LocationPicker
        initial={{ addressLine1: 'Room 14', latitude: '28.4855000', longitude: '77.5135000', needsLocationConfirmation: true }}
        onCancel={jest.fn()}
        onSubmit={jest.fn()}
      />,
    );
    expect(renderer.root.findAllByType('MapPinView' as any)).toHaveLength(0);
    expect(textOf(renderer.root)).toContain('Use my current location');
  });
});
