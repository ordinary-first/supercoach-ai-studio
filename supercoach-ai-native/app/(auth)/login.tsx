import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { loginAnonymously, loginWithGoogle } from '../../services/firebaseService';

export default function LoginScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await loginWithGoogle();
      if (result?.user) {
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      Alert.alert('Login Failed', error?.message || 'Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const handleAnonymousLogin = useCallback(async () => {
    setIsLoading(true);
    try {
      const user = await loginAnonymously();
      if (user) {
        router.replace('/(tabs)');
      } else {
        Alert.alert('Login Failed', 'Anonymous login failed. Please try again.');
      }
    } catch (error: any) {
      Alert.alert('Login Failed', error?.message || 'Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  return (
    <View className="flex-1 items-center justify-center bg-white px-8">
      <View className="mb-12 items-center">
        <Text className="text-4xl font-bold text-gray-900">SuperCoach</Text>
        <Text className="mt-2 text-lg text-gray-500">AI Life Coach Studio</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#4285F4" />
      ) : (
        <View className="w-full max-w-xs gap-4">
          <TouchableOpacity
            className="w-full items-center rounded-xl bg-blue-600 px-6 py-4"
            onPress={handleGoogleLogin}
            activeOpacity={0.8}
          >
            <Text className="text-base font-semibold text-white">Sign in with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="w-full items-center rounded-xl border border-gray-300 bg-white px-6 py-4"
            onPress={handleAnonymousLogin}
            activeOpacity={0.8}
          >
            <Text className="text-base font-semibold text-gray-700">Continue as Guest</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
