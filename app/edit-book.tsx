// app/edit-book.tsx
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  ScrollView, ActivityIndicator, BackHandler, ImageBackground, Keyboard 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// --- PREMIUM COMPONENT ---
import CustomAlert from '../components/CustomAlert';

export default function EditBook() {
  const router = useRouter();
  const { id } = useLocalSearchParams(); 

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Alert State
  const [alertConfig, setAlertConfig] = useState({ 
    visible: false, 
    type: 'confirm' as 'success' | 'error' | 'warning' | 'confirm', 
    title: '', 
    msg: '', 
    onConfirm: () => {} 
  });

  // --- 1. Fetch Existing Data ---
  useEffect(() => {
    const fetchBook = async () => {
      try {
        const docRef = doc(db, "books", id as string);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setTitle(data.title);
          setAuthor(data.author);
          setCategory(data.category);
        } else {
          setAlertConfig({
             visible: true, type: 'error', title: 'Error', msg: 'Book not found.', 
             onConfirm: () => router.back()
          });
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchBook();
  }, [id]);

  // --- 2. Back Handler ---
  useEffect(() => {
    const onBackPress = () => { router.back(); return true; };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, []);

  // --- 3. Update Logic (With Auto-Redirect) ---
  const handleUpdate = async () => {
    Keyboard.dismiss();
    
    if (!title || !author) {
      setAlertConfig({ visible: true, type: 'warning', title: 'Missing Info', msg: 'Title and Author are required fields.', onConfirm: () => setAlertConfig(p=>({...p, visible:false})) });
      return;
    }

    setSaving(true);
    try {
      const docRef = doc(db, "books", id as string);

      // We ONLY update metadata. Stock is untouched.
      await updateDoc(docRef, {
        title,
        author,
        category,
        lastUpdated: new Date().toISOString()
      });

      // Show Success Popup
      setAlertConfig({
          visible: true,
          type: 'success',
          title: 'Success',
          msg: 'Book details have been updated.\nRedirecting...',
          onConfirm: () => {} // No manual action required
      });

      // AUTOMATIC REDIRECT: Wait 1.5 seconds, then go back
      setTimeout(() => {
          setAlertConfig(prev => ({...prev, visible: false})); // Close popup
          router.back(); // Go back to previous page
      }, 1000);

    } catch (error: any) {
      setAlertConfig({ visible: true, type: 'error', title: 'Update Failed', msg: error.message, onConfirm: () => setAlertConfig(p=>({...p, visible:false})) });
    } finally {
      setSaving(false);
    }
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Book Details</Text>
      </View>

      <ScrollView contentContainerStyle={styles.form}>
        <View style={styles.card}>
          <Text style={styles.label}>Book Title</Text>
          <TextInput 
            style={styles.input} 
            value={title} 
            onChangeText={setTitle} 
            placeholderTextColor="#888" 
          />
          
          <Text style={styles.label}>Author</Text>
          <TextInput 
            style={styles.input} 
            value={author} 
            onChangeText={setAuthor} 
            placeholderTextColor="#888" 
          />

          <Text style={styles.label}>Category</Text>
          <TextInput 
            style={styles.input} 
            value={category} 
            onChangeText={setCategory} 
            placeholderTextColor="#888" 
          />
          
          <View style={styles.hintBox}>
            <Ionicons name="information-circle" size={16} color="#AAA" style={{marginTop: 2, marginRight: 6}} />
            <Text style={styles.hint}>
              Note: To change stock quantity, please use the "Add Book" page to ensure inventory logs are maintained properly.
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleUpdate} disabled={saving}>
          {saving ? <ActivityIndicator color="#2E0249" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
        </TouchableOpacity>
      </ScrollView>

      {/* CUSTOM ALERT */}
      <CustomAlert 
        visible={alertConfig.visible}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.msg}
        onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
        onConfirm={alertConfig.onConfirm}
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
  
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, marginTop: 35 },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
  headerTitle: { fontSize: 20, color: '#FFF', fontWeight: 'bold', marginLeft: 15 },
  
  form: { padding: 20 },
  card: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 25, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  
  label: { color: '#FFD54F', fontSize: 12, marginBottom: 8, fontWeight: 'bold', letterSpacing: 1 },
  input: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 15, marginBottom: 20, color: '#FFF', fontSize: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  
  hintBox: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', padding: 15, borderRadius: 12, marginTop: 5 },
  hint: { color: '#AAA', fontSize: 12, fontStyle: 'italic', flex: 1, lineHeight: 18 },
  
  saveBtn: { backgroundColor: '#FFD54F', padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 30 },
  saveBtnText: { color: '#2E0249', fontWeight: 'bold', fontSize: 16 }
});