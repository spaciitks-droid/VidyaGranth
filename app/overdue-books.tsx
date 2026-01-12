// app/overdue-books.tsx
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, FlatList, ActivityIndicator, BackHandler } from 'react-native'; // Added BackHandler
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where, onSnapshot, doc, updateDoc, increment } from 'firebase/firestore'; 
import { db } from '../firebaseConfig';
import CustomAlert from '../components/CustomAlert';

export default function OverdueBooks() {
  const router = useRouter();
  const [overdueList, setOverdueList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Alert State
  const [alertConfig, setAlertConfig] = useState({ visible: false, type: 'confirm' as any, title: '', msg: '', onConfirm: () => {} });

  // --- ADDED: ANDROID BACK BUTTON HANDLER ---
  useEffect(() => {
    const onBackPress = () => {
      router.back(); // Go back to the previous screen
      return true;   // Prevent default behavior (exiting the app)
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress
    );

    return () => backHandler.remove();
  }, []);
  // ------------------------------------------

  // 1. Listen for ALL Issued Books & Filter for Overdue
  useEffect(() => {
    const q = query(collection(db, "issueRequests"), where("status", "==", "Issued"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = new Date();
      
      const overdueItems = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter(item => {
           // Check if returnDate exists and is in the past
           if (!item.returnDate) return false;
           return new Date(item.returnDate) < now;
        });

      setOverdueList(overdueItems);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Handle "Overdue Return" Logic
  const handleOverdueReturn = (request: any) => {
    setAlertConfig({
        visible: true,
        type: 'confirm',
        title: 'Confirm Overdue Return',
        msg: `Mark "${request.bookTitle}" returned from ${request.studentName}? Stock will be updated.`,
        onConfirm: async () => {
            setAlertConfig(prev => ({ ...prev, visible: false }));
            try {
                // A. Mark as Returned
                await updateDoc(doc(db, "issueRequests", request.id), {
                    status: "Returned",
                    returnedAt: new Date().toISOString(),
                    isOverdueReturn: true // Optional flag for history
                });

                // B. Increment Stock
                await updateDoc(doc(db, "books", request.bookId), {
                    qty: increment(1)
                });

            } catch (error) {
                console.error("Return failed", error);
            }
        }
    });
  };

  const renderOverdueItem = ({ item }: any) => {
    const daysOverdue = Math.floor((new Date().getTime() - new Date(item.returnDate).getTime()) / (1000 * 3600 * 24));

    return (
      <View style={styles.card}>
          <View style={styles.cardHeader}>
              <View style={styles.iconBox}>
                 <Ionicons name="warning" size={20} color="#F44336" />
              </View>
              <View style={styles.info}>
                  <Text style={styles.bookTitle} numberOfLines={1}>{item.bookTitle}</Text>
                  <Text style={styles.studentName}>{item.studentName}</Text>
              </View>
              <View style={styles.daysBadge}>
                  <Text style={styles.daysText}>{daysOverdue} days late</Text>
              </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.cardFooter}>
              <Text style={styles.dateText}>Due: {new Date(item.returnDate).toLocaleDateString()}</Text>
              
              <TouchableOpacity 
                style={styles.returnBtn}
                onPress={() => handleOverdueReturn(item)}
              >
                  <Text style={styles.returnBtnText}>Overdue Return</Text>
                  <Ionicons name="checkmark-circle-outline" size={16} color="#FFF" style={{marginLeft: 5}}/>
              </TouchableOpacity>
          </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Overdue Books</Text>
      </View>

      <FlatList
        data={overdueList}
        keyExtractor={item => item.id}
        renderItem={renderOverdueItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !loading ? (
            <View style={{alignItems: 'center', marginTop: 100}}>
                <Ionicons name="checkbox-outline" size={60} color="rgba(76, 175, 80, 0.3)" />
                <Text style={{color: '#AAA', marginTop: 15}}>No books are overdue!</Text>
            </View>
          ) : null
        }
      />

      <CustomAlert 
        visible={alertConfig.visible}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.msg}
        onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
        onConfirm={alertConfig.onConfirm}
        confirmText="Confirm Return"
      />

      {loading && (
         <View style={styles.loaderContainer}>
            <ActivityIndicator color="#F44336" size="large" />
         </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', marginTop: 1 },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
  headerTitle: { fontSize: 20, color: '#FFF', fontWeight: 'bold', marginLeft: 15 },
  
  listContent: { padding: 20 },
  loaderContainer: { position: 'absolute', bottom: 20, width: '100%', alignItems: 'center' },

  // Card Styles
  card: { backgroundColor: 'rgba(244, 67, 54, 0.08)', borderRadius: 16, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: 'rgba(244, 67, 54, 0.2)' },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(244, 67, 54, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  info: { flex: 1 },
  bookTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  studentName: { color: '#AAA', fontSize: 13, marginTop: 2 },
  
  daysBadge: { backgroundColor: '#F44336', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  daysText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },

  divider: { height: 1, backgroundColor: 'rgba(244, 67, 54, 0.15)', marginVertical: 12 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateText: { color: '#F44336', fontSize: 12, fontWeight: '600' },
  
  returnBtn: { flexDirection: 'row', backgroundColor: '#F44336', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  returnBtnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' }
});