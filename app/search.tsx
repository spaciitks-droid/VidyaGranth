// app/search.tsx
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, ImageBackground, TextInput, 
  FlatList, Dimensions, TouchableOpacity 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs } from 'firebase/firestore'; 
import { db } from '../firebaseConfig'; 
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

export default function SearchScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [allBooks, setAllBooks] = useState<any[]>([]);
  const [filteredBooks, setFilteredBooks] = useState<any[]>([]);

  // 1. Fetch all books once when the page opens
  useEffect(() => {
    const fetchAllBooks = async () => {
      const querySnapshot = await getDocs(collection(db, "books"));
      const booksList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAllBooks(booksList);
      setFilteredBooks(booksList);
    };
    fetchAllBooks();
  }, []);

  // 2. Handle Search Logic
  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (text === '') {
      setFilteredBooks(allBooks);
    } else {
      const filtered = allBooks.filter(book => 
        book.title.toLowerCase().includes(text.toLowerCase()) || 
        book.author.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredBooks(filtered);
    }
  };

  const renderBookItem = ({ item }: any) => (
    <TouchableOpacity style={styles.resultCard} activeOpacity={0.7}>
      <View style={styles.bookIconCircle}>
        <Ionicons name="journal-outline" size={24} color="#FFD54F" />
      </View>
      <View style={styles.bookDetails}>
        <Text style={styles.bookTitle}>{item.title}</Text>
        <Text style={styles.bookAuthor}>By {item.author}</Text>
        <Text style={styles.bookMeta}>{item.category} • Qty: {item.qty}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.3)" />
    </TouchableOpacity>
  );

  return (
    <ImageBackground source={require('../assets/images/library_bg.jpg')} style={styles.bg}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          
          {/* HEADER & SEARCH BAR */}
          <View style={styles.header}>
             <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color="#FFF" />
             </TouchableOpacity>
             <View style={styles.searchBarWrapper}>
                <Ionicons name="search" size={20} color="#AAA" style={{marginLeft: 10}} />
                <TextInput 
                  style={styles.searchInput}
                  placeholder="Search title or author..."
                  placeholderTextColor="#999"
                  value={searchQuery}
                  onChangeText={handleSearch}
                  autoFocus={true}
                />
             </View>
          </View>

          {/* SEARCH RESULTS */}
          <FlatList 
            data={filteredBooks}
            keyExtractor={item => item.id}
            renderItem={renderBookItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={60} color="rgba(255,255,255,0.1)" />
                <Text style={styles.emptyText}>No books found matching "{searchQuery}"</Text>
              </View>
            }
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
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 20, 
    borderBottomWidth: 1, 
    borderBottomColor: 'rgba(255,255,255,0.1)' 
  },
  backBtn: { padding: 8, marginRight: 10 },
  searchBarWrapper: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255,255,255,0.1)', 
    borderRadius: 12, 
    height: 45,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  searchInput: { flex: 1, color: '#FFF', paddingHorizontal: 10, fontSize: 16 },
  listContent: { padding: 20 },
  resultCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    padding: 15, 
    borderRadius: 15, 
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)'
  },
  bookIconCircle: { 
    width: 50, 
    height: 50, 
    borderRadius: 25, 
    backgroundColor: 'rgba(255,255,255,0.1)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 15 
  },
  bookDetails: { flex: 1 },
  bookTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  bookAuthor: { color: '#AAA', fontSize: 13, marginTop: 2 },
  bookMeta: { color: '#FFD54F', fontSize: 11, marginTop: 4, fontWeight: '600' },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#666', marginTop: 10, textAlign: 'center' }
});