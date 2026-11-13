import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ridersApi } from '@/lib/api/riders';
import { RiderStatusBadge } from './RiderStatusBadge';
import { 
  X, 
  Bike, 
  User, 
  CheckCircle2, 
  XCircle, 
  ShieldAlert, 
  Ban, 
  RotateCcw,
  AlertCircle,
  FileText,
  Activity
} from 'lucide-react';

interface RiderDetailDrawerProps {
  riderId: string;
  onClose: () => void;
}

export const RiderDetailDrawer: React.FC<RiderDetailDrawerProps> = ({
  riderId,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'info' | 'kyc' | 'operations'>('info');
  const [suspensionModalOpen, setSuspensionModalOpen] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: rider, isLoading, isError } = useQuery({
    queryKey: ['admin', 'rider', riderId],
    queryFn: () => ridersApi.getRiderDetails(riderId),
  });

  const verifyMutation = useMutation({
    mutationFn: (payload: { verificationStatus: 'approved' | 'rejected'; rejectionReason?: string }) =>
      ridersApi.verifyRider(riderId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rider', riderId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'riders'] });
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
      ridersApi.suspendRider(riderId, { suspensionReason: reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rider', riderId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'riders'] });
      setSuspensionModalOpen(false);
      setSuspensionReason('');
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err?.response?.data?.message || err?.message || 'Failed to suspend rider');
    },
  });

  const unsuspendMutation = useMutation({
    mutationFn: () => ridersApi.unsuspendRider(riderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rider', riderId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'riders'] });
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err?.response?.data?.message || err?.message || 'Failed to unsuspend rider');
    },
  });

  const isSuspended = !!rider?.suspensionReason;
  const isPending = rider?.verificationStatus === 'pending';
  const isApproved = rider?.verificationStatus === 'approved';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-end z-50">
      <div className="w-full max-w-2xl bg-[#17211B] h-full shadow-2xl border-l border-[#24533F]/40 flex flex-col overflow-hidden">
        {/* Drawer Header */}
        <div className="p-6 border-b border-[#24533F]/30 flex items-center justify-between shrink-0 bg-[#121915]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#24533F] border border-[#D9F078]/20 flex items-center justify-center text-[#D9F078] font-bold">
              <Bike className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#F7F6F0]">
                {isLoading ? 'Loading Rider...' : rider?.fullName || 'Unnamed Fleet Partner'}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] font-mono text-[#F7F6F0]/40">
                  ID: {riderId.slice(0, 8)}...
                </span>
                {rider && (
                  <RiderStatusBadge type="verification" status={rider.verificationStatus} />
                )}
                {rider && isSuspended && (
                  <RiderStatusBadge type="suspension" status={true} />
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

        {/* Action Error Banner */}
        {actionError && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-[#E98755]/15 border border-[#E98755]/30 flex items-center gap-2 text-xs text-[#E98755]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Top Action Bar */}
        {!isLoading && rider && (
          <div className="px-6 py-3 bg-black/20 border-b border-[#24533F]/20 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              {isPending && (
                <>
                  <button
                    disabled={verifyMutation.isPending}
                    onClick={() => verifyMutation.mutate({ verificationStatus: 'approved' })}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#24533F] text-[#D9F078] text-xs font-bold hover:bg-[#24533F]/80 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve Rider KYC</span>
                  </button>
                  <button
                    disabled={verifyMutation.isPending}
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
                  <span>Suspend Fleet Account</span>
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-2 text-[11px] font-mono text-[#F7F6F0]/50">
              <span>Status:</span>
              <RiderStatusBadge type="availability" status={rider.availabilityStatus} />
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
            Profile & Vehicle
          </button>
          <button
            onClick={() => setActiveTab('kyc')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'kyc'
                ? 'border-[#D9F078] text-[#D9F078]'
                : 'border-transparent text-[#F7F6F0]/60 hover:text-[#F7F6F0]'
            }`}
          >
            KYC Documentation
          </button>
          <button
            onClick={() => setActiveTab('operations')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'operations'
                ? 'border-[#D9F078] text-[#D9F078]'
                : 'border-transparent text-[#F7F6F0]/60 hover:text-[#F7F6F0]'
            }`}
          >
            Operational State
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
              Failed to load rider details from backend.
            </div>
          ) : (
            <>
              {activeTab === 'info' && (
                <div className="space-y-6 text-xs">
                  {/* Personal Contact */}
                  <div className="p-5 rounded-xl bg-black/20 border border-[#24533F]/30 space-y-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-[#D9F078]" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#F7F6F0]/50">
                        Rider Contact & Account
                      </h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[#F7F6F0]/40 text-[11px]">Full Legal Name</span>
                        <div className="font-bold text-[#F7F6F0] text-sm mt-0.5">{rider?.fullName || 'N/A'}</div>
                      </div>
                      <div>
                        <span className="text-[#F7F6F0]/40 text-[11px]">Phone Number</span>
                        <div className="font-mono text-[#F7F6F0] text-sm mt-0.5">{rider?.user?.phone || 'N/A'}</div>
                      </div>
                      <div>
                        <span className="text-[#F7F6F0]/40 text-[11px]">Email Address</span>
                        <div className="font-mono text-[#F7F6F0]/70 mt-0.5">{rider?.user?.email || 'None'}</div>
                      </div>
                      <div>
                        <span className="text-[#F7F6F0]/40 text-[11px]">Date of Birth</span>
                        <div className="font-mono text-[#F7F6F0]/70 mt-0.5">
                          {rider?.dateOfBirth ? new Date(rider.dateOfBirth).toLocaleDateString('en-IN') : 'Not Provided'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Vehicle Information */}
                  <div className="p-5 rounded-xl bg-black/20 border border-[#24533F]/30 space-y-3">
                    <div className="flex items-center gap-2">
                      <Bike className="w-4 h-4 text-[#D9F078]" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#F7F6F0]/50">
                        Registered Vehicle
                      </h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[#F7F6F0]/40 text-[11px]">Vehicle Type</span>
                        <div className="font-bold text-[#D9F078] uppercase mt-0.5">{rider?.vehicleType}</div>
                      </div>
                      <div>
                        <span className="text-[#F7F6F0]/40 text-[11px]">Vehicle Registration Plate</span>
                        <div className="font-mono text-[#F7F6F0] font-bold mt-0.5">
                          {rider?.vehicleNumber || 'No Plate Registered'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Suspension Audit Notes */}
                  {rider?.suspensionReason && (
                    <div className="p-4 rounded-xl bg-[#E98755]/15 border border-[#E98755]/40 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#E98755]">
                        <ShieldAlert className="w-4 h-4" />
                        <span>Suspension Reason on Record</span>
                      </div>
                      <p className="text-xs text-[#F7F6F0]/80">{rider.suspensionReason}</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'kyc' && (
                <div className="space-y-4 text-xs">
                  <div className="p-5 rounded-xl bg-black/20 border border-[#24533F]/30 space-y-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#D9F078]" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#F7F6F0]/50">
                        License Verification
                      </h3>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-black/30 border border-white/5">
                      <div>
                        <div className="font-bold text-[#F7F6F0]">Commercial Driving License</div>
                        <div className="font-mono text-[11px] text-[#D9F078] mt-0.5">
                          {rider?.licenseNumber || 'No License Number Uploaded'}
                        </div>
                      </div>
                      <RiderStatusBadge type="verification" status={rider?.verificationStatus || 'pending'} />
                    </div>
                  </div>

                  {rider?.approvedAt && (
                    <div className="p-4 rounded-xl bg-[#24533F]/20 border border-[#24533F]/40 flex items-center justify-between">
                      <div>
                        <span className="text-[#F7F6F0]/50 text-[11px]">Approved On</span>
                        <div className="font-mono text-xs text-[#F7F6F0]">
                          {new Date(rider.approvedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[#F7F6F0]/50 text-[11px]">Approved By Admin</span>
                        <div className="font-mono text-xs text-[#D9F078]">
                          {rider.approver?.fullName || rider.approvedBy?.slice(0, 8)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'operations' && (
                <div className="space-y-4 text-xs">
                  <div className="p-5 rounded-xl bg-black/20 border border-[#24533F]/30 space-y-4">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[#D9F078]" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#F7F6F0]/50">
                        Live Operational Capacity
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-lg bg-black/30 border border-white/5 space-y-1">
                        <span className="text-[10px] text-[#F7F6F0]/50 uppercase">Current Active Deliveries</span>
                        <div className="text-xl font-bold font-mono text-[#D9F078]">
                          {rider?.currentActiveOrdersCount || 0}
                        </div>
                        <p className="text-[10px] text-[#F7F6F0]/40">Simultaneous batch deliveries</p>
                      </div>

                      <div className="p-3 rounded-lg bg-black/30 border border-white/5 space-y-1">
                        <span className="text-[10px] text-[#F7F6F0]/50 uppercase">Max Allowed Capacity</span>
                        <div className="text-xl font-bold font-mono text-[#F7F6F0]">
                          {rider?.maxActiveOrders || 2}
                        </div>
                        <p className="text-[10px] text-[#F7F6F0]/40">System dispatch ceiling</p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
                      <span className="text-[#F7F6F0]/60">Fleet Online Toggle (Socket connection):</span>
                      <span className="font-mono font-semibold text-[#F7F6F0]">
                        {rider?.isOnline ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal: Suspend Rider */}
        {suspensionModalOpen && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-60">
            <div className="bg-[#17211B] border border-[#E98755] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center gap-2 text-[#E98755]">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="text-sm font-bold">Suspend Delivery Fleet Partner</h3>
              </div>
              <p className="text-xs text-[#F7F6F0]/70 leading-relaxed">
                Suspending this rider will atomically set their availability to offline and prevent them from receiving any new dispatch broadcast offers.
              </p>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#F7F6F0]/60">
                  Mandatory Suspension Reason
                </label>
                <textarea
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                  placeholder="Reason for suspending rider (e.g. repeated delivery cancellations, customer dispute)..."
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

        {/* Modal: Reject Verification */}
        {rejectionModalOpen && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-60">
            <div className="bg-[#17211B] border border-[#E98755] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center gap-2 text-[#E98755]">
                <XCircle className="w-5 h-5" />
                <h3 className="text-sm font-bold">Reject Rider Verification</h3>
              </div>
              <p className="text-xs text-[#F7F6F0]/70 leading-relaxed">
                Provide notes on why the rider's application or license was rejected.
              </p>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#F7F6F0]/60">
                  Rejection Reason
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Reason (e.g. invalid driving license, expired documents)..."
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
                  disabled={verifyMutation.isPending}
                  onClick={() =>
                    verifyMutation.mutate({
                      verificationStatus: 'rejected',
                      rejectionReason,
                    })
                  }
                  className="px-4 py-1.5 rounded-lg bg-[#E98755] text-black text-xs font-bold hover:bg-[#E98755]/80 disabled:opacity-50 cursor-pointer"
                >
                  {verifyMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
