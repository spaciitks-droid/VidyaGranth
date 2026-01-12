// app/notifications.tsx
import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, Text, View, ImageBackground, TouchableOpacity, 
  FlatList, ActivityIndicator, BackHandler // 1. Added BackHandler Import
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where, onSnapshot, orderBy, writeBatch, doc } from 'firebase/firestore'; 
import { db, auth } from '../firebaseConfig'; 

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 2. NEW: Android Hardware Back Button Handler
  useEffect(() => {
    const onBackPress = () => {
      router.back(); // Trigger the same action as the screen UI back button
      return true;   // Prevent default behavior (exiting the app)
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);

    // Cleanup the listener when the component unmounts
    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // 1. Listen for Notifications (Ordered Newest First)
    const q = query(
      collection(db, "notifications"),
      where("studentId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setNotifications(list);
      setLoading(false);
      
      // 2. Auto-mark as Read (Clear the Red Dot)
      markAsRead(snapshot.docs);
    });

    return () => unsubscribe();
  }, []);

  // --- HELPER: Mark Unread Items as Read ---
  const markAsRead = async (docs: any[]) => {
    const unreadDocs = docs.filter(d => !d.data().read);
    if (unreadDocs.length === 0) return;

    const batch = writeBatch(db);
    unreadDocs.forEach(d => {
      const ref = doc(db, "notifications", d.id);
      batch.update(ref, { read: true });
    });

    try {
      await batch.commit();
    } catch (e) {
      console.log("Error marking notifications as read", e);
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return "Just now";
    const date = timestamp.toDate();
    return date.toLocaleDateString() + " • " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderItem = ({ item }: any) => {
    const isSuccess = item.type === 'success';
    const isError = item.type === 'error';

    return (
      <View style={[styles.card, !item.read && styles.unreadBorder]}>
        <View style={[styles.iconBox, isSuccess ? styles.bgSuccess : (isError ? styles.bgError : styles.bgInfo)]}>
            <Ionicons 
                name={isSuccess ? "checkmark-done" : (isError ? "alert-circle" : "information")} 
                size={24} 
                color="#FFF" 
            />
        </View>
        <View style={styles.contentBox}>
            <View style={styles.topRow}>
                <Text style={styles.title}>{item.title}</Text>
                {!item.read && <View style={styles.newBadge}><Text style={styles.newText}>NEW</Text></View>}
            </View>
            <Text style={styles.message}>{item.message}</Text>
            <Text style={styles.date}>{formatTime(item.createdAt)}</Text>
        </View>
      </View>
    );
  };

  return (
    <ImageBackground source={require('../assets/images/library_bg.jpg')} style={styles.bg}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Notifications</Text>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#FFD54F" style={{ marginTop: 50 }} />
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={renderItem}
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <Ionicons name="notifications-off-outline" size={60} color="rgba(255,255,255,0.3)" />
                  <Text style={styles.emptyText}>No notifications yet.</Text>
                </View>
              }
            />
          )}

        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' },
  container: { flex: 1 },
  
  header: { flexDirection: 'row', alignItems: 'center', padding: 20 },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginLeft: 15 },

  listContent: { padding: 20 },

  card: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 15, marginBottom: 15 },
  unreadBorder: { borderLeftWidth: 4, borderLeftColor: '#FFD54F', backgroundColor: 'rgba(255,255,255,0.08)' },

  iconBox: { width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  bgSuccess: { backgroundColor: '#4CAF50' },
  bgError: { backgroundColor: '#F44336' },
  bgInfo: { backgroundColor: '#2196F3' },

  contentBox: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  
  newBadge: { backgroundColor: '#FFD54F', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  newText: { fontSize: 10, fontWeight: 'bold', color: '#000' },

  message: { color: '#CCC', fontSize: 13, lineHeight: 18, marginBottom: 6 },
  date: { color: '#888', fontSize: 11 },

  emptyBox: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#888', marginTop: 10, fontSize: 14 }
});