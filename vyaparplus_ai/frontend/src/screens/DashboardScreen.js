import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { api } from '../api';

export default function DashboardScreen() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.todaySummary();
      setSummary(data);
    } catch (e) {
      console.warn('Failed to load summary', e);
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} />;

  return (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Today's Summary</Text>
      {summary && (
        <View style={styles.grid}>
          <Card label="Total Sales" value={`\u20b9${summary.total_amount}`} />
          <Card label="Transactions" value={summary.total_transactions} />
          <Card
            label="Paid"
            value={`\u20b9${summary.paid_amount} (${summary.paid_transactions})`}
          />
          <Card
            label="Pending"
            value={`\u20b9${summary.pending_amount} (${summary.pending_transactions})`}
          />
        </View>
      )}
    </ScrollView>
  );
}

function Card({ label, value }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardValue}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: {
    width: '48%',
    backgroundColor: '#f2f2f2',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  cardValue: { fontSize: 20, fontWeight: 'bold' },
  cardLabel: { color: '#666', marginTop: 4 },
});
