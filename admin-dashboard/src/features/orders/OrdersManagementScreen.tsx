import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '@/lib/api/orders';
import { OrderStatusBadge } from './components/OrderStatusBadge';
import { OrderDetailDrawer } from './components/OrderDetailDrawer';
import { 
  ShoppingBag, 
  Search, 
  RefreshCw, 
  ChevronRight, 
  Store, 
  User, 
  AlertCircle 
} from 'lucide-react';

export const OrdersManagementScreen: React.FC = () => {
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'orders', { status: selectedStatus, search: searchTerm, page }],
    queryFn: () =>
      ordersApi.listOrders({
        orderStatus: selectedStatus === 'all' ? undefined : selectedStatus,
        search: searchTerm.trim() || undefined,
        page,
        limit: 15,
      }),
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val);
  };

  const statusTabs = [
    { label: 'All Orders', value: 'all' },
    { label: 'In Kitchen', value: 'preparing' },
    { label: 'Ready for Pickup', value: 'ready_for_pickup' },
    { label: 'Out for Delivery', value: 'out_for_delivery' },
    { label: 'Delivered', value: 'delivered' },
    { label: 'Cancelled', value: 'cancelled' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#24533F]/30">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#F7F6F0]">
            Global Order Management
          </h1>
          <p className="text-xs text-[#F7F6F0]/60 mt-1">
            Super Admin Control Center · Live Kitchen Progress, Dispatch Telemetry, Administrative Cancellation
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#24533F]/40 border border-[#24533F] text-xs font-medium text-[#D9F078] hover:bg-[#24533F]/60 transition-colors disabled:opacity-50 cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Refresh Orders</span>
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center bg-[#17211B] border border-[#24533F]/40 rounded-lg p-1">
          {statusTabs.map((tab) => (
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
            placeholder="Search order #, customer, outlet..."
            className="w-full bg-[#17211B] border border-[#24533F]/40 rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#F7F6F0] placeholder-[#F7F6F0]/30 focus:outline-none focus:border-[#D9F078]"
          />
        </div>
      </div>

      {/* Orders Directory Table */}
      {isError ? (
        <div className="p-8 rounded-xl bg-[#E98755]/10 border border-[#E98755]/30 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-[#E98755] mx-auto" />
          <p className="text-sm font-semibold text-[#F7F6F0]">
            Failed to retrieve orders directory from backend.
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
                <th className="px-5 py-3.5">Order Ref</th>
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-5 py-3.5">Kitchen Outlet</th>
                <th className="px-5 py-3.5">Amount</th>
                <th className="px-5 py-3.5">Payment</th>
                <th className="px-5 py-3.5">Lifecycle Status</th>
                <th className="px-5 py-3.5">Delivery Status</th>
                <th className="px-5 py-3.5">Placed (IST)</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center">
                    <span className="text-xs font-mono text-[#F7F6F0]/40 animate-pulse">
                      Querying platform orders...
                    </span>
                  </td>
                </tr>
              ) : !data?.data || data.data.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-[#F7F6F0]/50">
                    <ShoppingBag className="w-6 h-6 text-[#F7F6F0]/20 mx-auto mb-2" />
                    <span>No customer orders found matching this filter.</span>
                  </td>
                </tr>
              ) : (
                data.data.map((ord: any) => {
                  const placedTime = new Date(ord.createdAt);
                  const timeStr = placedTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
                  const dateStr = placedTime.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });

                  const orderId = ord.orderId || ord.id;
                  const orderStatus = ord.orderStatus || ord.status;
                  const customerName = ord.customer?.fullName || ord.customer?.name || 'Customer';
                  const customerPhone = ord.customer?.phone || 'N/A';
                  const restaurantName = ord.restaurant?.name || 'Restaurant';
                  const outletName = ord.restaurant?.outletName || 'Main Outlet';

                  return (
                    <tr
                      key={orderId}
                      onClick={() => setSelectedOrderId(orderId)}
                      className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                    >
                      <td className="px-5 py-3.5 space-y-0.5">
                        <div className="font-bold text-[#F7F6F0] group-hover:text-[#D9F078] transition-colors font-mono">
                          #{ord.orderNumber}
                        </div>
                        <div className="text-[10px] text-[#F7F6F0]/40 font-mono">
                          {ord.itemCount || 1} items
                        </div>
                      </td>

                      <td className="px-5 py-3.5 space-y-0.5">
                        <div className="font-semibold text-[#F7F6F0] flex items-center gap-1">
                          <User className="w-3 h-3 text-[#D9F078]" />
                          <span>{customerName}</span>
                        </div>
                        <div className="text-[10px] font-mono text-[#F7F6F0]/50">
                          {customerPhone}
                        </div>
                      </td>

                      <td className="px-5 py-3.5 space-y-0.5">
                        <div className="font-semibold text-[#F7F6F0] flex items-center gap-1">
                          <Store className="w-3 h-3 text-[#D9F078]" />
                          <span>{restaurantName}</span>
                        </div>
                        <div className="text-[10px] text-[#F7F6F0]/50">
                          {outletName}
                        </div>
                      </td>

                      <td className="px-5 py-3.5 font-mono text-[11px] font-bold text-[#D9F078]">
                        {formatCurrency(ord.totalPayable)}
                      </td>

                      <td className="px-5 py-3.5">
                        {ord.payment ? (
                          <OrderStatusBadge type="payment" status={ord.payment.status} />
                        ) : (
                          <span className="text-[10px] font-mono text-[#F7F6F0]/40">PENDING</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        <OrderStatusBadge type="order" status={orderStatus} />
                      </td>

                      <td className="px-5 py-3.5">
                        {ord.delivery ? (
                          <OrderStatusBadge type="delivery" status={ord.delivery.status} />
                        ) : (
                          <span className="text-[10px] font-mono text-amber-400">UNASSIGNED</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 font-mono text-[11px] text-[#F7F6F0]/60">
                        <div>{timeStr}</div>
                        <div className="text-[10px] text-[#F7F6F0]/30">{dateStr}</div>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrderId(orderId);
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
                Page {data.page} of {data.totalPages} ({data.total} total orders)
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

      {/* Order Detail & Actions Drawer */}
      {selectedOrderId && (
        <OrderDetailDrawer
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
        />
      )}
    </div>
  );
};

