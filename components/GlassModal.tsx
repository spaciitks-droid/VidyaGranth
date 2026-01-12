// components/GlassModal.tsx
import React from 'react';
import { 
  Modal, View, Text, TouchableOpacity, StyleSheet, 
  KeyboardAvoidingView, Platform, ScrollView 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface GlassModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export default function GlassModal({ visible, onClose, title, children }: GlassModalProps) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* KeyboardAvoidingView ensures inputs don't get hidden by keyboard */}
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"} 
          style={styles.keyboardWrapper}
        >
            <View style={styles.container}>
                
                {/* Modal Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>{title || ""}</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Ionicons name="close" size={20} color="#FFF" />
                    </TouchableOpacity>
                </View>

                {/* Modal Content */}
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {children}
                </ScrollView>
                
            </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)', // Deep dark overlay
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  keyboardWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  container: {
    width: '100%',
    maxHeight: '80%', // Prevents it from being too tall
    backgroundColor: '#1E1E1E',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)'
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    letterSpacing: 0.5
  },
  closeBtn: {
    padding: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 15,
  },
  content: {
    paddingBottom: 10
  }
});