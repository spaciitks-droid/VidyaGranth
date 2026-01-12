// app/request-status.tsx
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, ImageBackground, TouchableOpacity, 
  FlatList, ActivityIndicator, BackHandler // 1. Added BackHandler Import
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where, onSnapshot, deleteDoc, doc, orderBy } from 'firebase/firestore'; 
import { db, auth } from '../firebaseConfig'; 

// --- PREMIUM COMPONENT ---
import CustomAlert from '../components/CustomAlert';

export default function RequestStatusScreen() {
  const router = useRouter();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Alert State
  const [alertConfig, setAlertConfig] = useState({ 
    visible: false, 
    type: 'success' as 'success' | 'error' | 'warning' | 'confirm' | 'destructive', 
    title: '', 
    msg: '', 
    onConfirm: () => {} 
  });

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

  // 1. Fetch PENDING Requests (Live Listener)
  useEffect(() => {
    const studentId = auth.currentUser?.uid;
    if (!studentId) {
      setLoading(false);
      return;
    }

    // Query: Get all 'Pending' requests for this student
    const q = query(
      collection(db, "issueRequests"), 
      where("studentId", "==", studentId),
      where("status", "==", "Pending"),
      orderBy("requestDate", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRequests(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Handle Cancel Request
  const handleCancelPress = (item: any) => {
    setAlertConfig({
        visible: true,
        type: 'destructive',
        title: 'Cancel Request?',
        msg: `Are you sure you want to cancel your request for "${item.bookTitle}"?`,
        onConfirm: async () => {
            setAlertConfig(prev => ({ ...prev, visible: false }));
            try {
                await deleteDoc(doc(db, "issueRequests", item.id));
            } catch (error) {
                console.error("Error cancelling request", error);
                alert("Failed to cancel request.");
            }
        }
    });
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Just now";
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return d.toLocaleDateString() + " • " + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };

  const renderRequestCard = ({ item }: any) => {
    const isReissue = item.type === 'Reissue';

    return (
      <View style={styles.card}>
        {/* Header Row: Type Badge & Status */}
        <View style={styles.cardHeader}>
            <View style={[styles.typeBadge, isReissue ? {backgroundColor: 'rgba(156, 39, 176, 0.2)'} : {backgroundColor: 'rgba(33, 150, 243, 0.2)'}]}>
                <Text style={[styles.typeText, isReissue ? {color: '#CE93D8'} : {color: '#90CAF9'}]}>
                    {isReissue ? "REISSUE REQUEST" : "NEW BOOK REQUEST"}
                </Text>
            </View>
            <View style={styles.pendingBadge}>
                <ActivityIndicator size="small" color="#FFD54F" style={{transform: [{scale: 0.7}], marginRight: 4}} />
                <Text style={styles.pendingText}>Pending</Text>
            </View>
        </View>

        {/* Content Row */}
        <View style={styles.cardContent}>
            <View style={[styles.iconBox, isReissue ? {borderColor: '#CE93D8'} : {borderColor: '#90CAF9'}]}>
                <Ionicons name={isReissue ? "refresh" : "book"} size={24} color={isReissue ? "#CE93D8" : "#90CAF9"} />
            </View>
            <View style={{flex: 1}}>
                <Text style={styles.bookTitle} numberOfLines={1}>{item.bookTitle}</Text>
                <Text style={styles.dateText}>Requested: {formatDate(item.requestDate)}</Text>
            </View>
        </View>

        {/* Action Row */}
        <View style={styles.actionRow}>
            <Text style={styles.infoText}>Waiting for admin approval...</Text>
            <TouchableOpacity 
                style={styles.cancelBtn} 
                onPress={() => handleCancelPress(item)}
            >
                <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <ImageBackground source={require('../assets/images/library_bg.jpg')} style={styles.bg}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Pending Requests</Text>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#FFD54F" style={{ marginTop: 50 }} />
          ) : (
            <FlatList
              data={requests}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={renderRequestCard}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons name="checkmark-done-circle" size={60} color="rgba(76, 175, 80, 0.5)" />
                  </View>
                  <Text style={styles.emptyTitle}>All Caught Up!</Text>
                  <Text style={styles.emptyText}>You have no pending requests at the moment.</Text>
                  <TouchableOpacity 
                    style={styles.browseBtn}
                    onPress={() => router.back()}
                  >
                    <Text style={styles.browseBtnText}>Go to Dashboard</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          )}

          <CustomAlert 
            visible={alertConfig.visible}
            type={alertConfig.type}
            title={alertConfig.title}
            message={alertConfig.msg}
            onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
            onConfirm={alertConfig.onConfirm}
            confirmText="Yes, Cancel"
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
  header: { flexDirection: 'row', alignItems: 'center', padding: 20 },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginLeft: 15 },
  listContent: { padding: 20 },

  card: { 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    borderRadius: 16, 
    padding: 15, 
    marginBottom: 15, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.05)'
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  typeText: { fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
  pendingBadge: { flexDirection: 'row', alignItems: 'center' },
  pendingText: { color: '#FFD54F', fontSize: 12, fontStyle: 'italic' },

  cardContent: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  iconBox: { width: 45, height: 45, borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginRight: 15, backgroundColor: 'rgba(0,0,0,0.2)' },
  bookTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  dateText: { color: '#AAA', fontSize: 12 },

  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 12 },
  infoText: { color: '#666', fontSize: 11 },
  cancelBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(244, 67, 54, 0.1)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(244, 67, 54, 0.3)' },
  cancelText: { color: '#F44336', fontSize: 11, fontWeight: 'bold' },

  emptyContainer: { alignItems: 'center', marginTop: 80, padding: 20 },
  emptyIconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  emptyText: { color: '#888', textAlign: 'center', fontSize: 14, marginBottom: 30 },
  browseBtn: { backgroundColor: '#FFD54F', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 15 },
  browseBtnText: { color: '#2E0249', fontWeight: 'bold', fontSize: 16 }
});