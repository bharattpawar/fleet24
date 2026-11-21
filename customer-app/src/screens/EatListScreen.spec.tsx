import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { EatListScreen } from './EatListScreen';
import { eatListApi, EatListEntry, EatListPage } from '../api/eatList';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
jest.mock('react-native', () => {
  const React = jest.requireActual('react');
  return {
    View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity', ScrollView: 'ScrollView',
    ActivityIndicator: 'ActivityIndicator', RefreshControl: 'RefreshControl', Alert: { alert: jest.fn() },
    StyleSheet: { create: (styles: any) => styles },
    useWindowDimensions: () => ({ width: 390, height: 844 }),
    FlatList: ({ data, renderItem, ListHeaderComponent, ListFooterComponent, ListEmptyComponent }: any) => React.createElement('FlatList', null,
      ListHeaderComponent, ...data.map((item: any) => React.createElement(React.Fragment, { key: item.key }, renderItem({ item }))), !data.length && ListEmptyComponent, ListFooterComponent),
  };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'customer-1' } }) }));
jest.mock('../context/EatListState', () => ({ useEatList: () => null }));
jest.mock('../components/ScreenEmptyState', () => ({ ScreenEmptyState: 'ScreenEmptyState' }));
jest.mock('../components/VegBadge', () => ({ VegBadge: 'VegBadge' }));
jest.mock('../components/home/HomeImage', () => ({ HomeImage: 'HomeImage' }));
jest.mock('../api/client', () => ({ API_BASE_URL: 'https://test/api/v1' }));
jest.mock('../theme/homeArt', () => ({ HOME_ART: {} }));
jest.mock('../api/eatList', () => ({ eatListApi: { list: jest.fn() } }));
const list = eatListApi.list as jest.Mock;
const entry = (id: string, plannedDate: string | null = null) => ({ id, name: `Dish ${id}`, outletId: 'outlet', menuItemId: id, restaurantName: 'Kitchen', outletName: 'Main', imageUrl: null, isVeg: true, savedPrice: 200, price: 200, createdAt: '2026-11-21T10:00:00Z', updatedAt: '2026-11-21T10:00:00Z', note: null, plannedDate, plannedTime: null, timeZone: plannedDate ? 'UTC' : null, canOpenMenu: false, isAvailable: false, outlet: null } as EatListEntry);
const page = (items: EatListEntry[], nextCursor: string | null = null): EatListPage => ({ items, nextCursor, stats: { all: 2, planned: 1, someday: 1 } });
let renderer: TestRenderer.ReactTestRenderer;
const text = () => renderer.root.findAllByType('Text' as any).map(node => [].concat(node.props.children).join('')).join(' ');
const render = async () => { await act(async () => { renderer = TestRenderer.create(<EatListScreen onRequireAuth={jest.fn()} onExploreFood={jest.fn()} onSelectOutlet={jest.fn()} />); }); };
beforeEach(() => jest.clearAllMocks());
afterEach(() => act(() => renderer?.unmount()));
describe('Eat List screen requests', () => {
  it('switches from mixed saved dishes to Planned safely while the next page is still loading', async () => {
    let resolve!: (value: EatListPage) => void;
    list.mockResolvedValueOnce(page([entry('someday'), entry('planned', '2026-12-24')]))
      .mockImplementationOnce(() => new Promise<EatListPage>(done => { resolve = done; }));
    await render(); expect(text()).toContain('Dish someday');
    await act(async () => renderer.root.findByProps({ accessibilityLabel: 'Planned' }).props.onPress());
    expect(text()).toContain('Bringing your cravings together');
    await act(async () => resolve(page([entry('planned', '2026-12-24')])));
    expect(text()).toContain('Dish planned'); expect(text()).not.toContain('Dish someday');
  });
  it('deduplicates overlapping pages and forwards the cursor', async () => {
    list.mockResolvedValueOnce(page([entry('first')], 'page-two')).mockResolvedValueOnce(page([entry('first'), entry('second')]));
    await render();
    const more = renderer.root.findAllByType('TouchableOpacity' as any).find(node => node.findAllByType('Text' as any).some(child => child.props.children === 'Load more cravings'))!;
    await act(async () => more.props.onPress());
    expect(list.mock.calls[1].slice(0, 3)).toEqual(['all', undefined, 'page-two']);
    expect(renderer.root.findAllByProps({ accessibilityLabel: 'View Dish first' })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ accessibilityLabel: 'View Dish second' })).toHaveLength(1);
  });
});
