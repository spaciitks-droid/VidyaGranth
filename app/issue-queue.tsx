// app/issue-queue.tsx
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, ImageBackground, TouchableOpacity, 
  FlatList, ActivityIndicator, BackHandler, TextInput, Modal, ScrollView 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { 
  collection, query, where, onSnapshot, orderBy, doc, getDoc, 
  updateDoc, deleteDoc, addDoc, serverTimestamp, increment 
} from 'firebase/firestore'; 
import { db } from '../firebaseConfig'; 

// --- IMPORT CUSTOM ALERT ---
import CustomAlert from '../components/CustomAlert';

export default function IssueQueueScreen() {
  const router = useRouter();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'Issue' | 'Reissue'>('Issue'); 

  // --- FILTER & SORT STATE ---
  const [searchQuery, setSearchQuery] = useState('');
  const [sortType, setSortType] = useState('newest');
  const [modalVisible, setModalVisible] = useState(false);

  // --- ALERT STATE ---
  const [alertConfig, setAlertConfig] = useState({ 
    visible: false, 
    type: 'confirm' as 'success' | 'error' | 'warning' | 'confirm', 
    title: '', 
    msg: '', 
    onConfirm: () => {} 
  });

  // 1. Android Back Handler
  useEffect(() => {
    const onBackPress = () => { router.back(); return true; };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, []);

  // 2. Live Listener
  useEffect(() => {
    const q = query(
      collection(db, "issueRequests"), 
      where("status", "==", "Pending"),
      orderBy("requestDate", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRequests(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // --- 3. FILTER & SORT LOGIC ---
  const getProcessedList = () => {
    // A. Filter by Active Tab
    let list = requests.filter(r => 
        activeTab === 'Issue' ? r.type !== 'Reissue' : r.type === 'Reissue'
    );

    // B. Filter by Search Query
    if (searchQuery) {
        const lower = searchQuery.toLowerCase();
        list = list.filter(r => 
            (r.studentName && r.studentName.toLowerCase().includes(lower)) ||
            (r.bookTitle && r.bookTitle.toLowerCase().includes(lower)) ||
            (r.bookId && r.bookId.toLowerCase().includes(lower))
        );
    }

    // C. Sort
    switch (sortType) {
        case 'oldest': 
            return list.sort((a, b) => (a.requestDate?.seconds || 0) - (b.requestDate?.seconds || 0));
        case 'student_az': 
            return list.sort((a, b) => (a.studentName || "").localeCompare(b.studentName || ""));
        case 'book_az': 
            return list.sort((a, b) => (a.bookTitle || "").localeCompare(b.bookTitle || ""));
        case 'newest':
        default: 
            return list.sort((a, b) => (b.requestDate?.seconds || 0) - (a.requestDate?.seconds || 0));
    }
  };

  const finalData = getProcessedList();

  const getSortLabel = () => {
    switch(sortType) {
        case 'newest': return 'Newest Requests';
        case 'oldest': return 'Oldest Requests';
        case 'student_az': return 'Student (A-Z)';
        case 'book_az': return 'Book Title (A-Z)';
        default: return 'Newest Requests';
    }
  };

  // --- LOGIC HELPERS ---
  const sendNotification = async (studentId: string, title: string, message: string, type: 'success' | 'error' | 'info') => {
    await addDoc(collection(db, "notifications"), {
        studentId, title, message, type, read: false, createdAt: serverTimestamp()
    });
  };

  const getLoanDuration = async () => {
    try {
        const settingsSnap = await getDoc(doc(db, "settings", "libraryConfig"));
        if (settingsSnap.exists()) return settingsSnap.data().loanDuration || 14; 
    } catch (e) { console.log("Error fetching settings"); }
    return 14; 
  };

  const onApprovePress = (item: any) => {
      const isReissue = item.type === 'Reissue';
      setAlertConfig({
          visible: true,
          type: 'confirm',
          title: isReissue ? 'Approve Extension?' : 'Confirm Issue?',
          msg: isReissue 
             ? `Extend due date for "${item.bookTitle}"?` 
             : `Issue "${item.bookTitle}" to ${item.studentName}?`,
          onConfirm: () => handleApproveLogic(item)
      });
  };

  const onRejectPress = (item: any) => {
      setAlertConfig({
          visible: true,
          type: 'warning',
          title: 'Reject Request?',
          msg: `Are you sure you want to reject the request for "${item.bookTitle}"?`,
          onConfirm: () => handleRejectLogic(item)
      });
  };

  const handleApproveLogic = async (item: any) => {
    setAlertConfig(prev => ({ ...prev, visible: false })); 
    try {
        const duration = await getLoanDuration();

        if (item.type === 'Reissue') {
            if (!item.originalRequestId) return;
            const originalRef = doc(db, "issueRequests", item.originalRequestId);
            const originalSnap = await getDoc(originalRef);

            if (originalSnap.exists()) {
                const currentDue = originalSnap.data().returnDate.toDate();
                const newDue = new Date(currentDue);
                newDue.setDate(newDue.getDate() + duration);

                await updateDoc(originalRef, { returnDate: newDue, reissueCount: increment(1) });
                await sendNotification(item.studentId, "Reissue Approved ✅", `Extended by ${duration} days!`, 'success');
            }
        } else {
            const bookRef = doc(db, "books", item.bookId);
            const bookSnap = await getDoc(bookRef);

            if (!bookSnap.exists() || bookSnap.data().qty < 1) {
                setAlertConfig({ visible: true, type: 'error', title: 'Out of Stock', msg: 'Cannot issue this book.', onConfirm: () => setAlertConfig(p=>({...p, visible:false})) });
                return;
            }

            await updateDoc(bookRef, { qty: increment(-1) });
            const returnDate = new Date();
            returnDate.setDate(returnDate.getDate() + duration);

            await updateDoc(doc(db, "issueRequests", item.id), {
                status: 'Issued',
                issuedAt: serverTimestamp(),
                returnDate: returnDate
            });

            await sendNotification(item.studentId, "Book Issued ✅", `You have been issued "${item.bookTitle}".`, 'success');
            return; 
        }

        if (item.type === 'Reissue') {
            await deleteDoc(doc(db, "issueRequests", item.id));
        }

    } catch (error) {
        console.error(error);
    }
  };

  const handleRejectLogic = async (item: any) => {
    setAlertConfig(prev => ({ ...prev, visible: false })); 
    try {
        await deleteDoc(doc(db, "issueRequests", item.id));
        await sendNotification(item.studentId, "Request Rejected ❌", `Your request for "${item.bookTitle}" was declined.`, 'error');
    } catch (error) {
        console.error(error);
    }
  };

  // --- RENDERERS ---
  const SortOption = ({ id, label, icon }: { id: string, label: string, icon: any }) => (
    <TouchableOpacity 
        style={[styles.modalOption, sortType === id && styles.modalOptionActive]} 
        onPress={() => {
            setSortType(id);
            setModalVisible(false);
        }}
    >
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <View style={[styles.iconBoxSmall, sortType === id ? {backgroundColor: '#2E0249'} : {backgroundColor: 'rgba(255,255,255,0.1)'}]}>
                <Ionicons name={icon} size={16} color={sortType === id ? "#FFD54F" : "#AAA"} />
            </View>
            <Text style={[styles.modalOptionText, sortType === id && styles.modalOptionTextActive]}>{label}</Text>
        </View>
        {sortType === id && <Ionicons name="checkmark-circle" size={20} color="#2E0249" />}
    </TouchableOpacity>
  );

  const renderCard = ({ item }: any) => {
    const isReissue = item.type === 'Reissue';

    return (
      <View style={styles.cardContainer}>
        {/* HEADER: Date & Tag */}
        <View style={styles.cardHeader}>
            <View style={[styles.typeTag, isReissue ? styles.bgPurple : styles.bgBlue]}>
                <Text style={[styles.typeText, isReissue ? {color:'#E040FB'} : {color:'#2196F3'}]}>
                    {isReissue ? "EXTENSION" : "NEW ISSUE"}
                </Text>
            </View>
            <View style={styles.dateRow}>
                <Ionicons name="time-outline" size={10} color="#AAA" />
                <Text style={styles.dateText}>
                    {item.requestDate?.toDate ? item.requestDate.toDate().toLocaleDateString() : 'Just now'}
                </Text>
            </View>
        </View>

        {/* BODY: Student & Book Info */}
        <View style={styles.cardBody}>
            <View style={styles.studentRow}>
                <Ionicons name="person-circle" size={16} color="#FFD54F" />
                <Text style={styles.studentName} numberOfLines={1}>{item.studentName || "Unknown Student"}</Text>
            </View>
            <Text style={styles.bookTitle} numberOfLines={1}>{item.bookTitle}</Text>
            <Text style={styles.bookId}>ID: {item.bookId?.substring(0, 8)}...</Text>
        </View>

        {/* FOOTER: Action Buttons */}
        <View style={styles.actionRow}>
            <TouchableOpacity 
                style={[styles.actionBtn, styles.btnReject]} 
                onPress={() => onRejectPress(item)}
            >
                <Ionicons name="close" size={16} color="#F44336" />
                <Text style={[styles.btnText, {color: '#F44336'}]}>Decline</Text>
            </TouchableOpacity>

            <View style={{width: 10}} />

            <TouchableOpacity 
                style={[styles.actionBtn, styles.btnApprove]} 
                onPress={() => onApprovePress(item)}
            >
                <Ionicons name="checkmark" size={16} color="#000" />
                <Text style={[styles.btnText, {color: '#000'}]}>Accept</Text>
            </TouchableOpacity>
        </View>
      </View>
    );
  };

  const issueCount = requests.filter(r => r.type !== 'Reissue').length;
  const reissueCount = requests.filter(r => r.type === 'Reissue').length;

  return (
    <ImageBackground source={require('../assets/images/library_bg.jpg')} style={styles.bg}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          
          {/* HEADER */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Queue Manager</Text>
          </View>

          {/* TABS */}
          <View style={styles.tabContainer}>
            <TouchableOpacity 
                style={[styles.tab, activeTab === 'Issue' && styles.activeTabIssue]}
                onPress={() => setActiveTab('Issue')}
            >
                <Text style={[styles.tabText, activeTab === 'Issue' && {color: '#2196F3'}]}>New Issues</Text>
                {issueCount > 0 && <View style={styles.badgeBlue}><Text style={styles.badgeText}>{issueCount}</Text></View>}
            </TouchableOpacity>

            <TouchableOpacity 
                style={[styles.tab, activeTab === 'Reissue' && styles.activeTabReissue]}
                onPress={() => setActiveTab('Reissue')}
            >
                <Text style={[styles.tabText, activeTab === 'Reissue' && {color: '#E040FB'}]}>Reissues</Text>
                {reissueCount > 0 && <View style={styles.badgePurple}><Text style={styles.badgeText}>{reissueCount}</Text></View>}
            </TouchableOpacity>
          </View>

          {/* SEARCH BAR */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#CCC" style={{ marginRight: 10 }} />
            <TextInput
            style={styles.searchInput}
            placeholder="Search student, book title/ID..."
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
                <Ionicons name="filter" size={22} color="#FFD54F" />
            </TouchableOpacity>
          </View>

          {/* INFO BAR */}
          <View style={styles.filterStatus}>
            <Text style={styles.filterText}>
                <Ionicons name="funnel-outline" size={10} color="#AAA"/> {getSortLabel()}
            </Text>
            <Text style={styles.filterText}>{finalData.length} Pending</Text>
          </View>

          {/* LIST */}
          {loading ? (
            <ActivityIndicator size="large" color="#FFD54F" style={{ marginTop: 50 }} />
          ) : (
            <FlatList
              data={finalData}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={renderCard}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyCircle}>
                    <Ionicons name="file-tray-outline" size={50} color="rgba(255,255,255,0.3)" />
                  </View>
                  <Text style={styles.emptyText}>Queue is empty!</Text>
                  <Text style={styles.emptySub}>No requests match your filter.</Text>
                </View>
              }
            />
          )}

          {/* MODAL */}
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
                        <View style={styles.modalTitleRow}>
                            <Ionicons name="filter-circle" size={28} color="#FFD54F" style={{marginRight: 10}}/>
                            <Text style={styles.modalTitle}>Sort Queue</Text>
                        </View>
                        <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                            <Ionicons name="close" size={20} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                    
                    <ScrollView style={{maxHeight: 450}} showsVerticalScrollIndicator={false}>
                        <Text style={styles.groupTitle}>DATE</Text>
                        <SortOption id="newest" label="Newest First" icon="calendar" />
                        <SortOption id="oldest" label="Oldest First" icon="calendar" />

                        <Text style={styles.groupTitle}>ALPHABETICAL</Text>
                        <SortOption id="student_az" label="Student Name (A - Z)" icon="person" />
                        <SortOption id="book_az" label="Book Title (A - Z)" icon="book" />
                    </ScrollView>
                </View>
            </TouchableOpacity>
          </Modal>

          {/* ALERT POPUP */}
          <CustomAlert 
            visible={alertConfig.visible} type={alertConfig.type} title={alertConfig.title} message={alertConfig.msg} 
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' },
  container: { flex: 1 },
  
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, marginTop: 1 },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginLeft: 15 },

  // Tabs
  tabContainer: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 15 },
  tab: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'rgba(255,255,255,0.1)' },
  activeTabIssue: { borderBottomColor: '#2196F3' },
  activeTabReissue: { borderBottomColor: '#E040FB' },
  tabText: { color: '#888', fontWeight: 'bold', fontSize: 13, marginRight: 6 },
  badgeBlue: { backgroundColor: '#2196F3', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  badgePurple: { backgroundColor: '#E040FB', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 10, color: '#FFF', fontWeight: 'bold' },

  // Search Bar
  searchContainer: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', 
    marginHorizontal: 20, borderRadius: 16, paddingHorizontal: 15, height: 50, 
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' 
  },
  searchInput: { flex: 1, color: '#FFF', fontSize: 15 },
  verticalLine: { width: 1, height: '50%', backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 10 },
  sortBtn: { padding: 5 },

  // Info Bar
  filterStatus: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 25, marginBottom: 10, marginTop: 15 },
  filterText: { color: '#888', fontSize: 11, fontWeight: 'bold' },

  listContent: { padding: 20, paddingBottom: 50 },

  // --- CARD STYLES (COMPACT) ---
  cardContainer: { 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    borderRadius: 12, 
    marginBottom: 12, 
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden'
  },
  cardHeader: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.03)' 
  },
  typeTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  bgBlue: { backgroundColor: 'rgba(33, 150, 243, 0.15)' },
  bgPurple: { backgroundColor: 'rgba(224, 64, 251, 0.15)' },
  typeText: { fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5 },
  dateRow: { flexDirection: 'row', alignItems: 'center' },
  dateText: { color: '#888', fontSize: 10, marginLeft: 4 },

  cardBody: { padding: 12 }, 
  studentRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  studentName: { color: '#FFD54F', fontSize: 13, fontWeight: 'bold', marginLeft: 6 },
  bookTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 2 }, 
  bookId: { color: '#666', fontSize: 11, fontFamily: 'monospace' },

  actionRow: { flexDirection: 'row', padding: 12, paddingTop: 0 },
  actionBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  btnReject: { backgroundColor: 'rgba(244, 67, 54, 0.1)', borderWidth: 1, borderColor: 'rgba(244, 67, 54, 0.3)' },
  btnApprove: { backgroundColor: '#4CAF50' },
  btnText: { fontSize: 13, fontWeight: 'bold', marginLeft: 6 }, 

  // Empty State
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  emptyText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  emptySub: { color: '#666', fontSize: 14, marginTop: 5 },

  // --- MODAL STYLES ---
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#1E1E1E', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center' },
  modalTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  closeBtn: { padding: 5, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 15 },
  
  groupTitle: { color: '#666', fontSize: 11, fontWeight: 'bold', marginTop: 15, marginBottom: 8, letterSpacing: 1, marginLeft: 5 },
  
  modalOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 15, borderRadius: 12, marginBottom: 6, backgroundColor: 'rgba(255,255,255,0.02)' },
  modalOptionActive: { backgroundColor: '#FFD54F' }, 
  iconBoxSmall: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  
  modalOptionText: { color: '#DDD', fontSize: 15, fontWeight: '500' },
  modalOptionTextActive: { color: '#2E0249', fontWeight: 'bold' }, 
});