import Constants from 'expo-constants';
import { signInWithGoogleNative } from './googleSignIn';

const mockConfigure = jest.fn();
const mockHasPlayServices = jest.fn();
const mockSignIn = jest.fn();
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: (...args: unknown[]) => mockConfigure(...args),
    hasPlayServices: (...args: unknown[]) => mockHasPlayServices(...args),
    signIn: (...args: unknown[]) => mockSignIn(...args),
  },
  isSuccessResponse: (result: { type: string }) => result.type === 'success',
  isErrorWithCode: (error: { code?: string }) => Boolean(error?.code),
  statusCodes: { SIGN_IN_CANCELLED: 'cancelled' },
}));

const constants = Constants as unknown as {
  appOwnership: string | null;
  expoConfig: { extra: { googleWebClientId?: string; googleIosClientId?: string } } | null;
};

beforeEach(() => {
  jest.clearAllMocks();
  constants.appOwnership = null;
  constants.expoConfig = { extra: { googleWebClientId: 'web-client', googleIosClientId: 'ios-client' } };
  mockHasPlayServices.mockResolvedValue(true);
});

it('requests a native ID token for the backend Web client audience', async () => {
  mockSignIn.mockResolvedValue({ type: 'success', data: { idToken: 'verified-by-backend' } });
  await expect(signInWithGoogleNative()).resolves.toBe('verified-by-backend');
  expect(mockConfigure).toHaveBeenCalledWith({ webClientId: 'web-client', iosClientId: 'ios-client' });
});

it('stops before loading native sign-in in Expo Go', async () => {
  constants.appOwnership = 'expo';
  await expect(signInWithGoogleNative()).rejects.toThrow('development build');
  expect(mockConfigure).not.toHaveBeenCalled();
});

it('handles cancellation without authenticating', async () => {
  mockSignIn.mockResolvedValue({ type: 'cancelled', data: null });
  await expect(signInWithGoogleNative()).resolves.toBeNull();
});

it('requires an ID token on successful sign-in', async () => {
  mockSignIn.mockResolvedValue({ type: 'success', data: { idToken: null } });
  await expect(signInWithGoogleNative()).rejects.toThrow('ID token');
});
