import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { restaurantsApi } from '@/lib/api/restaurants';
import { Edit3, AlertCircle } from 'lucide-react';

interface EditRestaurantModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurant: {
    id: string;
    name: string;
    description: string | null;
    logoUrl: string | null;
    ownerId?: string | null;
  };
}

export const EditRestaurantModal: React.FC<EditRestaurantModalProps> = ({
  isOpen,
  onClose,
  restaurant,
}) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState(restaurant.name);
  const [description, setDescription] = useState(restaurant.description || '');
  const [logoUrl, setLogoUrl] = useState(restaurant.logoUrl || '');
  const [ownerId, setOwnerId] = useState(restaurant.ownerId || '');
  const [error, setError] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: () =>
      restaurantsApi.updateRestaurant(restaurant.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        ownerId: ownerId.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'restaurant', restaurant.id] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'restaurants'] });
      onClose();
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message || err?.message || 'Failed to update restaurant.');
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-60">
      <div className="bg-[#FFFFFF] border border-[#24533F] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center gap-2 text-[#24533F]">
          <Edit3 className="w-5 h-5" />
          <h3 className="text-sm font-bold text-[#171A21]">Edit Restaurant Profile</h3>
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
              Restaurant Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs p-2 rounded-lg bg-[#F5F6F8] border border-[#24533F] text-[#171A21] focus:outline-none focus:border-[#24533F]"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
              Logo URL
            </label>
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className="w-full text-xs p-2 rounded-lg bg-[#F5F6F8] border border-[#24533F] text-[#171A21] focus:outline-none focus:border-[#24533F]"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
              Owner User Account UUID
            </label>
            <input
              type="text"
              value={ownerId}
              placeholder="e.g. 00000000-0000-0000-0000-000000000001"
              onChange={(e) => setOwnerId(e.target.value)}
              className="w-full text-xs p-2 rounded-lg bg-[#F5F6F8] border border-[#24533F] text-[#171A21] focus:outline-none focus:border-[#24533F] tabular-nums"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs p-2 rounded-lg bg-[#F5F6F8] border border-[#24533F] text-[#171A21] focus:outline-none focus:border-[#24533F]"
            />
          </div>

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
              disabled={updateMutation.isPending || !name.trim()}
              className="px-4 py-1.5 rounded-lg bg-[#24533F] text-white text-xs font-bold hover:bg-[#24533F]/80 disabled:opacity-50 cursor-pointer"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

