// app/_layout.tsx
import { Stack } from 'expo-router';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    // 1. GLOBAL BACKGROUND IMAGE
    // This loads once and stays persistent across all screens
    <ImageBackground 
      source={require('../assets/images/library_bg.jpg')} 
      style={styles.background}
      resizeMode="cover"
    >
      {/* 2. GLOBAL DARK OVERLAY */}
      {/* Controls the tint/darkness for the whole app */}
      <View style={styles.overlay}>
        <StatusBar style="light" />
        
        {/* 3. TRANSPARENT NAVIGATION STACK */}
        <Stack 
          screenOptions={{ 
            headerShown: false,
            // CRITICAL: Makes every screen transparent so the bg shows through
            contentStyle: { backgroundColor: 'transparent' }, 
            // Global fade animation for a smooth, premium feel
            animation: 'fade', 
            animationDuration: 200 
          }}
        >
          {/* List your screens here */}
          <Stack.Screen name="index" />
          <Stack.Screen name="student-login" />
          <Stack.Screen name="student-dashboard" />
          <Stack.Screen name="available" />
          <Stack.Screen name="history" />
          {/* Any other new screens will automatically inherit the background */}
        </Stack>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    // Adjust this value (0.85) to make the background darker or lighter globally
    backgroundColor: 'rgba(0,0,0,0.85)', 
  }
});