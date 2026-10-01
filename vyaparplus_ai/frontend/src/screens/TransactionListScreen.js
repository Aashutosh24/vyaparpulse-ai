import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { api } from '../api';

export default function TransactionListScreen() {
  const [transactions, setTransactions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await api.listTransactions();
    setTransactions(data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <FlatList
      data={transactions}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.item}>
              {item.item || 'Unspecified item'} {item.quantity ? `x${item.quantity}` : ''}
            </Text>
            <Text style={styles.meta}>
              {item.customer_name || 'Walk-in'} · {new Date(item.timestamp).toLocaleTimeString()}
            </Text>
          </View>
          <Text style={styles.amount}>₹{item.amount}</Text>
          <Text style={[styles.status, item.status === 'PAID' ? styles.paid : styles.pending]}>
            {item.status}
          </Text>
        </View>
      )}
      ListEmptyComponent={
        <Text style={{ textAlign: 'center', marginTop: 24 }}>No transactions yet.</Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  item: { fontSize: 15 },
  meta: { fontSize: 12, color: '#888' },
  amount: { marginHorizontal: 10, fontWeight: 'bold' },
  status: {
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  paid: { backgroundColor: '#c8e6c9', color: '#2e7d32' },
  pending: { backgroundColor: '#ffe0b2', color: '#e65100' },
});
