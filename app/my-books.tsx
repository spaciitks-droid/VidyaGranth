// app/my-books.tsx
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, ImageBackground, TouchableOpacity, 
  FlatList, ActivityIndicator, BackHandler // 1. Added BackHandler Import
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore'; 
import { db, auth } from '../firebaseConfig'; 
import { useRouter } from 'expo-router';

// --- SUB-COMPONENT: Handles Fetching Missing Details ---
const BookItem = ({ item, router }: { item: any, router: any }) => {
    const [authorName, setAuthorName] = useState(item.bookAuthor || "Loading...");
    const [finalDueDate, setFinalDueDate] = useState<Date | null>(null);

    useEffect(() => {
        // 1. Resolve Author Name
        const resolveAuthor = async () => {
            if (!item.bookAuthor && item.bookId) {
                try {
                    const bookSnap = await getDoc(doc(db, "books", item.bookId));
                    if (bookSnap.exists()) {
                        setAuthorName(bookSnap.data().author || "Unknown Author");
                    } else {
                        setAuthorName("Unknown Author");
                    }
                } catch (e) {
                    setAuthorName("Unknown Author");
                }
            } else if (item.bookAuthor) {
                setAuthorName(item.bookAuthor);
            } else {
                setAuthorName("Unknown Author");
            }
        };

        // 2. Resolve Date
        if (item.returnDate) {
            if (item.returnDate.toDate) {
                setFinalDueDate(item.returnDate.toDate());
            } else {
                setFinalDueDate(new Date(item.returnDate));
            }
        }

        resolveAuthor();
    }, [item]);

    // Calculate Days Left
    const getDaysRemaining = (dueDate: Date | null) => {
        if (!dueDate) return 0;
        const now = new Date();
        const diffTime = dueDate.getTime() - now.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    };

    const daysLeft = getDaysRemaining(finalDueDate);
    
    // Logic: Red text if 7 days or less
    const isCritical = daysLeft <= 7; 
    const isOverdue = daysLeft < 0;

    return (
        <TouchableOpacity 
            style={[styles.bookCard, isOverdue && styles.overdueBorder]}
            activeOpacity={0.8}
            onPress={() => router.push({
                pathname: '/book-detail-unified',
                params: { requestId: item.id } 
            })}
        >
            <View style={styles.cardLeft}>
               <View style={styles.bookIcon}>
                  <Ionicons name="book" size={28} color="#FFD54F" />
               </View>
            </View>
    
            <View style={styles.cardCenter}>
               {/* Title restricted to 1 line */}
               <Text style={styles.bookTitle} numberOfLines={1}>{item.bookTitle}</Text>
               
               {/* Author restricted to 1 line */}
               <Text style={styles.authorText} numberOfLines={1}>
                   Author: {authorName}
               </Text>
               
               <View style={styles.dateRow}>
                  <Ionicons name="calendar-outline" size={12} color="#AAA" />
                  <Text style={styles.dateText}>
                     Due: {finalDueDate ? finalDueDate.toLocaleDateString() : 'N/A'}
                  </Text>
               </View>
            </View>
    
            <View style={styles.cardRight}>
                <View style={[
                    styles.daysBadge, 
                    isCritical ? { backgroundColor: 'rgba(244, 67, 54, 0.15)' } :
                    { backgroundColor: 'rgba(76, 175, 80, 0.15)' } 
                ]}>
                    <Text style={[
                        styles.daysText,
                        isCritical ? { color: '#F44336' } : { color: '#4CAF50' }
                    ]}>
                        {isOverdue ? "OVERDUE" : `${daysLeft} Days Left`}
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.3)" style={{marginTop: 10}} />
            </View>
        </TouchableOpacity>
    );
};

// --- MAIN SCREEN ---
export default function MyBooksScreen() {
  const router = useRouter();
  const [issuedBooks, setIssuedBooks] = useState<any[]>([]);
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
    const studentId = auth.currentUser?.uid;
    if (!studentId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "issueRequests"), 
      where("studentId", "==", studentId),
      where("status", "==", "Issued")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const booksList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setIssuedBooks(booksList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <ImageBackground source={require('../assets/images/library_bg.jpg')} style={styles.bg}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Issue Books</Text>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#FFD54F" style={{ marginTop: 50 }} />
          ) : (
            <FlatList
              data={issuedBooks}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => <BookItem item={item} router={router} />}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons name="library" size={50} color="rgba(255,255,255,0.5)" />
                  </View>
                  <Text style={styles.emptyTitle}>No Books Issued</Text>
                  <Text style={styles.emptyText}>You don't have any active book loans currently.</Text>
                  <TouchableOpacity 
                    style={styles.browseBtn}
                    onPress={() => router.replace('/available')}
                  >
                    <Text style={styles.browseBtnText}>Browse Library Catalog</Text>
                  </TouchableOpacity>
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)' },
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20 },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginLeft: 15 },
  listContent: { padding: 20 },

  bookCard: { 
    flexDirection: 'row', 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    borderRadius: 16, 
    padding: 15, 
    marginBottom: 15, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)'
  },
  overdueBorder: { borderColor: 'rgba(244, 67, 54, 0.5)' },
  
  cardLeft: { marginRight: 15 },
  
  bookIcon: { 
    width: 50, 
    height: 65, 
    backgroundColor: 'rgba(255, 213, 79, 0.15)', 
    borderRadius: 8, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: 'rgba(255,213,79,0.3)' 
  },
  
  cardCenter: { flex: 1 },
  bookTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  authorText: { color: '#AAA', fontSize: 12, marginBottom: 8, fontStyle: 'italic' }, 
  dateRow: { flexDirection: 'row', alignItems: 'center' },
  dateText: { color: '#CCC', fontSize: 12, marginLeft: 5 },

  cardRight: { alignItems: 'flex-end' },
  daysBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  daysText: { fontSize: 10, fontWeight: 'bold' },

  emptyContainer: { alignItems: 'center', marginTop: 80, padding: 20 },
  emptyIconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  emptyText: { color: '#888', textAlign: 'center', fontSize: 14, marginBottom: 30 },
  browseBtn: { backgroundColor: '#FFD54F', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 15 },
  browseBtnText: { color: '#2E0249', fontWeight: 'bold', fontSize: 16 }
});