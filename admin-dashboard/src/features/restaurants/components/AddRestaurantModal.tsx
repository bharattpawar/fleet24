import { hasOutletCoordinates, OutletPlaceSearch } from './OutletPlaceSearch';
import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { restaurantsApi } from '@/lib/api/restaurants';
import { Store, Plus, AlertCircle } from 'lucide-react';

interface AddRestaurantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddRestaurantModal: React.FC<AddRestaurantModalProps> = ({
  isOpen,
  onClose,
}) => {
  const queryClient = useQueryClient();

  // Restaurant details
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  // Primary Outlet details
  const [outletName, setOutletName] = useState('');
  const [outletPhone, setOutletPhone] = useState('+91');
  const [outletAddress, setOutletAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState('5.0');

  const [ownerId, setOwnerId] = useState('');
  const [createdRestaurantId, setCreatedRestaurantId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      let restId = createdRestaurantId;

      // 1. Create Restaurant Brand if not already created in a previous attempt
      if (!restId) {
        const rest = await restaurantsApi.createRestaurant({
          name: name.trim(),
          slug: slug.trim() || undefined,
          description: description.trim() || undefined,
          logoUrl: logoUrl.trim() || undefined,
          ownerId: ownerId.trim() || undefined,
        });
        const resolvedId = rest?.id || rest?.data?.id;
        if (!resolvedId) {
          throw new Error('Restaurant was created but backend returned an unrecognized response format.');
        }
        restId = resolvedId;
        setCreatedRestaurantId(resolvedId);
      }

      // 2. Create Initial Outlet
      if (!restId) throw new Error('Failed to resolve restaurant ID.');
      await restaurantsApi.createOutlet(restId, {
        name: outletName.trim() || `${name.trim()} - Main Outlet`,
        phone: outletPhone.trim(),
        address: outletAddress.trim(),
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        deliveryRadiusKm: parseFloat(deliveryRadiusKm),
      });

      return restId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'restaurants'] });
      onClose();
      resetForm();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Failed to complete restaurant setup.';
      if (createdRestaurantId) {
        setError(`Restaurant brand was created successfully, but outlet initialization failed: ${msg}. You can adjust outlet details and retry, or add the outlet directly from restaurant details.`);
      } else {
        setError(msg);
      }
    },
  });

  const resetForm = () => {
    setName('');
    setSlug('');
    setDescription('');
    setLogoUrl('');
    setOwnerId('');
    setOutletName('');
    setOutletPhone('+91');
    setOutletAddress('');
    setLatitude('');
    setLongitude('');
    setDeliveryRadiusKm('5.0');
    setCreatedRestaurantId(null);
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-[#FFFFFF] border border-[#205641] rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 pb-3 border-b border-[#E3E7EC]">
          <div className="w-9 h-9 rounded-xl bg-[#205641] text-white flex items-center justify-center font-bold">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#171A21]">Onboard New Restaurant</h2>
            <p className="text-[11px] text-slate-600">
              Create restaurant brand and initialize primary operating outlet in Super Admin directory
            </p>
          </div>
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
            if (!hasOutletCoordinates(latitude, longitude)) {
              setError('Enter valid latitude and longitude or select an address.');
              return;
            }
            createMutation.mutate();
          }}
          className="space-y-4 max-h-[520px] overflow-y-auto pr-1"
        >
          {/* Restaurant Brand Info */}
          <div className="space-y-3">
            <span className="text-[10px] font-bold  text-[#205641]">
              1. Brand & Identity
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                  Restaurant Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Royal Biryani House"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg bg-[#F5F6F8] border border-[#205641] text-[#171A21] focus:outline-none focus:border-[#205641]"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                  Custom Slug (optional)
                </label>
                <input
                  type="text"
                  placeholder="royal-biryani-house"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  className="w-full text-xs p-2.5 rounded-lg bg-[#F5F6F8] border border-[#205641] text-[#171A21] focus:outline-none focus:border-[#205641] tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                Brand Logo URL
              </label>
              <input
                type="url"
                placeholder="https://images.unsplash.com/..."
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg bg-[#F5F6F8] border border-[#205641] text-[#171A21] focus:outline-none focus:border-[#205641]"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                Owner User Account UUID (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. 00000000-0000-0000-0000-000000000001"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg bg-[#F5F6F8] border border-[#205641] text-[#171A21] focus:outline-none focus:border-[#205641] tabular-nums"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                Brand Description
              </label>
              <textarea
                rows={2}
                placeholder="Authentic Hyderabadi biryani, kebabs, and Mughlai curries..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg bg-[#F5F6F8] border border-[#205641] text-[#171A21] focus:outline-none focus:border-[#205641]"
              />
            </div>
          </div>

          {/* Primary Outlet Information */}
          <div className="space-y-3 pt-2 border-t border-[#E3E7EC]">
            <span className="text-[10px] font-bold  text-[#205641]">
              2. Primary Operating Outlet
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                  Outlet Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Indiranagar Kitchen"
                  value={outletName}
                  onChange={(e) => setOutletName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg bg-[#F5F6F8] border border-[#205641] text-[#171A21] focus:outline-none focus:border-[#205641]"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                  Outlet Phone (+91) *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+919876543210"
                  value={outletPhone}
                  onChange={(e) => setOutletPhone(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg bg-[#F5F6F8] border border-[#205641] text-[#171A21] focus:outline-none focus:border-[#205641] tabular-nums"
                />
              </div>
            </div>

            <OutletPlaceSearch onSelect={(place) => {
              setOutletAddress(place.formattedAddress);
              setLatitude(String(place.latitude));
              setLongitude(String(place.longitude));
            }} />
            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                Kitchen Address *
              </label>
              <textarea
                rows={2}
                required
                placeholder="Building, street, city and postal code"
                value={outletAddress}
                onChange={(e) => setOutletAddress(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg bg-[#F5F6F8] border border-[#205641] text-[#171A21] focus:outline-none focus:border-[#205641]"
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
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E3E7EC]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-slate-600 hover:text-[#171A21] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !name.trim() || !outletAddress.trim()}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#205641] text-white text-xs font-bold hover:bg-[#205641]/80 transition-colors disabled:opacity-50 cursor-pointer shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>{createMutation.isPending ? 'Onboarding...' : 'Onboard Restaurant'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
