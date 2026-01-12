// app/issue-book.tsx
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, TextInput, ScrollView, 
  ActivityIndicator, BackHandler, FlatList, Keyboard, ImageBackground 
} from 'react-native'; 
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { 
  collection, query, where, getDocs, doc, updateDoc, 
  addDoc, increment, getDoc, onSnapshot 
} from 'firebase/firestore'; 
import { db } from '../firebaseConfig';
import CustomAlert from '../components/CustomAlert';

export default function IssueBook() {
  const router = useRouter();
  const { prefillStudentId } = useLocalSearchParams(); 

  // Data State
  const [studentEmail, setStudentEmail] = useState('');
  const [bookQuery, setBookQuery] = useState(''); 
  
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedBook, setSelectedBook] = useState<any>(null);
  
  // Search State
  const [searchingStudent, setSearchingStudent] = useState(false);
  const [issuing, setIssuing] = useState(false);

  // Real-time Book Data
  const [allBooks, setAllBooks] = useState<any[]>([]);
  const [filteredBooks, setFilteredBooks] = useState<any[]>([]);
  const [showBookList, setShowBookList] = useState(false);

  const [alertConfig, setAlertConfig] = useState({ 
    visible: false, 
    type: 'confirm' as 'success' | 'error' | 'warning' | 'confirm', 
    title: '', 
    msg: '', 
    onConfirm: () => {} 
  });

  // --- 1. ANDROID BACK BUTTON ---
  useEffect(() => {
    const onBackPress = () => { router.back(); return true; };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, []);

  // --- 2. FETCH ALL BOOKS ---
  useEffect(() => {
    const q = query(collection(db, "books"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const books = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllBooks(books);
    });
    return () => unsubscribe();
  }, []);

  // --- 3. FILTER BOOKS ---
  useEffect(() => {
    if (bookQuery.trim() === '') {
      setFilteredBooks([]);
      return;
    }
    const lowerQuery = bookQuery.toLowerCase();
    const filtered = allBooks.filter((book: any) => 
       (book.title?.toLowerCase().includes(lowerQuery)) ||
       (book.author?.toLowerCase().includes(lowerQuery))
    );
    setFilteredBooks(filtered.slice(0, 5));
  }, [bookQuery, allBooks]);

  // --- 4. STUDENT SEARCH ---
  useEffect(() => {
    if (prefillStudentId) findStudentById(prefillStudentId as string);
  }, [prefillStudentId]);

  const findStudentById = async (uid: string) => {
    setSearchingStudent(true);
    try {
      const q = query(collection(db, "users"), where("uid", "==", uid));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setSelectedStudent({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      }
    } catch (err) { console.log(err); } finally { setSearchingStudent(false); }
  };

  const handleSearchStudent = async () => {
    if (!studentEmail) return;
    
    // FIX: Automatically dismiss keyboard when search starts
    Keyboard.dismiss();
    
    setSearchingStudent(true);
    setSelectedStudent(null);
    try {
      const q = query(collection(db, "users"), where("email", "==", studentEmail.trim()));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setSelectedStudent({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      } else {
        setAlertConfig({ visible: true, type: 'error', title: 'Not Found', msg: 'No student found with this email.', onConfirm: () => setAlertConfig(p=>({...p, visible:false})) });
      }
    } catch (error) {
      setAlertConfig({ visible: true, type: 'error', title: 'Error', msg: 'Search failed.', onConfirm: () => setAlertConfig(p=>({...p, visible:false})) });
    }
    setSearchingStudent(false);
  };

  // --- HELPER: GET ADMIN SETTINGS ---
  const getLoanDuration = async () => {
    try {
        const settingsSnap = await getDoc(doc(db, "settings", "libraryConfig"));
        if (settingsSnap.exists()) return settingsSnap.data().loanDuration || 14; 
    } catch (e) { console.log("Error fetching settings"); }
    return 14; 
  };

  // --- 5. REISSUE LOGIC ---
  const processReissue = async (existingLoan: any) => {
      setIssuing(true);
      setAlertConfig(prev => ({ ...prev, visible: false })); 

      try {
          const duration = await getLoanDuration();
          const currentDue = existingLoan.data().returnDate.toDate();
          const newDue = new Date(currentDue);
          newDue.setDate(newDue.getDate() + duration);

          await updateDoc(doc(db, "issueRequests", existingLoan.id), {
              status: 'Reissued',
              returnDate: newDue,
              reissueCount: increment(1)
          });

          setIssuing(false);
          setAlertConfig({ 
              visible: true, 
              type: 'success', 
              title: 'Reissue Successful', 
              msg: `Due date extended to: ${newDue.toLocaleDateString()}`,
              onConfirm: () => {
                  setAlertConfig(p=>({...p, visible:false}));
                  router.back();
              }
          });

      } catch (error: any) {
          setIssuing(false);
          setAlertConfig({ visible: true, type: 'error', title: 'Reissue Failed', msg: error.message, onConfirm: () => setAlertConfig(p=>({...p, visible:false})) });
      }
  };

  // --- 6. ISSUE LOGIC ---
  const confirmIssue = async () => {
    if (!selectedStudent || !selectedBook) return;
    setIssuing(true);

    try {
      const checkQuery = query(
        collection(db, "issueRequests"),
        where("studentId", "==", selectedStudent.uid),
        where("bookId", "==", selectedBook.id)
      );
      
      const checkSnapshot = await getDocs(checkQuery);
      const existingLoan = checkSnapshot.docs.find(doc => ['Issued', 'Reissued'].includes(doc.data().status));

      if (existingLoan) {
          setIssuing(false);
          setAlertConfig({ 
              visible: true, 
              type: 'confirm', 
              title: 'Already Issued', 
              msg: `Student already has "${selectedBook.title}".\n\nDo you want to EXTEND the due date (Reissue)?`,
              onConfirm: () => processReissue(existingLoan) 
          });
          return;
      }

      const loanDays = await getLoanDuration();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + loanDays);

      await addDoc(collection(db, "issueRequests"), {
        studentId: selectedStudent.uid, 
        studentName: selectedStudent.displayName,
        studentEmail: selectedStudent.email,
        bookId: selectedBook.id,
        bookTitle: selectedBook.title,
        bookAuthor: selectedBook.author || "Unknown Author", 
        status: "Issued",                 
        requestDate: new Date(), 
        issuedAt: new Date(),
        returnDate: dueDate,
        type: 'Issue',
        via: 'Manual'
      });

      await updateDoc(doc(db, "books", selectedBook.id), {
        qty: increment(-1)
      });

      setIssuing(false);
      setAlertConfig({ 
          visible: true, 
          type: 'success', 
          title: 'Book Issued', 
          msg: `Due Date: ${dueDate.toLocaleDateString()}`,
          onConfirm: () => {
              setAlertConfig(p=>({...p, visible:false}));
              router.back();
          }
      });

    } catch (error: any) {
      setIssuing(false);
      setAlertConfig({ visible: true, type: 'error', title: 'Failed', msg: error.message, onConfirm: () => setAlertConfig(p=>({...p, visible:false})) });
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
            <Text style={styles.headerTitle}>Issue / Reissue a Book</Text>
          </View>

          {/* FIX: added keyboardShouldPersistTaps="handled" to allow button taps while keyboard is open */}
          <ScrollView 
            contentContainerStyle={styles.content} 
            keyboardShouldPersistTaps="handled"
          >
            
            {/* STEP 1: SELECT STUDENT */}
            <View style={styles.section}>
                <Text style={styles.sectionLabel}>1. Select Student</Text>
                {selectedStudent ? (
                    <View style={styles.selectedCard}>
                        <View style={styles.iconCircle}><Ionicons name="person" size={20} color="#FFD54F" /></View>
                        <View>
                            <Text style={styles.selectedTitle} numberOfLines={1}>{selectedStudent.displayName}</Text>
                            <Text style={styles.selectedSub}>{selectedStudent.email}</Text>
                        </View>
                        <TouchableOpacity onPress={() => { setSelectedStudent(null); setStudentEmail(''); }} style={{marginLeft: 'auto'}}>
                            <Ionicons name="close-circle" size={24} color="#F44336" />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.searchRow}>
                        <TextInput 
                            style={styles.input} 
                            placeholder="Enter Student Email" 
                            placeholderTextColor="#888" 
                            value={studentEmail} 
                            onChangeText={setStudentEmail} 
                            autoCapitalize="none"
                            returnKeyType="search"
                            onSubmitEditing={handleSearchStudent}
                        />
                        <TouchableOpacity style={styles.searchBtn} onPress={handleSearchStudent} disabled={searchingStudent}>
                            {searchingStudent ? <ActivityIndicator color="#2E0249" /> : <Ionicons name="search" size={20} color="#2E0249" />}
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* STEP 2: SELECT BOOK */}
            <View style={[styles.section, {zIndex: 10}]}> 
                <Text style={styles.sectionLabel}>2. Select Book</Text>
                
                {selectedBook ? (
                    <View style={styles.selectedCard}>
                        <View style={styles.iconCircle}><Ionicons name="book" size={20} color="#2196F3" /></View>
                        <View>
                            <Text style={styles.selectedTitle} numberOfLines={1}>{selectedBook.title}</Text>
                            <Text style={styles.selectedSub}>{selectedBook.author}</Text>
                            <Text style={[styles.selectedSub, {color: '#4CAF50'}]}>Stock: {selectedBook.qty}</Text>
                        </View>
                        <TouchableOpacity onPress={() => { setSelectedBook(null); setBookQuery(''); }} style={{marginLeft: 'auto'}}>
                            <Ionicons name="close-circle" size={24} color="#F44336" />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View>
                        <View style={styles.searchRow}>
                            <TextInput 
                                style={styles.input} 
                                placeholder="Type title or author..." 
                                placeholderTextColor="#888" 
                                value={bookQuery} 
                                onChangeText={(text) => {
                                    setBookQuery(text);
                                    setShowBookList(true);
                                }}
                                onFocus={() => setShowBookList(true)}
                            />
                            <View style={[styles.searchBtn, {backgroundColor: 'rgba(255,255,255,0.1)'}]}>
                                 <Ionicons name="search" size={20} color="#AAA" />
                            </View>
                        </View>

                        {showBookList && bookQuery.length > 0 && (
                            <View style={styles.dropdown}>
                                {filteredBooks.length > 0 ? (
                                    filteredBooks.map((item) => (
                                        <TouchableOpacity 
                                            key={item.id}
                                            style={styles.dropdownItem}
                                            onPress={() => {
                                                if (item.qty > 0) {
                                                    setSelectedBook(item);
                                                    setShowBookList(false);
                                                    Keyboard.dismiss();
                                                } else {
                                                    setAlertConfig({ visible: true, type: 'error', title: 'Out of Stock', msg: 'No copies available.', onConfirm: () => setAlertConfig(p=>({...p, visible:false})) });
                                                }
                                            }}
                                        >
                                            <View style={{flex: 1, marginRight: 10}}>
                                                <Text style={styles.dropMain} numberOfLines={1}>{item.title}</Text>
                                                <Text style={styles.dropSub} numberOfLines={1}>{item.author}</Text>
                                            </View>
                                            {item.qty > 0 ? (
                                                <View style={styles.stockBadge}>
                                                    <Text style={styles.stockText}>{item.qty} left</Text>
                                                </View>
                                            ) : (
                                                <Text style={{color: '#F44336', fontSize: 10, fontWeight:'bold'}}>OUT</Text>
                                            )}
                                        </TouchableOpacity>
                                    ))
                                ) : (
                                    <View style={{padding: 15, alignItems:'center'}}>
                                        <Text style={{color:'#666'}}>No matching books found</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                )}
            </View>

            {/* STEP 3: CONFIRM */}
            <TouchableOpacity 
                style={[styles.issueBtn, (!selectedStudent || !selectedBook) && styles.disabledBtn]} 
                onPress={confirmIssue} 
                disabled={!selectedStudent || !selectedBook || issuing}
            >
                {issuing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.issueBtnText}>Confirm</Text>}
            </TouchableOpacity>

          </ScrollView>

          <CustomAlert 
            visible={alertConfig.visible} type={alertConfig.type} title={alertConfig.title} message={alertConfig.msg} 
            onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))} 
            onConfirm={alertConfig.onConfirm}
            confirmText={alertConfig.type === 'confirm' ? "Yes, Extend" : "OK"}
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
  headerTitle: { fontSize: 20, color: '#FFF', fontWeight: 'bold', marginLeft: 15 },
  content: { padding: 20 },
  section: { marginBottom: 30 },
  sectionLabel: { color: '#FFD54F', fontSize: 14, fontWeight: 'bold', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  searchRow: { flexDirection: 'row', gap: 10 },
  input: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', color: '#FFF', borderRadius: 12, padding: 15, fontSize: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  searchBtn: { backgroundColor: '#FFD54F', borderRadius: 12, width: 50, justifyContent: 'center', alignItems: 'center' },
  dropdown: { backgroundColor: '#1E1E1E', borderRadius: 12, marginTop: 5, borderWidth: 1, borderColor: '#333' },
  dropdownItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#2A2A2A', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropMain: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  dropSub: { color: '#AAA', fontSize: 12 },
  stockBadge: { backgroundColor: 'rgba(76, 175, 80, 0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  stockText: { color: '#4CAF50', fontSize: 10, fontWeight: 'bold' },
  selectedCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  selectedTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', flex: 1 },
  selectedSub: { color: '#AAA', fontSize: 12 },
  issueBtn: { backgroundColor: '#4CAF50', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 10 },
  disabledBtn: { backgroundColor: 'rgba(255,255,255,0.1)', opacity: 0.5 },
  issueBtnText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' }
});