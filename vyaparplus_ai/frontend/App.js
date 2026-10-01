import React, { useState } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import DashboardScreen from './src/screens/DashboardScreen';
import TransactionListScreen from './src/screens/TransactionListScreen';
import NewTransactionScreen from './src/screens/NewTransactionScreen';
import PaymentMessagesScreen from './src/screens/PaymentMessagesScreen';

const TABS = {
  Dashboard: DashboardScreen,
  Transactions: TransactionListScreen,
  'New Sale': NewTransactionScreen,
  Payments: PaymentMessagesScreen,
};

export default function App() {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const ActiveScreen = TABS[activeTab];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.tabBar}>
        {Object.keys(TABS).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.content}>
        <ActiveScreen />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ddd' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#2e7d32' },
  tabText: { color: '#888', fontSize: 12 },
  activeTabText: { color: '#2e7d32', fontWeight: 'bold' },
  content: { flex: 1, padding: 16 },
});
