// app/return-book.tsx
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, 
  ActivityIndicator, Keyboard, BackHandler, FlatList, ImageBackground 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { db } from '../firebaseConfig';
import { collection, query, where, getDocs, updateDoc, doc, increment } from 'firebase/firestore';

// --- PREMIUM COMPONENT ---
import CustomAlert from '../components/CustomAlert';

export default function ReturnBook() {
  const router = useRouter();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Search State
  const [studentMatches, setStudentMatches] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null); 
  const [issuedBooks, setIssuedBooks] = useState<any[]>([]); 
  
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Alert State
  const [alertConfig, setAlertConfig] = useState({ 
    visible: false, 
    type: 'confirm' as 'success' | 'error' | 'warning' | 'confirm' | 'destructive', 
    title: '', 
    msg: '', 
    onConfirm: () => {} 
  });

  // --- BACK HANDLER ---
  useEffect(() => {
    const onBackPress = () => {
      if (selectedStudent) {
        setSelectedStudent(null);
        setIssuedBooks([]);
        return true;
      }
      router.back(); 
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [selectedStudent]);

  // --- HELPERS ---
  const isOverdue = (dateInput: any) => {
    if (!dateInput) return false;
    let due;
    if (dateInput.toDate) due = dateInput.toDate();
    else due = new Date(dateInput);
    return new Date() > due;
  };

  const formatDate = (dateInput: any) => {
    if (!dateInput) return "N/A";
    if (dateInput.toDate) return dateInput.toDate().toLocaleDateString();
    const d = new Date(dateInput);
    if (!isNaN(d.getTime())) return d.toLocaleDateString();
    return "Invalid Date";
  };

  // --- 1. SEARCH LOGIC ---
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setAlertConfig({ visible: true, type: 'warning', title: 'Input Required', msg: 'Please enter a student name or email.', onConfirm: () => setAlertConfig(p=>({...p, visible:false})) });
      return;
    }

    setLoading(true);
    setStudentMatches([]);
    setSelectedStudent(null);
    setIssuedBooks([]);
    Keyboard.dismiss();

    const term = searchQuery.trim().toLowerCase();

    try {
        const usersSnap = await getDocs(collection(db, "users"));
        
        const matches = usersSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter((user: any) => {
                const email = (user.email || "").toLowerCase();
                const name = (user.displayName || "").toLowerCase();
                return email.includes(term) || name.includes(term);
            });

        if (matches.length === 0) {
            setAlertConfig({ visible: true, type: 'error', title: 'Not Found', msg: 'No student matches that query.', onConfirm: () => setAlertConfig(p=>({...p, visible:false})) });
        } else if (matches.length === 1) {
            handleSelectStudent(matches[0]);
        } else {
            setStudentMatches(matches);
        }

    } catch (error) {
        setAlertConfig({ visible: true, type: 'error', title: 'Error', msg: 'Search failed.', onConfirm: () => setAlertConfig(p=>({...p, visible:false})) });
    } finally {
        setLoading(false);
    }
  };

  // --- 2. SELECT STUDENT ---
  const handleSelectStudent = async (student: any) => {
      setLoading(true);
      setSelectedStudent(student);
      setStudentMatches([]); 

      try {
        const booksQ = query(
            collection(db, "issueRequests"), 
            where("studentId", "==", student.id),
            where("status", "==", "Issued")
        );
        const booksSnap = await getDocs(booksQ);
        const books = booksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setIssuedBooks(books);
      } catch (error) {
          setAlertConfig({ visible: true, type: 'error', title: 'Error', msg: 'Could not fetch active loans.', onConfirm: () => setAlertConfig(p=>({...p, visible:false})) });
      } finally {
          setLoading(false);
      }
  };

  // --- 3. RETURN LOGIC ---
  const confirmReturn = (bookItem: any) => {
      const overdue = isOverdue(bookItem.returnDate);
      
      setAlertConfig({
          visible: true,
          type: overdue ? 'destructive' : 'confirm',
          title: overdue ? 'Overdue Return' : 'Confirm Return',
          msg: overdue 
             ? `⚠️ This book is OVERDUE.\nDue Date: ${formatDate(bookItem.returnDate)}\n\nProcess return anyway?`
             : `Mark "${bookItem.bookTitle}" as returned?`,
          onConfirm: () => handleReturnBook(bookItem)
      });
  };

  const handleReturnBook = async (bookItem: any) => {
      setAlertConfig(prev => ({ ...prev, visible: false }));
      setProcessingId(bookItem.id);
      
      try {
          await updateDoc(doc(db, "issueRequests", bookItem.id), {
              status: "Returned",
              returnedAt: new Date().toISOString()
          });

          await updateDoc(doc(db, "books", bookItem.bookId), {
              qty: increment(1)
          });

          setIssuedBooks(prev => prev.filter(b => b.id !== bookItem.id));
          
          setAlertConfig({ 
              visible: true, 
              type: 'success', 
              title: 'Returned', 
              msg: 'Book successfully returned to inventory.',
              onConfirm: () => setAlertConfig(p=>({...p, visible:false}))
          });

      } catch (error) {
          setAlertConfig({ visible: true, type: 'error', title: 'Error', msg: 'Return failed.', onConfirm: () => setAlertConfig(p=>({...p, visible:false})) });
      } finally {
          setProcessingId(null);
      }
  };

  // --- RENDERERS ---
  const renderStudentMatch = ({ item }: any) => (
      <TouchableOpacity style={styles.matchCard} onPress={() => handleSelectStudent(item)}>
          <View style={styles.matchAvatar}>
             <Ionicons name="person" size={20} color="#FFD54F" />
          </View>
          <View>
              <Text style={styles.matchName}>{item.displayName}</Text>
              <Text style={styles.matchEmail}>{item.email}</Text>
              <Text style={styles.matchDept}>{item.department || "No Dept"}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#AAA" style={{marginLeft: 'auto'}}/>
      </TouchableOpacity>
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
            <Text style={styles.headerTitle}>Return a Book</Text>
          </View>

          <View style={styles.content}>
              {/* Search Bar */}
              {!selectedStudent && (
                <View style={styles.searchBox}>
                    <Ionicons name="search" size={20} color="#AAA" style={{marginRight: 10}}/>
                    <TextInput 
                        style={styles.input} 
                        placeholder="Search Name or Email..." 
                        placeholderTextColor="#666"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={handleSearch}
                    />
                    <TouchableOpacity onPress={handleSearch} style={styles.goBtn}>
                        <Ionicons name="arrow-forward" size={20} color="#2E0249" />
                    </TouchableOpacity>
                </View>
              )}

              {/* Loading */}
              {loading && <ActivityIndicator color="#FFD54F" style={{marginTop: 30}} />}

              {/* MATCHES LIST */}
              {!loading && !selectedStudent && studentMatches.length > 0 && (
                 <View style={{flex: 1}}>
                     <Text style={styles.sectionLabel}>Select Student ({studentMatches.length} found)</Text>
                     <FlatList 
                        data={studentMatches}
                        keyExtractor={item => item.id}
                        renderItem={renderStudentMatch}
                        contentContainerStyle={{paddingBottom: 20}}
                     />
                 </View>
              )}

              {/* SELECTED STUDENT VIEW */}
              {!loading && selectedStudent && (
                 <View style={{flex: 1}}>
                    <View style={styles.selectedHeader}>
                        <TouchableOpacity onPress={() => { setSelectedStudent(null); setIssuedBooks([]); setStudentMatches([]); setSearchQuery(''); }}>
                            <Text style={styles.changeBtn}>Change Student</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.studentCard}>
                        <View style={styles.avatar}>
                            <Ionicons name="person" size={24} color="#FFD54F" />
                        </View>
                        <View>
                            <Text style={styles.studentName}>{selectedStudent.displayName}</Text>
                            <Text style={styles.studentEmail}>{selectedStudent.email}</Text>
                            <Text style={styles.studentDept}>{selectedStudent.department || "N/A"}</Text>
                        </View>
                    </View>

                    <ScrollView contentContainerStyle={{paddingBottom: 20}}>
                        {issuedBooks.length === 0 ? (
                            <View style={styles.emptyBox}>
                                <Ionicons name="checkmark-done-circle" size={50} color="rgba(255,255,255,0.2)" />
                                <Text style={styles.emptyText}>No active loans for this student.</Text>
                            </View>
                        ) : (
                            issuedBooks.map((item) => {
                                const overdue = isOverdue(item.returnDate);
                                return (
                                    <View key={item.id} style={[styles.bookCard, overdue && {borderColor: 'rgba(244, 67, 54, 0.4)', borderWidth: 1}]}>
                                        <View style={styles.cardLeft}>
                                            <View style={styles.iconBox}>
                                                <Ionicons name="book" size={20} color="#FFF" />
                                            </View>
                                            <View style={{flex: 1}}>
                                                <Text style={styles.bookTitle}>{item.bookTitle}</Text>
                                                <Text style={styles.dateText}>Issued: {formatDate(item.createdAt || item.issuedAt)}</Text>
                                                <Text style={[styles.dueDate, {color: overdue ? '#F44336' : '#FFD54F'}]}>
                                                    Due: {formatDate(item.returnDate)}
                                                    {overdue && " (Overdue)"}
                                                </Text>
                                            </View>
                                        </View>

                                        <TouchableOpacity 
                                            style={[styles.returnButton, overdue && {backgroundColor: '#F44336'}]} 
                                            onPress={() => confirmReturn(item)}
                                            disabled={processingId === item.id}
                                        >
                                            {processingId === item.id ? (
                                                <ActivityIndicator color="#FFF" size="small" />
                                            ) : (
                                                <Text style={styles.returnBtnText}>Return</Text>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                );
                            })
                        )}
                    </ScrollView>
                 </View>
              )}

          </View>

          {/* CUSTOM ALERT COMPONENT */}
          <CustomAlert 
            visible={alertConfig.visible}
            type={alertConfig.type}
            title={alertConfig.title}
            message={alertConfig.msg}
            onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
            onConfirm={alertConfig.onConfirm}
            confirmText={alertConfig.type === 'destructive' ? 'Return Anyway' : 'Yes, Return'}
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
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, marginTop: 1 },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
  headerTitle: { fontSize: 20, color: '#FFF', fontWeight: 'bold', marginLeft: 15 },
  content: { flex: 1, paddingHorizontal: 20 },
  
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 15, height: 50, marginBottom: 20 },
  input: { flex: 1, color: '#333', fontSize: 16 },
  goBtn: { backgroundColor: '#FFD54F', padding: 8, borderRadius: 8 },

  sectionLabel: { color: '#AAA', marginBottom: 10, fontSize: 12, textTransform: 'uppercase' },

  matchCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', padding: 15, borderRadius: 12, marginBottom: 10 },
  matchAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255, 213, 79, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  matchName: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  matchEmail: { color: '#AAA', fontSize: 12 },
  matchDept: { color: '#FFD54F', fontSize: 10, fontWeight: 'bold' },

  selectedHeader: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 10 },
  changeBtn: { color: '#2196F3', fontSize: 12, fontWeight: 'bold' },
  studentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 20, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#FFD54F' },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255, 213, 79, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1, borderColor: '#FFD54F' },
  studentName: { color: '#FFF', fontWeight: 'bold', fontSize: 18 },
  studentEmail: { color: '#AAA', fontSize: 12 },
  studentDept: { color: '#FFD54F', fontSize: 12, fontWeight: 'bold', marginTop: 2 },

  emptyBox: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 15, fontStyle: 'italic' },

  bookCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 15, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(33, 150, 243, 0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  bookTitle: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  dateText: { color: '#AAA', fontSize: 11, marginTop: 2 },
  dueDate: { fontSize: 11, marginTop: 4, fontWeight: 'bold' },

  returnButton: { backgroundColor: '#4CAF50', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 10, marginLeft: 10 },
  returnBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 }
});