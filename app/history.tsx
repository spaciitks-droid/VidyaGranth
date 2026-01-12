// app/history.tsx
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ImageBackground, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore'; 
import { db, auth } from '../firebaseConfig'; 
import { useRouter, usePathname } from 'expo-router'; // Added usePathname

export default function HistoryScreen() {
  const router = useRouter();
  const pathname = usePathname(); // Get current route
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const studentId = auth.currentUser?.uid;
    if (!studentId) return;

    const q = query(
      collection(db, "returnHistory"), 
      where("studentId", "==", studentId),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const renderHistoryItem = ({ item }: any) => (
    <View style={styles.historyCard}>
      <View style={styles.iconCircle}>
        <Ionicons name="checkmark-done" size={20} color="#4CAF50" />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.bookTitle}>{item.bookTitle}</Text>
        <Text style={styles.returnDate}>Returned on: {item.returnDate}</Text>
      </View>
      <View style={styles.statusBadge}>
        <Text style={styles.statusText}>COMPLETED</Text>
      </View>
    </View>
  );

  return (
    <ImageBackground source={require('../assets/images/library_bg.jpg')} style={styles.bg}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Reading History</Text>
          </View>

          {loading ? (
            <ActivityIndicator color="#FFD54F" style={{ marginTop: 50 }} />
          ) : (
            <FlatList
              data={history}
              keyExtractor={item => item.id}
              renderItem={renderHistoryItem}
              contentContainerStyle={styles.list}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="book-outline" size={60} color="rgba(255,255,255,0.1)" />
                  <Text style={styles.emptyText}>No return history found yet.</Text>
                </View>
              }
            />
          )}

          {/* SHARED BOTTOM NAVIGATION: Home -> Books -> History */}
          <View style={styles.bottomNav}>
             {/* 1. HOME */}
             <TouchableOpacity 
                style={styles.navItem} 
                onPress={() => router.replace('/student-dashboard')} // CHANGED TO REPLACE
             >
                <Ionicons 
                  name={pathname === '/student-dashboard' ? "home" : "home-outline"} 
                  size={24} 
                  color={pathname === '/student-dashboard' ? "#FFD54F" : "#888"} 
                />
                <Text style={[styles.navText, {color: pathname === '/student-dashboard' ? '#FFD54F' : '#888'}]}>
                  Home
                </Text>
             </TouchableOpacity>

             {/* 2. BOOKS */}
             <TouchableOpacity 
                style={styles.navItem} 
                onPress={() => router.replace('/available')} // CHANGED TO REPLACE
             >
                <Ionicons 
                  name={pathname === '/available' ? "book" : "book-outline"} 
                  size={24} 
                  color={pathname === '/available' ? "#FFD54F" : "#888"} 
                />
                <Text style={[styles.navText, {color: pathname === '/available' ? '#FFD54F' : '#888'}]}>
                  Books
                </Text>
             </TouchableOpacity>

             {/* 3. HISTORY */}
             <TouchableOpacity 
                style={styles.navItem}
                onPress={() => router.replace('/history')} // CHANGED TO REPLACE
            >
                <Ionicons 
                  name={pathname === '/history' ? "time" : "time-outline"} 
                  size={24} 
                  color={pathname === '/history' ? "#FFD54F" : "#888"} 
                />
                <Text style={[styles.navText, {color: pathname === '/history' ? '#FFD54F' : '#888'}]}>
                  History
                </Text>
             </TouchableOpacity>
          </View>

        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' },
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, marginBottom: 10 },
  headerTitle: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  historyCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    padding: 15, 
    borderRadius: 15, 
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(76,175,80,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  textContainer: { flex: 1 },
  bookTitle: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  returnDate: { color: '#AAA', fontSize: 12, marginTop: 2 },
  statusBadge: { backgroundColor: 'rgba(76,175,80,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { color: '#4CAF50', fontSize: 9, fontWeight: 'bold' },
  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#666', marginTop: 15 },

  // NAV STYLES
  bottomNav: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    paddingVertical: 12, 
    backgroundColor: '#0F0F0F', 
    borderTopWidth: 1, 
    borderTopColor: 'rgba(255,255,255,0.05)' 
  },
  navItem: { alignItems: 'center', flex: 1 },
  navText: { fontSize: 10, marginTop: 4, color: '#888', fontWeight: '500' }
});