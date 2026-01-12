// app/admin-login.tsx
import React, { useState } from 'react';
import { 
  StyleSheet, Text, View, ImageBackground, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// --- FIREBASE IMPORTS ---
// Added 'db' import here
import { auth, db } from '../firebaseConfig';
// Added 'signOut' and Firestore functions imports
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

// --- PREMIUM COMPONENT ---
import CustomAlert from '../components/CustomAlert';

export default function AdminLogin() {
  const router = useRouter();
  
  // Changed 'adminId' to 'email' because Firebase uses emails
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Alert State
  const [alertConfig, setAlertConfig] = useState({ 
    visible: false, 
    type: 'error' as 'success' | 'error' | 'warning', 
    title: '', 
    msg: '', 
    onConfirm: () => {} 
  });

  const handleLogin = async () => {
    // 1. Basic Validation
    if (!email.trim() || !password) {
        setAlertConfig({
            visible: true,
            type: 'warning',
            title: 'Missing Info',
            msg: 'Please enter both your Admin Email and Password.',
            onConfirm: () => {}
        });
        return;
    }

    setLoading(true);

    try {
        // 2. FIREBASE AUTHENTICATION (Check Password)
        // We trim() the email to remove accidental spaces
        const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
        const user = userCredential.user;
        
        // --- 3. SECURITY CHECK: Check Role (NEW CODE START) ---
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // THE GATEKEEPER
            if (userData.role === 'admin') {
                // ✅ Success: User is Admin. Redirect to Dashboard.
                // (No need to set loading false manually, component unmounts on navigation)
                router.replace('/admin-dashboard');
            } else {
                // ⛔ Failed: User is a Student/Other trying to login as Admin
                await signOut(auth); // Kick them out immediately
                setLoading(false);
                setAlertConfig({
                    visible: true,
                    type: 'error',
                    title: 'Access Denied',
                    msg: 'This account does not have Admin privileges.',
                    onConfirm: () => {}
                });
            }
        } else {
            // User exists in Auth but not in Database (Rare edge case)
            await signOut(auth);
            setLoading(false);
            setAlertConfig({
                visible: true,
                type: 'error',
                title: 'Login Error',
                msg: 'User record not found in database.',
                onConfirm: () => {}
            });
        }
        // --- SECURITY CHECK END ---

    } catch (error: any) {
        setLoading(false);
        console.log("Firebase Login Error:", error.code);

        // 4. Handle Specific Errors nicely
        let errorMessage = 'Invalid credentials. Please check and try again.';
        
        if (error.code === 'auth/invalid-email') {
            errorMessage = 'The email address format is incorrect.';
        } else if (error.code === 'auth/user-not-found') {
            errorMessage = 'No admin account found with this email.';
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = 'Incorrect password.';
        } else if (error.code === 'auth/invalid-credential') {
            errorMessage = 'Invalid Email or Password.';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Too many failed attempts. Please try again later.';
        }

        setAlertConfig({
            visible: true,
            type: 'error',
            title: 'Login Failed',
            msg: errorMessage,
            onConfirm: () => {}
        });
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ImageBackground source={require('../assets/images/library_bg.jpg')} style={styles.backgroundImage} resizeMode="cover">
        <View style={styles.overlay}>
          <SafeAreaView style={styles.safeArea}>
            
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Administrator</Text>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.formContainer}>
              
              {/* Logo / Icon */}
              <View style={styles.iconCircle}>
                <Ionicons name="shield-checkmark" size={40} color="#FFD54F" />
              </View>
              <Text style={styles.welcomeText}>Admin Access</Text>
              <Text style={styles.subText}>Authorized personnel only.</Text>

              {/* Glass Input Fields */}
              <View style={styles.glassCard}>
                  <View style={styles.inputWrapper}>
                    {/* Changed Icon to Mail */}
                    <Ionicons name="mail" size={20} color="#AAA" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Admin Email"  // Changed from ID to Email
                      placeholderTextColor="#888"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address" // Added keyboard type
                    />
                  </View>

                  <View style={styles.inputWrapper}>
                    <Ionicons name="lock-closed" size={20} color="#AAA" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Secure Password"
                      placeholderTextColor="#888"
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={setPassword}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                      <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#AAA" />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity style={styles.loginButton} onPress={handleLogin} activeOpacity={0.8} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator color="#2E0249" />
                    ) : (
                        <Text style={styles.loginButtonText}>Secure Login</Text>
                    )}
                  </TouchableOpacity>
              </View>
              
            </KeyboardAvoidingView>
          </SafeAreaView>
        </View>

        {/* --- CUSTOM ALERT COMPONENT --- */}
        <CustomAlert 
            visible={alertConfig.visible} 
            type={alertConfig.type} 
            title={alertConfig.title} 
            message={alertConfig.msg} 
            onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))} 
        />

      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundImage: { flex: 1, width: '100%', height: '100%' },
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.85)' }, 
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, marginTop: 1 },
  backButton: { padding: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#FFF', marginLeft: 15 },
  formContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 30, marginTop: -50 },
  
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255, 213, 79, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20, alignSelf: 'center', borderWidth: 1, borderColor: '#FFD54F' },
  welcomeText: { fontSize: 28, fontWeight: 'bold', color: '#FFF', textAlign: 'center', marginBottom: 5 },
  subText: { fontSize: 14, color: '#AAA', textAlign: 'center', marginBottom: 40 },
  
  // Premium Glass Card Style
  glassCard: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 25, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, paddingHorizontal: 15, marginBottom: 15, height: 55, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, height: '100%', color: '#FFF', fontSize: 16 },
  
  loginButton: { backgroundColor: '#FFD54F', marginTop: 10, paddingVertical: 16, borderRadius: 12, alignItems: 'center', shadowColor: '#FFD54F', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  loginButtonText: { color: '#2E0249', fontSize: 16, fontWeight: 'bold' },
});