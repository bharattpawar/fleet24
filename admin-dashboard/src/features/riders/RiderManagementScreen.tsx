import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ridersApi } from '@/lib/api/riders';
import type { RiderVerificationStatus, RiderAvailabilityStatus } from '@/types/riders';
import { RiderStatusBadge } from './components/RiderStatusBadge';
import { RiderDetailDrawer } from './components/RiderDetailDrawer';
import { 
  Bike, 
  Search, 
  RefreshCw, 
  ChevronRight, 
  AlertCircle 
} from 'lucide-react';

export const RiderManagementScreen: React.FC = () => {
  const [selectedVerificationStatus, setSelectedVerificationStatus] =
    useState<RiderVerificationStatus>('all');
  const [selectedAvailabilityStatus, setSelectedAvailabilityStatus] =
    useState<RiderAvailabilityStatus>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: [
      'admin',
      'riders',
      {
        verificationStatus: selectedVerificationStatus,
        availabilityStatus: selectedAvailabilityStatus,
        search: searchTerm,
        page,
      },
    ],
    queryFn: () =>
      ridersApi.listRiders({
        verificationStatus:
          selectedVerificationStatus === 'all' ? undefined : selectedVerificationStatus,
        availabilityStatus:
          selectedAvailabilityStatus === 'all' ? undefined : selectedAvailabilityStatus,
        search: searchTerm.trim() || undefined,
        page,
        limit: 15,
      }),
  });

  const verificationTabs: Array<{ label: string; value: RiderVerificationStatus }> = [
    { label: 'All Fleet', value: 'all' },
    { label: 'Pending KYC', value: 'pending' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#24533F]/30">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#F7F6F0]">
            Delivery Fleet Management & KYC
          </h1>
          <p className="text-xs text-[#F7F6F0]/60 mt-1">
            Super Admin Fleet Governance · License Auditing, Operational Availability, Account Suspension
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#24533F]/40 border border-[#24533F] text-xs font-medium text-[#D9F078] hover:bg-[#24533F]/60 transition-colors disabled:opacity-50 cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Refresh Fleet</span>
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Verification Status Tabs */}
        <div className="flex flex-wrap items-center bg-[#17211B] border border-[#24533F]/40 rounded-lg p-1">
          {verificationTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setSelectedVerificationStatus(tab.value);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                selectedVerificationStatus === tab.value
                  ? 'bg-[#24533F] text-[#D9F078] shadow-sm font-semibold'
                  : 'text-[#F7F6F0]/60 hover:text-[#F7F6F0] hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Availability dropdown & Search */}
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <select
            value={selectedAvailabilityStatus}
            onChange={(e) => {
              setSelectedAvailabilityStatus(e.target.value as RiderAvailabilityStatus);
              setPage(1);
            }}
            className="bg-[#17211B] border border-[#24533F]/40 rounded-lg px-3 py-1.5 text-xs text-[#F7F6F0] focus:outline-none focus:border-[#D9F078] cursor-pointer"
          >
            <option value="all">Availability: All</option>
            <option value="available">Available Only</option>
            <option value="busy">On Delivery Only</option>
            <option value="offline">Offline Only</option>
          </select>

          <div className="relative w-full lg:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#F7F6F0]/40" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Search rider, plate, license..."
              className="w-full bg-[#17211B] border border-[#24533F]/40 rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#F7F6F0] placeholder-[#F7F6F0]/30 focus:outline-none focus:border-[#D9F078]"
            />
          </div>
        </div>
      </div>

      {/* Riders Table */}
      {isError ? (
        <div className="p-8 rounded-xl bg-[#E98755]/10 border border-[#E98755]/30 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-[#E98755] mx-auto" />
          <p className="text-sm font-semibold text-[#F7F6F0]">
            Failed to retrieve rider directory from backend.
          </p>
          <button
            onClick={() => refetch()}
            className="px-4 py-1.5 rounded-lg bg-[#24533F] text-[#D9F078] text-xs font-bold hover:bg-[#24533F]/80 transition-colors cursor-pointer"
          >
            Retry Query
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#24533F]/30 bg-[#17211B]">
          <table className="w-full text-left text-xs">
            <thead className="bg-black/30 border-b border-[#24533F]/30 text-[10px] uppercase font-mono tracking-wider text-[#F7F6F0]/50">
              <tr>
                <th className="px-5 py-3.5">Rider Partner</th>
                <th className="px-5 py-3.5">Phone Contact</th>
                <th className="px-5 py-3.5">Vehicle & Plate</th>
                <th className="px-5 py-3.5">Driving License</th>
                <th className="px-5 py-3.5">KYC Status</th>
                <th className="px-5 py-3.5">Live Availability</th>
                <th className="px-5 py-3.5">Account Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center">
                    <span className="text-xs font-mono text-[#F7F6F0]/40 animate-pulse">
                      Loading rider fleet directory...
                    </span>
                  </td>
                </tr>
              ) : data?.data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-[#F7F6F0]/50">
                    <Bike className="w-6 h-6 text-[#F7F6F0]/20 mx-auto mb-2" />
                    <span>No delivery partners found matching current filters.</span>
                  </td>
                </tr>
              ) : (
                data?.data.map((r) => {
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedRiderId(r.id)}
                      className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                    >
                      <td className="px-5 py-3.5 space-y-0.5">
                        <div className="font-bold text-[#F7F6F0] group-hover:text-[#D9F078] transition-colors flex items-center gap-1.5">
                          <span>{r.fullName || 'Unnamed Rider'}</span>
                        </div>
                        <div className="text-[11px] font-mono text-[#F7F6F0]/40">
                          ID: {r.id.slice(0, 8)}...
                        </div>
                      </td>

                      <td className="px-5 py-3.5 font-mono text-[11px] text-[#F7F6F0]/70">
                        {r.user?.phone || 'No Phone Linked'}
                      </td>

                      <td className="px-5 py-3.5 space-y-0.5">
                        <div className="font-semibold uppercase text-[#D9F078]">
                          {r.vehicleType}
                        </div>
                        <div className="text-[11px] font-mono text-[#F7F6F0]/50">
                          {r.vehicleNumber || 'Unregistered'}
                        </div>
                      </td>

                      <td className="px-5 py-3.5 font-mono text-[11px] text-[#F7F6F0]/70">
                        {r.licenseNumber || 'None'}
                      </td>

                      <td className="px-5 py-3.5">
                        <RiderStatusBadge type="verification" status={r.verificationStatus} />
                      </td>

                      <td className="px-5 py-3.5">
                        <RiderStatusBadge type="availability" status={r.availabilityStatus} />
                      </td>

                      <td className="px-5 py-3.5">
                        <RiderStatusBadge type="suspension" status={r.isSuspended} />
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRiderId(r.id);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#24533F]/30 hover:bg-[#24533F] text-[11px] font-semibold text-[#D9F078] border border-[#24533F] transition-colors cursor-pointer"
                        >
                          <span>Manage</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {data && data.pagination.totalPages > 1 && (
            <div className="p-4 bg-black/20 border-t border-[#24533F]/30 flex items-center justify-between text-xs text-[#F7F6F0]/60">
              <span>
                Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} total riders)
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded bg-black/40 border border-white/5 disabled:opacity-30 cursor-pointer"
                >
                  Previous
                </button>
                <button
                  disabled={page >= data.pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 rounded bg-black/40 border border-white/5 disabled:opacity-30 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rider Detail Drawer */}
      {selectedRiderId && (
        <RiderDetailDrawer
          riderId={selectedRiderId}
          onClose={() => setSelectedRiderId(null)}
        />
      )}
    </div>
  );
};

