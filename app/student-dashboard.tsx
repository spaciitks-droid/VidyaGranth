// app/student-dashboard.tsx
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ImageBackground, TouchableOpacity, ScrollView, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { auth, db } from '../firebaseConfig'; 
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy, limit, doc, getDoc } from 'firebase/firestore'; 

import CustomAlert from '../components/CustomAlert';

export default function StudentDashboard() {
  const router = useRouter();
  const user = auth.currentUser;
  
  const [userName, setUserName] = useState("Student");
  const [issuedCount, setIssuedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [alertsList, setAlertsList] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [alertConfig, setAlertConfig] = useState({ 
    visible: false, 
    type: 'confirm' as 'success' | 'error' | 'warning' | 'confirm' | 'destructive', 
    title: '', 
    msg: '', 
    onConfirm: () => {} 
  });

  // 1. Fetch Name
  useEffect(() => {
    if (user?.uid) {
        getDoc(doc(db, "users", user.uid)).then(docSnap => {
            if(docSnap.exists()) setUserName(docSnap.data().displayName || "Student");
        });
    }
  }, [user]);

  // 2. Counts & Alerts Listeners
  useEffect(() => {
    if (!user?.uid) return;
    
    // Issued Books
    const q1 = query(collection(db, "issueRequests"), where("studentId", "==", user.uid), where("status", "==", "Issued"));
    const u1 = onSnapshot(q1, s => setIssuedCount(s.docs.length));
    
    // Pending Requests
    const q2 = query(collection(db, "issueRequests"), where("studentId", "==", user.uid), where("status", "==", "Pending"));
    const u2 = onSnapshot(q2, s => setPendingCount(s.docs.length));

    // Alerts
    const q3 = query(collection(db, "alerts"), orderBy("createdAt", "desc"), limit(5));
    const u3 = onSnapshot(q3, s => setAlertsList(s.docs.map(d => ({ id: d.id, ...d.data() }))));

    // Unread Notifications
    const q4 = query(collection(db, "notifications"), where("studentId", "==", user.uid), where("read", "==", false));
    const u4 = onSnapshot(q4, s => setUnreadCount(s.docs.length));

    return () => { u1(); u2(); u3(); u4(); };
  }, [user]);

  // 3. Back Button Handler (Prevent going back to login)
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => backHandler.remove();
  }, []);

  const handleLogoutPress = () => {
    setAlertConfig({
        visible: true, type: 'destructive', title: 'Sign Out?', msg: 'Are you sure you want to log out?',
        onConfirm: async () => {
            setAlertConfig(p => ({ ...p, visible: false }));
            try { await signOut(auth); router.replace('/'); } catch (e) { console.error(e); }
        }
    });
  };

  return (
    <ImageBackground source={require('../assets/images/library_bg.jpg')} style={styles.backgroundImage} resizeMode="cover">
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <StatusBar style="light" />
          
          {/* HEADER */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Welcome back,</Text>
              <Text style={styles.username}>{userName}</Text>
            </View>
            <View style={{flexDirection: 'row', gap: 10}}>
                <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/notifications')}>
                  <Ionicons name="notifications-outline" size={24} color="#FFF" />
                  {unreadCount > 0 && <View style={styles.redDot} />}
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={handleLogoutPress}>
                  <Ionicons name="log-out-outline" size={24} color="#F44336" />
                </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fixedContent}>
            
            {/* ID CARD */}
            <TouchableOpacity style={styles.idCard} onPress={() => router.push('/profile')} activeOpacity={0.8}>
              <View style={styles.idHeader}>
                <View>
                  <Text style={styles.cardLabel}>Student ID</Text>
                  <Text style={styles.cardValue}>{user?.email || "Unknown"}</Text>
                </View>
                <Ionicons name="chevron-forward-circle" size={30} color="#FFD54F" />
              </View>
              <View style={styles.divider} />
              <Text style={styles.idNumber}>STATUS: <Text style={{color: '#4CAF50'}}>ACTIVE</Text> • TAP TO VIEW PROFILE</Text>
            </TouchableOpacity>

            {/* STATS ROW */}
            <View style={styles.statsContainer}>
              <TouchableOpacity style={[styles.statCard, { backgroundColor: '#FFD54F' }]} onPress={() => router.push('/my-books')}>
                <View style={styles.statIconCircle}><Ionicons name="book" size={20} color="#FFD54F" /></View>
                <Text style={styles.statNumber}>{issuedCount}</Text>
                <Text style={styles.statLabel}>Issued Books</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.statCard, { backgroundColor: '#FFF' }]} onPress={() => router.push('/request-status')}>
                 <View style={[styles.statIconCircle, { backgroundColor: '#E0E0E0' }]}><Ionicons name="hourglass-outline" size={20} color="#333" /></View>
                <Text style={styles.statNumber}>{pendingCount}</Text>
                <Text style={styles.statLabel}>Pending Requests</Text>
              </TouchableOpacity>
            </View>

            {/* --- NEW: BROWSE LIBRARY CARD (Yellow) --- */}
            <TouchableOpacity 
                 style={[styles.actionCard, { borderLeftColor: '#FFD54F' }]}
                 onPress={() => router.push('/available')}
             >
                 <View style={[styles.actionIconBox, { backgroundColor: 'rgba(255, 213, 79, 0.2)' }]}>
                     <Ionicons name="search" size={22} color="#FFD54F" />
                 </View>
                 <View style={{flex: 1}}>
                     <Text style={styles.actionTitle}>Browse Library</Text>
                     <Text style={styles.actionSubtitle}>Find and request new books</Text>
                 </View>
                 <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>

            {/* --- HISTORY CARD (Green) --- */}
            <TouchableOpacity 
                 style={[styles.actionCard, { borderLeftColor: '#4CAF50' }]}
                 onPress={() => router.push('/student-history')}
             >
                 <View style={[styles.actionIconBox, { backgroundColor: 'rgba(76, 175, 80, 0.2)' }]}>
                     <Ionicons name="time-outline" size={22} color="#4CAF50" />
                 </View>
                 <View style={{flex: 1}}>
                     <Text style={styles.actionTitle}>History</Text>
                     <Text style={styles.actionSubtitle}>View all returned books</Text>
                 </View>
                 <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>

            <View style={styles.sectionHeader}>
              <Ionicons name="notifications" size={20} color="#FFD54F" />
              <Text style={styles.sectionTitle}>Announcements</Text>
            </View>
          </View>

          {/* ALERTS LIST */}
          <ScrollView style={styles.alertsScrollView} contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
            {alertsList.length === 0 ? (
              <View style={styles.alertBox}><Text style={styles.alertText}>No new announcements.</Text></View>
            ) : (
              alertsList.map((alert) => (
                <View key={alert.id} style={styles.alertBox}>
                  <View style={styles.alertHeader}>
                     <Ionicons name="calendar-outline" size={14} color="#FFD54F" />
                     <Text style={styles.alertDateText}>{alert.day}, {alert.date}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="megaphone-outline" size={24} color="#FFD54F" style={{marginRight: 15}} />
                    <Text style={styles.alertText}>{alert.text}</Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <CustomAlert visible={alertConfig.visible} type={alertConfig.type} title={alertConfig.title} message={alertConfig.msg} onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))} onConfirm={alertConfig.onConfirm} confirmText="Log Out"/>

        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: { flex: 1, width: '100%', height: '100%' },
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.8)' },
  container: { flex: 1 },
  fixedContent: { paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 8, marginBottom: 20 },
  greeting: { fontSize: 16, color: '#DDD' },
  username: { fontSize: 24, fontWeight: 'bold', color: '#FFF', textTransform: 'capitalize' },
  iconBtn: { padding: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)' },
  redDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: '#F44336' },
  idCard: { backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  idHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabel: { color: '#AAA', fontSize: 12, textTransform: 'uppercase' },
  cardValue: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginTop: 2 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 15 },
  idNumber: { color: '#FFD54F', fontWeight: '600', letterSpacing: 1, fontSize: 10 },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  statCard: { width: '48%', borderRadius: 20, padding: 15, alignItems: 'center', justifyContent: 'center', height: 100, elevation: 5 },
  statIconCircle: { width: 35, height: 35, borderRadius: 18, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statNumber: { fontSize: 24, fontWeight: 'bold', color: '#2E0249', marginBottom: 2 },
  statLabel: { fontSize: 13, color: '#555', fontWeight: '600' },
  
  // ACTION CARDS (Browse & History)
  actionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', padding: 12, borderRadius: 16, marginBottom: 10, borderLeftWidth: 4 },
  actionIconBox: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  actionTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  actionSubtitle: { color: '#AAA', fontSize: 12 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginTop: 5 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFF', marginLeft: 10 },
  alertsScrollView: { flex: 1, marginHorizontal: 20 },
  alertBox: { backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 15, padding: 15, borderWidth: 1, borderColor: '#d8a500', borderStyle: 'dashed', marginBottom: 12 },
  alertHeader: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,213,79,0.2)', paddingBottom: 8, marginBottom: 10 },
  alertDateText: { color: '#FFD54F', fontSize: 11, fontWeight: 'bold', marginLeft: 6, textTransform: 'uppercase' },
  alertText: { color: '#FFF', flex: 1, fontSize: 14, fontWeight: '500', lineHeight: 20 },
});