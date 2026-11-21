import { useSearchParams } from 'react-router-dom';
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
  const [params, setParams] = useSearchParams();
  const selectedRiderId = params.get('record');
  const setSelectedRiderId = (id: string | null) => setParams((previous) => {
    const next = new URLSearchParams(previous);
    if (id) next.set('record', id);
    else next.delete('record');
    return next;
  });

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
    <div className="max-w-7xl mx-auto space-y-4 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-[#E3E7EC]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#171A21]">
            Delivery Fleet Management & KYC
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Super Admin Fleet Governance · License Auditing, Operational Availability, Account Suspension
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#E8F2ED] border border-[#24533F] text-xs font-medium text-[#24533F] hover:bg-[#E8F2ED] transition-colors disabled:opacity-50 cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Refresh Fleet</span>
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Verification Status Tabs */}
        <div className="flex flex-wrap items-center bg-[#FFFFFF] border border-[#E3E7EC] rounded-lg p-1">
          {verificationTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setSelectedVerificationStatus(tab.value);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                selectedVerificationStatus === tab.value
                  ? 'bg-[#24533F] text-white shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-[#171A21] hover:bg-slate-100'
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
            className="bg-[#FFFFFF] border border-[#E3E7EC] rounded-lg px-3 py-1.5 text-xs text-[#171A21] focus:outline-none focus:border-[#24533F] cursor-pointer"
          >
            <option value="all">Availability: All</option>
            <option value="available">Available Only</option>
            <option value="busy">On Delivery Only</option>
            <option value="offline">Offline Only</option>
          </select>

          <div className="relative w-full lg:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Search rider, plate, license..."
              className="w-full bg-[#FFFFFF] border border-[#E3E7EC] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#171A21] placeholder-slate-600 focus:outline-none focus:border-[#24533F]"
            />
          </div>
        </div>
      </div>

      {/* Riders Table */}
      {isError ? (
        <div className="p-8 rounded-xl bg-[#9A431F]/10 border border-[#9A431F]/30 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-[#9A431F] mx-auto" />
          <p className="text-sm font-semibold text-[#171A21]">
            Failed to retrieve rider directory from backend.
          </p>
          <button
            onClick={() => refetch()}
            className="px-4 py-1.5 rounded-lg bg-[#24533F] text-white text-xs font-bold hover:bg-[#24533F]/80 transition-colors cursor-pointer"
          >
            Retry Query
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#E3E7EC] bg-[#FFFFFF]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F5F6F8] border-b border-[#E3E7EC] text-[10px] tabular-nums  text-slate-600">
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
            <tbody className="divide-y divide-[#E3E7EC]">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center">
                    <span className="text-xs tabular-nums text-slate-600 animate-pulse">
                      Loading rider fleet directory...
                    </span>
                  </td>
                </tr>
              ) : data?.data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-600">
                    <Bike className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                    <span>No delivery partners found matching current filters.</span>
                  </td>
                </tr>
              ) : (
                data?.data.map((r) => {
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedRiderId(r.id)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer group"
                    >
                      <td className="px-5 py-3.5 space-y-0.5">
                        <div className="font-bold text-[#171A21] group-hover:text-[#24533F] transition-colors flex items-center gap-1.5">
                          <span>{r.fullName || 'Unnamed Rider'}</span>
                        </div>
                        <div className="text-[11px] tabular-nums text-slate-600">
                          ID: {r.id.slice(0, 8)}...
                        </div>
                      </td>

                      <td className="px-5 py-3.5 tabular-nums text-[11px] text-slate-600">
                        {r.user?.phone || 'No Phone Linked'}
                      </td>

                      <td className="px-5 py-3.5 space-y-0.5">
                        <div className="font-semibold text-[#24533F]">
                          {r.vehicleType}
                        </div>
                        <div className="text-[11px] tabular-nums text-slate-600">
                          {r.vehicleNumber || 'Unregistered'}
                        </div>
                      </td>

                      <td className="px-5 py-3.5 tabular-nums text-[11px] text-slate-600">
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
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#E8F2ED] hover:bg-[#24533F] text-[11px] font-semibold text-[#24533F] border border-[#24533F] transition-colors cursor-pointer"
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
            <div className="p-4 bg-[#F5F6F8] border-t border-[#E3E7EC] flex items-center justify-between text-xs text-slate-600">
              <span>
                Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} total riders)
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded bg-[#F5F6F8] border border-[#E3E7EC] disabled:opacity-30 cursor-pointer"
                >
                  Previous
                </button>
                <button
                  disabled={page >= data.pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 rounded bg-[#F5F6F8] border border-[#E3E7EC] disabled:opacity-30 cursor-pointer"
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

