// app/available.tsx
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, ImageBackground, TouchableOpacity, 
  FlatList, Dimensions, ActivityIndicator, TextInput, BackHandler // 1. Added BackHandler Import
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, getDocs, addDoc, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore'; 
import { db, auth } from '../firebaseConfig'; 
import CustomAlert from '../components/CustomAlert'; 

const { width } = Dimensions.get('window');

export default function AvailableScreen() {
  const router = useRouter(); 
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [myRequests, setMyRequests] = useState<{[key: string]: string}>({});

  const [alertConfig, setAlertConfig] = useState({ 
    visible: false, 
    type: 'confirm' as 'success' | 'error' | 'warning' | 'confirm', 
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

  // 1. Fetch All Books
  useEffect(() => {
    const fetchBooks = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "books"));
        const booksList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setBooks(booksList);
      } catch (error) {
        console.error("Error fetching books: ", error);
      } finally {
        setLoading(false);
      }
    };
    fetchBooks();
  }, []);

  // 2. Listen for MY active requests
  useEffect(() => {
    if (!auth.currentUser) return;
    
    const q = query(
        collection(db, "issueRequests"), 
        where("studentId", "==", auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const statusMap: {[key: string]: string} = {};
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.status !== 'Returned') {
                statusMap[data.bookId] = data.status; 
            }
        });
        setMyRequests(statusMap);
    });

    return () => unsubscribe();
  }, []);

  const handleRequestBook = (book: any) => {
    if (book.qty <= 0) {
      setAlertConfig({
          visible: true, type: 'error', title: 'Out of Stock', 
          msg: 'This book is currently unavailable.', onConfirm: () => setAlertConfig(p => ({...p, visible: false}))
      });
      return;
    }

    if (myRequests[book.id]) {
       const status = myRequests[book.id];
       setAlertConfig({
          visible: true, type: 'warning', title: 'Request Exists', 
          msg: `You already have a ${status.toLowerCase()} request for this book.`, 
          onConfirm: () => setAlertConfig(p => ({...p, visible: false}))
      });
      return;
    }

    setAlertConfig({
      visible: true,
      type: 'confirm',
      title: 'Confirm Request',
      msg: `Do you want to request "${book.title}"?`,
      onConfirm: async () => {
        setAlertConfig(prev => ({ ...prev, visible: false })); 
        try {
          await addDoc(collection(db, "issueRequests"), {
            bookId: book.id,
            bookTitle: book.title,
            studentId: auth.currentUser?.uid,
            studentEmail: auth.currentUser?.email,
            studentName: auth.currentUser?.email?.split('@')[0],
            requestDate: serverTimestamp(),
            status: 'Pending',
            type: 'Issue' 
          });
          
          setTimeout(() => {
              setAlertConfig({
                  visible: true, type: 'success', title: 'Request Sent', 
                  msg: 'Admin will review your request shortly.', 
                  onConfirm: () => setAlertConfig(p => ({...p, visible: false}))
              });
          }, 500);
          
        } catch (e) {
          setAlertConfig({
              visible: true, type: 'error', title: 'Error', 
              msg: 'Could not send request. Try again.', 
              onConfirm: () => setAlertConfig(p => ({...p, visible: false}))
          });
        }
      }
    });
  };

  const categories = ['All', ...new Set(books.map(b => b.category))];

  const filteredBooks = books.filter(book => {
    const matchesCategory = selectedCategory === 'All' || book.category === selectedCategory;
    const matchesSearch = 
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      book.author.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const renderBook = ({ item }: any) => {
    const myStatus = myRequests[item.id];
    const isPending = myStatus === 'Pending';
    const isIssued = myStatus === 'Issued';
    
    let btnText = 'Request';
    let btnColor = '#FFD54F';
    let textColor = '#2E0249';
    
    if (item.qty <= 0) {
        btnText = 'Unavailable';
        btnColor = 'rgba(255,255,255,0.1)';
        textColor = '#AAA';
    } else if (isPending) {
        btnText = 'Pending...';
        btnColor = 'rgba(255, 213, 79, 0.3)';
        textColor = '#FFD54F';
    } else if (isIssued) {
        btnText = 'Owned';
        btnColor = 'rgba(76, 175, 80, 0.3)';
        textColor = '#4CAF50';
    }

    const isDisabled = item.qty <= 0 || !!myStatus;

    return (
      <TouchableOpacity 
        style={styles.bookCard}
        activeOpacity={0.8}
        // --- FIX IS HERE: Changed 'id' to 'bookId' ---
        onPress={() => router.push({ pathname: '/book-detail-unified', params: { bookId: item.id } })}
      >
        <View style={styles.bookCover}>
          <Ionicons name="book" size={48} color="#FFD54F" />
          <View style={styles.glare} />
        </View>

        <View style={styles.bookInfo}>
          <Text style={styles.bookTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.bookAuthor} numberOfLines={1}>{item.author}</Text>
          
          <View style={[styles.statusPill, { backgroundColor: item.qty > 0 ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)' }]}>
              <View style={[styles.statusDot, { backgroundColor: item.qty > 0 ? '#4CAF50' : '#F44336' }]} />
              <Text style={[styles.statusText, { color: item.qty > 0 ? '#4CAF50' : '#F44336' }]}>
                {item.qty > 0 ? `${item.qty} Available` : 'Out of Stock'}
              </Text>
          </View>

          <TouchableOpacity 
            style={[styles.requestBtn, { backgroundColor: btnColor }]} 
            onPress={() => handleRequestBook(item)}
            disabled={isDisabled}
          >
            <Text style={[styles.requestBtnText, { color: textColor }]}>
              {btnText}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ImageBackground source={require('../assets/images/library_bg.jpg')} style={styles.bg}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          
          <View style={styles.headerContainer}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Available Now</Text>
            <View style={{ width: 40 }} /> 
          </View>

          <View style={styles.searchSection}>
            <Ionicons name="search-outline" size={20} color="#FFD54F" />
            <TextInput 
              style={styles.searchInput}
              placeholder="Search title or author..."
              placeholderTextColor="#888"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#AAA" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.catContainer}>
            <FlatList
              data={categories}
              horizontal
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  onPress={() => setSelectedCategory(item)}
                  style={[styles.catPill, selectedCategory === item && styles.catPillActive]}
                >
                  <Text style={[styles.catText, selectedCategory === item && styles.catTextActive]}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#FFD54F" style={{ marginTop: 50 }} />
          ) : (
            <FlatList
              data={filteredBooks}
              keyExtractor={item => item.id}
              renderItem={renderBook}
              numColumns={2}
              columnWrapperStyle={styles.row}
              contentContainerStyle={styles.grid}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No books found matching your search.</Text>
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
  headerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 15, paddingBottom: 10 },
  backButton: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFF', textAlign: 'center' },
  searchSection: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 20, paddingHorizontal: 15, borderRadius: 15, height: 50, marginBottom: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  searchInput: { flex: 1, color: '#FFF', marginLeft: 10, fontSize: 15 },
  catContainer: { height: 50, paddingHorizontal: 20, marginBottom: 10 },
  catPill: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', marginRight: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  catPillActive: { backgroundColor: '#FFD54F', borderColor: '#FFD54F' },
  catText: { color: '#AAA', fontWeight: '600' },
  catTextActive: { color: '#2E0249' },
  grid: { paddingHorizontal: 20, paddingBottom: 40 },
  row: { justifyContent: 'space-between' },
  emptyContainer: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#AAA', fontSize: 16 },
  
  bookCard: { 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    borderRadius: 16, width: (width - 55) / 2, marginBottom: 20, 
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' 
  },
  bookCover: { 
    height: 100, 
    backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', position: 'relative'
  },
  glare: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  bookInfo: { padding: 12, flex: 1, justifyContent: 'space-between' },
  bookTitle: { color: '#FFF', fontSize: 15, fontWeight: 'bold', marginBottom: 4, lineHeight: 20 },
  bookAuthor: { color: '#AAA', fontSize: 12, marginBottom: 8 },
  statusPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginBottom: 12 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  requestBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12 },
  requestBtnText: { fontSize: 13, fontWeight: 'bold' },
});