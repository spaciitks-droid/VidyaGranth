// app/book-detail.tsx
import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, 
  ScrollView, BackHandler, ImageBackground 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { doc, deleteDoc, onSnapshot } from 'firebase/firestore'; // IMPORTED onSnapshot
import { db } from '../firebaseConfig';

// --- PREMIUM COMPONENT ---
import CustomAlert from '../components/CustomAlert';

export default function BookDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [book, setBook] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Alert State
  const [alertConfig, setAlertConfig] = useState({ 
    visible: false, 
    type: 'confirm' as 'success' | 'error' | 'warning' | 'confirm' | 'destructive', 
    title: '', 
    msg: '', 
    onConfirm: () => {} 
  });

  // --- 1. ANDROID BACK BUTTON HANDLER ---
  useEffect(() => {
    const onBackPress = () => {
      router.back(); 
      return true;   
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, []);

  // --- 2. REAL-TIME DATA LISTENER (FIXED) ---
  useEffect(() => {
    if (!id) return;

    const docRef = doc(db, "books", id as string);

    // LISTENER: Updates immediately when data changes in 'edit-book' or 'issue-book'
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setBook({ id: docSnap.id, ...docSnap.data() });
      } else {
        // If doc is missing, only show error if it's the INITIAL load.
        // This prevents this error from overriding the "Success" popup during deletion.
        if (loading) {
            setAlertConfig({
                visible: true, type: 'error', title: 'Error', msg: 'Book not found.', 
                onConfirm: () => router.back()
            });
        }
      }
      setLoading(false);
    }, (error) => {
      console.error("Error listening to book:", error);
      setLoading(false);
    });

    // Clean up listener when leaving page
    return () => unsubscribe();
  }, [id]);

  // --- 3. Delete Logic (With Auto-Redirect) ---
  const handleDelete = () => {
    setAlertConfig({
        visible: true,
        type: 'destructive',
        title: 'Delete Book?',
        msg: `Are you sure you want to delete "${book?.title}"?\n\nThis action cannot be undone.`,
        onConfirm: async () => {
            setAlertConfig(prev => ({ ...prev, visible: false }));
            
            try {
                await deleteDoc(doc(db, "books", id as string));
                
                // Show "Deleted" Success Popup
                setAlertConfig({
                    visible: true,
                    type: 'success',
                    title: 'Deleted',
                    msg: 'The book has been successfully removed.\nRedirecting...',
                    onConfirm: () => {} 
                });

                // AUTOMATIC REDIRECT
                setTimeout(() => {
                    setAlertConfig(prev => ({...prev, visible: false}));
                    router.back(); 
                }, 1500);

            } catch (error) {
                setAlertConfig({ 
                    visible: true, type: 'error', title: 'Error', msg: 'Could not delete book.', 
                    onConfirm: () => setAlertConfig(prev => ({...prev, visible: false})) 
                });
            }
        }
    });
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return "Unknown Date";
    const date = new Date(isoString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return (
    <View style={styles.loader}>
      <ActivityIndicator size="large" color="#FFD54F" />
    </View>
  );

  return (
    <ImageBackground source={require('../assets/images/library_bg.jpg')} style={styles.bg}>
    <View style={styles.overlay}>
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book Details</Text>
        
        {/* Action Buttons Row */}
        <View style={{flexDirection: 'row', gap: 10}}>
            {/* Edit Button */}
            <TouchableOpacity 
              onPress={() => router.push({ pathname: '/edit-book', params: { id: book?.id } })} 
              style={[styles.backBtn, {backgroundColor: 'rgba(33, 150, 243, 0.2)'}]}
            >
              <Ionicons name="pencil" size={20} color="#2196F3" />
            </TouchableOpacity>

            {/* Delete Button */}
            <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={20} color="#F44336" />
            </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.coverPlaceholder}>
           <Ionicons name="book" size={80} color="#FFD54F" />
        </View>

        <View style={styles.infoCard}>
           <Text style={styles.label}>TITLE</Text>
           <Text style={styles.value}>{book?.title}</Text>
           
           <View style={styles.divider}/>

           <Text style={styles.label}>AUTHOR</Text>
           <Text style={styles.value}>{book?.author}</Text>

           <View style={styles.divider}/>

           <View style={styles.row}>
             <View style={{flex: 1}}>
                <Text style={styles.label}>CATEGORY</Text>
                <Text style={styles.value}>{book?.category || 'General'}</Text>
             </View>
             <View style={{flex: 1}}>
                <Text style={styles.label}>TOTAL REGISTERED</Text>
                <Text style={styles.value}>{book?.totalQty || book?.qty} Copies</Text>
             </View>
           </View>

           <View style={styles.divider}/>

           <View style={styles.row}>
             <View style={{flex: 1}}>
                <Text style={styles.label}>AVAILABLE FOR ISSUE</Text>
                <Text style={[styles.value, {color: book?.qty > 0 ? '#4CAF50' : '#F44336'}]}>
                    {book?.qty} Copies
                </Text>
             </View>
           </View>

           <View style={styles.divider}/>

           <Text style={styles.label}>AVAILABILITY STATUS</Text>
           <View style={[styles.statusBadge, {backgroundColor: book?.qty > 0 ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)'}]}>
              <Text style={[styles.statusText, {color: book?.qty > 0 ? '#4CAF50' : '#F44336'}]}>
                  {book?.qty > 0 ? 'READY TO ISSUE' : 'ALL COPIES ISSUED'}
              </Text>
           </View>
        </View>

        {/* --- STOCK HISTORY SECTION --- */}
        <View style={styles.sectionHeader}>
            <Ionicons name="time-outline" size={18} color="#AAA" />
            <Text style={styles.sectionTitle}>Entry Logs</Text>
        </View>

        <View style={styles.historyCard}>
            {book?.restockHistory && book.restockHistory.length > 0 ? (
                // Display History in Reverse Order (Newest First)
                [...book.restockHistory].reverse().map((log: any, index: number) => (
                    <View key={index} style={styles.logRow}>
                        <View style={styles.logInfo}>
                            <Text style={styles.logAction}>{log.action || "Stock Added"}</Text>
                            <Text style={styles.logDate}>{formatDate(log.date)}</Text>
                        </View>
                        <Text style={styles.logQty}>+{log.qty}</Text>
                    </View>
                ))
            ) : (
                // Fallback for old books without history
                <View style={styles.logRow}>
                    <View style={styles.logInfo}>
                        <Text style={styles.logAction}>Initial Import</Text>
                        <Text style={styles.logDate}>{formatDate(book?.addedAt)}</Text>
                    </View>
                    <Text style={[styles.logQty, {color: '#AAA'}]}>-</Text>
                </View>
            )}
        </View>

      </ScrollView>

      {/* CUSTOM ALERT COMPONENT */}
      <CustomAlert 
        visible={alertConfig.visible}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.msg}
        onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
        onConfirm={alertConfig.onConfirm}
        confirmText={alertConfig.type === 'destructive' ? 'Delete' : 'OK'}
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
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 20,
    marginTop: 1 
  },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
  deleteBtn: { padding: 8, backgroundColor: 'rgba(244, 67, 54, 0.1)', borderRadius: 12 },
  headerTitle: { fontSize: 20, color: '#FFF', fontWeight: 'bold' },
  content: { padding: 20 },
  coverPlaceholder: { 
    alignItems: 'center', 
    marginBottom: 30, 
    padding: 40, 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.1)' 
  },
  infoCard: { 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    borderRadius: 20, 
    padding: 25, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 20
  },
  label: { color: '#FFD54F', fontSize: 11, fontWeight: 'bold', marginBottom: 5, letterSpacing: 1 },
  value: { color: '#FFF', fontSize: 18, fontWeight: '500' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginTop: 5 },
  statusText: { fontSize: 12, fontWeight: 'bold' },

  // HISTORY STYLES
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, paddingLeft: 5 },
  sectionTitle: { color: '#AAA', fontSize: 14, fontWeight: 'bold', marginLeft: 8, textTransform: 'uppercase' },
  historyCard: { 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    borderRadius: 16, 
    padding: 5, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 40
  },
  logRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 15, 
    borderBottomWidth: 1, 
    borderBottomColor: 'rgba(255,255,255,0.05)' 
  },
  logInfo: { flexDirection: 'column' },
  logAction: { color: '#FFF', fontSize: 14, fontWeight: '500' },
  logDate: { color: '#666', fontSize: 11, marginTop: 2 },
  logQty: { color: '#4CAF50', fontSize: 16, fontWeight: 'bold' }
});