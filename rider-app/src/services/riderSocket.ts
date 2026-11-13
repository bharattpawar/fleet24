import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../api/client';
import { authStorage } from '../api/storage';

class RiderSocketManager {
  private socket: Socket | null = null;
  private isConnecting: boolean = false;
  private offerListeners: Array<(offer: any) => void> = [];
  private deliveryUpdateListeners: Array<(update: any) => void> = [];
  private connectionStatusListeners: Array<(connected: boolean) => void> = [];

  public async connect(): Promise<Socket | null> {
    if (this.socket?.connected) {
      return this.socket;
    }
    if (this.isConnecting) return null;

    this.isConnecting = true;
    const token = await authStorage.getAccessToken();

    try {
      if (this.socket) {
        this.socket.disconnect();
        this.socket.removeAllListeners();
      }

      this.socket = io(`${SOCKET_URL}/tracking`, {
        transports: ['websocket'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
        auth: {
          token: token || undefined,
        },
      });

      this.socket.on('connect', () => {
        this.notifyConnection(true);
      });

      this.socket.on('disconnect', (reason) => {
        this.notifyConnection(false);
      });

      this.socket.on('connect_error', (error) => {
        this.notifyConnection(false);
      });

      // Listen for delivery offer broadcasted directly to rider's private room
      this.socket.on('delivery.offer.created', (offerPayload: any) => {
        this.offerListeners.forEach((listener) => {
          try {
            listener(offerPayload);
          } catch (e) {
            console.error('Error in offer listener:', e);
          }
        });
      });

      // Listen for active delivery status updates
      this.socket.on('delivery.status.updated', (payload: any) => {
        this.deliveryUpdateListeners.forEach((listener) => {
          try {
            listener(payload);
          } catch (e) {
            console.error('Error in delivery status listener:', e);
          }
        });
      });

      return this.socket;
    } catch (err) {
      console.error('[RiderSocket] Connection failed:', err);
      return null;
    } finally {
      this.isConnecting = false;
    }
  }

  public onOfferCreated(callback: (offer: any) => void): () => void {
    this.offerListeners.push(callback);
    return () => {
      this.offerListeners = this.offerListeners.filter((cb) => cb !== callback);
    };
  }

  public onDeliveryStatusUpdated(callback: (update: any) => void): () => void {
    this.deliveryUpdateListeners.push(callback);
    return () => {
      this.deliveryUpdateListeners = this.deliveryUpdateListeners.filter((cb) => cb !== callback);
    };
  }

  public onConnectionChange(callback: (connected: boolean) => void): () => void {
    this.connectionStatusListeners.push(callback);
    // Send immediate current state
    callback(!!this.socket?.connected);
    return () => {
      this.connectionStatusListeners = this.connectionStatusListeners.filter((cb) => cb !== callback);
    };
  }

  private notifyConnection(connected: boolean) {
    this.connectionStatusListeners.forEach((cb) => {
      try {
        cb(connected);
      } catch (e) {
        console.error('Error in connection listener:', e);
      }
    });
  }

  public isConnected(): boolean {
    return !!this.socket?.connected;
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.notifyConnection(false);
  }
}

export const riderSocket = new RiderSocketManager();

