import { RouteRequest, RouteResult, MatrixRequest, MatrixResult } from '../routing.types';

export const ROUTING_PROVIDER_TOKEN = 'IRoutingProvider';

export interface IRoutingProvider {
  readonly providerName: string;

  /**
   * Calculates a road route between two points.
   */
  computeRoute(req: RouteRequest): Promise<RouteResult>;

  /**
   * Calculates an N x M road distance and duration matrix.
   */
  computeRouteMatrix(req: MatrixRequest): Promise<MatrixResult>;

  /**
   * Checks whether the provider is configured and available.
   */
  isConfigured(): boolean;
}
