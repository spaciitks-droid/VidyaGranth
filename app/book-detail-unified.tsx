// app/book-detail-unified.tsx
import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, Text, View, ImageBackground, TouchableOpacity, 
  ScrollView, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { 
  doc, getDoc, addDoc, collection, serverTimestamp, 
  query, where, onSnapshot 
} from 'firebase/firestore'; 
import { db, auth } from '../firebaseConfig'; 
import CustomAlert from '../components/CustomAlert';

export default function BookDetailUnified() {
  const router = useRouter();
  const { bookId, requestId } = useLocalSearchParams(); 

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  
  const [userStatus, setUserStatus] = useState<string | null>(null); 
  const [activeLoanId, setActiveLoanId] = useState<string | null>(null); 
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  
  // FIX 1: New state to track if ANY request (Issue or Reissue) is pending
  const [hasPending, setHasPending] = useState(false);
  
  const [alertConfig, setAlertConfig] = useState({ 
    visible: false, type: 'confirm' as any, title: '', msg: '', onConfirm: () => {} 
  });

  // --- 1. DATA FETCHING LOGIC ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        let finalBookId = bookId as string;
        let loanData: any = null;

        // SCENARIO A: Coming from "My Books" (Direct Loan ID)
        if (requestId) {
          const loanSnap = await getDoc(doc(db, "issueRequests", requestId as string));
          if (loanSnap.exists()) {
            loanData = loanSnap.data();
            finalBookId = loanData.bookId;
            setUserStatus(loanData.status);
            setActiveLoanId(requestId as string);
            
            // If the specific request clicked is Pending, set flag
            if (loanData.status === 'Pending') setHasPending(true);

            if (loanData.returnDate) {
               const due = loanData.returnDate.toDate ? loanData.returnDate.toDate() : new Date(loanData.returnDate);
               const now = new Date();
               setDaysLeft(Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
            }
          }
        }

        // SCENARIO B: Get Book Details
        if (finalBookId) {
          const bookSnap = await getDoc(doc(db, "books", finalBookId));
          if (bookSnap.exists()) {
             const bookDetails = bookSnap.data();
             setData({
                 id: finalBookId,
                 ...bookDetails,
                 ...loanData, 
                 title: bookDetails.title,
                 author: bookDetails.author,
                 category: bookDetails.category,
                 qty: bookDetails.qty
             });
          }
        }

        // SCENARIO C: Real-time Status Check
        if (finalBookId && auth.currentUser) {
            const q = query(
                collection(db, "issueRequests"),
                where("studentId", "==", auth.currentUser.uid),
                where("bookId", "==", finalBookId)
            );
            
            const unsub = onSnapshot(q, (snapshot) => {
                let loanFound:any = null;
                let pendingFound = false;

                snapshot.docs.forEach(d => {
                    const s = d.data().status;
                    
                    // Check for Active Loan (Issued/Reissued)
                    if (s === 'Issued' || s === 'Reissued') {
                        loanFound = { id: d.id, ...d.data() };
                    }
                    
                    // FIX 2: Check for Pending separately (This detects Reissue requests)
                    if (s === 'Pending') {
                        pendingFound = true;
                    }
                });

                // Update States
                setHasPending(pendingFound);

                if (loanFound) {
                    // If we have an active loan, set status to Issued/Reissued so UI shows dates
                    setUserStatus(loanFound.status);
                    setActiveLoanId(loanFound.id);
                    
                    if (loanFound.returnDate) {
                        const rDate = loanFound.returnDate.toDate ? loanFound.returnDate.toDate() : new Date(loanFound.returnDate);
                        setDaysLeft(Math.ceil((rDate.getTime() - new Date().getTime()) / (86400000)));
                    }
                } else {
                    // If no active loan, userStatus is null (or Pending if we found a pending doc but no active loan)
                    setUserStatus(pendingFound ? 'Pending' : null);
                }
            });
            return () => unsub(); 
        }

      } catch (e) {
        console.error("Error fetching data:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [bookId, requestId]);

  // --- HELPER: Logic for Ownership ---
  const isOwned = userStatus === 'Issued' || userStatus === 'Reissued';

  // --- 2. ACTION HANDLERS ---
  const handleMainAction = () => {
    // 1. Issue Request (New)
    if (!userStatus && !hasPending) {
        if (data?.qty <= 0) return; 
        
        setAlertConfig({
            visible: true, type: 'confirm', title: 'Request Issue',
            msg: `Do you want to borrow "${data.title}"?`,
            onConfirm: async () => {
                setAlertConfig(p => ({...p, visible: false}));
                setRequesting(true);
                try {
                    await addDoc(collection(db, "issueRequests"), {
                        bookId: data.id,
                        bookTitle: data.title,
                        studentId: auth.currentUser?.uid,
                        studentEmail: auth.currentUser?.email,
                        studentName: auth.currentUser?.email?.split('@')[0],
                        requestDate: serverTimestamp(),
                        status: 'Pending',
                        type: 'Issue'
                    });
                } catch(e) { alert("Error sending request"); } 
                finally { setRequesting(false); }
            }
        });
    }
    // 2. Reissue Request (Extension)
    else if (isOwned && !hasPending) {
        if (daysLeft !== null && daysLeft > 7) {
             setAlertConfig({ visible: true, type: 'warning', title: 'Too Early', msg: `You can only reissue in the last 7 days.\nTime remaining: ${daysLeft} days`, onConfirm: () => setAlertConfig(p=>({...p, visible:false}))});
             return;
        }
        if (daysLeft !== null && daysLeft < 0) {
             setAlertConfig({ visible: true, type: 'error', title: 'Overdue', msg: `Book is overdue. Please return it personally.`, onConfirm: () => setAlertConfig(p=>({...p, visible:false}))});
             return;
        }

        setAlertConfig({
            visible: true, type: 'confirm', title: 'Request Reissue',
            msg: `Request 14-day extension for "${data.title}"?`,
            onConfirm: async () => {
                setAlertConfig(p => ({...p, visible: false}));
                setRequesting(true);
                try {
                    await addDoc(collection(db, "issueRequests"), {
                        bookId: data.id,
                        bookTitle: data.title,
                        studentId: auth.currentUser?.uid,
                        studentName: auth.currentUser?.email?.split('@')[0],
                        requestDate: serverTimestamp(),
                        status: 'Pending',
                        type: 'Reissue',
                        originalRequestId: activeLoanId 
                    });
                    // FIX 3: Manually set pending to true immediately for instant feedback
                    setHasPending(true); 
                } catch(e) { alert("Error requesting reissue"); }
                finally { setRequesting(false); }
            }
        });
    }
  };

  // --- 3. LOGIC FOR BUTTON STATE ---
  const getButtonState = () => {
      // FIX 4: Check 'hasPending' first. This catches both new requests AND reissue requests.
      if (hasPending) {
          return { 
              text: 'Request Pending...', 
              color: 'rgba(255, 255, 255, 0.1)', 
              textColor: '#AAA', 
              icon: 'hourglass', 
              disabled: true 
          };
      }
      
      // Already Owned (Issued / Reissued)
      if (isOwned) {
          const isEligibleForReissue = daysLeft !== null && daysLeft <= 7;
          
          if (!isEligibleForReissue) {
             const waitDays = daysLeft ? daysLeft - 7 : 0;
             return {
                 text: `Reissue in ${waitDays} Days`,
                 color: 'rgba(255, 255, 255, 0.1)', 
                 textColor: '#AAA',
                 icon: 'lock-closed',
                 disabled: true
             };
          }
          return { 
              text: 'Request Reissue', 
              color: '#FFD54F', 
              textColor: '#2E0249', 
              icon: 'refresh', 
              disabled: false 
          };
      }

      // Out of Stock
      if (data?.qty <= 0) {
          return { 
              text: 'Unavailable', 
              color: 'rgba(255, 255, 255, 0.05)', 
              textColor: '#555', 
              icon: 'close-circle', 
              disabled: true 
          };
      }

      // Default: Available
      return { 
          text: 'Request Issue', 
          color: '#FFD54F', 
          textColor: '#2E0249', 
          icon: 'arrow-forward', 
          disabled: false 
      };
  };

  const isOverdue = daysLeft !== null && daysLeft < 0;
  const isUrgent = daysLeft !== null && daysLeft <= 7; 
  
  const getStatusUI = () => {
      if (isOwned) {
          if (isOverdue) return { color: '#F44336', bg: 'rgba(244, 67, 54, 0.1)', text: 'Overdue', icon: 'alert-circle' };
          return { color: '#4CAF50', bg: 'rgba(76, 175, 80, 0.1)', text: userStatus, icon: 'checkmark-circle' };
      }
      if (hasPending) return { color: '#FFD54F', bg: 'rgba(255, 213, 79, 0.1)', text: 'Pending Approval', icon: 'time' };
      if (data?.qty > 0) return { color: '#4CAF50', bg: 'rgba(76, 175, 80, 0.1)', text: 'Available', icon: 'cube' };
      return { color: '#F44336', bg: 'rgba(244, 67, 54, 0.1)', text: 'Out of Stock', icon: 'close-circle' };
  };

  if (loading || !data) {
    return (
      <View style={[styles.container, {justifyContent:'center', alignItems:'center', backgroundColor:'#000'}]}>
        <ActivityIndicator size="large" color="#FFD54F" />
      </View>
    );
  }

  const statusUI = getStatusUI();
  const btnState = getButtonState();

  return (
    <ImageBackground source={require('../assets/images/library_bg.jpg')} style={styles.bg}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Book Details</Text>
            <View style={{width: 40}} /> 
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            
            <View style={styles.heroCard}>
               <Ionicons name="book" size={80} color="#FFD54F" />
            </View>

            <View style={styles.detailsCard}>
               
               <View style={{marginBottom: 15}}>
                   <View style={styles.statusPillContainer}>
                       <View style={styles.categoryBadge}>
                           <Text style={styles.categoryText}>{data.category}</Text>
                       </View>
                       
                       <View style={[styles.statusBadge, { backgroundColor: statusUI.bg }]}>
                           <Ionicons name={statusUI.icon as any} size={14} color={statusUI.color} style={{marginRight: 6}} />
                           <Text style={[styles.statusText, { color: statusUI.color }]}>{statusUI.text}</Text>
                       </View>
                   </View>

                   <Text style={styles.title}>{data.title}</Text>
                   <Text style={styles.author}>by {data.author}</Text>
               </View>

               <View style={styles.divider} />

               {isOwned && data.issuedAt ? (
                   <View style={styles.gridContainer}>
                       <View style={styles.infoCard}>
                           <View style={styles.iconCircle}>
                               <Ionicons name="calendar-outline" size={18} color="#AAA" />
                           </View>
                           <View>
                               <Text style={styles.cardLabel}>ISSUED ON</Text>
                               <Text style={styles.cardValue}>
                                   {data.issuedAt?.toDate ? data.issuedAt.toDate().toLocaleDateString() : new Date(data.issuedAt).toLocaleDateString()}
                               </Text>
                           </View>
                       </View>

                       <View style={[styles.infoCard, isUrgent && { borderColor: 'rgba(244, 67, 54, 0.3)', backgroundColor: 'rgba(244, 67, 54, 0.05)' }]}>
                           <View style={[styles.iconCircle, isUrgent && { backgroundColor: 'rgba(244, 67, 54, 0.2)' }]}>
                               <Ionicons name="timer-outline" size={18} color={isUrgent ? "#F44336" : "#4CAF50"} />
                           </View>
                           <View>
                               <Text style={[styles.cardLabel, isUrgent && { color: '#F44336' }]}>
                                   {isOverdue ? "OVERDUE" : "DUE IN"}
                               </Text>
                               <Text style={[styles.cardValue, isUrgent ? { color: '#F44336' } : { color: '#4CAF50' }]}>
                                   {Math.abs(daysLeft || 0)} Days
                               </Text>
                           </View>
                       </View>
                   </View>
               ) : (
                   <View style={styles.stockContainer}>
                       <Ionicons name="library-outline" size={24} color="#FFD54F" />
                       <View style={{marginLeft: 15}}>
                           <Text style={styles.cardLabel}>LIBRARY STOCK</Text>
                           <Text style={styles.stockValue}>{data.qty} Copies Available</Text>
                       </View>
                   </View>
               )}

            </View>

          </ScrollView>

          <View style={styles.footer}>
             <TouchableOpacity 
                style={[
                    styles.actionBtn, 
                    { backgroundColor: btnState.color },
                    (btnState.disabled || requesting) && { opacity: 0.7 } 
                ]}
                onPress={handleMainAction}
                disabled={btnState.disabled || requesting}
                activeOpacity={0.8}
             >
                 {requesting ? (
                    <ActivityIndicator color="#2E0249" />
                 ) : (
                    <>
                        <Text style={[styles.btnText, { color: btnState.textColor }]}>
                            {btnState.text}
                        </Text>
                        <Ionicons name={btnState.icon as any} size={20} color={btnState.textColor} style={{marginLeft: 10}} />
                    </>
                 )}
             </TouchableOpacity>
          </View>

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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  scrollContent: { padding: 20 },
  
  heroCard: { 
    height: 140, backgroundColor: 'rgba(255,255,255,0.05)', 
    borderRadius: 24, justifyContent: 'center', alignItems: 'center',
    marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
  },
  
  detailsCard: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 24, padding: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
  },
  
  statusPillContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  categoryBadge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  categoryText: { color: '#AAA', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
  
  title: { color: '#FFF', fontSize: 22, fontWeight: 'bold', lineHeight: 30, marginBottom: 4 },
  author: { color: '#AAA', fontSize: 16, fontStyle: 'italic' },
  
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 20 },

  gridContainer: { flexDirection: 'row', gap: 12 },
  infoCard: { 
    flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 16, padding: 15,
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)'
  },
  iconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardLabel: { color: '#888', fontSize: 10, fontWeight: 'bold', marginBottom: 2 },
  cardValue: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },

  stockContainer: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 213, 79, 0.05)', 
    padding: 20, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255, 213, 79, 0.1)' 
  },
  stockValue: { color: '#FFD54F', fontSize: 16, fontWeight: 'bold' },
  
  footer: { 
    padding: 20, backgroundColor: 'rgba(0,0,0,0.5)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' 
  },
  actionBtn: { 
    borderRadius: 16, height: 60, 
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center' 
  },
  btnText: { fontSize: 18, fontWeight: 'bold' }
});