import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { api } from '../api';

export default function NewTransactionScreen() {
  const [item, setItem] = useState('');
  const [quantity, setQuantity] = useState('');
  const [amount, setAmount] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!amount) {
      Alert.alert('Amount is required');
      return;
    }
    setSubmitting(true);
    try {
      await api.createTransaction({
        item: item || null,
        quantity: quantity ? parseInt(quantity, 10) : null,
        amount: parseFloat(amount),
        customer_name: customerName || null,
      });
      setItem('');
      setQuantity('');
      setAmount('');
      setCustomerName('');
      Alert.alert('Transaction created (PENDING)');
    } catch (e) {
      Alert.alert('Failed to create transaction', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View>
      <Text style={styles.label}>Item (optional)</Text>
      <TextInput style={styles.input} value={item} onChangeText={setItem} placeholder="e.g. Tea" />

      <Text style={styles.label}>Quantity (optional)</Text>
      <TextInput
        style={styles.input}
        value={quantity}
        onChangeText={setQuantity}
        keyboardType="numeric"
        placeholder="e.g. 2"
      />

      <Text style={styles.label}>Amount</Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        placeholder="e.g. 50"
      />

      <Text style={styles.label}>Customer name (optional)</Text>
      <TextInput
        style={styles.input}
        value={customerName}
        onChangeText={setCustomerName}
        placeholder="e.g. Ramesh"
      />

      <TouchableOpacity style={styles.button} onPress={submit} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? 'Saving...' : 'Create Transaction'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: 12, marginBottom: 4, color: '#444' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 10 },
  button: {
    marginTop: 20,
    backgroundColor: '#2e7d32',
    padding: 14,
    borderRadius: 6,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: 'bold' },
});
