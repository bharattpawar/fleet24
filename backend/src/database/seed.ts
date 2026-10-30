import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { eq, and } from 'drizzle-orm';
import * as schema from './schema';

dotenv.config();

/**
 * Deterministic UUIDs for idempotent seeding of mock data into PostgreSQL.
 * Format: Standard RFC 4122 v4-shaped strings.
 */
export const SEED_DATA = {
  restaurants: [
    {
      id: 'a1000000-0000-4000-8000-000000000001',
      name: 'Amritsari Kulcha & Chaap Hub',
      slug: 'amritsari-kulcha-kp3',
      description: 'Authentic Amritsari street food, stuffed chur-chur naans, and rich gravies.',
      logoUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=1000&auto=format&fit=crop&q=80',
      isActive: true,
      outlet: {
        id: 'b1000000-0000-4000-8000-000000000001',
        name: 'Knowledge Park III Main Branch',
        phone: '+919811122001',
        address: 'Commercial Belt, Near Sharda University, Knowledge Park III',
        latitude: '28.4744000',
        longitude: '77.5040000',
        deliveryRadiusKm: '6.50',
        isAcceptingOrders: true,
        isActive: true,
      },
      categories: [
        { id: 'c1000000-0000-4000-8000-000000000001', name: 'Thalis & Combos', displayOrder: 1 },
        { id: 'c1000000-0000-4000-8000-000000000002', name: 'Starters', displayOrder: 2 },
        { id: 'c1000000-0000-4000-8000-000000000003', name: 'Main Course', displayOrder: 3 },
        { id: 'c1000000-0000-4000-8000-000000000004', name: 'Beverages', displayOrder: 4 },
        { id: 'c1000000-0000-4000-8000-000000000005', name: 'Breads', displayOrder: 5 },
      ],
      items: [
        {
          id: 'd1000000-0000-4000-8000-000000000101',
          categoryId: 'c1000000-0000-4000-8000-000000000001',
          name: 'Amritsari Chur Chur Naan Thali',
          description: 'Layered butter naan stuffed with paneer and spiced potatoes, served with dal makhani, chole, raita & mint chutney.',
          basePrice: '210.00',
          isVeg: true,
          imageUrl: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=600&auto=format&fit=crop&q=80',
          isAvailable: true,
          override: { customPrice: '190.00', isAvailable: true },
        },
        {
          id: 'd1000000-0000-4000-8000-000000000102',
          categoryId: 'c1000000-0000-4000-8000-000000000002',
          name: 'Tandoori Malai Soya Chaap',
          description: 'Tender soya chunks marinated in rich cashew paste, cardamom, fresh cream and cooked crisp in clay tandoor.',
          basePrice: '180.00',
          isVeg: true,
          imageUrl: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&auto=format&fit=crop&q=80',
          isAvailable: true,
        },
        {
          id: 'd1000000-0000-4000-8000-000000000103',
          categoryId: 'c1000000-0000-4000-8000-000000000003',
          name: 'Dal Makhani Slow Cooked',
          description: 'Slow-simmered black lentils finished with fresh white butter and rich cream overnight on coal.',
          basePrice: '160.00',
          isVeg: true,
          imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&auto=format&fit=crop&q=80',
          isAvailable: true,
          override: { customPrice: '150.00', isAvailable: true },
        },
        {
          id: 'd1000000-0000-4000-8000-000000000104',
          categoryId: 'c1000000-0000-4000-8000-000000000003',
          name: 'Paneer Butter Masala',
          description: 'Fresh cottage cheese cubes in velvety tomato satin gravy with crushed fenugreek leaves.',
          basePrice: '220.00',
          isVeg: true,
          imageUrl: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&auto=format&fit=crop&q=80',
          isAvailable: true,
        },
        {
          id: 'd1000000-0000-4000-8000-000000000105',
          categoryId: 'c1000000-0000-4000-8000-000000000004',
          name: 'Patiala Sweet Lassi (Clay Kulhad)',
          description: 'Thick chilled Punjabi sweet curd topped with a dollop of fresh malai and crushed pistachios.',
          basePrice: '80.00',
          isVeg: true,
          imageUrl: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80',
          isAvailable: true,
          override: { customPrice: '70.00', isAvailable: true },
        },
        {
          id: 'd1000000-0000-4000-8000-000000000106',
          categoryId: 'c1000000-0000-4000-8000-000000000005',
          name: 'Tandoori Butter Roti (Whole Wheat)',
          description: 'Traditional crisp tandoori roti made from whole wheat flour and brushed with desi ghee.',
          basePrice: '20.00',
          isVeg: true,
          imageUrl: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&auto=format&fit=crop&q=80',
          isAvailable: true,
        },
      ],
    },
    {
      id: 'a1000000-0000-4000-8000-000000000002',
      name: 'Chowringhee Kathi Junction',
      slug: 'chowringhee-pari-chowk',
      description: 'Signature Calcutta style kathi rolls, egg parathas, and fast evening bites.',
      logoUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=1000&auto=format&fit=crop&q=80',
      isActive: true,
      outlet: {
        id: 'b1000000-0000-4000-8000-000000000002',
        name: 'Pari Chowk Express',
        phone: '+919811122002',
        address: 'Metro Station Plaza, Near Alpha 1 Commercial Complex',
        latitude: '28.4682000',
        longitude: '77.5135000',
        deliveryRadiusKm: '8.00',
        isAcceptingOrders: true,
        isActive: true,
      },
      categories: [
        { id: 'c1000000-0000-4000-8000-000000000006', name: 'Kathi Rolls', displayOrder: 1 },
        { id: 'c1000000-0000-4000-8000-000000000007', name: 'Sides', displayOrder: 2 },
      ],
      items: [
        {
          id: 'd1000000-0000-4000-8000-000000000201',
          categoryId: 'c1000000-0000-4000-8000-000000000006',
          name: 'Double Egg Double Chicken Roll',
          description: 'Flaky layered laccha paratha with double farm egg wrap, spicy roasted chicken chunks, sliced onions & tangy lime sauce.',
          basePrice: '170.00',
          isVeg: false,
          imageUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600&auto=format&fit=crop&q=80',
          isAvailable: true,
          override: { customPrice: '160.00', isAvailable: true },
        },
        {
          id: 'd1000000-0000-4000-8000-000000000202',
          categoryId: 'c1000000-0000-4000-8000-000000000006',
          name: 'Paneer Tikka Roll',
          description: 'Char-grilled cottage cheese tossed in Kolkata spice blend, fresh coriander, green chillies & crisp onions.',
          basePrice: '130.00',
          isVeg: true,
          imageUrl: 'https://images.unsplash.com/photo-1627308595229-7830a5c91f9f?w=600&auto=format&fit=crop&q=80',
          isAvailable: true,
        },
        {
          id: 'd1000000-0000-4000-8000-000000000203',
          categoryId: 'c1000000-0000-4000-8000-000000000006',
          name: 'Crispy Soya Masala Roll',
          description: 'Spiced textured soya granules roasted with bell peppers, rolling inside golden crisp handmade paratha.',
          basePrice: '110.00',
          isVeg: true,
          imageUrl: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=600&auto=format&fit=crop&q=80',
          isAvailable: true,
        },
        {
          id: 'd1000000-0000-4000-8000-000000000204',
          categoryId: 'c1000000-0000-4000-8000-000000000007',
          name: 'Masala Fries with Peri Peri Dip',
          description: 'Golden potato fries seasoned with in-house chatpata masala and served hot.',
          basePrice: '90.00',
          isVeg: true,
          imageUrl: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=600&auto=format&fit=crop&q=80',
          isAvailable: true,
          override: { customPrice: '85.00', isAvailable: true },
        },
      ],
    },
    {
      id: 'a1000000-0000-4000-8000-000000000003',
      name: 'Awadh Dum Biryani & Kebabs',
      slug: 'awadh-dum-biryani-jaghat',
      description: 'Slow-cooked royal Awadhi dum biryanis, succulent kebabs and aromatic gravies.',
      logoUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=1000&auto=format&fit=crop&q=80',
      isActive: true,
      outlet: {
        id: 'b1000000-0000-4000-8000-000000000003',
        name: 'Jaghat Farm Outlet',
        phone: '+919811122003',
        address: 'Shop 14, Jaghat Farm Market, Gamma 1',
        latitude: '28.4821000',
        longitude: '77.5180000',
        deliveryRadiusKm: '5.00',
        isAcceptingOrders: true,
        isActive: true,
      },
      categories: [
        { id: 'c1000000-0000-4000-8000-000000000008', name: 'Biryani', displayOrder: 1 },
        { id: 'c1000000-0000-4000-8000-000000000009', name: 'Kebabs', displayOrder: 2 },
      ],
      items: [
        {
          id: 'd1000000-0000-4000-8000-000000000301',
          categoryId: 'c1000000-0000-4000-8000-000000000008',
          name: 'Lucknowi Chicken Dum Biryani',
          description: 'Long grain fragrant basmati rice cooked on slow dum with marinated chicken cuts, served with creamy burani raita.',
          basePrice: '260.00',
          isVeg: false,
          imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop&q=80',
          isAvailable: true,
          override: { customPrice: '240.00', isAvailable: true },
        },
        {
          id: 'd1000000-0000-4000-8000-000000000302',
          categoryId: 'c1000000-0000-4000-8000-000000000008',
          name: 'Subz Shahi Paneer Biryani',
          description: 'Dum-cooked basmati rice layered with spiced paneer tikka, carrots, French beans and saffron milk.',
          basePrice: '210.00',
          isVeg: true,
          imageUrl: 'https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?w=600&auto=format&fit=crop&q=80',
          isAvailable: true,
          override: { customPrice: '200.00', isAvailable: true },
        },
        {
          id: 'd1000000-0000-4000-8000-000000000303',
          categoryId: 'c1000000-0000-4000-8000-000000000009',
          name: 'Galouti Kebab Melt (4 Pcs)',
          description: 'Melt-in-mouth smoked vegetarian yam & lentil patties infused with 16 royal spices and rose water.',
          basePrice: '160.00',
          isVeg: true,
          imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80',
          isAvailable: true,
        },
      ],
    },
    {
      id: 'a1000000-0000-4000-8000-000000000004',
      name: 'Dakshin Tiffins & Filter Coffee',
      slug: 'dakshin-tiffins-galgotias',
      description: 'Crisp ghee podi dosas, steamed idlis, vada sambar, and authentic degree filter coffee.',
      logoUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=1000&auto=format&fit=crop&q=80',
      isActive: true,
      outlet: {
        id: 'b1000000-0000-4000-8000-000000000004',
        name: 'Galgotias Student Hub',
        phone: '+919811122004',
        address: 'Food Street, Opposite Galgotias Campus, Knowledge Park II',
        latitude: '28.4610000',
        longitude: '77.4980000',
        deliveryRadiusKm: '4.50',
        isAcceptingOrders: false, // Closed showcase per mock
        isActive: true,
      },
      categories: [
        { id: 'c1000000-0000-4000-8000-000000000010', name: 'Tiffins & Dosas', displayOrder: 1 },
        { id: 'c1000000-0000-4000-8000-000000000011', name: 'Hot Beverages', displayOrder: 2 },
      ],
      items: [
        {
          id: 'd1000000-0000-4000-8000-000000000401',
          categoryId: 'c1000000-0000-4000-8000-000000000010',
          name: 'Crisp Ghee Roast Masala Dosa',
          description: 'Golden fermented rice-lentil crepe smeared with spiced red chutney, potato masala and pure desi ghee.',
          basePrice: '140.00',
          isVeg: true,
          imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80',
          isAvailable: true,
        },
        {
          id: 'd1000000-0000-4000-8000-000000000402',
          categoryId: 'c1000000-0000-4000-8000-000000000010',
          name: 'Steamed Thatte Idli Duo with Podi',
          description: 'Puffy soft Karnataka style plate idlis drenched in gunpowder podi and warm sambar.',
          basePrice: '90.00',
          isVeg: true,
          imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80',
          isAvailable: true,
        },
        {
          id: 'd1000000-0000-4000-8000-000000000403',
          categoryId: 'c1000000-0000-4000-8000-000000000011',
          name: 'South Indian Degree Filter Coffee',
          description: 'Fresh decoction brewed with chicory and frothed hot in traditional brass dabarah and tumbler.',
          basePrice: '55.00',
          isVeg: true,
          imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80',
          isAvailable: true,
        },
      ],
    },
    {
      id: 'a1000000-0000-4000-8000-000000000005',
      name: 'Campus Chai & Bun Maska Co.',
      slug: 'campus-chai-gbu',
      description: 'Kadak ginger elaichi chai, Irani bun maska, samosas, and late-night study bites.',
      logoUrl: 'https://images.unsplash.com/photo-1571997478779-2adcbbe9ab2f?w=1000&auto=format&fit=crop&q=80',
      isActive: true,
      outlet: {
        id: 'b1000000-0000-4000-8000-000000000005',
        name: 'Gautam Buddha University Gate 2',
        phone: '+919811122005',
        address: 'GBU Main Boulevard, Sector Chi V',
        latitude: '28.4410000',
        longitude: '77.5310000',
        deliveryRadiusKm: '7.00',
        isAcceptingOrders: true,
        isActive: true,
      },
      categories: [
        { id: 'c1000000-0000-4000-8000-000000000012', name: 'Chai & Snacks', displayOrder: 1 },
      ],
      items: [
        {
          id: 'd1000000-0000-4000-8000-000000000501',
          categoryId: 'c1000000-0000-4000-8000-000000000012',
          name: 'Adrak Elaichi Cutting Chai Flask (500ml)',
          description: 'Strong full-cream milk tea boiled with fresh crushed ginger and green cardamom, serves 3-4.',
          basePrice: '120.00',
          isVeg: true,
          imageUrl: 'https://images.unsplash.com/photo-1571997478779-2adcbbe9ab2f?w=600&auto=format&fit=crop&q=80',
          isAvailable: true,
        },
        {
          id: 'd1000000-0000-4000-8000-000000000502',
          categoryId: 'c1000000-0000-4000-8000-000000000012',
          name: 'Classic Irani Bun Maska',
          description: 'Warm pillowy sweet pav bun sliced and generously slathered with salted Amul butter.',
          basePrice: '45.00',
          isVeg: true,
          imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80',
          isAvailable: true,
        },
      ],
    },
  ],
};

async function seedDatabase() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('[Seed Error] DATABASE_URL is not set.');
    process.exit(1);
  }

  // Safety Check: Never allow seeding production
  if (process.env.NODE_ENV === 'production') {
    console.error('[Seed Safety Violation] Seeding is strictly forbidden in production mode.');
    process.exit(1);
  }

  // Verify connection target is localhost/5434/fleet24_dev or Supabase
  const parsed = new URL(connectionString);
  const isDevTarget =
    ((parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
      parsed.pathname.includes('fleet24_dev')) ||
    parsed.hostname.includes('supabase.com');

  if (!isDevTarget) {
    console.error(
      `[Seed Safety Violation] Target database '${parsed.hostname}:${parsed.port}${parsed.pathname}' does not match expected development database.`,
    );
    process.exit(1);
  }

  console.log(`[Seed] Connecting to PostgreSQL database at ${parsed.hostname}:${parsed.port || 5432}${parsed.pathname}...`);

  const pool = new Pool({
    connectionString,
    ssl: parsed.hostname.includes('supabase.com') ? { rejectUnauthorized: false } : undefined,
    max: 1,
    connectionTimeoutMillis: 10000,
  });

  const db = drizzle(pool, { schema });

  let restaurantsCount = 0;
  let outletsCount = 0;
  let operatingHoursCount = 0;
  let categoriesCount = 0;
  let menuItemsCount = 0;
  let overridesCount = 0;

  try {
    for (const rData of SEED_DATA.restaurants) {
      // 1. Upsert Restaurant
      const existingRestaurant = await db.query.restaurants.findFirst({
        where: eq(schema.restaurants.slug, rData.slug),
      });

      let restaurantId = rData.id;
      if (existingRestaurant) {
        restaurantId = existingRestaurant.id;
        await db
          .update(schema.restaurants)
          .set({
            name: rData.name,
            description: rData.description,
            logoUrl: rData.logoUrl,
            isActive: rData.isActive,
            updatedAt: new Date(),
          })
          .where(eq(schema.restaurants.id, restaurantId));
      } else {
        await db.insert(schema.restaurants).values({
          id: restaurantId,
          name: rData.name,
          slug: rData.slug,
          description: rData.description,
          logoUrl: rData.logoUrl,
          isActive: rData.isActive,
        });
      }
      restaurantsCount++;

      // 2. Upsert Outlet
      const existingOutlet = await db.query.restaurantOutlets.findFirst({
        where: eq(schema.restaurantOutlets.id, rData.outlet.id),
      });

      if (existingOutlet) {
        await db
          .update(schema.restaurantOutlets)
          .set({
            name: rData.outlet.name,
            phone: rData.outlet.phone,
            address: rData.outlet.address,
            latitude: rData.outlet.latitude,
            longitude: rData.outlet.longitude,
            deliveryRadiusKm: rData.outlet.deliveryRadiusKm,
            isAcceptingOrders: rData.outlet.isAcceptingOrders,
            isActive: rData.outlet.isActive,
            updatedAt: new Date(),
          })
          .where(eq(schema.restaurantOutlets.id, rData.outlet.id));
      } else {
        await db.insert(schema.restaurantOutlets).values({
          id: rData.outlet.id,
          restaurantId,
          name: rData.outlet.name,
          phone: rData.outlet.phone,
          address: rData.outlet.address,
          latitude: rData.outlet.latitude,
          longitude: rData.outlet.longitude,
          deliveryRadiusKm: rData.outlet.deliveryRadiusKm,
          isAcceptingOrders: rData.outlet.isAcceptingOrders,
          isActive: rData.outlet.isActive,
        });
      }
      outletsCount++;

      // 3. Operating Hours (Sunday = 0 through Saturday = 6)
      for (let day = 0; day <= 6; day++) {
        const existingHour = await db.query.outletOperatingHours.findFirst({
          where: and(
            eq(schema.outletOperatingHours.outletId, rData.outlet.id),
            eq(schema.outletOperatingHours.dayOfWeek, day),
          ),
        });

        if (!existingHour) {
          await db.insert(schema.outletOperatingHours).values({
            outletId: rData.outlet.id,
            dayOfWeek: day,
            openTime: '08:00:00',
            closeTime: '23:30:00',
            isClosed: false,
          });
        }
        operatingHoursCount++;
      }

      // 4. Menu Categories
      const categoryMap = new Map<string, string>(); // categoryId -> DB UUID
      for (const cat of rData.categories) {
        const existingCategory = await db.query.menuCategories.findFirst({
          where: and(
            eq(schema.menuCategories.restaurantId, restaurantId),
            eq(schema.menuCategories.name, cat.name),
          ),
        });

        let catId = cat.id;
        if (existingCategory) {
          catId = existingCategory.id;
          await db
            .update(schema.menuCategories)
            .set({
              displayOrder: cat.displayOrder,
              isActive: true,
            })
            .where(eq(schema.menuCategories.id, catId));
        } else {
          await db.insert(schema.menuCategories).values({
            id: catId,
            restaurantId,
            name: cat.name,
            displayOrder: cat.displayOrder,
            isActive: true,
          });
        }
        categoryMap.set(cat.id, catId);
        categoriesCount++;
      }

      // 5. Menu Items & Overrides
      for (const item of rData.items) {
        const mappedCatId = categoryMap.get(item.categoryId) || item.categoryId;

        const existingItem = await db.query.menuItems.findFirst({
          where: eq(schema.menuItems.id, item.id),
        });

        if (existingItem) {
          await db
            .update(schema.menuItems)
            .set({
              name: item.name,
              description: item.description,
              basePrice: item.basePrice,
              isVeg: item.isVeg,
              imageUrl: item.imageUrl,
              isAvailable: item.isAvailable,
              categoryId: mappedCatId,
              updatedAt: new Date(),
            })
            .where(eq(schema.menuItems.id, item.id));
        } else {
          await db.insert(schema.menuItems).values({
            id: item.id,
            restaurantId,
            categoryId: mappedCatId,
            name: item.name,
            description: item.description,
            basePrice: item.basePrice,
            isVeg: item.isVeg,
            imageUrl: item.imageUrl,
            isAvailable: item.isAvailable,
          });
        }
        menuItemsCount++;

        // Outlet Override if custom price or availability is present
        if (item.override) {
          const existingOverride = await db.query.outletMenuItemOverrides.findFirst({
            where: and(
              eq(schema.outletMenuItemOverrides.outletId, rData.outlet.id),
              eq(schema.outletMenuItemOverrides.menuItemId, item.id),
            ),
          });

          if (existingOverride) {
            await db
              .update(schema.outletMenuItemOverrides)
              .set({
                customPrice: item.override.customPrice,
                isAvailable: item.override.isAvailable,
                updatedAt: new Date(),
              })
              .where(eq(schema.outletMenuItemOverrides.id, existingOverride.id));
          } else {
            await db.insert(schema.outletMenuItemOverrides).values({
              outletId: rData.outlet.id,
              menuItemId: item.id,
              customPrice: item.override.customPrice,
              isAvailable: item.override.isAvailable,
            });
          }
          overridesCount++;
        }
      }
    }

    console.log('[Seed Completed Successfully]');
    console.log(`- Restaurants seeded/updated: ${restaurantsCount}`);
    console.log(`- Restaurant Outlets seeded/updated: ${outletsCount}`);
    console.log(`- Operating Hours records seeded: ${operatingHoursCount}`);
    console.log(`- Menu Categories seeded/updated: ${categoriesCount}`);
    console.log(`- Menu Items seeded/updated: ${menuItemsCount}`);
    console.log(`- Outlet Item Overrides seeded/updated: ${overridesCount}`);
  } catch (error) {
    console.error('[Seed Error Occurred]', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedDatabase().catch((err) => {
  console.error('[Seed Unhandled Failure]', err);
  process.exit(1);
});
