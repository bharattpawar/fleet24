export function resolveApiBaseUrl(configuredUrl?: string, metroHostUri?: string): string {
  if (configuredUrl?.trim()) return configuredUrl.trim().replace(/\/+$/, '');

  let host = 'localhost';
  if (metroHostUri) {
    try {
      host = new URL(metroHostUri.includes('://') ? metroHostUri : `http://${metroHostUri}`).hostname || host;
    } catch {
      // Metro's URI is optional, including when running without a development server.
    }
  }
  return `http://${host}:4000/api/v1`;
}
