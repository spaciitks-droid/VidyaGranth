// app/add-book.tsx
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, 
  ActivityIndicator, BackHandler 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { db } from '../firebaseConfig';
import { collection, addDoc, getDocs, updateDoc, increment, doc, arrayUnion } from 'firebase/firestore';

// --- PREMIUM COMPONENTS ---
// Make sure you have created these files in your components folder
import GlassModal from '../components/GlassModal';
import CustomAlert from '../components/CustomAlert';

export default function AddBook() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [category, setCategory] = useState('');
  const [totalQty, setTotalQty] = useState('');
  const [loading, setLoading] = useState(false);

  // State for Duplicate Handling
  const [duplicateBook, setDuplicateBook] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // State for Custom Alerts
  const [alertConfig, setAlertConfig] = useState({ 
    visible: false, 
    type: 'success' as 'success' | 'error' | 'warning', 
    title: '', 
    msg: '', 
    onConfirm: () => {} 
  });

  // Helper to show alerts easily
  const showAlert = (type: 'success' | 'error' | 'warning', title: string, msg: string, onConfirm?: () => void) => {
    setAlertConfig({ visible: true, type, title, msg, onConfirm: onConfirm || (() => {}) });
  };

  // Back Handler
  useEffect(() => {
    const onBackPress = () => {
      if (modalVisible) {
        setModalVisible(false);
        return true;
      }
      router.back();
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [modalVisible]);

  const handleAddBook = async () => {
    // 1. Basic Field Validation
    if (!title || !author || !totalQty) {
      showAlert('warning', 'Missing Details', 'Please fill in all essential book details');
      return;
    }

    // 2. ZERO QUANTITY CHECK
    const quantityNumber = parseInt(totalQty);
    if (isNaN(quantityNumber) || quantityNumber <= 0) {
      showAlert('error', 'Invalid Quantity', 'You must add at least 1 book to the inventory.');
      return;
    }

    setLoading(true);
    const inputTitle = title.trim().toLowerCase();
    const inputAuthor = author.trim().toLowerCase();

    try {
      // 3. SMART CHECK (CASE INSENSITIVE)
      const booksSnap = await getDocs(collection(db, "books"));
      
      const foundDuplicate = booksSnap.docs.find(doc => {
          const d = doc.data();
          const dbTitle = (d.title || "").trim().toLowerCase();
          const dbAuthor = (d.author || "").trim().toLowerCase();
          return dbTitle === inputTitle && dbAuthor === inputAuthor;
      });

      if (foundDuplicate) {
        // DUPLICATE FOUND!
        const existingData = { id: foundDuplicate.id, ...foundDuplicate.data() };
        setDuplicateBook(existingData);
        setModalVisible(true);
        setLoading(false);
        return; 
      }

      // 4. NO DUPLICATE: Create New Entry with HISTORY
      const newEntryLog = {
        date: new Date().toISOString(),
        qty: quantityNumber,
        action: 'Initial Stock'
      };

      await addDoc(collection(db, "books"), {
        title: title.trim(),
        author: author.trim(),
        category: category || "General",
        totalQty: quantityNumber, 
        qty: quantityNumber,      
        available: true,
        addedAt: new Date().toISOString(),
        restockHistory: [newEntryLog]
      });

      setLoading(false);
      showAlert('success', 'Success', 'Book added to catalog!', () => router.back());
      
    } catch (error: any) {
      setLoading(false);
      showAlert('error', 'Error', error.message);
    }
  };

  // Logic to update existing stock from the Modal
  const confirmAddStock = async () => {
    if (!duplicateBook) return;

    const quantityNumber = parseInt(totalQty);
    if (quantityNumber <= 0) return;

    setLoading(true); 
    try {
       const newEntryLog = {
         date: new Date().toISOString(),
         qty: quantityNumber,
         action: 'Restock'
       };

       await updateDoc(doc(db, "books", duplicateBook.id), {
           totalQty: increment(quantityNumber),
           qty: increment(quantityNumber), 
           lastUpdated: new Date().toISOString(),
           restockHistory: arrayUnion(newEntryLog)
       });

       setModalVisible(false);
       setLoading(false);
       
       showAlert('success', 'Success', `Added ${quantityNumber} copies to existing stock!`, () => router.back());

    } catch (error) {
       console.error(error);
       setLoading(false);
       showAlert('error', 'Error', 'Could not update stock');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Catalog Entry</Text>
      </View>

      <ScrollView contentContainerStyle={styles.form}>
        <View style={styles.card}>
          <Text style={styles.label}>Book Title</Text>
          <TextInput 
            style={styles.input} 
            value={title} 
            onChangeText={setTitle} 
            placeholder="e.g. Wings of Fire" 
            placeholderTextColor="#888" 
          />
          
          <Text style={styles.label}>Author Name</Text>
          <TextInput 
            style={styles.input} 
            value={author} 
            onChangeText={setAuthor} 
            placeholder="e.g. A.P.J. Abdul Kalam" 
            placeholderTextColor="#888"
          />

          <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
            <View style={{width: '48%'}}>
                <Text style={styles.label}>Category</Text>
                <TextInput 
                  style={styles.input} 
                  value={category} 
                  onChangeText={setCategory} 
                  placeholder="e.g. Science" 
                  placeholderTextColor="#888"
                />
            </View>
            <View style={{width: '48%'}}>
                <Text style={styles.label}>Total Quantity</Text>
                <TextInput 
                  style={styles.input} 
                  value={totalQty} 
                  onChangeText={setTotalQty} 
                  placeholder="Total" 
                  placeholderTextColor="#888"
                  keyboardType="numeric" 
                />
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleAddBook} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Add to Library</Text>}
        </TouchableOpacity>
      </ScrollView>

      {/* --- DUPLICATE FOUND POPUP (Using GlassModal) --- */}
      <GlassModal 
        visible={modalVisible} 
        onClose={() => setModalVisible(false)}
        title="Duplicate Found"
      >
        <View style={{alignItems: 'center', marginBottom: 20}}>
            <Ionicons name="alert-circle" size={48} color="#FFD54F" />
            <Text style={styles.warningText}>
                This book is already in your library.
            </Text>
            <Text style={styles.subWarningText}>
                Would you like to add this new stock to the existing record instead?
            </Text>
        </View>

        {/* Existing Book Preview Card */}
        {duplicateBook && (
            <TouchableOpacity 
                style={styles.previewCard}
                onPress={() => {
                    setModalVisible(false);
                    router.push({ pathname: '/book-detail', params: { id: duplicateBook.id } });
                }}
            >
                <View style={styles.previewIcon}>
                    <Ionicons name="book" size={24} color="#FFF" />
                </View>
                <View style={{flex: 1}}>
                    <Text style={styles.previewTitle}>{duplicateBook.title}</Text>
                    <Text style={styles.previewAuthor}>{duplicateBook.author}</Text>
                    <View style={styles.stockBadge}>
                        <Text style={styles.stockLabel}>Current Stock: </Text>
                        <Text style={styles.stockValue}>{duplicateBook.totalQty || duplicateBook.qty}</Text>
                    </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
        )}

        {/* Action Buttons */}
        <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={confirmAddStock}>
                <Text style={styles.confirmText}>Yes, Add +{totalQty}</Text>
            </TouchableOpacity>
        </View>
      </GlassModal>

      {/* --- STANDARD ALERTS (Success/Error) --- */}
      <CustomAlert 
        visible={alertConfig.visible}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.msg}
        onClose={() => {
            setAlertConfig(prev => ({...prev, visible: false}));
            if (alertConfig.type === 'success') alertConfig.onConfirm();
        }}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, marginTop: 1 },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
  headerTitle: { fontSize: 20, color: '#FFF', fontWeight: 'bold', marginLeft: 15 },
  form: { padding: 20 },
  card: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  label: { color: '#FFD54F', fontSize: 12, marginBottom: 8, fontWeight: 'bold' },
  input: { backgroundColor: '#FFF', borderRadius: 10, padding: 12, marginBottom: 20, color: '#333' },
  submitBtn: { backgroundColor: '#2196F3', padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 10 },
  submitBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },

  // --- POPUP STYLES ---
  warningText: { color: '#FFF', textAlign: 'center', marginTop: 15, fontSize: 16, fontWeight: 'bold' },
  subWarningText: { color: '#AAA', textAlign: 'center', marginTop: 5, fontSize: 14, lineHeight: 20 },
  
  previewCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255,255,255,0.08)', 
    padding: 15, 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.1)', 
    marginBottom: 25 
  },
  previewIcon: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    backgroundColor: 'rgba(33, 150, 243, 0.2)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 15,
    borderWidth: 1,
    borderColor: 'rgba(33, 150, 243, 0.3)'
  },
  previewTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  previewAuthor: { color: '#CCC', fontSize: 13, fontStyle: 'italic', marginBottom: 6 },
  stockBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(76, 175, 80, 0.1)', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  stockLabel: { color: '#AAA', fontSize: 11 },
  stockValue: { color: '#4CAF50', fontSize: 11, fontWeight: 'bold' },

  modalActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  cancelBtn: { padding: 15, flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12 },
  cancelText: { color: '#AAA', fontWeight: 'bold' },
  confirmBtn: { backgroundColor: '#FFD54F', padding: 15, borderRadius: 12, flex: 1, alignItems: 'center' },
  confirmText: { color: '#2E0249', fontWeight: 'bold' }
});