// app/profile.tsx
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, ImageBackground, TouchableOpacity, 
  ScrollView, ActivityIndicator, BackHandler 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { auth, db } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

import CustomAlert from '../components/CustomAlert';

export default function ProfileScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [alertConfig, setAlertConfig] = useState({ 
    visible: false, 
    type: 'confirm' as 'success' | 'error' | 'warning' | 'confirm' | 'destructive', 
    title: '', 
    msg: '', 
    onConfirm: () => {} 
  });

  // --- ANDROID BACK HANDLER ---
  useEffect(() => {
    const onBackPress = () => {
      router.back(); 
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, []);

  // --- FETCH DATA ---
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.uid) return;
      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserData(docSnap.data());
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleLogoutPress = () => {
    setAlertConfig({
        visible: true, type: 'destructive', title: 'Sign Out?',
        msg: 'Are you sure you want to log out?',
        onConfirm: async () => {
            setAlertConfig(prev => ({ ...prev, visible: false }));
            try { await signOut(auth); router.replace('/'); } 
            catch (error) { console.error(error); }
        }
    });
  };

  const handleSupport = () => {
    setAlertConfig({
        visible: true, type: 'success', title: 'Librarian Contact',
        msg: 'Email: library@nitgyanam.com\nPhone: +91 98765 43210', onConfirm: () => {}
    });
  };

  // --- UI HELPERS ---
  const isSuspended = userData?.status === 'Blocked';
  const statusColor = isSuspended ? '#F44336' : '#4CAF50'; 
  const statusText = isSuspended ? 'Suspended' : 'Active Student';
  const initial = userData?.displayName ? userData.displayName.charAt(0).toUpperCase() : "U";

  if (loading) return (
    <View style={styles.loader}>
        <ActivityIndicator size="large" color="#FFD54F" />
    </View>
  );

  return (
    <ImageBackground source={require('../assets/images/library_bg.jpg')} style={styles.bg}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          
          {/* HEADER */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>My Profile</Text>
            <View style={{width: 40}} /> 
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            
            {/* 1. HERO PROFILE SECTION */}
            <View style={styles.heroSection}>
                <View style={[styles.avatarContainer, { borderColor: statusColor }]}>
                    <Text style={styles.avatarText}>{initial}</Text>
                    {/* Status Dot */}
                    <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                </View>
                
                <Text style={styles.userName}>{userData?.displayName || "Student Name"}</Text>
                
                <View style={styles.idPill}>
                    <Text style={styles.idLabel}>ID: </Text>
                    <Text style={styles.idValue}>
                        {userData?.rollNumber || user?.uid.substring(0, 8).toUpperCase()}
                    </Text>
                </View>

                <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
            </View>

            <View style={styles.divider} />

            {/* 2. DETAILS GRID */}
            <Text style={styles.sectionHeader}>ACADEMIC DETAILS</Text>
            
            <View style={styles.detailsCard}>
                {/* Department */}
                <View style={styles.row}>
                    <View style={styles.iconBox}>
                        <Ionicons name="school-outline" size={20} color="#FFD54F" />
                    </View>
                    <View style={styles.infoBox}>
                        <Text style={styles.label}>Department</Text>
                        <Text style={styles.value}>{userData?.department || "General"}</Text>
                    </View>
                </View>

                <View style={styles.innerDivider} />

                {/* Email */}
                <View style={styles.row}>
                    <View style={styles.iconBox}>
                        <Ionicons name="mail-outline" size={20} color="#FFD54F" />
                    </View>
                    <View style={styles.infoBox}>
                        <Text style={styles.label}>Email Address</Text>
                        <Text style={styles.value}>{user?.email}</Text>
                    </View>
                </View>

                <View style={styles.innerDivider} />

                {/* Joined Date */}
                <View style={styles.row}>
                    <View style={styles.iconBox}>
                        <Ionicons name="calendar-outline" size={20} color="#FFD54F" />
                    </View>
                    <View style={styles.infoBox}>
                        <Text style={styles.label}>Member Since</Text>
                        <Text style={styles.value}>
                            {userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString() : 'N/A'}
                        </Text>
                    </View>
                </View>
            </View>

            {/* 3. ACTIONS */}
            <Text style={styles.sectionHeader}>SETTINGS</Text>

            <TouchableOpacity style={styles.actionBtn} onPress={handleSupport}>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <Ionicons name="headset-outline" size={22} color="#FFF" style={{marginRight: 15}}/>
                    <Text style={styles.actionBtnText}>Contact Support</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogoutPress}>
                <Ionicons name="log-out-outline" size={22} color="#F44336" style={{marginRight: 10}}/>
                <Text style={styles.logoutText}>Sign Out</Text>
            </TouchableOpacity>

            <View style={styles.versionInfo}>
                <Text style={styles.versionText}>Nitgyanam Library App v1.0.0</Text>
            </View>

          </ScrollView>

          <CustomAlert 
            visible={alertConfig.visible}
            type={alertConfig.type}
            title={alertConfig.title}
            message={alertConfig.msg}
            onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
            onConfirm={alertConfig.onConfirm}
            confirmText={alertConfig.type === 'destructive' ? 'Log Out' : 'Okay'}
          />

        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' }, // Darker for premium look
  container: { flex: 1 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  
  header: { flexDirection: 'row', alignItems: 'center', padding: 20 },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginLeft: 15 },
  
  scrollContent: { padding: 20, paddingBottom: 40 },

  // HERO SECTION
  heroSection: { alignItems: 'center', marginBottom: 20 },
  avatarContainer: { 
    width: 100, height: 100, borderRadius: 50, 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    justifyContent: 'center', alignItems: 'center', 
    borderWidth: 3, marginBottom: 15 
  },
  avatarText: { fontSize: 40, fontWeight: 'bold', color: '#FFF' },
  statusDot: { 
    width: 18, height: 18, borderRadius: 9, 
    position: 'absolute', bottom: 5, right: 5, 
    borderWidth: 3, borderColor: '#000' 
  },
  userName: { fontSize: 24, fontWeight: 'bold', color: '#FFF', textAlign: 'center', marginBottom: 5 },
  idPill: { 
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', 
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 10 
  },
  idLabel: { color: '#AAA', fontSize: 12, fontWeight: '600' },
  idValue: { color: '#FFD54F', fontSize: 12, fontWeight: 'bold' },
  statusText: { fontSize: 12, fontWeight: 'bold', letterSpacing: 1, textTransform: 'uppercase' },

  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 20 },
  
  sectionHeader: { color: '#666', fontSize: 12, fontWeight: 'bold', marginBottom: 10, paddingLeft: 5 },

  // DETAILS CARD
  detailsCard: { 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    borderRadius: 20, padding: 20, marginBottom: 25,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)'
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { 
    width: 40, height: 40, borderRadius: 12, 
    backgroundColor: 'rgba(255, 213, 79, 0.1)', 
    justifyContent: 'center', alignItems: 'center', marginRight: 15 
  },
  infoBox: { flex: 1 },
  label: { color: '#AAA', fontSize: 12, marginBottom: 2 },
  value: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  innerDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginVertical: 15, marginLeft: 55 },

  // BUTTONS
  actionBtn: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)', 
    padding: 18, borderRadius: 16, marginBottom: 15 
  },
  actionBtnText: { color: '#FFF', fontSize: 16, fontWeight: '500' },

  logoutBtn: { 
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(244, 67, 54, 0.1)', 
    padding: 18, borderRadius: 16, marginBottom: 30,
    borderWidth: 1, borderColor: 'rgba(244, 67, 54, 0.3)'
  },
  logoutText: { color: '#F44336', fontSize: 16, fontWeight: 'bold' },

  versionInfo: { alignItems: 'center' },
  versionText: { color: '#444', fontSize: 12 }
});