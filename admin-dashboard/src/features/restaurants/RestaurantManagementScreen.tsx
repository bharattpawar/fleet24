import { useSearchParams } from 'react-router-dom';
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
  const [params, setParams] = useSearchParams();
  const selectedRestaurantId = params.get('record');
  const setSelectedRestaurantId = (id: string | null) => setParams((previous) => {
    const next = new URLSearchParams(previous);
    if (id) next.set('record', id);
    else next.delete('record');
    return next;
  });
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
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] tabular-nums font-semibold bg-[#205641] text-white">
            <CheckCircle2 className="w-3 h-3" /> APPROVED
          </span>
        );
      case 'suspended':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] tabular-nums font-semibold bg-[#9A431F]/20 text-[#9A431F] border border-[#9A431F]/40">
            <XCircle className="w-3 h-3" /> SUSPENDED
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] tabular-nums font-semibold bg-slate-100 text-slate-600 border border-[#E3E7EC]">
            REJECTED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] tabular-nums font-semibold bg-amber-500/10 text-amber-700 border border-amber-500/30">
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
    <div className="max-w-7xl mx-auto space-y-4 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-[#E3E7EC]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#171A21]">
            Restaurant & Outlet Management
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Super Admin Partner Governance · Onboarding KYC, Multi-Outlet Controls, Emergency Overrides
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#205641] text-white text-xs font-bold hover:bg-[#205641]/80 transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Restaurant</span>
          </button>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#E8F2ED] border border-[#205641] text-xs font-medium text-[#205641] hover:bg-[#E8F2ED] transition-colors disabled:opacity-50 cursor-pointer self-start md:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh Directory</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center bg-[#FFFFFF] border border-[#E3E7EC] rounded-lg p-1">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setSelectedStatus(tab.value);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                selectedStatus === tab.value
                  ? 'bg-[#205641] text-white shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-[#171A21] hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder="Search restaurant or slug..."
            className="w-full bg-[#FFFFFF] border border-[#E3E7EC] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#171A21] placeholder-slate-600 focus:outline-none focus:border-[#205641]"
          />
        </div>
      </div>

      {/* Restaurant Directory Table */}
      {isError ? (
        <div className="p-8 rounded-xl bg-[#9A431F]/10 border border-[#9A431F]/30 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-[#9A431F] mx-auto" />
          <p className="text-sm font-semibold text-[#171A21]">
            Failed to retrieve restaurant applications from backend.
          </p>
          {(error as any)?.message && (
            <p className="text-xs text-[#9A431F] tabular-nums max-w-md mx-auto">
              {(error as any)?.response?.data?.message || (error as any)?.message}
            </p>
          )}
          <button
            onClick={() => refetch()}
            className="px-4 py-1.5 rounded-lg bg-[#205641] text-white text-xs font-bold hover:bg-[#205641]/80 transition-colors cursor-pointer"
          >
            Retry Query
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#E3E7EC] bg-[#FFFFFF]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F5F6F8] border-b border-[#E3E7EC] text-[10px] tabular-nums  text-slate-600">
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
            <tbody className="divide-y divide-[#E3E7EC]">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <span className="text-xs tabular-nums text-slate-600 animate-pulse">
                      Querying restaurant applications...
                    </span>
                  </td>
                </tr>
              ) : !data?.data || data.data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-600">
                    <Store className="w-6 h-6 text-slate-600 mx-auto mb-2" />
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
                      className="hover:bg-slate-50 transition-colors cursor-pointer group"
                    >
                      <td className="px-5 py-3.5 space-y-0.5">
                        <div className="font-bold text-[#171A21] group-hover:text-[#205641] transition-colors flex items-center gap-1.5">
                          <span>{r.name}</span>
                        </div>
                        <div className="text-[11px] tabular-nums text-[#205641]/70">/{r.slug}</div>
                      </td>

                      <td className="px-5 py-3.5 space-y-0.5">
                        <div className="font-semibold text-[#171A21]">
                          {r.owner?.fullName || 'Not Linked'}
                        </div>
                        <div className="text-[11px] tabular-nums text-slate-600">
                          {r.owner?.phone || 'No Phone'}
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#F5F6F8] border border-[#E3E7EC] tabular-nums text-[11px] text-[#171A21]">
                          <MapPin className="w-3 h-3 text-[#205641]" />
                          {r.outletCount}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#F5F6F8] border border-[#E3E7EC] tabular-nums text-[11px] text-[#171A21]">
                          <FileText className="w-3 h-3 text-[#205641]" />
                          {r.documentCount}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">{getStatusBadge(r.verificationStatus)}</td>

                      <td className="px-5 py-3.5 tabular-nums text-[11px] text-slate-600">
                        {dateStr}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRestaurantId(r.id);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#E8F2ED] hover:bg-[#205641] text-[11px] font-semibold text-[#205641] border border-[#205641] transition-colors cursor-pointer"
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
            <div className="p-4 bg-[#F5F6F8] border-t border-[#E3E7EC] flex items-center justify-between text-xs text-slate-600">
              <span>
                Page {data.page} of {data.totalPages} ({data.total} total partners)
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
                  disabled={page >= data.totalPages}
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

