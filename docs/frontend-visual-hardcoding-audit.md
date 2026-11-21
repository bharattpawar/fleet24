# Frontend visual hardcoding audit

Audited on 21 November 2026 (Asia/Calcutta). Scope: customer app and its web version, admin dashboard, restaurant app, rider app, their asset/config files, and the backend fields serving their images. There is no separate marketing/website application directory in this checkout; the customer website uses customer-app. This report focuses on pictures, backgrounds, illustrations, maps, icons and styling, rather than ordinary interface copy.

## Direct answer

**Everything is not database driven.** Business photographs and Home content can be edited through stored image references. The visual design around them—green backgrounds, gradients, decorative shapes, typography, navigation icons, startup animation and the Launching Soon character—is implemented in the app and has no admin setting.

An image can be a bundled file while its selection is still admin controlled. For example, a published Home section containing `asset:tile-biryani` selects a bundled photograph. Admin can replace that reference with a new uploaded `media:<id>` image and publish; changing the bytes of the bundled file itself requires a new app build/update.

## Customer app and customer website

| Visual / location | Current source | Can admin change it now? | Code evidence |
| --- | --- | --- | --- |
| Home green header/background | Fixed green theme and CSS gradient; this is not a background photograph | No theme/background setting | `src/theme/homeTheme.ts` (`headerGradient`), `src/screens/HomeScreen.tsx` (`header.backgroundImage`) |
| Banner food images on the left and right | Published Home `imageLeft` / `image` fields in DB | Yes: Customer Home → banner → upload/select/URL → Publish | `src/components/home/HomeHeader.tsx` (`BannerCarousel`); admin `CustomerHomeScreen.tsx` |
| Banner background, button shape, photo placement, text overlay | Theme/style code | No | `HomeHeader.tsx`, `homeTheme.ts` |
| Food / Instant / Dineout / Scenes pictures | Published shortcut image references; bundled defaults if no shortcut section exists | Yes: Customer Home → shortcuts → Picture → Publish | `HomeScreen.tsx:145`, `src/utils/homeFeed.ts` (`DEFAULT_SHORTCUTS`) |
| Shortcut backgrounds, selected border and card layout | Fixed styles | No | `HomeHeader.tsx` (`shortcutIdle`, `shortcutSelected`) |
| Biryani / Main Course / Kathi Rolls / Beverages promo-tile pictures | Published target `image` references | Yes: Customer Home → tiles → Tile picture → Publish | `HomeHeader.tsx` (`PromoTiles`), admin `CustomerHomeScreen.tsx` |
| Tile/background treatment and number of visible tile columns | Fixed UI code | No | `HomeHeader.tsx` (`tile`, `tileWidth`) |
| “What's on your mind?” cuisine-circle photos | Published category image when category sections exist; otherwise name-to-bundled-image mapping | Yes by adding/publishing category sections. The automatic fallback mapping itself has no editor | `HomeScreen.tsx:340–347`, `src/utils/imageRef.ts` (`DISH_HINTS`, `fallbackArt`) |
| Restaurant rail/list photos and restaurant hero | Outlet `coverImageUrl`, then restaurant `logoUrl`, then bundled fallback | Yes: Restaurants → outlet → Home offer → Cover photo; restaurant logo has its own URL editor | `src/utils/homeFeed.ts` (`outletPhoto`), `RestaurantCard.tsx`, `RestaurantDetailScreen.tsx` |
| Restaurant/dish photo shading, rounded corners, green cards and availability badges | Fixed styles and gradients | No | `RestaurantCard.tsx`, `HomeSections.tsx`, `homeTheme.ts` (`photoShade`) |
| Dish images in search and curated Home rows | Menu-item DB `imageUrl`, then bundled fallback | Yes: Restaurants → menu → Image URL; restaurant owner also has a menu image-URL form | `HomeSections.tsx`, admin `MenuManagementTab.tsx`, restaurant `RestaurantMenuScreen.tsx` |
| Dish images inside a restaurant menu | Menu-item DB image URL; missing/error displays a fixed restaurant icon | Yes for the URL; placeholder is fixed | `MenuItemCard.tsx`, `ExplorePhoto.tsx` |
| Cart/order food thumbnails | Dish/order API image URL, with the reusable fixed unavailable-image treatment | Dish image is managed through the menu; historical snapshots need not follow future menu edits | `CartScreen.tsx`, `OrdersScreen.tsx`, `ExplorePhoto.tsx` |
| Eat List dish images | Live dish image / saved DB snapshot, then bundled fallback | Menu image can be changed; deleted-source snapshots remain the customer's saved record | `EatListScreen.tsx`, `EatListEditor.tsx`, backend `eat-list.service.ts` |
| Eat List hero, circles, pale cards, note/calendar layout | Fixed style code, not a background image from DB | No | `EatListScreen.tsx` (`hero`, `heroOrb`, card/plan styles) |
| Startup 3D cyclist, bicycle, helmet, delivery bag, shadows and cycle poses | Fixed bundled rider poster/48-frame rendered atlas | No animation upload/selection setting | `components/motion/RidingScene.tsx`, `assets/illustrations/rider/`, `scripts/startup-rider/` |
| Startup road, skyline, halo, scenery colours and animation timing | Drawn/styled in code | No | `RidingScene.tsx`, `StartupSplash.tsx` |
| Launching Soon cartoon shown for Instant/Dineout/Scenes | One fixed bundled `launching-soon-boy.webp` for all three features | No mascot editor | `components/LaunchingSoonModal.tsx:84` |
| Launching Soon orbit cards, halo, floating icons and animation | Fixed UI code and icon names | No | `LaunchingSoonModal.tsx` |
| Sign-in brand badge / bicycle glyph / wordmark | Fixed `BrandArt` and font/text styling; optional rider-art constant is currently null | No | `components/brand/BrandArt.tsx` |
| Empty-state illustrations and navigation/profile/cart/veg/bookmark icons | Ionicons or UI-drawn shapes, with fixed styling | No | `ScreenEmptyState.tsx`, `ScreenHeader.tsx`, `App.tsx`, `VegBadge.tsx` |
| Fonts, theme colours, spacing, shadows, borders and responsive breakpoints | Bundled fonts and TypeScript style tokens | No design-theme editor | `App.tsx` (`useFonts`), `src/theme/tokens.ts`, `appStyles.ts`, `homeLayout.ts` |
| Customer address/tracking map tiles | Google Maps / native map provider when configured; not a bundled background photo | Provider/API configuration, not an admin image field | `components/tracking/TrackingMap.tsx`, `.web.tsx`, `components/location/MapPinView.tsx`, `.web.tsx` |
| Customer map marker art, sizes and map UI defaults | Fixed code; locations/routes come from user/GPS/backend data | Marker design is not editable | Same map components and `MovingPin.tsx` |
| Launcher icon, Android adaptive-icon foreground/background, favicon | App-config paths to bundled files | No; native branding changes require a new native build | `customer-app/app.json` |

Customer paths in the table are relative to `customer-app/` unless otherwise stated. The API resolves `media:<id>` via `/public/media/:id`, `asset:<key>` via the bundled art map, and normal HTTP(S) URLs directly. If loading fails, `HomeImage` uses bundled art and finally a neutral icon placeholder. `ExplorePhoto` is a separate URL-only component and does not resolve `asset:` / `media:` references. Home uploads/cover references use `HomeImage`; menu-image forms currently collect a normal image URL.

## Admin dashboard

| Visual | Source / editability |
| --- | --- |
| Admin login background, shield mark, navigation icons, cards, sidebar, colours and spacing | Fixed Tailwind classes, Lucide icons and CSS variables. No admin theme/brand-background editor. Sources: `src/index.css`, `src/features/auth/AdminLoginScreen.tsx`, app layout components. |
| Home image-picker gallery | Fixed `public/home-art/*.webp` files and `src/components/media/homeArt.ts` catalog. Admin chooses an existing asset or uploads a replacement reference through `ImageField.tsx`; the gallery's original file contents are build assets. |
| Home editor previews, outlet covers, restaurant logos and menu images | Preview stored image references/URLs rather than forcing one image per restaurant. Home and outlet cover forms have an upload control. Restaurant-logo and menu-item editors currently expose URL inputs. |
| Built-in starter Home layout | Code-defined starter image references in `src/features/customer-home/starterLayout.ts`. They become editable draft/published content after use. This is not a remote theme system. |
| Admin font and favicon | Bundled/static files. `src/index.css` loads Instrument Serif; `index.html` references `public/favicon.svg`. Neither has an admin branding setting. |

## Restaurant app

- Update after the original audit: the restaurant app now also has a bundled, articulated 3D chef startup animation (`src/components/motion/CharacterScene.tsx`, `assets/illustrations/startup/`). Its character, kitchen scenery and intro styling are fixed source assets, not admin settings.
- Menu photographs are DB/API `item.imageUrl` values. The owner can edit the image URL and see a preview in `src/screens/RestaurantMenuScreen.tsx` (the menu image and form preview both use React Native Image).
- Screen/kitchen/card backgrounds, badges, status colours, icons, spacing and fonts are fixed in `src/theme/tokens.ts` and component styles. No configurable screen-background photograph was found in the runtime source.
- Launcher/adaptive icons and favicon are fixed asset paths in `app.json`. Fonts are bundled in `App.tsx`.

## Rider app

- Update after the original audit: the rider app now also has a bundled 3D scooter-courier startup animation (`src/components/motion/CharacterScene.tsx`, `assets/illustrations/startup/`). Its character, parallax city/road scenery and intro styling are fixed source assets, not admin settings.
- The profile avatar uses the API `profileImageUrl` when present and a fixed icon fallback in `src/components/RiderHeader.tsx`.
- **The rider map's background is a stylized code-drawn map canvas:** roads, grid, water and park are fixed View shapes in `src/components/RiderMap.tsx:111` and its style definitions. It is not a live Google basemap or a DB-selected map image. GPS state/coordinates come from runtime data; that does not make the background roads geographically real.
- Radar/pin artwork, dashboard backgrounds, cards, status colours, fonts and icon names are fixed styles/tokens. No admin-controlled rider dashboard background image setting was found.
- Launcher/adaptive icons, favicon and notification icon are bundled app-config assets.

## Configured database snapshot

Read-only inspection of the currently configured backend database during this audit found:

| Stored content | Observed state |
| --- | --- |
| Outlet cover photos | 9 `media:` uploaded-image references |
| Menu-item photographs | 21 HTTP(S) image URLs |
| Restaurant logos | 10 HTTP(S) URLs; 2 missing |
| Published Home | 6 sections: shortcuts, search hints, banner, tiles, rail, row |
| Published Home image fields | 10 `asset:` references to bundled art; no uploaded `media:` Home references at audit time |
| Published category sections | None. Automatic cuisine-circle pictures therefore currently use the bundled name-matching fallback. |

This snapshot describes this database, not every deployment or only the kitchens eligible for a particular user's delivery location. Stored HTTP image URLs are data records, not frontend hardcoded strings. Bundled choices in published Home are replaceable through the editor. Database rows and uploaded-media contents are not copied to Git by pushing source code.

## Other findings relevant to “hardcoded”

- `customer-app/src/api/mockData.ts` still contains fixed sample restaurants, menu photographs and other demo records. `USE_MOCK_DATA = false`, so those pictures are not the normal live data source.
- Customer/default shortcut and cuisine-fallback image choices remain code constants. Default offer filters, icon selections and navigation destinations are also code-defined.
- Rider development mock mode remains enabled by its existing development-only expression in `rider-app/src/api/mockData.ts`; it is separate from DB-backed live-mode data.
- Image URLs appearing as input placeholders in admin/restaurant forms are examples, not rendered product photos.
- Generated `customer-app/assets/restaurant-covers/*` photographs exist as source assets, but no runtime code directly imports those files. Visible outlet covers are served through the DB/media references described above.
- `admin-dashboard/src/App.tsx` has a fixed fallback Google Web Client ID if `VITE_GOOGLE_CLIENT_ID` is absent. The current local admin env supplies the customer Web Client ID. This is configuration hardcoding, not image/background hardcoding. No client secret is needed in browser code.

## What would need an additional settings feature

To change every visual from admin, add an explicit versioned visual-settings contract for app colours/backgrounds, splash/coming-soon artwork and branding. Keep readable built-in defaults and constrain supported animation formats. The current Home editor already handles business content photographs; it does not expose arbitrary app CSS, native icons or the rider map's drawing as editable records. Launcher/native branding and bundled font replacements still have build-time constraints.

No visual settings were added by this audit. It records the current behavior so fixed design assets are not incorrectly described as entirely DB driven.

## Push verification

All five TypeScript checks passed. Test totals: backend 589, customer 130, admin 61, restaurant 23, rider 22. The admin financial-settings test hit its existing 5-second timeout in the first parallel run; the complete admin suite passed on retry. Customer/admin lint pass with existing warnings. Pending source/text changes were checked for common credential patterns without exposing local env contents. Local `.env` files remain ignored, and `stash@{0}` is preserved.
