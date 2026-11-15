import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { restaurantsApi } from '@/lib/api/restaurants';
import { OutletManagementTable } from './components/OutletManagementTable';
import { RestaurantDetailsDrawer } from './components/RestaurantDetailsDrawer';

export function OutletsScreen() {
  const [page, setPage] = useState(1);
  const [restaurantId, setRestaurantId] = useState('');
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const directory = useQuery({
    queryKey: ['admin', 'restaurants', 'outlet-directory', page],
    queryFn: () => restaurantsApi.listRestaurants({ page, limit: 25 }),
  });
  const restaurants = directory.data?.data ?? [];
  const restaurant = restaurants.find(({ id }) => id === restaurantId) ?? restaurants[0];
  const outlets = useQuery({
    queryKey: ['admin', 'restaurant', restaurant?.id, 'outlets'],
    queryFn: () => restaurantsApi.listOutlets(restaurant!.id),
    enabled: Boolean(restaurant),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="admin-panel flex flex-wrap items-center gap-3 p-4">
        <label htmlFor="outlet-restaurant" className="text-sm font-semibold">Restaurant</label>
        <select id="outlet-restaurant" className="admin-control max-w-full" value={restaurant?.id ?? ''} onChange={(event) => setRestaurantId(event.target.value)}>
          {restaurants.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
        </select>
        {restaurant && <button className="admin-control cursor-pointer" onClick={() => setDrawerId(restaurant.id)}>Restaurant details</button>}
        {(directory.data?.totalPages ?? 0) > 1 && (
          <div className="ml-auto flex items-center gap-2 text-sm">
            <button className="admin-control" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
            <span>Page {page}</span>
            <button className="admin-control" disabled={page >= (directory.data?.totalPages ?? 0)} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        )}
      </div>
      {directory.isError || outlets.isError ? (
        <p role="alert" className="admin-panel p-4 text-sm">Could not load outlets. <button className="admin-control" onClick={() => directory.isError ? directory.refetch() : outlets.refetch()}>Retry</button></p>
      ) : directory.isLoading || outlets.isLoading ? (
        <p role="status" className="admin-panel p-4 text-sm">Loading outlets…</p>
      ) : restaurant ? (
        <OutletManagementTable restaurantId={restaurant.id} isRestaurantSuspended={restaurant.verificationStatus === 'suspended'} outlets={outlets.data ?? []} />
      ) : (
        <p className="admin-panel p-4 text-sm">No restaurants with outlets to manage.</p>
      )}
      {drawerId && <RestaurantDetailsDrawer restaurantId={drawerId} onClose={() => setDrawerId(null)} initialTab="outlets" />}
    </div>
  );
}
