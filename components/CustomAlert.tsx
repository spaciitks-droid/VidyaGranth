// components/CustomAlert.tsx
import React from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface CustomAlertProps {
  visible: boolean;
  // ADDED 'destructive' to the allowed types
  type: 'success' | 'error' | 'warning' | 'confirm' | 'destructive';
  title: string;
  message: string;
  onClose: () => void;
  onConfirm?: () => void;
  confirmText?: string;
}

export default function CustomAlert({ 
  visible, type, title, message, onClose, onConfirm, confirmText = "Confirm" 
}: CustomAlertProps) {

  // Configuration for Icon, Color, and Button Style
  const getIcon = () => {
    switch (type) {
      case 'success': return { name: 'checkmark-circle', color: '#4CAF50' }; // Green
      case 'error': return { name: 'close-circle', color: '#F44336' };    // Red
      case 'warning': return { name: 'alert-circle', color: '#FFD54F' };  // Gold
      case 'confirm': return { name: 'help-circle', color: '#2196F3' };   // Blue
      // ADDED Destructive case (Red Question)
      case 'destructive': return { name: 'help-circle', color: '#F44336' }; // Red
      default: return { name: 'information-circle', color: '#FFF' };
    }
  };

  const iconData = getIcon();

  // Helper: Both 'confirm' and 'destructive' need two buttons
  const isTwoButton = type === 'confirm' || type === 'destructive';

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Glass Container */}
        <View style={styles.alertBox}>
            
            {/* Top Icon Badge */}
            <View style={[styles.iconCircle, { backgroundColor: `${iconData.color}20`, borderColor: iconData.color }]}>
                <Ionicons name={iconData.name as any} size={32} color={iconData.color} />
            </View>

            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>

            {/* Buttons Row */}
            <View style={styles.btnRow}>
                {isTwoButton ? (
                    <>
                        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            style={[styles.confirmBtn, { backgroundColor: iconData.color }]} 
                            onPress={onConfirm}
                        >
                            {/* Smart text color: Dark text if background is Gold, White otherwise */}
                            <Text style={[styles.confirmText, { color: iconData.color === '#FFD54F' ? '#2E0249' : '#FFF' }]}>
                                {confirmText}
                            </Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    // Single OK Button for alerts
                    <TouchableOpacity 
                        style={[styles.confirmBtn, { width: '100%', backgroundColor: iconData.color }]} 
                        onPress={onClose}
                    >
                         <Text style={[styles.confirmText, { color: iconData.color === '#FFD54F' ? '#2E0249' : '#FFF' }]}>
                            {type === 'error' ? 'Try Again' : 'Okay'}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)', // Deep dark overlay for focus
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertBox: {
    width: width * 0.85,
    backgroundColor: '#1E1E1E', // Solid Dark Grey
    borderRadius: 24,
    padding: 25,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1, // Added border for "glow" effect
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#AAA',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 20,
  },
  btnRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    gap: 15,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cancelText: {
    color: '#AAA',
    fontWeight: 'bold',
    fontSize: 14,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
});