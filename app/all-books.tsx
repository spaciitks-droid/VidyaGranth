// app/all-books.tsx
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, FlatList, ActivityIndicator, Modal, ScrollView, BackHandler } from 'react-native'; 
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'; 
import { db } from '../firebaseConfig';

export default function AllBooks() {
  const router = useRouter();
  const [books, setBooks] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [sortType, setSortType] = useState('az'); 
  const [modalVisible, setModalVisible] = useState(false); 

  useEffect(() => {
    const onBackPress = () => {
      router.back(); 
      return true;   
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress
    );

    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "books"), orderBy("title", "asc")); 
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const booksList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBooks(booksList);
      setLoading(false);
    });
    return () => unsubscribe(); 
  }, []);

  const getProcessedBooks = () => {
    let result = books.filter(book => 
      book.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.author?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.category?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    switch (sortType) {
      case 'za': return result.sort((a, b) => b.title.localeCompare(a.title));
      case 'author_az': return result.sort((a, b) => a.author.localeCompare(b.author));
      case 'author_za': return result.sort((a, b) => b.author.localeCompare(b.author));
      case 'cat_az': return result.sort((a, b) => (a.category || "").localeCompare(b.category || ""));
      case 'cat_za': return result.sort((a, b) => (b.category || "").localeCompare(b.category || ""));
      case 'qty_high': return result.sort((a, b) => b.qty - a.qty);
      case 'qty_low': return result.sort((a, b) => a.qty - b.qty);
      case 'available':
        return result.sort((a, b) => {
           if (a.qty > 0 && b.qty <= 0) return -1;
           if (a.qty <= 0 && b.qty > 0) return 1;
           return 0;
        });
      case 'newest':
        return result.sort((a, b) => {
            const dateA = new Date(a.addedAt || 0).getTime();
            const dateB = new Date(b.addedAt || 0).getTime();
            return dateB - dateA;
        });
      case 'az':
      default:
        return result.sort((a, b) => a.title.localeCompare(b.title));
    }
  };

  const finalBooksList = getProcessedBooks();

  const getSortLabel = () => {
      switch(sortType) {
          case 'az': return 'Title (A-Z)';
          case 'za': return 'Title (Z-A)';
          case 'author_az': return 'Author (A-Z)';
          case 'author_za': return 'Author (Z-A)';
          case 'cat_az': return 'Category (A-Z)';
          case 'cat_za': return 'Category (Z-A)';
          case 'qty_high': return 'Quantity (High-Low)';
          case 'qty_low': return 'Quantity (Low-High)';
          case 'available': return 'In Stock First';
          case 'newest': return 'Newest Added';
          default: return 'Title (A-Z)';
      }
  };

  const SortOption = ({ id, label, icon }: { id: string, label: string, icon: any }) => (
    <TouchableOpacity 
        style={[styles.modalOption, sortType === id && styles.modalOptionActive]} 
        onPress={() => {
            setSortType(id);
            setModalVisible(false);
        }}
    >
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Ionicons name={icon} size={20} color={sortType === id ? "#2E0249" : "#FFF"} style={{marginRight: 15}} />
            <Text style={[styles.modalOptionText, sortType === id && styles.modalOptionTextActive]}>{label}</Text>
        </View>
        {sortType === id && <Ionicons name="checkmark-circle" size={20} color="#2E0249" />}
    </TouchableOpacity>
  );

  const renderBook = ({ item }: any) => (
    <View style={styles.itemWrapper}>
        <TouchableOpacity 
            style={styles.itemRow}
            onPress={() => router.push({
                pathname: '/book-detail',
                params: { id: item.id }
            })}
        >
            <View style={styles.iconBox}>
                <Ionicons name="book" size={18} color="#FFF" />
            </View>
            <View style={styles.info}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.subtitle}>
                    <Text style={{fontWeight: 'bold', color: '#FFD54F'}}>{item.author}</Text>
                    {item.category ? ` • ${item.category}` : ''}
                </Text>
                {/* NEW: Display Total Registered Count */}
                <Text style={styles.totalRegisteredText}>
                    Total Registered: {item.totalQty || item.qty}
                </Text>
            </View>
            
            {/* UPDATED BADGE: Shows Available vs Total */}
            <View style={[styles.badge, {backgroundColor: item.qty > 0 ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)'}]}>
                <Text style={[styles.badgeText, {color: item.qty > 0 ? '#4CAF50' : '#F44336'}]}>
                    {item.qty > 0 ? `${item.qty} / ${item.totalQty || item.qty} In` : 'Out of Stock'}
                </Text>
            </View>
        </TouchableOpacity>
        <View style={styles.divider} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All Library Books</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#CCC" style={{ marginRight: 10 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by title, author, category..."
          placeholderTextColor="#AAA"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{marginRight: 10}}>
                <Ionicons name="close-circle" size={20} color="#AAA" />
            </TouchableOpacity>
        )}
        <View style={styles.verticalLine} />
        
        <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.sortBtn}>
            <Ionicons name="filter" size={20} color="#FFD54F" />
        </TouchableOpacity>
      </View>

      <View style={styles.filterStatus}>
         <Text style={styles.filterText}>Sorted by: {getSortLabel()}</Text>
         <Text style={styles.filterText}>Total: {finalBooksList.length}</Text>
      </View>

      <FlatList
        data={finalBooksList}
        keyExtractor={item => item.id}
        renderItem={renderBook}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !loading ? (
            <View style={{alignItems: 'center', marginTop: 50}}>
                <Ionicons name="library-outline" size={50} color="rgba(255,255,255,0.2)" />
                <Text style={{color: '#AAA', marginTop: 10}}>No books found.</Text>
            </View>
          ) : null
        }
      />

      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => setModalVisible(false)}
        >
            <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Sort Books By</Text>
                    <TouchableOpacity onPress={() => setModalVisible(false)}>
                        <Ionicons name="close" size={24} color="#AAA" />
                    </TouchableOpacity>
                </View>
                
                <ScrollView style={{maxHeight: 400}} showsVerticalScrollIndicator={false}>
                    <Text style={styles.groupTitle}>TITLE</Text>
                    <SortOption id="az" label="Title (A - Z)" icon="text" />
                    <SortOption id="za" label="Title (Z - A)" icon="text" />

                    <Text style={styles.groupTitle}>AUTHOR</Text>
                    <SortOption id="author_az" label="Author Name (A - Z)" icon="person" />
                    <SortOption id="author_za" label="Author Name (Z - A)" icon="person" />

                    <Text style={styles.groupTitle}>CATEGORY</Text>
                    <SortOption id="cat_az" label="Category (A - Z)" icon="pricetag" />
                    <SortOption id="cat_za" label="Category (Z - A)" icon="pricetag" />

                    <Text style={styles.groupTitle}>STOCK & STATUS</Text>
                    <SortOption id="available" label="In Stock First" icon="checkmark-circle" />
                    <SortOption id="qty_high" label="Highest Quantity" icon="stats-chart" />
                    <SortOption id="qty_low" label="Lowest Quantity" icon="stats-chart" />
                    <SortOption id="newest" label="Newest Added" icon="calendar" />
                </ScrollView>
            </View>
        </TouchableOpacity>
      </Modal>

      {loading && (
         <View style={styles.loaderContainer}>
            <ActivityIndicator color="#FFD54F" size="large" />
         </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, marginTop: 1 },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
  headerTitle: { fontSize: 20, color: '#FFF', fontWeight: 'bold', marginLeft: 15 },
  
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 20, borderRadius: 12, paddingHorizontal: 15, height: 50, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  searchInput: { flex: 1, color: '#FFF', fontSize: 16 },
  verticalLine: { width: 1, height: '60%', backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 5 },
  sortBtn: { padding: 5 },
  
  filterStatus: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 25, marginBottom: 10, marginTop: 10 },
  filterText: { color: '#AAA', fontSize: 11, fontStyle: 'italic' },

  listContent: { paddingBottom: 20 },
  itemWrapper: { marginHorizontal: 20, marginBottom: 0 },
  itemRow: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16 },
  iconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(33, 150, 243, 0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  info: { flex: 1 },
  title: { color: '#FFF', fontSize: 14, fontWeight: '500' },
  subtitle: { color: '#AAA', fontSize: 12 },
  totalRegisteredText: { color: '#666', fontSize: 10, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: 'bold' },
  divider: { height: 10 },
  loaderContainer: { position: 'absolute', bottom: 20, width: '100%', alignItems: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#1E1E1E', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#333', elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  
  groupTitle: { color: '#888', fontSize: 10, fontWeight: 'bold', marginTop: 10, marginBottom: 5, letterSpacing: 1 },
  
  modalOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 15, borderRadius: 12, marginBottom: 5 },
  modalOptionActive: { backgroundColor: '#FFD54F' }, 
  modalOptionText: { color: '#FFF', fontSize: 15 },
  modalOptionTextActive: { color: '#2E0249', fontWeight: 'bold' }, 
});