import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { api } from '../api';

export default function PaymentMessagesScreen() {
  const [messages, setMessages] = useState([]);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    const data = await api.listPaymentMessages();
    setMessages(data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runMatching = async () => {
    setRunning(true);
    try {
      const results = await api.runMatching();
      const matched = results.filter((r) => r.matched).length;
      Alert.alert('Matching complete', `${matched} of ${results.length} matched.`);
      await load();
    } catch (e) {
      Alert.alert('Matching failed', e.message);
    } finally {
      setRunning(false);
    }
  };

  const loadMock = async () => {
    await api.loadMockPayments();
    await load();
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.button} onPress={runMatching} disabled={running}>
          <Text style={styles.buttonText}>
            {running ? 'Matching...' : 'Run Payment Verification'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.secondary]} onPress={loadMock}>
          <Text style={styles.buttonText}>Load Mock SMS</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.type}>
              {item.type}
              {item.amount ? ` · ₹${item.amount}` : ''}
            </Text>
            <Text style={styles.body}>{item.raw_sms}</Text>
            <Text style={styles.matchStatus}>
              {item.matched_transaction_id
                ? `Matched -> ${item.matched_transaction_id}`
                : 'Not matched'}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', marginTop: 24 }}>
            No payment messages yet. Try "Load Mock SMS".
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', marginBottom: 12 },
  button: {
    flex: 1,
    backgroundColor: '#2e7d32',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginRight: 8,
  },
  secondary: { backgroundColor: '#607d8b', marginRight: 0 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  row: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  type: { fontWeight: 'bold' },
  body: { color: '#555', marginTop: 2 },
  matchStatus: { fontSize: 12, color: '#888', marginTop: 4 },
});
