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
      <div className="w-full max-w-2xl bg-[#FFFFFF] h-full shadow-2xl border-l border-[#E3E7EC] flex flex-col overflow-hidden">
        {/* Drawer Header */}
        <div className="p-6 border-b border-[#E3E7EC] flex items-center justify-between shrink-0 bg-[#F5F6F8]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#24533F] border border-[#24533F]/20 flex items-center justify-center text-[#24533F] font-bold">
              <Bike className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#171A21]">
                {isLoading ? 'Loading Rider...' : rider?.fullName || 'Unnamed Fleet Partner'}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] tabular-nums text-slate-600">
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
            className="p-2 text-slate-600 hover:text-[#171A21] rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Error Banner */}
        {actionError && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-[#9A431F]/15 border border-[#9A431F]/30 flex items-center gap-2 text-xs text-[#9A431F]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Top Action Bar */}
        {!isLoading && rider && (
          <div className="px-6 py-3 bg-[#F5F6F8] border-b border-[#E3E7EC] flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              {isPending && (
                <>
                  <button
                    disabled={verifyMutation.isPending}
                    onClick={() => verifyMutation.mutate({ verificationStatus: 'approved' })}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#24533F] text-white text-xs font-bold hover:bg-[#24533F]/80 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve Rider KYC</span>
                  </button>
                  <button
                    disabled={verifyMutation.isPending}
                    onClick={() => setRejectionModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F5F6F8] text-[#9A431F] border border-[#9A431F]/40 text-xs font-semibold hover:bg-[#9A431F]/10 transition-colors disabled:opacity-50 cursor-pointer"
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#24533F] text-white text-xs font-bold hover:bg-[#24533F]/80 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reinstate / Unsuspend</span>
                </button>
              ) : isApproved ? (
                <button
                  disabled={suspendMutation.isPending}
                  onClick={() => setSuspensionModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#9A431F]/15 text-[#9A431F] border border-[#9A431F]/40 text-xs font-semibold hover:bg-[#9A431F]/25 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Ban className="w-4 h-4" />
                  <span>Suspend Fleet Account</span>
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-2 text-[11px] tabular-nums text-slate-600">
              <span>Status:</span>
              <RiderStatusBadge type="availability" status={rider.availabilityStatus} />
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center px-6 border-b border-[#E3E7EC] bg-[#FFFFFF] shrink-0">
          <button
            onClick={() => setActiveTab('info')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'info'
                ? 'border-[#24533F] text-[#24533F]'
                : 'border-transparent text-slate-600 hover:text-[#171A21]'
            }`}
          >
            Profile & Vehicle
          </button>
          <button
            onClick={() => setActiveTab('kyc')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'kyc'
                ? 'border-[#24533F] text-[#24533F]'
                : 'border-transparent text-slate-600 hover:text-[#171A21]'
            }`}
          >
            KYC Documentation
          </button>
          <button
            onClick={() => setActiveTab('operations')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'operations'
                ? 'border-[#24533F] text-[#24533F]'
                : 'border-transparent text-slate-600 hover:text-[#171A21]'
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
                <div key={i} className="h-20 bg-slate-100 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : isError ? (
            <div className="p-6 rounded-xl bg-[#9A431F]/15 border border-[#9A431F]/30 text-xs text-[#9A431F]">
              Failed to load rider details from backend.
            </div>
          ) : (
            <>
              {activeTab === 'info' && (
                <div className="space-y-6 text-xs">
                  {/* Personal Contact */}
                  <div className="p-5 rounded-xl bg-[#F5F6F8] border border-[#E3E7EC] space-y-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-[#24533F]" />
                      <h3 className="text-xs font-bold  text-slate-600">
                        Rider Contact & Account
                      </h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-slate-600 text-[11px]">Full Legal Name</span>
                        <div className="font-bold text-[#171A21] text-sm mt-0.5">{rider?.fullName || 'N/A'}</div>
                      </div>
                      <div>
                        <span className="text-slate-600 text-[11px]">Phone Number</span>
                        <div className="tabular-nums text-[#171A21] text-sm mt-0.5">{rider?.user?.phone || 'N/A'}</div>
                      </div>
                      <div>
                        <span className="text-slate-600 text-[11px]">Email Address</span>
                        <div className="tabular-nums text-slate-600 mt-0.5">{rider?.user?.email || 'None'}</div>
                      </div>
                      <div>
                        <span className="text-slate-600 text-[11px]">Date of Birth</span>
                        <div className="tabular-nums text-slate-600 mt-0.5">
                          {rider?.dateOfBirth ? new Date(rider.dateOfBirth).toLocaleDateString('en-IN') : 'Not Provided'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Vehicle Information */}
                  <div className="p-5 rounded-xl bg-[#F5F6F8] border border-[#E3E7EC] space-y-3">
                    <div className="flex items-center gap-2">
                      <Bike className="w-4 h-4 text-[#24533F]" />
                      <h3 className="text-xs font-bold  text-slate-600">
                        Registered Vehicle
                      </h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-slate-600 text-[11px]">Vehicle Type</span>
                        <div className="font-bold text-[#24533F] mt-0.5">{rider?.vehicleType}</div>
                      </div>
                      <div>
                        <span className="text-slate-600 text-[11px]">Vehicle Registration Plate</span>
                        <div className="tabular-nums text-[#171A21] font-bold mt-0.5">
                          {rider?.vehicleNumber || 'No Plate Registered'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Suspension Audit Notes */}
                  {rider?.suspensionReason && (
                    <div className="p-4 rounded-xl bg-[#9A431F]/15 border border-[#9A431F]/40 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#9A431F]">
                        <ShieldAlert className="w-4 h-4" />
                        <span>Suspension Reason on Record</span>
                      </div>
                      <p className="text-xs text-slate-600">{rider.suspensionReason}</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'kyc' && (
                <div className="space-y-4 text-xs">
                  <div className="p-5 rounded-xl bg-[#F5F6F8] border border-[#E3E7EC] space-y-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#24533F]" />
                      <h3 className="text-xs font-bold  text-slate-600">
                        License Verification
                      </h3>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-[#F5F6F8] border border-[#E3E7EC]">
                      <div>
                        <div className="font-bold text-[#171A21]">Commercial Driving License</div>
                        <div className="tabular-nums text-[11px] text-[#24533F] mt-0.5">
                          {rider?.licenseNumber || 'No License Number Uploaded'}
                        </div>
                      </div>
                      <RiderStatusBadge type="verification" status={rider?.verificationStatus || 'pending'} />
                    </div>
                  </div>

                  {rider?.approvedAt && (
                    <div className="p-4 rounded-xl bg-[#E8F2ED] border border-[#E3E7EC] flex items-center justify-between">
                      <div>
                        <span className="text-slate-600 text-[11px]">Approved On</span>
                        <div className="tabular-nums text-xs text-[#171A21]">
                          {new Date(rider.approvedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-600 text-[11px]">Approved By Admin</span>
                        <div className="tabular-nums text-xs text-[#24533F]">
                          {rider.approver?.fullName || rider.approvedBy?.slice(0, 8)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'operations' && (
                <div className="space-y-4 text-xs">
                  <div className="p-5 rounded-xl bg-[#F5F6F8] border border-[#E3E7EC] space-y-4">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[#24533F]" />
                      <h3 className="text-xs font-bold  text-slate-600">
                        Live Operational Capacity
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-lg bg-[#F5F6F8] border border-[#E3E7EC] space-y-1">
                        <span className="text-[10px] text-slate-600">Current Active Deliveries</span>
                        <div className="text-xl font-bold tabular-nums text-[#24533F]">
                          {rider?.currentActiveOrdersCount || 0}
                        </div>
                        <p className="text-[10px] text-slate-600">Simultaneous batch deliveries</p>
                      </div>

                      <div className="p-3 rounded-lg bg-[#F5F6F8] border border-[#E3E7EC] space-y-1">
                        <span className="text-[10px] text-slate-600">Max Allowed Capacity</span>
                        <div className="text-xl font-bold tabular-nums text-[#171A21]">
                          {rider?.maxActiveOrders || 2}
                        </div>
                        <p className="text-[10px] text-slate-600">System dispatch ceiling</p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#E3E7EC] flex items-center justify-between text-[11px]">
                      <span className="text-slate-600">Fleet Online Toggle (Socket connection):</span>
                      <span className="tabular-nums font-semibold text-[#171A21]">
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
            <div className="bg-[#FFFFFF] border border-[#9A431F] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center gap-2 text-[#9A431F]">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="text-sm font-bold">Suspend Delivery Fleet Partner</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Suspending this rider will atomically set their availability to offline and prevent them from receiving any new dispatch broadcast offers.
              </p>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-600">
                  Mandatory Suspension Reason
                </label>
                <textarea
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                  placeholder="Reason for suspending rider (e.g. repeated delivery cancellations, customer dispute)..."
                  rows={3}
                  className="w-full text-xs p-2 rounded-lg bg-[#F5F6F8] border border-[#9A431F]/40 text-[#171A21] focus:outline-none focus:border-[#9A431F]"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setSuspensionModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-[#171A21] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={!suspensionReason.trim() || suspendMutation.isPending}
                  onClick={() => suspendMutation.mutate(suspensionReason)}
                  className="px-4 py-1.5 rounded-lg bg-[#9A431F] text-black text-xs font-bold hover:bg-[#9A431F]/80 disabled:opacity-50 cursor-pointer"
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
            <div className="bg-[#FFFFFF] border border-[#9A431F] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center gap-2 text-[#9A431F]">
                <XCircle className="w-5 h-5" />
                <h3 className="text-sm font-bold">Reject Rider Verification</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Provide notes on why the rider's application or license was rejected.
              </p>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-600">
                  Rejection Reason
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Reason (e.g. invalid driving license, expired documents)..."
                  rows={3}
                  className="w-full text-xs p-2 rounded-lg bg-[#F5F6F8] border border-[#9A431F]/40 text-[#171A21] focus:outline-none focus:border-[#9A431F]"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setRejectionModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-[#171A21] cursor-pointer"
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
                  className="px-4 py-1.5 rounded-lg bg-[#9A431F] text-black text-xs font-bold hover:bg-[#9A431F]/80 disabled:opacity-50 cursor-pointer"
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
