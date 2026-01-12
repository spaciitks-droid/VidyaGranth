// app/add-user.tsx
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, 
  ActivityIndicator, BackHandler, KeyboardAvoidingView, Platform, 
  ImageBackground, Keyboard // Added Keyboard for dismissing
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
// Added sendEmailVerification and signOut
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

// --- PREMIUM COMPONENT ---
import CustomAlert from '../components/CustomAlert';

export default function AddUser() {
  const router = useRouter();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [password, setPassword] = useState(''); 
  const [showPassword, setShowPassword] = useState(false); 
  const [loading, setLoading] = useState(false);

  // Alert State
  const [alertConfig, setAlertConfig] = useState({ 
    visible: false, 
    type: 'success' as 'success' | 'error' | 'warning', 
    title: '', 
    msg: '', 
    onConfirm: () => {} 
  });

  const showAlert = (type: 'success' | 'error' | 'warning', title: string, msg: string, onConfirm?: () => void) => {
    setAlertConfig({ visible: true, type, title, msg, onConfirm: onConfirm || (() => {}) });
  };

  // Back Handler
  useEffect(() => {
    const onBackPress = () => { router.back(); return true; };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, []);

  const handleRegister = async () => {
    // Dismiss keyboard immediately
    Keyboard.dismiss();

    if (!name || !email || !department || !password) {
      showAlert('warning', 'Missing Fields', 'Please fill in all details.');
      return;
    }

    setLoading(true);

    try {
      // 1. Create the Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // 2. Send Verification Email
      await sendEmailVerification(user);

      // 3. Save to Firestore (Setting 'verified' field to false initially)
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        displayName: name,
        email: email.trim(),
        department: department,
        role: 'student',
        status: 'Active',
        emailVerified: false, // Internal flag
        createdAt: new Date().toISOString()
      });

      // 4. IMPORTANT: Sign the user out immediately.
      // Firebase signs users in automatically upon registration. 
      // We sign them out so they MUST verify before their first real login.
      await signOut(auth);

      setLoading(false);
      
      showAlert(
        'success', 
        'Verification Sent', 
        `A verification link has been sent to ${email}. The student cannot login until the email is verified.`, 
        () => {
          setName(''); setEmail(''); setDepartment(''); setPassword('');
          router.back();
        }
      );

    } catch (error: any) {
      setLoading(false);
      let title = "Registration Error";
      let msg = error.message;

      if (error.code === 'auth/email-already-in-use') msg = "This email is already registered.";
      else if (error.code === 'auth/weak-password') msg = "Password should be at least 6 characters.";
      else if (error.code === 'auth/invalid-email') msg = "Invalid email format.";

      showAlert('error', title, msg);
    }
  };

  return (
    <ImageBackground source={require('../assets/images/library_bg.jpg')} style={styles.bg}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Add New Student</Text>
          </View>

          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
            style={{flex: 1}}
          >
            <ScrollView 
              contentContainerStyle={styles.form}
              keyboardShouldPersistTaps="handled" // Allows button click without double tapping
            >
              <View style={styles.card}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput 
                  style={styles.input} 
                  value={name} 
                  onChangeText={setName} 
                  placeholder="e.g. Rahul Kumar" 
                  placeholderTextColor="#888" 
                />

                <Text style={styles.label}>Email ID</Text>
                <TextInput 
                  style={styles.input} 
                  value={email} 
                  onChangeText={setEmail} 
                  placeholder="student@college.edu" 
                  placeholderTextColor="#888" 
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <Text style={styles.label}>Class / Department</Text>
                <TextInput 
                  style={styles.input} 
                  value={department} 
                  onChangeText={setDepartment} 
                  placeholder="e.g. CSE - 3rd Year" 
                  placeholderTextColor="#888" 
                />

                <Text style={styles.label}>Default Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput 
                    style={styles.passwordInput} 
                    value={password} 
                    onChangeText={setPassword} 
                    placeholder="Min 6 characters" 
                    placeholderTextColor="#888" 
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                    <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#888" />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={styles.submitBtn} onPress={handleRegister} disabled={loading}>
                {loading ? <ActivityIndicator color="#2E0249" /> : <Text style={styles.submitBtnText}>Register & Send Link</Text>}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>

          <CustomAlert 
            visible={alertConfig.visible}
            type={alertConfig.type}
            title={alertConfig.title}
            message={alertConfig.msg}
            onClose={() => {
              setAlertConfig(prev => ({ ...prev, visible: false }));
              if (alertConfig.type === 'success') alertConfig.onConfirm();
            }}
          />
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)' },
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, marginTop: 1 },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
  headerTitle: { fontSize: 20, color: '#FFF', fontWeight: 'bold', marginLeft: 15 },
  form: { padding: 20 },
  card: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 25, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 20 },
  label: { color: '#FFD54F', fontSize: 12, marginBottom: 8, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  input: { backgroundColor: '#FFF', borderRadius: 12, padding: 15, marginBottom: 20, color: '#333', fontSize: 16 },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, marginBottom: 20, paddingHorizontal: 15 },
  passwordInput: { flex: 1, paddingVertical: 15, color: '#333', fontSize: 16 },
  eyeBtn: { padding: 5 },
  submitBtn: { backgroundColor: '#FFD54F', padding: 18, borderRadius: 15, alignItems: 'center', elevation: 5 },
  submitBtnText: { color: '#2E0249', fontWeight: 'bold', fontSize: 16 }
});