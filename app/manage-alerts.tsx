// app/manage-alerts.tsx
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, ImageBackground, TextInput, TouchableOpacity, 
   ActivityIndicator, BackHandler, ScrollView, Keyboard // Added Keyboard import
} from 'react-native'; 
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { db } from '../firebaseConfig';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  orderBy, 
  getDocs, 
  deleteDoc, 
  doc,
  onSnapshot
} from 'firebase/firestore';

// --- PREMIUM COMPONENT ---
import CustomAlert from '../components/CustomAlert';

export default function ManageAlerts() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [fetchingHistory, setFetchingHistory] = useState(true);

  // --- ALERT STATE ---
  const [alertConfig, setAlertConfig] = useState({ 
    visible: false, 
    type: 'success' as 'success' | 'error' | 'warning' | 'confirm' | 'destructive', 
    title: '', 
    msg: '', 
    onConfirm: () => {} 
  });

  const showAlert = (type: any, title: string, msg: string, onConfirm?: () => void) => {
    setAlertConfig({ visible: true, type, title, msg, onConfirm: onConfirm || (() => {}) });
  };

  // --- ANDROID BACK BUTTON HANDLER ---
  useEffect(() => {
    const onBackPress = () => {
      router.back();
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, []);

  // --- FETCH ALERT HISTORY (Real-time) ---
  useEffect(() => {
    const q = query(collection(db, "alerts"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const alerts = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setHistory(alerts);
      setFetchingHistory(false);
    });
    return () => unsubscribe();
  }, []);

  // --- DELETE ALERT HANDLER (PREMIUM UI) ---
  const handleDeleteAlert = (alertId: string) => {
      showAlert(
          'destructive', 
          'Delete Announcement?',
          'This will permanently remove this alert from the student dashboard.',
          async () => {
              setAlertConfig(prev => ({ ...prev, visible: false })); 
              try {
                  await deleteDoc(doc(db, "alerts", alertId));
              } catch (error) {
                  console.error("Delete error", error);
                  showAlert('error', 'Error', "Failed to delete alert.");
              }
          }
      );
  };

  const handlePostAlert = async () => {
    // FIX: Dismiss keyboard immediately when button is clicked
    Keyboard.dismiss();

    if (!message.trim()) {
      showAlert('warning', 'Missing Content', 'Please enter a message to broadcast.');
      return;
    }

    setLoading(true);
    try {
      const now = new Date();
      const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
      const dateString = now.toLocaleDateString('en-US', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
      });

      await addDoc(collection(db, "alerts"), {
        text: message,
        day: dayName,
        date: dateString,
        createdAt: serverTimestamp(),
      });

      // Cleanup logic: Keep only latest 5
      const q = query(collection(db, "alerts"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      
      if (snapshot.size > 5) {
        const toDelete = snapshot.docs.slice(5);
        const deletePromises = toDelete.map(d => deleteDoc(doc(db, "alerts", d.id)));
        await Promise.all(deletePromises);
      }

      setLoading(false);
      setMessage(''); 
      
      showAlert('success', 'Broadcast Sent', 'Your announcement is live on the student dashboard.');

    } catch (error) {
      setLoading(false);
      console.error(error);
      showAlert('error', 'Post Failed', 'Could not send the broadcast.');
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
            <Text style={styles.headerTitle}>Broadcast Alert</Text>
          </View>

          {/* FIX: added keyboardShouldPersistTaps="handled" */}
          <ScrollView 
            contentContainerStyle={styles.content} 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled" 
          >
            <Text style={styles.label}>Broadcast Message</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Type announcement here..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              value={message}
              onChangeText={setMessage}
            />
            
            <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={18} color="#FFD54F" />
                <Text style={styles.infoText}>
                    Posting a new alert will show up on the students' home page with today's date.
                </Text>
            </View>

            <TouchableOpacity style={styles.postBtn} onPress={handlePostAlert} disabled={loading}>
              {loading ? <ActivityIndicator color="#2E0249" /> : <Text style={styles.postBtnText}>Post to Students</Text>}
            </TouchableOpacity>

            {/* --- HISTORY SECTION --- */}
            <View style={styles.historySection}>
               <View style={styles.historyHeader}>
                  <Ionicons name="time-outline" size={20} color="#FFD54F" />
                  <Text style={styles.historyTitle}>Alert History (Latest 5)</Text>
               </View>

               {fetchingHistory ? (
                 <ActivityIndicator color="#FFD54F" style={{ marginTop: 20 }} />
               ) : (
                 history.map((item) => (
                   <View key={item.id} style={styles.historyCard}>
                      <View style={styles.cardTop}>
                         <Text style={styles.cardDate}>{item.day}, {item.date}</Text>
                         
                         <TouchableOpacity 
                            onPress={() => handleDeleteAlert(item.id)}
                            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                         >
                            <Ionicons name="trash-outline" size={18} color="#F44336" />
                         </TouchableOpacity>
                      </View>
                      <Text style={styles.cardText}>{item.text}</Text>
                   </View>
                 ))
               )}

               {!fetchingHistory && history.length === 0 && (
                 <Text style={styles.emptyText}>No previous alerts found.</Text>
               )}
            </View>
          </ScrollView>

          <CustomAlert 
            visible={alertConfig.visible} 
            type={alertConfig.type} 
            title={alertConfig.title} 
            message={alertConfig.msg} 
            onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))} 
            onConfirm={alertConfig.onConfirm}
            confirmText={alertConfig.type === 'destructive' ? "Yes, Delete" : "OK"}
          />

        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' },
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, marginTop: 1 },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginLeft: 15 },
  content: { padding: 20, paddingBottom: 40 },
  label: { color: '#FFD54F', fontSize: 16, fontWeight: 'bold', marginBottom: 15 },
  textArea: { backgroundColor: '#FFF', borderRadius: 15, padding: 15, height: 120, textAlignVertical: 'top', color: '#333', fontSize: 16 },
  infoBox: { flexDirection: 'row', marginTop: 15, backgroundColor: 'rgba(255,213,79,0.1)', padding: 12, borderRadius: 10, alignItems: 'center' },
  infoText: { color: '#CCC', fontSize: 12, marginLeft: 10, flex: 1 },
  postBtn: { backgroundColor: '#FFD54F', padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 25 },
  postBtnText: { color: '#2E0249', fontWeight: 'bold', fontSize: 16 },
  historySection: { marginTop: 40 },
  historyHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 10 },
  historyTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  historyCard: { 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    borderRadius: 12, 
    padding: 15, 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.1)' 
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' },
  cardDate: { color: '#FFD54F', fontSize: 12, fontWeight: '600' },
  cardText: { color: '#EEE', fontSize: 14, lineHeight: 20 },
  emptyText: { color: '#666', textAlign: 'center', marginTop: 20, fontStyle: 'italic' }
});