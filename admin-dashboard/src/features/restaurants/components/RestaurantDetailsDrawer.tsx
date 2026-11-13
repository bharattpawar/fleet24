import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { restaurantsApi } from '@/lib/api/restaurants';
import { KycDocumentReview } from './KycDocumentReview';
import { OutletManagementTable } from './OutletManagementTable';
import { MenuManagementTab } from './MenuManagementTab';
import { EditRestaurantModal } from './EditRestaurantModal';
import { AddOutletModal } from './AddOutletModal';
import { 
  X, 
  Store, 
  User, 
  CheckCircle2, 
  XCircle, 
  ShieldAlert, 
  Ban, 
  RotateCcw,
  AlertCircle,
  Edit3
} from 'lucide-react';

interface RestaurantDetailsDrawerProps {
  restaurantId: string;
  onClose: () => void;
}

export const RestaurantDetailsDrawer: React.FC<RestaurantDetailsDrawerProps> = ({
  restaurantId,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'info' | 'outlets' | 'menu' | 'documents'>('info');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [addOutletModalOpen, setAddOutletModalOpen] = useState(false);
  const [suspensionModalOpen, setSuspensionModalOpen] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'restaurant', restaurantId],
    queryFn: () => restaurantsApi.getRestaurantDetails(restaurantId),
  });

  const verifyRestaurantMutation = useMutation({
    mutationFn: (payload: { verificationStatus: 'approved' | 'rejected'; rejectionReason?: string }) =>
      restaurantsApi.verifyRestaurant(restaurantId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'restaurant', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'restaurants'] });
      setRejectionModalOpen(false);
      setRejectionReason('');
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err?.response?.data?.message || err?.message || 'Verification update failed');
    },
  });

  const suspendMutation = useMutation({
    mutationFn: (reason: string) =>
      restaurantsApi.suspendRestaurant(restaurantId, { suspensionReason: reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'restaurant', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'restaurants'] });
      setSuspensionModalOpen(false);
      setSuspensionReason('');
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err?.response?.data?.message || err?.message || 'Failed to suspend restaurant');
    },
  });

  const unsuspendMutation = useMutation({
    mutationFn: () => restaurantsApi.unsuspendRestaurant(restaurantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'restaurant', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'restaurants'] });
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err?.response?.data?.message || err?.message || 'Failed to reinstate restaurant');
    },
  });

  const restaurant = data?.restaurant;
  const owner = data?.owner;
  const outlets = data?.outlets || [];
  const documents = data?.documents || [];

  const isSuspended = restaurant?.verificationStatus === 'suspended';
  const isPending = restaurant?.verificationStatus === 'pending';
  const isApproved = restaurant?.verificationStatus === 'approved';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-end z-50">
      <div className="w-full max-w-2xl bg-[#17211B] h-full shadow-2xl border-l border-[#24533F]/40 flex flex-col overflow-hidden">
        {/* Drawer Header */}
        <div className="p-6 border-b border-[#24533F]/30 flex items-center justify-between shrink-0 bg-[#121915]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#24533F] border border-[#D9F078]/20 flex items-center justify-center text-[#D9F078] font-bold">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#F7F6F0]">
                {isLoading ? 'Loading Partner...' : restaurant?.name}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] font-mono text-[#F7F6F0]/40">
                  ID: {restaurantId.slice(0, 8)}...
                </span>
                {restaurant && (
                  <span
                    className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                      isApproved
                        ? 'bg-[#24533F] text-[#D9F078]'
                        : isSuspended
                        ? 'bg-[#E98755]/20 text-[#E98755] border border-[#E98755]/30'
                        : isPending
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-white/5 text-[#F7F6F0]/50'
                    }`}
                  >
                    {restaurant.verificationStatus}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[#F7F6F0]/50 hover:text-[#F7F6F0] rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Error Banner */}
        {actionError && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-[#E98755]/15 border border-[#E98755]/30 flex items-center gap-2 text-xs text-[#E98755]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Action Bar (Top Super Admin Controls) */}
        {!isLoading && restaurant && (
          <div className="px-6 py-3 bg-black/20 border-b border-[#24533F]/20 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              {isPending && (
                <>
                  <button
                    disabled={verifyRestaurantMutation.isPending}
                    onClick={() =>
                      verifyRestaurantMutation.mutate({ verificationStatus: 'approved' })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#24533F] text-[#D9F078] text-xs font-bold hover:bg-[#24533F]/80 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve Application</span>
                  </button>
                  <button
                    disabled={verifyRestaurantMutation.isPending}
                    onClick={() => setRejectionModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 text-[#E98755] border border-[#E98755]/40 text-xs font-semibold hover:bg-[#E98755]/10 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject</span>
                  </button>
                </>
              )}

              {isSuspended ? (
                <button
                  disabled={unsuspendMutation.isPending}
                  onClick={() => unsuspendMutation.mutate()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#24533F] text-[#D9F078] text-xs font-bold hover:bg-[#24533F]/80 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reinstate / Unsuspend</span>
                </button>
              ) : isApproved ? (
                <button
                  disabled={suspendMutation.isPending}
                  onClick={() => setSuspensionModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E98755]/15 text-[#E98755] border border-[#E98755]/40 text-xs font-semibold hover:bg-[#E98755]/25 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Ban className="w-4 h-4" />
                  <span>Suspend Brand</span>
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-1 text-[11px] font-mono text-[#F7F6F0]/50">
              <span>Outlets: {outlets.length}</span>
              <span>·</span>
              <span>Docs: {documents.length}</span>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center px-6 border-b border-[#24533F]/30 bg-[#17211B] shrink-0">
          <button
            onClick={() => setActiveTab('info')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'info'
                ? 'border-[#D9F078] text-[#D9F078]'
                : 'border-transparent text-[#F7F6F0]/60 hover:text-[#F7F6F0]'
            }`}
          >
            Brand Details & KYC
          </button>
          <button
            onClick={() => setActiveTab('outlets')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'outlets'
                ? 'border-[#D9F078] text-[#D9F078]'
                : 'border-transparent text-[#F7F6F0]/60 hover:text-[#F7F6F0]'
            }`}
          >
            Outlets ({outlets.length})
          </button>
          <button
            onClick={() => setActiveTab('menu')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'menu'
                ? 'border-[#D9F078] text-[#D9F078]'
                : 'border-transparent text-[#F7F6F0]/60 hover:text-[#F7F6F0]'
            }`}
          >
            Menu & Food Items
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'documents'
                ? 'border-[#D9F078] text-[#D9F078]'
                : 'border-transparent text-[#F7F6F0]/60 hover:text-[#F7F6F0]'
            }`}
          >
            KYC Documents ({documents.length})
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-white/5 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : isError ? (
            <div className="p-6 rounded-xl bg-[#E98755]/15 border border-[#E98755]/30 text-xs text-[#E98755]">
              Failed to load restaurant profile details from backend.
            </div>
          ) : (
            <>
              {activeTab === 'info' && (
                <div className="space-y-6 text-xs">
                  {/* Brand Profile Card */}
                  <div className="p-5 rounded-xl bg-black/20 border border-[#24533F]/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#F7F6F0]/50">
                        Brand Registration Profile
                      </h3>
                      <button
                        onClick={() => setEditModalOpen(true)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#24533F]/40 border border-[#24533F] text-[11px] font-semibold text-[#D9F078] hover:bg-[#24533F] transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit Profile</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[#F7F6F0]/40 text-[11px]">Brand Name</span>
                        <div className="font-bold text-[#F7F6F0] text-sm mt-0.5">{restaurant?.name}</div>
                      </div>
                      <div>
                        <span className="text-[#F7F6F0]/40 text-[11px]">Unique Slug</span>
                        <div className="font-mono text-[#D9F078] text-sm mt-0.5">/{restaurant?.slug}</div>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[#F7F6F0]/40 text-[11px]">Description</span>
                        <div className="text-[#F7F6F0]/70 mt-0.5">
                          {restaurant?.description || 'No public brand description provided.'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Registered Owner Identity */}
                  <div className="p-5 rounded-xl bg-black/20 border border-[#24533F]/30 space-y-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-[#D9F078]" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#F7F6F0]/50">
                        Primary Account Owner
                      </h3>
                    </div>
                    {owner ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-[#F7F6F0]/40 text-[11px]">Full Name</span>
                          <div className="font-bold text-[#F7F6F0] mt-0.5">{owner.fullName || 'N/A'}</div>
                        </div>
                        <div>
                          <span className="text-[#F7F6F0]/40 text-[11px]">Phone Number</span>
                          <div className="font-mono text-[#F7F6F0] mt-0.5">{owner.phone}</div>
                        </div>
                        <div className="col-span-2">
                          <span className="text-[#F7F6F0]/40 text-[11px]">Email Address</span>
                          <div className="font-mono text-[#F7F6F0]/70 mt-0.5">{owner.email || 'None'}</div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-[#F7F6F0]/50">No owner account linked.</p>
                    )}
                  </div>

                  {/* Suspension / Rejection Audit notes */}
                  {restaurant?.suspensionReason && (
                    <div className="p-4 rounded-xl bg-[#E98755]/15 border border-[#E98755]/40 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#E98755]">
                        <ShieldAlert className="w-4 h-4" />
                        <span>Suspension Reason on Record</span>
                      </div>
                      <p className="text-xs text-[#F7F6F0]/80">{restaurant.suspensionReason}</p>
                    </div>
                  )}

                  {restaurant?.rejectionReason && (
                    <div className="p-4 rounded-xl bg-[#E98755]/15 border border-[#E98755]/40 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#E98755]">
                        <XCircle className="w-4 h-4" />
                        <span>Rejection Notes</span>
                      </div>
                      <p className="text-xs text-[#F7F6F0]/80">{restaurant.rejectionReason}</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'outlets' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-[#F7F6F0]">Physical Outlets</h3>
                      <p className="text-[11px] text-[#F7F6F0]/50">Manage branch locations, delivery radii, and order acceptance</p>
                    </div>
                    <button
                      onClick={() => setAddOutletModalOpen(true)}
                      className="px-3 py-1.5 rounded-lg bg-[#D9F078] text-black text-xs font-bold hover:bg-[#D9F078]/80 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Store className="w-3.5 h-3.5" />
                      <span>Add Outlet</span>
                    </button>
                  </div>

                  <OutletManagementTable
                    restaurantId={restaurantId}
                    isRestaurantSuspended={isSuspended}
                    outlets={outlets}
                  />
                </div>
              )}

              {activeTab === 'menu' && (
                <MenuManagementTab
                  restaurantId={restaurantId}
                  outlets={outlets}
                />
              )}

              {activeTab === 'documents' && (
                <KycDocumentReview
                  restaurantId={restaurantId}
                  documents={documents}
                />
              )}
            </>
          )}
        </div>

        {/* Modal: Edit Restaurant */}
        {editModalOpen && restaurant && (
          <EditRestaurantModal
            isOpen={editModalOpen}
            onClose={() => setEditModalOpen(false)}
            restaurant={{
              id: restaurant.id,
              name: restaurant.name,
              description: restaurant.description,
              logoUrl: restaurant.logoUrl,
              ownerId: restaurant.ownerId,
            }}
          />
        )}

        {/* Modal: Add Outlet to Existing Restaurant */}
        {addOutletModalOpen && restaurant && (
          <AddOutletModal
            isOpen={addOutletModalOpen}
            onClose={() => setAddOutletModalOpen(false)}
            restaurantId={restaurant.id}
            restaurantName={restaurant.name}
          />
        )}

        {/* Modal: Suspend Restaurant */}
        {suspensionModalOpen && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-60">
            <div className="bg-[#17211B] border border-[#E98755] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center gap-2 text-[#E98755]">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="text-sm font-bold">Suspend Restaurant Brand</h3>
              </div>
              <p className="text-xs text-[#F7F6F0]/70 leading-relaxed">
                Suspending this restaurant will atomically deactivate all physical outlets from accepting new customer orders.
              </p>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#F7F6F0]/60">
                  Mandatory Suspension Reason
                </label>
                <textarea
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                  placeholder="Reason for suspending partner (e.g. food quality complaints, legal dispute)..."
                  rows={3}
                  className="w-full text-xs p-2 rounded-lg bg-black/30 border border-[#E98755]/40 text-[#F7F6F0] focus:outline-none focus:border-[#E98755]"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setSuspensionModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-[#F7F6F0]/60 hover:text-[#F7F6F0] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={!suspensionReason.trim() || suspendMutation.isPending}
                  onClick={() => suspendMutation.mutate(suspensionReason)}
                  className="px-4 py-1.5 rounded-lg bg-[#E98755] text-black text-xs font-bold hover:bg-[#E98755]/80 disabled:opacity-50 cursor-pointer"
                >
                  {suspendMutation.isPending ? 'Suspending...' : 'Confirm Suspension'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Reject Application */}
        {rejectionModalOpen && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-60">
            <div className="bg-[#17211B] border border-[#E98755] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center gap-2 text-[#E98755]">
                <XCircle className="w-5 h-5" />
                <h3 className="text-sm font-bold">Reject Restaurant Application</h3>
              </div>
              <p className="text-xs text-[#F7F6F0]/70 leading-relaxed">
                Provide an explanatory reason for rejecting this onboarding partner.
              </p>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#F7F6F0]/60">
                  Rejection Reason
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Reason for rejection (e.g. invalid FSSAI license, duplicate brand)..."
                  rows={3}
                  className="w-full text-xs p-2 rounded-lg bg-black/30 border border-[#E98755]/40 text-[#F7F6F0] focus:outline-none focus:border-[#E98755]"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setRejectionModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-[#F7F6F0]/60 hover:text-[#F7F6F0] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={!rejectionReason.trim() || verifyRestaurantMutation.isPending}
                  onClick={() =>
                    verifyRestaurantMutation.mutate({
                      verificationStatus: 'rejected',
                      rejectionReason,
                    })
                  }
                  className="px-4 py-1.5 rounded-lg bg-[#E98755] text-black text-xs font-bold hover:bg-[#E98755]/80 disabled:opacity-50 cursor-pointer"
                >
                  {verifyRestaurantMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
