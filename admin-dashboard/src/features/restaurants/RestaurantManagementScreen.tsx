import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { restaurantsApi } from '@/lib/api/restaurants';
import type { RestaurantVerificationStatus } from '@/types/restaurants';
import { RestaurantDetailsDrawer } from './components/RestaurantDetailsDrawer';
import { AddRestaurantModal } from './components/AddRestaurantModal';
import { 
  Store, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ChevronRight, 
  FileText, 
  MapPin, 
  AlertCircle,
  Plus
} from 'lucide-react';

export const RestaurantManagementScreen: React.FC = () => {
  const [selectedStatus, setSelectedStatus] = useState<RestaurantVerificationStatus>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState<boolean>(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'restaurants', { status: selectedStatus, search: searchTerm, page }],
    queryFn: () =>
      restaurantsApi.listRestaurants({
        verificationStatus: selectedStatus,
        search: searchTerm.trim() || undefined,
        page,
        limit: 15,
      }),
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#24533F] text-[#D9F078]">
            <CheckCircle2 className="w-3 h-3" /> APPROVED
          </span>
        );
      case 'suspended':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#E98755]/20 text-[#E98755] border border-[#E98755]/40">
            <XCircle className="w-3 h-3" /> SUSPENDED
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-white/5 text-[#F7F6F0]/40 border border-white/5">
            REJECTED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Clock className="w-3 h-3" /> PENDING REVIEW
          </span>
        );
    }
  };

  const tabs: Array<{ label: string; value: RestaurantVerificationStatus }> = [
    { label: 'All Partners', value: 'all' },
    { label: 'Pending Verification', value: 'pending' },
    { label: 'Approved & Active', value: 'approved' },
    { label: 'Suspended', value: 'suspended' },
    { label: 'Rejected', value: 'rejected' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#24533F]/30">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#F7F6F0]">
            Restaurant & Outlet Management
          </h1>
          <p className="text-xs text-[#F7F6F0]/60 mt-1">
            Super Admin Partner Governance · Onboarding KYC, Multi-Outlet Controls, Emergency Overrides
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#D9F078] text-black text-xs font-bold hover:bg-[#D9F078]/80 transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Restaurant</span>
          </button>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#24533F]/40 border border-[#24533F] text-xs font-medium text-[#D9F078] hover:bg-[#24533F]/60 transition-colors disabled:opacity-50 cursor-pointer self-start md:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh Directory</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center bg-[#17211B] border border-[#24533F]/40 rounded-lg p-1">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setSelectedStatus(tab.value);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                selectedStatus === tab.value
                  ? 'bg-[#24533F] text-[#D9F078] shadow-sm font-semibold'
                  : 'text-[#F7F6F0]/60 hover:text-[#F7F6F0] hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#F7F6F0]/40" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder="Search restaurant or slug..."
            className="w-full bg-[#17211B] border border-[#24533F]/40 rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#F7F6F0] placeholder-[#F7F6F0]/30 focus:outline-none focus:border-[#D9F078]"
          />
        </div>
      </div>

      {/* Restaurant Directory Table */}
      {isError ? (
        <div className="p-8 rounded-xl bg-[#E98755]/10 border border-[#E98755]/30 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-[#E98755] mx-auto" />
          <p className="text-sm font-semibold text-[#F7F6F0]">
            Failed to retrieve restaurant applications from backend.
          </p>
          {(error as any)?.message && (
            <p className="text-xs text-[#E98755] font-mono max-w-md mx-auto">
              {(error as any)?.response?.data?.message || (error as any)?.message}
            </p>
          )}
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
                <th className="px-5 py-3.5">Brand & Slug</th>
                <th className="px-5 py-3.5">Account Owner</th>
                <th className="px-5 py-3.5">Outlets</th>
                <th className="px-5 py-3.5">KYC Documents</th>
                <th className="px-5 py-3.5">Verification Status</th>
                <th className="px-5 py-3.5">Joined (IST)</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <span className="text-xs font-mono text-[#F7F6F0]/40 animate-pulse">
                      Querying restaurant applications...
                    </span>
                  </td>
                </tr>
              ) : !data?.data || data.data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-[#F7F6F0]/50">
                    <Store className="w-6 h-6 text-[#F7F6F0]/20 mx-auto mb-2" />
                    <span>No restaurant partners found matching this status or filter.</span>
                  </td>
                </tr>
              ) : (
                data.data.map((r) => {
                  const regDate = new Date(r.createdAt);
                  const dateStr = regDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });

                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedRestaurantId(r.id)}
                      className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                    >
                      <td className="px-5 py-3.5 space-y-0.5">
                        <div className="font-bold text-[#F7F6F0] group-hover:text-[#D9F078] transition-colors flex items-center gap-1.5">
                          <span>{r.name}</span>
                        </div>
                        <div className="text-[11px] font-mono text-[#D9F078]/70">/{r.slug}</div>
                      </td>

                      <td className="px-5 py-3.5 space-y-0.5">
                        <div className="font-semibold text-[#F7F6F0]">
                          {r.owner?.fullName || 'Not Linked'}
                        </div>
                        <div className="text-[11px] font-mono text-[#F7F6F0]/50">
                          {r.owner?.phone || 'No Phone'}
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black/30 border border-white/5 font-mono text-[11px] text-[#F7F6F0]">
                          <MapPin className="w-3 h-3 text-[#D9F078]" />
                          {r.outletCount}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black/30 border border-white/5 font-mono text-[11px] text-[#F7F6F0]">
                          <FileText className="w-3 h-3 text-[#D9F078]" />
                          {r.documentCount}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">{getStatusBadge(r.verificationStatus)}</td>

                      <td className="px-5 py-3.5 font-mono text-[11px] text-[#F7F6F0]/60">
                        {dateStr}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRestaurantId(r.id);
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
          {data && data.totalPages > 1 && (
            <div className="p-4 bg-black/20 border-t border-[#24533F]/30 flex items-center justify-between text-xs text-[#F7F6F0]/60">
              <span>
                Page {data.page} of {data.totalPages} ({data.total} total partners)
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
                  disabled={page >= data.totalPages}
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

      {/* Details & Action Drawer */}
      {selectedRestaurantId && (
        <RestaurantDetailsDrawer
          restaurantId={selectedRestaurantId}
          onClose={() => setSelectedRestaurantId(null)}
        />
      )}

      {/* Add Restaurant Modal */}
      {addModalOpen && (
        <AddRestaurantModal
          isOpen={addModalOpen}
          onClose={() => setAddModalOpen(false)}
        />
      )}
    </div>
  );
};

