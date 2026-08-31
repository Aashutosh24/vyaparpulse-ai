import type { Customer, ParsedSale, PaymentEvent, Transaction, TrendPoint } from '../types';

/**
 * PROTOTYPE DATA — the only hand-written numbers in the app.
 *
 * Everything a screen displays as an aggregate (today's totals, week revenue,
 * collection rate, Business Health, insights, forecast, customer balances) is
 * DERIVED from the ledger below by utils/metrics.ts, so no two screens can
 * disagree. There is no backend and no real UPI feed: payment events are
 * either seeded here or generated in-app by an explicitly simulated action.
 */

export const store = {
  name: 'Raj General Store',
  ownerFirstName: 'Raj',
  greeting: 'Good evening',
  location: 'Sector 4, Karnal',
  activeSince: '6 months',
  activeMonths: 6
};

/** Recorded business before the visible ledger window. */
export const history = {
  /** The six days before today, as already recorded. */
  priorDays: [
  { label: 'Mon', value: 9200 },
  { label: 'Tue', value: 10400 },
  { label: 'Wed', value: 8600 },
  { label: 'Thu', value: 13100 },
  { label: 'Fri', value: 15800 },
  { label: 'Sat', value: 14680 }] as
  TrendPoint[],
  todayLabel: 'Sun',
  lastWeekRevenue: 71600,
  priorWeekTransactions: 124,
  /** Business Health as it stood at the end of last week. */
  previousHealthScore: 75,
  earlierWeeks: [
  { label: 'W1', value: 61200 },
  { label: 'W2', value: 68400 },
  { label: 'W3', value: 71600 }] as
  TrendPoint[],
  earlierMonths: [
  { label: 'Apr', value: 214000 },
  { label: 'May', value: 238000 },
  { label: 'Jun', value: 262000 }] as
  TrendPoint[],
  monthToDateBeforeThisWeek: 216000,
  currentMonthLabel: 'Jul'
};

/** Plain-language data sources — no model names, no jargon. */
export const dataSources = [
'Every sale you record here, going back 6 months',
'UPI and cash payments matched against those sales',
'How many days your customers take to pay you',
'Nothing from outside your shop, unless you connect it with consent'];


export const topProducts = [
{ name: 'Rice bag (5kg)', units: 42, revenue: 21000 },
{ name: 'Cooking oil (1L)', units: 36, revenue: 6480 },
{ name: 'Notebook', units: 120, revenue: 6000 },
{ name: 'Tea packet', units: 58, revenue: 4060 },
{ name: 'Detergent', units: 24, revenue: 2880 }];


export const customers: Customer[] = [
{
  id: 'c1',
  name: 'Rahul Sharma',
  initials: 'RS',
  phone: '+91 98••• ••210',
  since: 'Jan 2026',
  priorPurchases: 46280,
  priorTransactions: 10
},
{
  id: 'c2',
  name: 'Anita Stores',
  initials: 'AS',
  phone: '+91 99••• ••884',
  since: 'Feb 2026',
  priorPurchases: 17750,
  priorTransactions: 8
},
{
  id: 'c3',
  name: 'Vikram Kumar',
  initials: 'VK',
  phone: '+91 97••• ••045',
  since: 'Dec 2025',
  priorPurchases: 29280,
  priorTransactions: 13
},
{
  id: 'c4',
  name: 'Priya Traders',
  initials: 'PT',
  phone: '+91 90••• ••377',
  since: 'Nov 2025',
  priorPurchases: 57600,
  priorTransactions: 20
},
{
  id: 'c5',
  name: 'Suresh Kirana',
  initials: 'SK',
  phone: '+91 96••• ••512',
  since: 'Mar 2026',
  priorPurchases: 9000,
  priorTransactions: 6
},
{
  id: 'c6',
  name: 'Meena Devi',
  initials: 'MD',
  phone: '+91 88••• ••129',
  since: 'Jan 2026',
  priorPurchases: 13130,
  priorTransactions: 10
},
{
  id: 'c7',
  name: 'Ravi Yadav',
  initials: 'RY',
  phone: '+91 87••• ••604',
  since: 'Dec 2025',
  priorPurchases: 21130,
  priorTransactions: 12
}];


export const transactions: Transaction[] = [
{
  id: 't1',
  ref: '#1042',
  customerId: 'c1',
  name: 'Rahul Sharma',
  initials: 'RS',
  items: [{ name: 'Notebook', qty: 10, unitPrice: 120 }],
  amount: 1200,
  receivedAmount: 1200,
  time: '7:42 PM',
  dayLabel: 'Today',
  status: 'paid',
  method: 'upi'
},
{
  id: 't2',
  ref: '#1041',
  customerId: 'unassigned',
  name: 'Unknown UPI',
  initials: '??',
  items: [{ name: 'Rice bag (5kg)', qty: 3, unitPrice: 500 }],
  amount: 1500,
  receivedAmount: 1500,
  time: '6:42 PM',
  dayLabel: 'Today',
  status: 'needsReview',
  method: 'upi'
},
{
  id: 't3',
  ref: '#1040',
  customerId: 'c2',
  name: 'Anita Stores',
  initials: 'AS',
  items: [{ name: 'Cooking oil (1L)', qty: 5, unitPrice: 170 }],
  amount: 850,
  receivedAmount: 0,
  time: '6:18 PM',
  dayLabel: 'Today',
  status: 'pending',
  method: 'credit'
},
{
  id: 't4',
  ref: '#1039',
  customerId: 'c3',
  name: 'Vikram Kumar',
  initials: 'VK',
  items: [
  { name: 'Rice bag (5kg)', qty: 4, unitPrice: 500 },
  { name: 'Detergent', qty: 2, unitPrice: 200 }],

  amount: 2400,
  receivedAmount: 1500,
  time: '4:52 PM',
  dayLabel: 'Today',
  status: 'partial',
  method: 'upi'
},
{
  id: 't5',
  ref: '#1038',
  customerId: 'c4',
  name: 'Priya Traders',
  initials: 'PT',
  items: [{ name: 'Rice bag (5kg)', qty: 6, unitPrice: 600 }],
  amount: 3600,
  receivedAmount: 3600,
  time: '2:10 PM',
  dayLabel: 'Today',
  status: 'paid',
  method: 'upi'
},
{
  id: 't6',
  ref: '#1037',
  customerId: 'c5',
  name: 'Suresh Kirana',
  initials: 'SK',
  items: [
  { name: 'Tea packet', qty: 5, unitPrice: 70 },
  { name: 'Notebook', qty: 2, unitPrice: 50 }],

  amount: 450,
  receivedAmount: 450,
  time: '12:30 PM',
  dayLabel: 'Today',
  status: 'paid',
  method: 'cash'
},
{
  id: 't9',
  ref: '#1034',
  customerId: 'c6',
  name: 'Meena Devi',
  initials: 'MD',
  items: [
  { name: 'Sugar (1kg)', qty: 10, unitPrice: 48 },
  { name: 'Tea packet', qty: 6, unitPrice: 115 }],

  amount: 1170,
  receivedAmount: 1170,
  time: '11:15 AM',
  dayLabel: 'Today',
  status: 'paid',
  method: 'cash'
},
{
  id: 't10',
  ref: '#1033',
  customerId: 'c7',
  name: 'Ravi Yadav',
  initials: 'RY',
  items: [{ name: 'Rice bag (5kg)', qty: 2, unitPrice: 835 }],
  amount: 1670,
  receivedAmount: 0,
  time: '10:05 AM',
  dayLabel: 'Today',
  status: 'pending',
  method: 'credit'
},
{
  id: 't7',
  ref: '#1036',
  customerId: 'c1',
  name: 'Rahul Sharma',
  initials: 'RS',
  items: [{ name: 'Cooking oil (1L)', qty: 4, unitPrice: 180 }],
  amount: 720,
  receivedAmount: 720,
  time: '8:05 PM',
  dayLabel: 'Yesterday',
  status: 'paid',
  method: 'upi'
},
{
  id: 't8',
  ref: '#1035',
  customerId: 'c3',
  name: 'Vikram Kumar',
  initials: 'VK',
  items: [{ name: 'Detergent', qty: 3, unitPrice: 240 }],
  amount: 720,
  receivedAmount: 0,
  time: '5:40 PM',
  dayLabel: 'Yesterday',
  status: 'pending',
  method: 'credit'
}];


export const paymentEvents: PaymentEvent[] = [
{
  id: 'p1',
  amount: 1200,
  senderName: 'Rahul Sharma',
  handle: 'rahul.sharma@upi',
  time: '7:42 PM',
  state: 'matched',
  matchedRef: '#1042'
},
{
  id: 'p2',
  amount: 1500,
  senderName: 'Unknown UPI',
  handle: 'r.stores9@upi',
  time: '6:42 PM',
  state: 'needsReview',
  candidates: [
  {
    txnId: 't2',
    name: 'Rahul Sharma',
    amount: 1500,
    time: 'Today 6:42 PM',
    reason: 'Exact amount, recorded at the same minute the payment arrived'
  },
  {
    txnId: 't2b',
    name: 'Rahul Stores',
    amount: 1450,
    time: 'Today 6:38 PM',
    reason: 'Similar name on the UPI handle, but ₹50 less than the payment'
  }]

},
{
  id: 'p3',
  amount: 3600,
  senderName: 'Priya Traders',
  handle: 'priyatraders@upi',
  time: '2:10 PM',
  state: 'matched',
  matchedRef: '#1038'
},
{
  id: 'p4',
  amount: 450,
  senderName: 'Suresh Kirana',
  handle: 'Cash',
  time: '12:30 PM',
  state: 'matched',
  matchedRef: '#1037'
}];


export const sampleParsedSale: ParsedSale = {
  transcript: 'Sold 10 notebooks to Rahul for 1200 rupees',
  items: [{ name: 'Notebook', qty: 10, unitPrice: 120 }],
  total: 1200,
  customerName: 'Rahul Sharma',
  customerAmbiguous: true,
  customerOptions: ['Rahul Sharma', 'Rahul Stores'],
  confidence: 'high'
};

export const quickItems = [
{ name: 'Rice bag (5kg)', price: 500 },
{ name: 'Cooking oil (1L)', price: 180 },
{ name: 'Notebook', price: 120 },
{ name: 'Tea packet', price: 70 },
{ name: 'Detergent', price: 240 },
{ name: 'Sugar (1kg)', price: 48 }];


export const recordSaleHint = 'Just say “Sold 10 notebooks to Rahul for 1200 rupees”';