/** Loads the Google Maps JavaScript API once per page (web only). Shared by every web map in the app. */

declare global {
  interface Window {
    google?: any;
    __fleet24MapsPromise?: Promise<any>;
  }
}

export const GOOGLE_MAPS_BROWSER_KEY: string | undefined = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || undefined;

export function loadGoogleMaps(key: string): Promise<any> {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (!window.__fleet24MapsPromise) {
    window.__fleet24MapsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
      script.async = true;
      script.onload = () => (window.google?.maps ? resolve(window.google.maps) : reject(new Error('Maps failed to load')));
      script.onerror = () => {
        window.__fleet24MapsPromise = undefined; // allow a retry on the next mount
        reject(new Error('Maps failed to load'));
      };
      document.head.appendChild(script);
    });
  }
  return window.__fleet24MapsPromise;
}
