// app/student-login.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router'; 
import { StatusBar } from 'expo-status-bar';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  sendEmailVerification, 
  sendPasswordResetEmail 
} from 'firebase/auth';
// --- ADDED FIRESTORE IMPORTS HERE ---
import { doc, getDoc } from 'firebase/firestore'; 
import React, { useState, useEffect, useRef } from 'react';
import { 
  ImageBackground, KeyboardAvoidingView, Platform, StyleSheet, 
  Text, TextInput, TouchableOpacity, View, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// --- ADDED DB IMPORT HERE ---
import { auth, db } from '../firebaseConfig'; 

import CustomAlert from '../components/CustomAlert';

export default function StudentLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [unverifiedUser, setUnverifiedUser] = useState<any>(null);
  
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [alertConfig, setAlertConfig] = useState({ 
    visible: false, 
    type: 'error' as 'success' | 'error' | 'warning', 
    title: '', 
    msg: '' 
  });

  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdown === 0 && timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [countdown]);

  const showAlert = (type: 'success' | 'error' | 'warning', title: string, msg: string) => {
    setAlertConfig({ visible: true, type, title, msg });
  };

  const handleLogin = async () => {
    if (email === '' || password === '') {
      showAlert('warning', 'Empty Fields', 'Please enter your email and password');
      return;
    }

    setLoading(true);
    setUnverifiedUser(null);

    try {
      // 1. Attempt login (Check Password)
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // 2. IMMEDIATE CHECK: Email Verified?
      if (!user.emailVerified) {
        await signOut(auth); 
        setTimeout(() => {
          setLoading(false);
          setUnverifiedUser(user); 
          setCountdown(60); 
          showAlert(
            'warning', 
            'Verification Required', 
            'Your account is registered but not verified. Please check your email inbox (and spam folder) for the verification link.'
          );
        }, 100); 
        return;
      }

      // --- 3. SECURITY CHECK: Check Role (NEW CODE START) ---
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
          const userData = userDoc.data();
          
          if (userData.role === 'student') {
              // ✅ Success: User is Student
              setLoading(false);
              router.replace('/student-dashboard'); 
          } else {
              // ⛔ Failed: Admin or other trying to login as student
              await signOut(auth); // Kick them out
              setLoading(false);
              showAlert('error', 'Access Denied', 'This login is strictly for Students. Admins must use the Admin Portal.');
          }
      } else {
          // User exists in Auth but not in Database (Edge Case)
          await signOut(auth);
          setLoading(false);
          showAlert('error', 'Error', 'User profile not found in database.');
      }
      // --- SECURITY CHECK END ---
      
    } catch (error: any) {
      setLoading(false);
      let errorMessage = "Invalid email or password.";
      if (error.code === 'auth/too-many-requests') errorMessage = "Too many attempts. Try later.";
      showAlert('error', 'Login Failed', errorMessage);
    }
  };

  const handleResendEmail = async () => {
    if (!unverifiedUser || countdown > 0) return;
    setResending(true);
    try {
      await sendEmailVerification(unverifiedUser);
      setResending(false);
      setCountdown(60);
      showAlert('success', 'Email Sent', 'A verification link has been sent to your inbox.');
    } catch (error: any) {
      setResending(false);
      showAlert('error', 'Limit Reached', 'Please wait before requesting again.');
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      showAlert('warning', 'Email Required', 'Please enter your email address first to reset your password.');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email.trim());
      showAlert('success', 'Reset Link Sent', 'A password reset link has been sent to your email.');
    } catch (error: any) {
      showAlert('error', 'Error', 'Could not send reset email. Please check the address.');
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
              <Text style={styles.headerTitle}>Student Portal</Text>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.formContainer}>
              <View style={styles.welcomeContainer}>
                <Text style={styles.welcomeText}>Welcome Back!</Text>
                <Text style={styles.subText}>Sign in to access your library account.</Text>
              </View>

              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Student Email"
                  placeholderTextColor="#999"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#999"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#666" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.forgotBtn} onPress={handleForgotPassword}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
                {loading ? <ActivityIndicator color="#2E0249" /> : <Text style={styles.loginButtonText}>Login</Text>}
              </TouchableOpacity>

              {unverifiedUser && (
                <TouchableOpacity 
                    style={[styles.resendContainer, countdown > 0 && { opacity: 0.6 }]} 
                    onPress={handleResendEmail} 
                    disabled={resending || countdown > 0}
                >
                  <Text style={styles.resendText}>
                    {countdown > 0 ? `Resend in ${countdown}s` : "Email not verified? "}
                    {countdown === 0 && <Text style={styles.resendLink}>Resend Link</Text>}
                  </Text>
                </TouchableOpacity>
              )}

            </KeyboardAvoidingView>

            <CustomAlert 
              visible={alertConfig.visible}
              type={alertConfig.type}
              title={alertConfig.title}
              message={alertConfig.msg}
              onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
            />

          </SafeAreaView>
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundImage: { flex: 1, width: '100%', height: '100%' },
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.75)' },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, marginTop: 1 },
  backButton: { padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFF', marginLeft: 15 },
  formContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 30 },
  welcomeContainer: { marginBottom: 30 },
  welcomeText: { fontSize: 32, fontWeight: 'bold', color: '#FFF', marginBottom: 10 },
  subText: { fontSize: 16, color: '#E0E0E0', opacity: 0.8 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 15, marginBottom: 15, height: 55 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, height: '100%', color: '#333', fontWeight: '600' },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 25 },
  forgotText: { color: '#FFD54F', fontSize: 14, fontWeight: '600' },
  loginButton: { backgroundColor: '#FFD54F', paddingVertical: 18, borderRadius: 16, alignItems: 'center', elevation: 5 },
  loginButtonText: { color: '#2E0249', fontSize: 18, fontWeight: 'bold' },
  resendContainer: { marginTop: 20, alignItems: 'center' },
  resendText: { color: '#AAA', fontSize: 14 },
  resendLink: { color: '#FFD54F', fontWeight: 'bold', textDecorationLine: 'underline' }
});