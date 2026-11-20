import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { restaurantsApi } from '@/lib/api/restaurants';
import type { RestaurantOutlet } from '@/types/restaurants';
import { Settings, AlertCircle } from 'lucide-react';
import { ImageField } from '@/components/media/ImageField';

interface OutletDeliverySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  outlet: RestaurantOutlet;
  restaurantId: string;
}

export const OutletDeliverySettingsModal: React.FC<OutletDeliverySettingsModalProps> = ({
  isOpen,
  onClose,
  outlet,
  restaurantId,
}) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState(outlet.name);
  const [phone, setPhone] = useState(outlet.phone);
  const [address, setAddress] = useState(outlet.address);
  const [latitude, setLatitude] = useState(outlet.latitude);
  const [longitude, setLongitude] = useState(outlet.longitude);
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState(outlet.deliveryRadiusKm || '5.0');
  const [offerTitle, setOfferTitle] = useState(outlet.offerTitle ?? '');
  const [offerSubtitle, setOfferSubtitle] = useState(outlet.offerSubtitle ?? '');
  const [coverImageUrl, setCoverImageUrl] = useState(outlet.coverImageUrl ?? '');
  const [error, setError] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: () =>
      restaurantsApi.updateOutlet(outlet.id, {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        deliveryRadiusKm: parseFloat(deliveryRadiusKm),
        offerTitle: offerTitle.trim(),
        offerSubtitle: offerSubtitle.trim(),
        coverImageUrl: coverImageUrl.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'restaurant', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'restaurants'] });
      onClose();
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message || err?.message || 'Failed to update outlet delivery settings.');
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-60">
      <div className="bg-[#FFFFFF] border border-[#205641] rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
        <div className="flex items-center gap-2 text-[#205641]">
          <Settings className="w-5 h-5" />
          <h3 className="text-sm font-bold text-[#171A21]">Outlet & Delivery Configuration</h3>
        </div>

        {error && (
          <div className="p-3 bg-[#9A431F]/15 border border-[#9A431F]/30 rounded-xl text-xs text-[#9A431F] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
              Outlet Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs p-2 rounded-lg bg-[#F5F6F8] border border-[#205641] text-[#171A21] focus:outline-none focus:border-[#205641]"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
              Contact Phone *
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full text-xs p-2 rounded-lg bg-[#F5F6F8] border border-[#205641] text-[#171A21] focus:outline-none focus:border-[#205641] tabular-nums"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
              Address *
            </label>
            <textarea
              rows={2}
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full text-xs p-2 rounded-lg bg-[#F5F6F8] border border-[#205641] text-[#171A21] focus:outline-none focus:border-[#205641]"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                Latitude *
              </label>
              <input
                type="number"
                step="any"
                required
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className="w-full text-xs p-2 rounded-lg bg-[#F5F6F8] border border-[#205641] text-[#171A21] focus:outline-none focus:border-[#205641] tabular-nums"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                Longitude *
              </label>
              <input
                type="number"
                step="any"
                required
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="w-full text-xs p-2 rounded-lg bg-[#F5F6F8] border border-[#205641] text-[#171A21] focus:outline-none focus:border-[#205641] tabular-nums"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                Delivery Radius (km) *
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="25"
                required
                value={deliveryRadiusKm}
                onChange={(e) => setDeliveryRadiusKm(e.target.value)}
                className="w-full text-xs p-2 rounded-lg bg-[#F5F6F8] border border-[#205641] text-[#171A21] focus:outline-none focus:border-[#205641] tabular-nums"
              />
            </div>
          </div>

          <fieldset className="space-y-2 rounded-xl border border-[#205641]/30 p-3">
            <legend className="px-1 text-[11px] font-bold text-[#205641]">Home offer (customer app card)</legend>
            <p className="text-[11px] text-slate-600">Shown over the food photo on Home. Leave blank for no offer; the Offers tab only lists outlets with a discount line.</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-[11px] font-semibold text-slate-600 block">Discount line
                <input type="text" maxLength={30} placeholder="50% OFF" value={offerTitle} onChange={(e) => setOfferTitle(e.target.value)} className="w-full text-xs p-2 rounded-lg bg-[#F5F6F8] border border-[#205641] text-[#171A21] focus:outline-none focus:border-[#205641] mt-1" />
              </label>
              <label className="text-[11px] font-semibold text-slate-600 block">Sub-line
                <input type="text" maxLength={30} placeholder="UPTO ₹100" value={offerSubtitle} onChange={(e) => setOfferSubtitle(e.target.value)} className="w-full text-xs p-2 rounded-lg bg-[#F5F6F8] border border-[#205641] text-[#171A21] focus:outline-none focus:border-[#205641] mt-1" />
              </label>
            </div>
            <ImageField
              label="Cover photo (falls back to the logo)"
              optional
              value={coverImageUrl}
              onChange={setCoverImageUrl}
              aspect={{ width: 4, height: 3, hint: '1200 × 900' }}
            />
          </fieldset>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-600 hover:text-[#171A21] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending || !name.trim() || !phone.trim() || !address.trim()}
              className="px-4 py-1.5 rounded-lg bg-[#205641] text-white text-xs font-bold hover:bg-[#205641]/80 disabled:opacity-50 cursor-pointer"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
