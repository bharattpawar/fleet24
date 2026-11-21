import { appStyles } from '../theme/appStyles';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { exploreColors as c } from '../theme/tokens';
import { HomeImage } from './home/HomeImage';
import { fallbackArt } from '../utils/imageRef';
import { DeliveryEta, formatEta } from '../utils/deliveryEta';

export interface OutletSummary {
  id: string;
  restaurantName: string;
  outletName: string;
  slug: string;
  logoUrl: string | null;
  address: string;
  deliveryRadiusKm: string;
  distanceKm?: number;
  /** Server estimate for the selected delivery location. */
  deliveryEta?: DeliveryEta | null;
  isAcceptingOrders: boolean;
  /** Admin-set discount text for Home, e.g. "50% OFF". */
  offerTitle?: string | null;
  /** Admin-set sub-line, e.g. "UPTO ₹100". */
  offerSubtitle?: string | null;
  /** Admin-set food photo for Home cards; falls back to logoUrl. */
  coverImageUrl?: string | null;
}

export function RestaurantCard({ outlet, onPress, editorial, compact }: { outlet: OutletSummary; onPress: () => void; editorial?: boolean; compact?: boolean }) {
  const distance = outlet.distanceKm;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={outlet.restaurantName}
      activeOpacity={0.88}
      onPress={onPress}
      style={[styles.card, compact && styles.compactCard]}
    >
      <View style={[styles.photo, compact && styles.compactPhoto]}>
        <HomeImage source={outlet.coverImageUrl || outlet.logoUrl} fallback={fallbackArt(outlet.restaurantName)} alt={`${outlet.restaurantName} food`} />
        {outlet.offerTitle ? (
          <View style={styles.offerShade}>
            <Text style={[styles.offerTitle, compact && styles.compactOfferTitle]} numberOfLines={1}>{outlet.offerTitle}</Text>
            {outlet.offerSubtitle ? <Text style={styles.offerSubtitle} numberOfLines={1}>{outlet.offerSubtitle}</Text> : null}
          </View>
        ) : null}
        {!outlet.isAcceptingOrders && <Text style={styles.closed}>Closed</Text>}
      </View>
      <View style={[styles.content, compact && styles.compactContent]}>
        <View style={styles.details}>
          <Text style={[styles.name, compact && styles.compactName, editorial && styles.editorialName]} numberOfLines={compact ? 1 : 2}>{outlet.restaurantName}</Text>
          <View style={styles.meta}>
            <View style={styles.detail}>
              <View style={[styles.statusDot, !outlet.isAcceptingOrders && styles.closedDot]} />
              <Text style={[styles.availability, compact && styles.compactCaption]}>{outlet.isAcceptingOrders ? 'Accepting orders' : 'Currently closed'}</Text>
            </View>
            {(formatEta(outlet.deliveryEta) || typeof distance === 'number') && (
              <Text style={[styles.caption, compact && styles.compactCaption]}>
                {[formatEta(outlet.deliveryEta), typeof distance === 'number' ? `${distance.toFixed(1)} km` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            )}
          </View>
          <Text style={[styles.caption, compact && styles.compactCaption]} numberOfLines={1}>{outlet.outletName}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = appStyles({
  compactCard: { borderRadius: 0, marginBottom: 0, boxShadow: 'none' },
  compactPhoto: { aspectRatio: 0.88, borderRadius: 18 },
  compactContent: { paddingHorizontal: 1, paddingTop: 8, paddingBottom: 0 },
  compactName: { fontSize: 15, lineHeight: 20, fontWeight: '700', letterSpacing: -0.4 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 0, boxShadow: '0px 5px 20px rgba(20, 35, 25, 0.07)',
    borderColor: c.border, marginBottom: 24, overflow: 'hidden',
  },
  photo: { aspectRatio: 1.9, overflow: 'hidden' },
  offerShade: {
    position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12, paddingTop: 28, paddingBottom: 9,
    backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.78) 100%)',
  },
  offerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  compactOfferTitle: { fontSize: 16 },
  offerSubtitle: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.4, opacity: 0.9 },
  closed: {
    position: 'absolute', top: 8, left: 8, color: c.ink, backgroundColor: c.surface,
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, fontSize: 11, fontWeight: '600',
  },
  content: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 11, paddingBottom: 15, gap: 10 },
  icon: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: c.tint,
    alignItems: 'center', justifyContent: 'center',
  },
  details: { flex: 1 },
  name: { color: c.ink, fontSize: 21, lineHeight: 25, fontWeight: '800', letterSpacing: -0.6 },
  editorialName: { fontFamily: 'HomeBold' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 3, marginTop: 6, marginBottom: 5 },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  caption: { color: '#777B80', fontSize: 13, lineHeight: 18 },
  availability: { color: '#4E5751', fontSize: 12, lineHeight: 18, fontWeight: '500' },
  compactCaption: { fontSize: 11, lineHeight: 16 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.green, marginRight: 2 },
  closedDot: { backgroundColor: '#949894' },
});
