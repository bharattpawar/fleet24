import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AdminProtectedRoute } from './AdminProtectedRoute';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AdminLoginScreen } from '@/features/auth/AdminLoginScreen';
import { AdminAccessDeniedScreen } from '@/features/auth/AdminAccessDeniedScreen';
import { OverviewScreen } from '@/features/overview/OverviewScreen';
import { RestaurantManagementScreen } from '@/features/restaurants/RestaurantManagementScreen';
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
        path: 'restaurants',
        element: <RestaurantManagementScreen />,
      },
      {
        path: 'outlets',
        element: <Navigate to="/restaurants" replace />,
      },
      {
        path: 'riders',
        element: <RiderManagementScreen />,
      },
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

