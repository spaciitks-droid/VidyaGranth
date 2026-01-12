// app/index.tsx
import { useRouter, useFocusEffect } from 'expo-router'; // Changed Import
import { StatusBar } from 'expo-status-bar';
import React, { useState, useCallback } from 'react'; // Changed Import
import { Dimensions, Image, ImageBackground, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { onAuthStateChanged } from 'firebase/auth'; 
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig'; 

const { width } = Dimensions.get('window');

export default function LandingScreen() {
  const router = useRouter();
  const [initializing, setInitializing] = useState(true);

  // --- THE FIX: useFocusEffect ---
  // This ensures the listener is ONLY active when this screen is focused.
  // As soon as you click "Admin Login" and move away, this listener STOPS.
  useFocusEffect(
    useCallback(() => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user && user.emailVerified) {
          try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              if (userData.role === 'admin') {
                router.replace('/admin-dashboard');
              } else if (userData.role === 'student') {
                router.replace('/student-dashboard');
              } else {
                setInitializing(false);
              }
            } else {
               setInitializing(false);
            }
          } catch (error) {
            setInitializing(false);
          }
        } else {
          setInitializing(false);
        }
      });

      // Cleanup: When we leave this screen (navigate to Login), stop listening!
      return () => unsubscribe();
    }, [])
  );

  if (initializing) {
    return (
      <View style={[styles.mainContainer, { backgroundColor: '#1E1E1E', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#FFD54F" />
      </View>
    );
  }

  // --- UI REMAINS EXACTLY THE SAME ---
  return (
    <View style={styles.mainContainer}>
      <StatusBar style="light" />
      <ImageBackground 
        source={require('../assets/images/library_bg.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.overlay}>
          <SafeAreaView style={styles.safeArea}>
            
            <View style={styles.brandingSection}>
              <View style={styles.logoContainer}>
                <Image 
                  source={require('../assets/images/logo.png')} 
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              
              <View style={styles.textContainer}>
                <Text style={styles.appName}>NITGYANAM</Text>
                <Text style={styles.appTitle}>Vidyagranth</Text>
                <Text style={styles.tagline}>Smart Library Management System</Text>
              </View>
            </View>

            <View style={styles.actionSection}>
              <TouchableOpacity 
                style={styles.primaryButton} 
                activeOpacity={0.8}
                onPress={() => router.push('/student-login')}
              >
                <Text style={styles.primaryButtonText}>Student Login</Text>
              </TouchableOpacity>

              <View style={styles.secondaryContainer}>
                <Text style={styles.secondaryText}>Manage the library?</Text>
                <TouchableOpacity activeOpacity={0.6}
                    onPress={() => router.push('/admin-login')}>
                    <Text style={styles.secondaryLink}>Admin Login</Text>
                </TouchableOpacity>
              </View>

              <View style={{ position: 'absolute', bottom: 15, alignItems: 'center' }}>
                <Text style={styles.versionText}>v1.0.0 • NITGyanam Consultancy Pvt. Ltd.</Text>
              </View>

            </View>

          </SafeAreaView>
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1 },
  backgroundImage: { flex: 1, width: '100%', height: '100%' },
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)' }, 
  safeArea: { flex: 1, justifyContent: 'space-between' },
  brandingSection: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 40 },
  logoContainer: { marginBottom: 25, shadowColor: '#FFD54F', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 30, elevation: 10 },
  logo: { width: width * 0.45, height: width * 0.45 },
  textContainer: { alignItems: 'center' },
  appName: { fontSize: 14, fontWeight: '700', color: '#FFD54F', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 },
  appTitle: { fontSize: 48, fontWeight: '800', color: '#FFFFFF', marginBottom: 8 },
  tagline: { fontSize: 16, color: '#E0E0E0', fontWeight: '500', opacity: 0.8 },
  actionSection: { paddingBottom: 50, paddingHorizontal: 30, alignItems: 'center' },
  primaryButton: { backgroundColor: '#FFD54F', width: '100%', paddingVertical: 18, borderRadius: 16, alignItems: 'center', marginBottom: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  primaryButtonText: { color: '#2E0249', fontSize: 18, fontWeight: 'bold' },
  secondaryContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 40 },
  secondaryText: { color: '#AAA', marginRight: 6 },
  secondaryLink: { color: '#FFD54F', fontWeight: '700' },
  versionText: {  color: 'rgba(255,255,255,0.3)', fontSize: 11 },
});