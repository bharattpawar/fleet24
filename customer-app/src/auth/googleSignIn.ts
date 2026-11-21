import Constants from 'expo-constants';

export async function signInWithGoogleNative(): Promise<string | null> {
  if (Constants.appOwnership === 'expo') {
    throw new Error('Google sign-in requires the Fleet24 development app. Install the development build and open it instead of Expo Go.');
  }
  const config = Constants.expoConfig?.extra;
  if (!config?.googleWebClientId) {
    throw new Error('Google sign-in is missing its Web Client ID. Configure EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID and rebuild the app.');
  }

  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } =
    // Load native code only after the Expo Go check.
    require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');

  GoogleSignin.configure({
    webClientId: config.googleWebClientId,
    iosClientId: config.googleIosClientId,
  });

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result = await GoogleSignin.signIn();
    if (!isSuccessResponse(result)) return null;
    if (!result.data.idToken) throw new Error('Google sign-in did not return an ID token.');
    return result.data.idToken;
  } catch (error) {
    if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) return null;
    throw error;
  }
}
