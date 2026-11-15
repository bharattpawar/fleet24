import { CustomerHomeScreen } from '@/features/customer-home/CustomerHomeScreen';
import { FinancialSettingsScreen } from '@/features/finance/FinancialSettingsScreen';
import { DisbursementsScreen } from '@/features/finance/DisbursementsScreen';
import { DirectoryRecordsScreen } from '@/features/finance/DirectoryRecordsScreen';
import { TransactionsScreen } from '@/features/finance/TransactionsScreen';
import { PaymentConflictsScreen } from '@/features/finance/PaymentConflictsScreen';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AdminProtectedRoute } from './AdminProtectedRoute';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AdminLoginScreen } from '@/features/auth/AdminLoginScreen';
import { AdminAccessDeniedScreen } from '@/features/auth/AdminAccessDeniedScreen';
import { OverviewScreen } from '@/features/overview/OverviewScreen';
import { RestaurantManagementScreen } from '@/features/restaurants/RestaurantManagementScreen';
import { OutletsScreen } from '@/features/restaurants/OutletsScreen';
import { RiderManagementScreen } from '@/features/riders/RiderManagementScreen';
import { OrdersManagementScreen } from '@/features/orders/OrdersManagementScreen';
import { LiveDispatchScreen } from '@/features/dispatch/LiveDispatchScreen';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <AdminLoginScreen />,
  },
  {
    path: '/access-denied',
    element: <AdminAccessDeniedScreen />,
  },
  {
    path: '/',
    element: (
      <AdminProtectedRoute>
        <DashboardLayout />
      </AdminProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/overview" replace />,
      },
      {
        path: 'overview',
        element: <OverviewScreen />,
      },
      {
        path: 'orders',
        element: <OrdersManagementScreen />,
      },
      {
        path: 'dispatch',
        element: <LiveDispatchScreen />,
      },
      {
        path: 'customer-home',
        element: <CustomerHomeScreen />,
      },
      {
        path: 'restaurants',
        element: <RestaurantManagementScreen />,
      },
      {
        path: 'outlets',
        element: <OutletsScreen />,
      },
      {
        path: 'riders',
        element: <RiderManagementScreen />,
      },
      { path: 'finance/payments', element: <TransactionsScreen key="payments" mode="payments" /> },
      { path: 'finance/conflicts', element: <PaymentConflictsScreen /> },
      { path: 'finance/refunds', element: <TransactionsScreen key="refunds" mode="refunds" /> },
      { path: 'customers', element: <DirectoryRecordsScreen key="customers" mode="customers" /> },
      { path: 'finance/ledger', element: <DirectoryRecordsScreen key="ledger" mode="ledger" /> },
      { path: 'finance/settlements', element: <DisbursementsScreen key="settlements" mode="settlements" /> },
      { path: 'finance/payouts', element: <DisbursementsScreen key="payouts" mode="payouts" /> },
      { path: 'finance/settings', element: <FinancialSettingsScreen /> },
      // Catch-all inside authenticated dashboard redirects to overview
      {
        path: '*',
        element: <Navigate to="/overview" replace />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

