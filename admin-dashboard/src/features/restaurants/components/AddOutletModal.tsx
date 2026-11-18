import { hasOutletCoordinates, OutletPlaceSearch } from './OutletPlaceSearch';
import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { restaurantsApi } from '@/lib/api/restaurants';
import { Store, AlertCircle } from 'lucide-react';

interface AddOutletModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantId: string;
  restaurantName: string;
}

export const AddOutletModal: React.FC<AddOutletModalProps> = ({
  isOpen,
  onClose,
  restaurantId,
  restaurantName,
}) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState('5.0');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const createOutletMutation = useMutation({
    mutationFn: () =>
      restaurantsApi.createOutlet(restaurantId, {
        name,
        phone,
        address,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        deliveryRadiusKm: parseFloat(deliveryRadiusKm),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'restaurant', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'restaurants'] });
      onClose();
    },
    onError: (err: any) => {
      setErrorMsg(
        err?.response?.data?.message || err?.message || 'Failed to create outlet for restaurant.',
      );
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!name.trim() || !phone.trim() || !address.trim()) {
      setErrorMsg('Please fill in all required outlet details.');
      return;
    }
    if (!hasOutletCoordinates(latitude, longitude)) {
      setErrorMsg('Enter valid latitude and longitude or select an address.');
      return;
    }
    createOutletMutation.mutate();
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-[#FFFFFF] border border-[#205641] rounded-2xl max-w-lg w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E3E7EC] pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#E8F2ED] border border-[#E3E7EC] text-[#205641]">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#171A21]">Add Physical Outlet</h3>
              <p className="text-[11px] text-slate-600">For {restaurantName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-600 hover:text-[#171A21] text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-[#9A431F]/15 border border-[#9A431F]/30 flex items-center gap-2 text-xs text-[#9A431F]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Outlet Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sector 62 Branch"
              className="w-full p-2.5 rounded-lg bg-[#F5F6F8] border border-[#205641] text-[#171A21] focus:outline-none focus:border-[#205641]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Contact Phone *
            </label>
            <input
              type="text"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+919876543210"
              className="w-full p-2.5 rounded-lg bg-[#F5F6F8] border border-[#205641] text-[#171A21] focus:outline-none focus:border-[#205641]"
            />
          </div>

          <OutletPlaceSearch onSelect={(place) => {
            setAddress(place.formattedAddress);
            setLatitude(String(place.latitude));
            setLongitude(String(place.longitude));
          }} />
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Full Physical Address *
            </label>
            <textarea
              required
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ground Floor, Tower A, Tech Park..."
              className="w-full p-2.5 rounded-lg bg-[#F5F6F8] border border-[#205641] text-[#171A21] focus:outline-none focus:border-[#205641]"
            />
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                Latitude *
              </label>
              <input
                type="text"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className="w-full p-2 rounded-lg bg-[#F5F6F8] border border-[#205641] text-[#171A21] text-center tabular-nums focus:outline-none focus:border-[#205641]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                Longitude *
              </label>
              <input
                type="text"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="w-full p-2 rounded-lg bg-[#F5F6F8] border border-[#205641] text-[#171A21] text-center tabular-nums focus:outline-none focus:border-[#205641]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                Radius (KM) *
              </label>
              <input
                type="text"
                required
                value={deliveryRadiusKm}
                onChange={(e) => setDeliveryRadiusKm(e.target.value)}
                className="w-full p-2 rounded-lg bg-[#F5F6F8] border border-[#205641] text-[#171A21] text-center tabular-nums focus:outline-none focus:border-[#205641]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E3E7EC]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-600 hover:text-[#171A21] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createOutletMutation.isPending}
              className="px-4 py-2 rounded-lg bg-[#205641] text-white text-xs font-bold hover:bg-[#205641]/80 disabled:opacity-50 cursor-pointer"
            >
              {createOutletMutation.isPending ? 'Creating Outlet...' : 'Create Outlet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
