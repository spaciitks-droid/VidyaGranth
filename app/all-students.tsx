// app/all-students.tsx
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, FlatList, ActivityIndicator, BackHandler } from 'react-native'; // Added BackHandler
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'; 
import { db } from '../firebaseConfig';

export default function AllStudents() {
  const router = useRouter();
  const [students, setStudents] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // --- ADDED: ANDROID BACK BUTTON HANDLER ---
  useEffect(() => {
    const onBackPress = () => {
      router.back(); // Go back to the previous screen
      return true;   // Prevent default behavior (exiting the app)
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress
    );

    return () => backHandler.remove();
  }, []);
  // ------------------------------------------

  // 1. Fetch ALL Students (No Limit)
  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc")); 
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const studentsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setStudents(studentsList);
      setLoading(false);
    });
    return () => unsubscribe(); 
  }, []);

  // 2. Filter Logic for Search
  const filteredStudents = students.filter(student => 
    student.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderStudent = ({ item }: any) => (
    <View style={styles.studentWrapper}>
        <TouchableOpacity 
            style={styles.studentRow}
            onPress={() => router.push({
                pathname: '/user-detail',
                params: { id: item.id }
            })}
        >
            <View style={styles.studentIcon}>
                <Ionicons name="person" size={18} color="#FFF" />
            </View>
            <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{item.displayName || "No Name"}</Text>
                <Text style={styles.studentClass}>{item.department || "No Dept"}</Text>
            </View>
            <View style={[styles.statusBadge, {backgroundColor: item.status === 'Blocked' ? 'rgba(244, 67, 54, 0.2)' : 'rgba(76, 175, 80, 0.2)'}]}>
                <Text style={[styles.statusText, {color: item.status === 'Blocked' ? '#F44336' : '#4CAF50'}]}>
                    {item.status || 'Active'}
                </Text>
            </View>
        </TouchableOpacity>
        <View style={styles.divider} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All Registered Students</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#CCC" style={{ marginRight: 10 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, email, or class..."
          placeholderTextColor="#AAA"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#AAA" />
            </TouchableOpacity>
        )}
      </View>

      {/* Student List */}
      <FlatList
        data={filteredStudents}
        keyExtractor={item => item.id}
        renderItem={renderStudent}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !loading ? (
            <View style={{alignItems: 'center', marginTop: 50}}>
                <Ionicons name="people-outline" size={50} color="rgba(255,255,255,0.2)" />
                <Text style={{color: '#AAA', marginTop: 10}}>No students found.</Text>
            </View>
          ) : null
        }
      />

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
  
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 20, borderRadius: 12, paddingHorizontal: 15, height: 50, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  searchInput: { flex: 1, color: '#FFF', fontSize: 16 },

  // Exact Copy of Dashboard List Styles
  listContent: { paddingBottom: 20 },
  studentWrapper: { marginHorizontal: 20, marginBottom: 0 },
  studentRow: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16 },
  studentIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  studentInfo: { flex: 1 },
  studentName: { color: '#FFF', fontSize: 14, fontWeight: '500' },
  studentClass: { color: '#AAA', fontSize: 12 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  divider: { height: 10 },
  
  loaderContainer: { position: 'absolute', bottom: 20, width: '100%', alignItems: 'center' }
});