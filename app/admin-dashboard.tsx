// app/admin-dashboard.tsx
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, TextInput, 
  Dimensions, ActivityIndicator, FlatList, Modal, Keyboard, 
  LayoutAnimation, Platform, UIManager, BackHandler 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { 
  collection, onSnapshot, query, limit, where, doc, getDoc, 
  setDoc, getDocs, orderBy // 1. Added orderBy import
} from 'firebase/firestore'; 
import { db } from '../firebaseConfig';
import { signOut } from 'firebase/auth'; 
import { auth } from '../firebaseConfig'; 
import CustomAlert from '../components/CustomAlert';

const { width } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function AdminDashboard() {
  const router = useRouter();
  
  const [students, setStudents] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [totalUsersCount, setTotalUsersCount] = useState(0); 
  const [totalBooksCount, setTotalBooksCount] = useState(0); 
  const [overdueCount, setOverdueCount] = useState(0);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false); 
  const [searchResults, setSearchResults] = useState<any[]>([]); 
  const [isSearching, setIsSearching] = useState(false);

  const [logoutVisible, setLogoutVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [loanDuration, setLoanDuration] = useState('14'); 

  // --- 2. UPDATED FETCH: Sort by createdAt DESC ---
  useEffect(() => {
    const q = query(
        collection(db, "users"), 
        orderBy("createdAt", "desc"), // Shows newest first
        limit(5)
    );

    const unsubscribe = onSnapshot(q, (s) => {
      setStudents(s.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe(); 
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(query(collection(db, "issueRequests"), where("status", "==", "Pending")), (s) => setPendingCount(s.docs.length));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Create a query that filters ONLY for students
    const q = query(collection(db, "users"), where("role", "==", "student"));

    const unsubscribe = onSnapshot(q, (s) => {
      setTotalUsersCount(s.size); // Now this size only includes students
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "books"), (s) => {
      let total = 0;
      s.docs.forEach((doc) => { total += Number(doc.data().qty || 0); });
      setTotalBooksCount(total); 
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(query(collection(db, "issueRequests"), where("status", "==", "Issued")), (snapshot) => {
      const now = new Date();
      setOverdueCount(snapshot.docs.filter(doc => {
          const data = doc.data();
          return data.returnDate && new Date(data.returnDate) < now;
      }).length);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
        const snap = await getDoc(doc(db, "settings", "libraryConfig"));
        if (snap.exists()) setLoanDuration(snap.data().loanDuration?.toString() || '14');
    };
    fetchSettings();
  }, []);

  const handleSearchFocus = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsSearchFocused(true);
  };

  const cancelSearch = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsSearchFocused(false);
    setSearchQuery('');
    setSearchResults([]);
    Keyboard.dismiss();
  };

  useEffect(() => {
    const backAction = () => {
      if (isSearchFocused) {
        cancelSearch();
        return true; 
      }
      return true; 
    };
    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => backHandler.remove();
  }, [isSearchFocused]);

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.length < 2) {
        setSearchResults([]);
        return;
    }
    setIsSearching(true);
    const lowerText = text.toLowerCase();

    try {
        const results: any[] = [];
        const booksSnap = await getDocs(query(collection(db, "books"), limit(50))); 
        booksSnap.forEach(doc => {
            const data = doc.data();
            if (data.title.toLowerCase().includes(lowerText) || data.author.toLowerCase().includes(lowerText)) {
                results.push({ id: doc.id, type: 'book', ...data });
            }
        });
        const usersSnap = await getDocs(query(collection(db, "users"), limit(50)));
        usersSnap.forEach(doc => {
            const data = doc.data();
            if ((data.displayName || "").toLowerCase().includes(lowerText) || (data.email || "").toLowerCase().includes(lowerText)) {
                results.push({ id: doc.id, type: 'student', ...data });
            }
        });
        setSearchResults(results);
    } catch (e) { console.error(e); } finally { setIsSearching(false); }
  };

  const handleResultPress = (item: any) => {
      setSearchQuery('');
      Keyboard.dismiss();
      router.push({ 
          pathname: item.type === 'book' ? '/book-detail' : '/user-detail', 
          params: { id: item.id } 
      });
  };

  const saveSettings = async () => {
      if (loanDuration) await setDoc(doc(db, "settings", "libraryConfig"), { loanDuration: parseInt(loanDuration) }, { merge: true });
      setSettingsVisible(false);
  };

  const confirmLogout = async () => {
    setLogoutVisible(false);
    await signOut(auth);
    router.replace('/');
  };

  const renderStudent = ({ item }: any) => (
    <View style={styles.studentWrapper}>
        <TouchableOpacity style={styles.studentRow} onPress={() => router.push({ pathname: '/user-detail', params: { id: item.id } })}>
            <View style={styles.studentIcon}><Ionicons name="person" size={18} color="#FFF" /></View>
            <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{item.displayName || "No Name"}</Text>
                <Text style={styles.studentClass}>{item.department || "No Dept"}</Text>
            </View>
            <View style={[styles.statusBadge, {backgroundColor: item.status === 'Blocked' ? 'rgba(244, 67, 54, 0.2)' : 'rgba(76, 175, 80, 0.2)'}]}>
                <Text style={[styles.statusText, {color: item.status === 'Blocked' ? '#F44336' : '#4CAF50'}]}>{item.status || 'Active'}</Text>
            </View>
        </TouchableOpacity>
        <View style={styles.divider} />
    </View>
  );

  const renderSearchResult = ({ item }: any) => (
    <TouchableOpacity style={styles.searchResultItem} onPress={() => handleResultPress(item)}>
        <View style={[styles.resultIcon, { backgroundColor: item.type === 'book' ? 'rgba(33, 150, 243, 0.3)' : 'rgba(255, 213, 79, 0.3)' }]}>
            <Ionicons name={item.type === 'book' ? "book" : "person"} size={20} color="#FFF" />
        </View>
        <View style={styles.resultInfo}>
            <Text style={styles.resultTitle}>{item.type === 'book' ? item.title : item.displayName}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.resultSub}>{item.type === 'book' ? `By ${item.author}` : item.email}</Text>
                
                {item.type === 'book' && (
                  <>
                    <Text style={[styles.resultSub, { marginHorizontal: 5 }]}>•</Text>
                    <Text style={{
                        color: item.qty > 0 ? '#4CAF50' : '#F44336', 
                        fontSize: 12, 
                        fontWeight: 'bold'
                    }}>
                        {item.qty} / {item.totalQty || item.qty} In
                    </Text>
                  </>
                )}
            </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.5)" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.fixedHeaderContainer}>
          {!isSearchFocused && (
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Admin Panel</Text>
                    <Text style={styles.headerSubtitle}>Nitgyanam Library System</Text>
                </View>
                <View style={{flexDirection: 'row', gap: 10}}>
                    <TouchableOpacity style={styles.logoutButton} onPress={() => setSettingsVisible(true)}>
                        <Ionicons name="settings-outline" size={24} color="#FFF" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.logoutButton} onPress={() => setLogoutVisible(true)}>
                        <Ionicons name="log-out-outline" size={24} color="#E53E3E" />
                    </TouchableOpacity>
                </View>
            </View>
          )}

          <View style={[styles.searchContainer, isSearchFocused && styles.searchContainerActive]}>
            <TouchableOpacity onPress={isSearchFocused ? cancelSearch : undefined} disabled={!isSearchFocused}>
                <Ionicons 
                    name={isSearchFocused ? "arrow-back" : "search"} 
                    size={24} 
                    color={isSearchFocused ? "#FFD54F" : "#CCC"} 
                    style={{ marginRight: 10 }} 
                />
            </TouchableOpacity>

            <TextInput
              style={styles.searchInput}
              placeholder={isSearchFocused ? "Search books or students..." : "Tap to search..."}
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={searchQuery}
              onChangeText={handleSearch}
              onFocus={handleSearchFocus}
            />
            
            {isSearchFocused && searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                    <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.5)" style={{marginLeft: 5}}/>
                </TouchableOpacity>
            )}
          </View>
      </View>

      {isSearchFocused ? (
          <View style={styles.glassOverlay}>
              {isSearching ? (
                  <ActivityIndicator color="#FFD54F" style={{marginTop: 20}} />
              ) : (
                  <FlatList
                    data={searchResults}
                    keyExtractor={item => item.id}
                    renderItem={renderSearchResult}
                    contentContainerStyle={{padding: 20}}
                    keyboardShouldPersistTaps="handled"
                    ListEmptyComponent={
                        searchQuery.length > 1 ? 
                        <Text style={{color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 20}}>No results found.</Text> 
                        : null
                    }
                  />
              )}
          </View>
      ) : (
          <>
              <View style={styles.statsRow}>
                  <TouchableOpacity style={[styles.statCard, {backgroundColor: '#1565C0'}]} onPress={() => router.push('/all-books')} activeOpacity={0.7}>
                      <Text style={styles.statNumber}>{totalBooksCount}</Text>
                      <Text style={styles.statLabel}>Total Books</Text>
                      <Ionicons name="library" size={14} color="rgba(255,255,255,0.4)" style={styles.cardIcon}/>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={[styles.statCard, {backgroundColor: '#2E7D32'}]} onPress={() => router.push('/all-students')} activeOpacity={0.7}>
                      <Text style={styles.statNumber}>{totalUsersCount}</Text>
                      <Text style={styles.statLabel}>Reg. Students</Text>
                      <Ionicons name="people" size={14} color="rgba(255,255,255,0.4)" style={styles.cardIcon}/>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.statCard, {backgroundColor: '#E64A19'}]} onPress={() => router.push('/overdue-books')} activeOpacity={0.7}>
                      <Text style={styles.statNumber}>{overdueCount}</Text>
                      <Text style={styles.statLabel}>Overdue</Text>
                      <Ionicons name="warning" size={14} color="rgba(255,255,255,0.4)" style={styles.cardIcon}/>
                  </TouchableOpacity>
              </View>

              <Text style={styles.sectionTitle}>Library Management</Text>
              <View style={styles.actionGrid}>
                  <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/add-user')}>
                      <View style={[styles.iconCircle, { backgroundColor: '#4CAF50' }]}><Ionicons name="person-add" size={24} color="#FFF" /></View>
                      <Text style={styles.actionText}>Add User</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/add-book')}>
                      <View style={[styles.iconCircle, { backgroundColor: '#2196F3' }]}><Ionicons name="book" size={24} color="#FFF" /></View>
                      <Text style={styles.actionText}>Add Book</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/issue-queue')}>
                      <View style={[styles.iconCircle, { backgroundColor: '#FF9800' }]}><Ionicons name="layers" size={24} color="#FFF" /></View>
                      <Text style={styles.actionText}>Issue Queue</Text>
                      {pendingCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{pendingCount > 9 ? '9+' : pendingCount}</Text></View>}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/manage-alerts')}>
                      <View style={[styles.iconCircle, { backgroundColor: '#E91E63' }]}><Ionicons name="notifications" size={24} color="#FFF" /></View>
                      <Text style={styles.actionText}>Cast Alerts</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.fullWidthActionCard} onPress={() => router.push('/issue-book')} activeOpacity={0.8}>
                      <View style={styles.fullWidthContent}>
                          <View style={styles.iconBackground}><Ionicons name="qr-code-outline" size={22} color="#2E0249" /></View>
                          <View><Text style={styles.fullWidthActionText}>Issue/Reissue Book</Text><Text style={styles.fullWidthSubText}>Instant checkout for walk-in students</Text></View>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#FFD54F" />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.fullWidthActionCard, styles.returnCard]} onPress={() => router.push('/return-book')} activeOpacity={0.8}>
                      <View style={styles.fullWidthContent}>
                          <View style={[styles.iconBackground, { backgroundColor: '#4CAF50' }]}><Ionicons name="arrow-undo-outline" size={22} color="#FFF" /></View>
                          <View><Text style={styles.fullWidthActionText}>Return Book</Text><Text style={styles.fullWidthSubText}>Check-in books and update stock</Text></View>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#4CAF50" />
                  </TouchableOpacity>
              </View>

              <View style={styles.listHeader}><Text style={styles.sectionTitle}>Recent Students (Latest 5)</Text></View>
              <FlatList
                data={students}
                keyExtractor={item => item.id}
                renderItem={renderStudent}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
              />
          </>
      )}

      <CustomAlert visible={logoutVisible} type="destructive" title="Sign Out" message="Are you sure?" onClose={() => setLogoutVisible(false)} onConfirm={confirmLogout} confirmText="Logout"/>
      
      <Modal visible={settingsVisible} transparent animationType="fade" onRequestClose={() => setSettingsVisible(false)}>
          <View style={styles.modalOverlay}>
              <View style={styles.settingsBox}>
                  <Text style={styles.modalTitle}>Library Settings</Text>
                  <Text style={styles.inputLabel}>Default Borrow Duration (Days)</Text>
                  <TextInput style={styles.modalInput} value={loanDuration} onChangeText={setLoanDuration} keyboardType="numeric"/>
                  <View style={styles.modalBtnRow}>
                      <TouchableOpacity onPress={() => setSettingsVisible(false)} style={styles.cancelBtn}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                      <TouchableOpacity onPress={saveSettings} style={styles.saveBtn}><Text style={styles.saveText}>Save</Text></TouchableOpacity>
                  </View>
              </View>
          </View>
      </Modal>

      {loading && <View style={styles.loaderContainer}><ActivityIndicator color="#FFD54F" size="large" /></View>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' }, 
  fixedHeaderContainer: { paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 8, marginBottom: 20, padding: 10 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#FFF' },
  headerSubtitle: { fontSize: 12, color: '#FFD54F', letterSpacing: 1 },
  logoutButton: { padding: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 20, borderRadius: 12, paddingHorizontal: 15, height: 50, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  searchContainerActive: { borderColor: '#FFD54F', backgroundColor: 'rgba(0,0,0,0.5)', marginTop: 55 },
  searchInput: { flex: 1, color: '#FFF', fontSize: 16 },
  glassOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)' },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  resultIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  resultInfo: { flex: 1 },
  resultTitle: { color: '#FFF', fontSize: 16, fontWeight: '500' },
  resultSub: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 30 },
  statCard: { width: '31%', borderRadius: 16, paddingVertical: 15, paddingHorizontal: 10, alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3 },
  statNumber: { fontSize: 22, fontWeight: 'bold', color: '#FFF', marginBottom: 4 },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', fontWeight: '600' },
  cardIcon: { position: 'absolute', top: 8, right: 8 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFF', marginLeft: 20, marginBottom: 15 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 10 },
  actionCard: { width: '48%', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 15, alignItems: 'center', marginBottom: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  badge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#F44336', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: '#121212' },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  fullWidthActionCard: { width: '100%', backgroundColor: 'rgba(255, 213, 79, 0.12)', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, borderWidth: 1, borderColor: '#FFD54F', borderLeftWidth: 6 },
  returnCard: { borderColor: '#4CAF50', backgroundColor: 'rgba(76, 175, 80, 0.12)', marginTop: 15 },
  fullWidthContent: { flexDirection: 'row', alignItems: 'center' },
  iconBackground: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#FFD54F', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  fullWidthActionText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  fullWidthSubText: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 },
  iconCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  actionText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  listHeader: { paddingHorizontal: 20, marginTop: 10, marginBottom: 5 }, 
  listContent: { paddingBottom: 50 }, 
  studentWrapper: { marginHorizontal: 20, marginBottom: 0 },
  studentRow: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16 },
  studentIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  studentInfo: { flex: 1 },
  studentName: { color: '#FFF', fontSize: 14, fontWeight: '500' },
  studentClass: { color: '#AAA', fontSize: 12 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  divider: { height: 10 }, 
  loaderContainer: { position: 'absolute', bottom: 20, width: '100%', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  settingsBox: { width: '80%', backgroundColor: '#1E1E1E', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  inputLabel: { color: '#AAA', marginBottom: 10, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  modalInput: { backgroundColor: '#333', color: '#FFF', padding: 12, borderRadius: 8, marginBottom: 25, fontSize: 16, textAlign: 'center', borderWidth: 1, borderColor: '#444' },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cancelBtn: { padding: 10 },
  cancelText: { color: '#AAA', fontWeight: 'bold' },
  saveBtn: { backgroundColor: '#FFD54F', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  saveText: { color: '#2E0249', fontWeight: 'bold' }
});