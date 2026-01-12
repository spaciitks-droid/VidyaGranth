// app/student-history.tsx
import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, Text, View, ImageBackground, TouchableOpacity, 
  FlatList, ActivityIndicator, BackHandler // 1. Added BackHandler Import
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where, getDocs } from 'firebase/firestore'; 
import { db, auth } from '../firebaseConfig'; 

export default function StudentHistory() {
  const router = useRouter();
  const [history, setHistory] = useState<any[]>([]);
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
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      
      
      const q = query(
        collection(db, "issueRequests"),
        where("studentId", "==", user.uid),
        where("status", "==", "Returned")
      );

      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      

      // --- ROBUST SORTING (Handles Strings & Timestamps) ---
      list.sort((a: any, b: any) => {
          const getTime = (dateInput: any) => {
              if (!dateInput) return 0;
              if (dateInput.toDate) return dateInput.toDate().getTime(); // Firestore Timestamp
              return new Date(dateInput).getTime(); // ISO String
          };
          return getTime(b.returnedAt) - getTime(a.returnedAt); // Newest first
      });

      setHistory(list);
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- SAFE DATE FORMATTER ---
  const formatDate = (dateInput: any) => {
    if (!dateInput) return "Date Unknown";
    try {
        const date = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
        if (isNaN(date.getTime())) return "Invalid Date";
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
        return "Date Error";
    }
  };

  const renderItem = ({ item }: any) => (
    <TouchableOpacity 
      style={styles.card} 
      activeOpacity={0.7}
      onPress={() => router.push({ pathname: '/book-detail-unified', params: { requestId: item.id } })}
    >
      <View style={styles.iconBox}>
        <Ionicons name="checkmark-done-circle" size={32} color="#4CAF50" />
      </View>
      
      <View style={styles.cardContent}>
        <Text style={styles.bookTitle}>{item.bookTitle || "Unknown Title"}</Text>
        <Text style={styles.author}>Returned on {formatDate(item.returnedAt)}</Text>
        
        <View style={styles.metaRow}>
            <View style={styles.badge}>
                <Ionicons name="calendar-outline" size={10} color="#AAA" style={{marginRight: 4}}/>
                <Text style={styles.metaText}>Issued: {formatDate(item.issuedAt)}</Text>
            </View>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.3)" />
    </TouchableOpacity>
  );

  return (
    <ImageBackground source={require('../assets/images/library_bg.jpg')} style={styles.bg}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Reading History</Text>
          </View>

          {!loading && (
             <View style={styles.statsContainer}>
                <Text style={styles.statsText}>
                    You have read <Text style={styles.highlight}>{history.length} books</Text> so far.
                </Text>
             </View>
          )}

          {loading ? (
            <ActivityIndicator size="large" color="#FFD54F" style={{ marginTop: 50 }} />
          ) : (
            <FlatList
              data={history}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={renderItem}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="book-outline" size={60} color="rgba(255,255,255,0.3)" />
                  <Text style={styles.emptyText}>No reading history yet.</Text>
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
  statsContainer: { paddingHorizontal: 20, marginBottom: 10 },
  statsText: { color: '#AAA', fontSize: 14 },
  highlight: { color: '#FFD54F', fontWeight: 'bold' },
  listContent: { padding: 20 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  iconBox: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(76, 175, 80, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  cardContent: { flex: 1 },
  bookTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  author: { color: '#4CAF50', fontSize: 12, fontWeight: 'bold', marginBottom: 6 },
  metaRow: { flexDirection: 'row' },
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  metaText: { color: '#AAA', fontSize: 10 },
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyText: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginTop: 15 }
});