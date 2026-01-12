// app/user-detail.tsx
import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, 
  ScrollView, BackHandler, TextInput 
} from 'react-native'; 
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
// Added 'deleteDoc' to imports
import { doc, collection, query, where, onSnapshot, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { SafeAreaView } from 'react-native-safe-area-context';

// --- PREMIUM COMPONENTS ---
import CustomAlert from '../components/CustomAlert'; 
import GlassModal from '../components/GlassModal';

export default function UserDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  const [user, setUser] = useState<any>(null);
  const [issuedBooks, setIssuedBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // --- MENU & EDIT STATES ---
  const [menuVisible, setMenuVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDept, setEditDept] = useState('');

  // Custom Alert State
  const [alertConfig, setAlertConfig] = useState({ 
    visible: false, 
    type: 'success' as 'success' | 'error' | 'warning' | 'confirm' | 'destructive', 
    title: '', 
    msg: '', 
    onConfirm: () => {} 
  });

  const showAlert = (type: any, title: string, msg: string, onConfirm?: () => void) => {
    setAlertConfig({ visible: true, type, title, msg, onConfirm: onConfirm || (() => {}) });
  };

  // --- ANDROID BACK BUTTON HANDLER ---
  useEffect(() => {
    const onBackPress = () => {
      if (menuVisible || editVisible) {
        setMenuVisible(false);
        setEditVisible(false);
        return true;
      }
      router.back(); 
      return true;   
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [menuVisible, editVisible]);

  // --- HELPER FORMATTERS ---
  const formatDate = (dateInput: any) => {
    if (!dateInput) return "N/A";
    if (dateInput.toDate) return dateInput.toDate().toLocaleDateString();
    const d = new Date(dateInput);
    if (!isNaN(d.getTime())) return d.toLocaleDateString();
    return "Invalid Date";
  };

  const isOverdue = (dateInput: any) => {
    if (!dateInput) return false;
    let due;
    if (dateInput.toDate) due = dateInput.toDate();
    else due = new Date(dateInput);
    return new Date() > due;
  };

  // 1. Fetch User Details
  useEffect(() => {
    setLoading(true);
    const docRef = doc(db, "users", id as string);
    const unsub = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            setUser({ id: docSnap.id, ...data });
            setEditName(data.displayName || "");
            setEditDept(data.department || "");
        } else {
            // User deleted, navigate back safely if not already loading
             if (!loading) router.back();
        }
        setLoading(false);
    }, (error) => {
        console.error("Error fetching user", error);
        setLoading(false);
    });

    return () => unsub();
  }, [id]);

  // 2. Listen for "Issued" Books
  useEffect(() => {
    const q = query(
      collection(db, "issueRequests"),
      where("studentId", "==", id),
      where("status", "==", "Issued")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setIssuedBooks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribe();
  }, [id]);

  // --- ACTIONS ---

  const handleBlockUser = () => {
    setMenuVisible(false);
    const isBlocked = user?.status === 'Blocked';
    const action = isBlocked ? "Unblock" : "Block";
    
    showAlert(
        isBlocked ? 'confirm' : 'destructive',
        `${action} User?`,
        `Are you sure you want to ${action.toLowerCase()} access for ${user?.displayName}?`,
        async () => {
            setAlertConfig(prev => ({ ...prev, visible: false }));
            try {
                await updateDoc(doc(db, "users", id as string), {
                    status: isBlocked ? 'Active' : 'Blocked'
                });
            } catch (error) {
                showAlert('error', 'Error', 'Could not update user status.');
            }
        }
    );
  };

  // --- NEW: SAFE DELETE HANDLER ---
  const handleDeleteUser = () => {
      setMenuVisible(false); // Close the menu

      // 1. Safety Check: Are there active loans?
      if (issuedBooks.length > 0) {
          showAlert(
              'warning', 
              'Cannot Delete', 
              `This student still has ${issuedBooks.length} book(s) issued. They must return all books before you can delete the account.`
          );
          return;
      }

      // 2. Destructive Confirmation
      showAlert(
          'destructive',
          'Delete Student?',
          `Permanently remove ${user?.displayName || 'this student'}? This action cannot be undone.`,
          async () => {
              setAlertConfig(prev => ({ ...prev, visible: false }));
              try {
                  await deleteDoc(doc(db, "users", id as string));
                  // The snapshot listener usually handles navigation, but we call back() to be sure
                  router.back();
              } catch (error) {
                  console.error("Delete failed", error);
                  showAlert('error', 'Delete Failed', 'Could not remove user from database.');
              }
          }
      );
  };

  const handleUpdateProfile = async () => {
      if(!editName.trim() || !editDept.trim()) {
          showAlert('warning', 'Missing Details', 'Name and Department cannot be empty.');
          return;
      }

      try {
          await updateDoc(doc(db, "users", id as string), {
              displayName: editName.trim(),
              department: editDept.trim()
          });
          setEditVisible(false);
          showAlert('success', 'Profile Updated', 'Student details have been saved.');
      } catch (error) {
          showAlert('error', 'Update Failed', 'Could not save changes.');
      }
  };

  const handleReturnPress = (request: any) => {
    showAlert(
      'confirm',
      'Return Book?',
      `Mark "${request.bookTitle}" as returned?`,
      async () => {
        setAlertConfig(prev => ({ ...prev, visible: false }));
        try {
            await updateDoc(doc(db, "issueRequests", request.id), {
                status: "Returned",
                returnedAt: new Date().toISOString()
            });

            await updateDoc(doc(db, "books", request.bookId), {
                qty: increment(1)
            });
            
        } catch (error) {
            console.error("Return failed", error);
            showAlert('error', 'Error', "Failed to return book.");
        }
      }
    );
  };

  if (loading && !user) return (
    <SafeAreaView style={styles.container}>
      <ActivityIndicator size="large" color="#FFD54F" style={{marginTop: 50}}/>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container}>
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Student Profile</Text>
        
        {/* Three Dot Menu Button */}
        <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.backBtn}>
           <Ionicons name="ellipsis-vertical" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* Profile Card */}
        <View style={styles.profileCard}>
            <View style={styles.avatarContainer}>
                <Ionicons name="person" size={40} color="#FFD54F" />
            </View>
            <Text style={styles.name}>{user?.displayName || "Unknown Student"}</Text>
            <Text style={styles.dept}>{user?.department || "No Department"}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            
            <View style={[styles.statusBadge, {backgroundColor: user?.status === 'Blocked' ? '#F44336' : '#4CAF50'}]}>
                <Text style={styles.statusText}>{user?.status || 'Active Account'}</Text>
            </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
            <View style={styles.statItem}>
                <Text style={styles.statNum}>{issuedBooks.length}</Text>
                <Text style={styles.statLabel}>Issued</Text>
            </View>
            <View style={styles.verticalLine} />
            <View style={styles.statItem}>
                <Text style={[styles.statNum, {color: issuedBooks.filter(b => isOverdue(b.returnDate)).length > 0 ? '#F44336' : '#FFF'}]}>
                    {issuedBooks.filter(b => isOverdue(b.returnDate)).length}
                </Text> 
                <Text style={styles.statLabel}>Overdue</Text>
            </View>
        </View>

        <View style={styles.divider} />

        {/* Currently Issued Section */}
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Currently Issued</Text>
            
            <TouchableOpacity 
                style={styles.issueBtn}
                onPress={() => router.push({
                    pathname: '/issue-book', 
                    params: { prefillStudentId: user?.id } 
                })}
            >
                <Ionicons name="add" size={18} color="#FFF" />
                <Text style={styles.issueBtnText}>Issue New</Text>
            </TouchableOpacity>
        </View>

        {issuedBooks.length === 0 ? (
            <View style={styles.emptyState}>
                <Ionicons name="book-outline" size={40} color="rgba(255,255,255,0.2)" />
                <Text style={styles.emptyText}>No books currently issued.</Text>
            </View>
        ) : (
            issuedBooks.map((item) => {
                const overdue = isOverdue(item.returnDate);
                return (
                    <View key={item.id} style={[styles.bookCard, overdue && {borderColor: 'rgba(244, 67, 54, 0.3)'}]}>
                        <View style={styles.bookIcon}>
                            <Ionicons name="book" size={20} color={overdue ? "#F44336" : "#FFF"} />
                        </View>
                        <View style={styles.bookInfo}>
                            <Text style={styles.bookTitle}>{item.bookTitle}</Text>
                            <Text style={styles.bookDate}>Issued: {formatDate(item.createdAt || item.issuedAt)}</Text>
                            <Text style={[styles.dueDate, {color: overdue ? '#F44336' : '#FFD54F'}]}>
                                Due: {formatDate(item.returnDate)}
                            </Text>
                        </View>
                        <TouchableOpacity 
                            style={styles.returnBtn} 
                            onPress={() => handleReturnPress(item)}
                        >
                            <Text style={styles.returnBtnText}>Return</Text>
                        </TouchableOpacity>
                    </View>
                );
            })
        )}

      </ScrollView>

      {/* --- MENU MODAL --- */}
      <GlassModal 
        visible={menuVisible} 
        onClose={() => setMenuVisible(false)}
        title="Student Options"
      >
          <View style={{ paddingBottom: 40 }}>
              <TouchableOpacity style={styles.menuOption} onPress={() => { setMenuVisible(false); setEditVisible(true); }}>
                  <Ionicons name="create-outline" size={22} color="#FFF" />
                  <Text style={styles.menuText}>Edit Profile</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuOption} onPress={handleBlockUser}>
                  <Ionicons 
                    name={user?.status === 'Blocked' ? "checkmark-circle-outline" : "ban-outline"} 
                    size={22} 
                    color={user?.status === 'Blocked' ? "#4CAF50" : "#F44336"} 
                  />
                  <Text style={[styles.menuText, {color: user?.status === 'Blocked' ? "#4CAF50" : "#F44336"}]}>
                      {user?.status === 'Blocked' ? "Unblock Student" : "Block Access"}
                  </Text>
              </TouchableOpacity>

              {/* NEW DELETE BUTTON */}
              <TouchableOpacity style={[styles.menuOption, { borderBottomWidth: 0 }]} onPress={handleDeleteUser}>
                  <Ionicons name="trash-outline" size={22} color="#FF6B6B" />
                  <Text style={[styles.menuText, {color: '#FF6B6B'}]}>Delete Student</Text>
              </TouchableOpacity>
          </View>
      </GlassModal>

      {/* --- EDIT MODAL --- */}
      <GlassModal
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        title="Edit Profile"
      >
          <Text style={styles.label}>Full Name</Text>
          <TextInput 
            style={styles.input} 
            value={editName} 
            onChangeText={setEditName} 
            placeholder="Student Name" 
            placeholderTextColor="#666" 
          />

          <Text style={styles.label}>Department / Class</Text>
          <TextInput 
            style={styles.input} 
            value={editDept} 
            onChangeText={setEditDept} 
            placeholder="e.g. CSE - 3rd Year" 
            placeholderTextColor="#666" 
          />

          <TouchableOpacity style={styles.saveBtn} onPress={handleUpdateProfile}>
              <Text style={styles.saveBtnText}>Save Changes</Text>
          </TouchableOpacity>
          
          {/* Spacer to prevent clipping */}
          <View style={{height: 80}} />
      </GlassModal>

      <CustomAlert 
        visible={alertConfig.visible}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.msg}
        onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
        onConfirm={alertConfig.onConfirm}
        confirmText={alertConfig.type === 'destructive' ? 'Yes, Delete' : 'Yes, Proceed'}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20,marginTop: 1 },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
  headerTitle: { fontSize: 20, color: '#FFF', fontWeight: 'bold' },
  content: { padding: 20 },
  
  // Profile Card
  profileCard: { alignItems: 'center', marginBottom: 20 },
  avatarContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255, 213, 79, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 15, borderWidth: 1, borderColor: '#FFD54F' },
  name: { fontSize: 22, fontWeight: 'bold', color: '#FFF', marginBottom: 5 },
  dept: { fontSize: 14, color: '#FFD54F', marginBottom: 5, fontWeight: '600' },
  email: { fontSize: 12, color: '#AAA', marginBottom: 15 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusText: { color: '#FFF', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  
  // Stats
  statsRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 20, justifyContent: 'space-evenly', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  statItem: { alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: 'bold', color: '#FFF' },
  statLabel: { fontSize: 10, color: '#AAA', marginTop: 2 },
  verticalLine: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.1)' },
  
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 25 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#FFF' },
  
  issueBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2196F3', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  issueBtnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold', marginLeft: 5 },
  
  emptyState: { alignItems: 'center', marginTop: 20 },
  emptyText: { color: '#666', marginTop: 10 },
  
  // Book Card
  bookCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 15, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  bookIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(33, 150, 243, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  bookInfo: { flex: 1 },
  bookTitle: { color: '#FFF', fontSize: 14, fontWeight: '500' },
  bookDate: { color: '#AAA', fontSize: 11, marginTop: 2 },
  dueDate: { fontSize: 11, marginTop: 4, fontWeight: 'bold' },
  
  returnBtn: { backgroundColor: 'rgba(76, 175, 80, 0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(76, 175, 80, 0.3)' },
  returnBtnText: { color: '#4CAF50', fontSize: 11, fontWeight: 'bold' },

  // Menu Styles
  menuOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  menuText: { color: '#FFF', fontSize: 16, marginLeft: 15, fontWeight: '500' },

  // Edit Form
  label: { color: '#FFD54F', fontSize: 12, marginBottom: 8, fontWeight: 'bold', marginTop: 10 },
  input: { backgroundColor: '#333', color: '#FFF', padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#444' },
  saveBtn: { backgroundColor: '#FFD54F', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 15 },
  saveBtnText: { color: '#2E0249', fontWeight: 'bold', fontSize: 16 }
});