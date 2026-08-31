# VyaparPulse Flutter Frontend — Codebase Snapshot

> Generated from `vyaparpulse-flutter-frontend.zip` for use as a text-readable project context/reference in tools that do not accept ZIP uploads.

## Purpose

This Markdown contains the relevant textual source/configuration from the Flutter mobile application. It is a codebase snapshot, not a replacement for the original ZIP. Binary launcher/icon assets are intentionally omitted.

## Project Tree

```text
lib/data/mock_data.dart
lib/main.dart
lib/models/customer.dart
lib/models/misc_models.dart
lib/models/transaction.dart
lib/screens/customers_screen.dart
lib/screens/home_screen.dart
lib/screens/insights_screen.dart
lib/screens/ledger_screen.dart
lib/screens/main_shell.dart
lib/screens/payment_review_screen.dart
lib/screens/record_sale_screen.dart
lib/theme/app_colors.dart
lib/theme/app_text_styles.dart
lib/theme/app_theme.dart
lib/utils/currency_formatter.dart
lib/widgets/app_card.dart
lib/widgets/bottom_nav.dart
lib/widgets/cash_flow_bars.dart
lib/widgets/credit_score_bar.dart
lib/widgets/custom_button.dart
lib/widgets/metric_card.dart
lib/widgets/revenue_trend_chart.dart
lib/widgets/section_header.dart
lib/widgets/status_badge.dart
lib/widgets/transaction_tile.dart
lib/widgets/vyapar_app_bar.dart
README.md
pubspec.yaml
analysis_options.yaml
android/app/build.gradle
android/app/src/main/AndroidManifest.xml
android/app/src/main/kotlin/com/vyaparpulse/app/MainActivity.kt
android/app/src/main/res/drawable/launch_background.xml
android/app/src/main/res/values-night/styles.xml
android/app/src/main/res/values/styles.xml
android/build.gradle
android/gradle.properties
android/gradle/wrapper/gradle-wrapper.properties
android/settings.gradle
```

---

## `lib/data/mock_data.dart`

```dart
import '../models/customer.dart';
import '../models/misc_models.dart';
import '../models/transaction.dart';

/// Static, in-memory mock data. No backend / network / database —
/// this exists purely so the UI has realistic content to render.
class MockData {
  MockData._();

  // ---------------------------------------------------------------------
  // Home / store
  // ---------------------------------------------------------------------
  static const String storeName = 'Raj General Store';
  static const String ownerGreeting = 'Good evening, Raj';
  static const double todaysSales = 12840;
  static const double collectedPercent = 0.72;
  static const double receivedAmount = 9420;
  static const double pendingAmount = 3420;
  static const String recordSaleHint = 'Just say "Sold 10 notebooks to Rahul for 1200 rupees"';

  // ---------------------------------------------------------------------
  // Record a sale (voice) — example parsed into a draft sale
  // ---------------------------------------------------------------------
  static const String sampleTranscript = 'Sold 10 notebooks to Rahul for 1200 rupees';
  static const SaleDraft sampleSaleDraft = SaleDraft(
    customerName: 'Rahul',
    productName: 'Notebook',
    quantity: 10,
    total: 1200,
  );

  // ---------------------------------------------------------------------
  // Ledger / transactions
  // ---------------------------------------------------------------------
  static List<AppTransaction> buildTransactions() => [
        const AppTransaction(
          id: 't1',
          name: 'Rahul Sharma',
          amount: 1200,
          time: '7:42 PM',
          status: PaymentStatus.paid,
        ),
        const AppTransaction(
          id: 't2',
          name: 'Unknown UPI',
          amount: 1500,
          time: '6:42 PM',
          status: PaymentStatus.needsReview,
        ),
        const AppTransaction(
          id: 't3',
          name: 'Anita Stores',
          amount: 850,
          time: '6:18 PM',
          status: PaymentStatus.pending,
        ),
        const AppTransaction(
          id: 't4',
          name: 'Vikram Kumar',
          amount: 2400,
          dueAmount: 900,
          time: '4:52 PM',
          status: PaymentStatus.partial,
        ),
        const AppTransaction(
          id: 't5',
          name: 'Priya Traders',
          amount: 3600,
          time: '2:10 PM',
          status: PaymentStatus.paid,
        ),
        const AppTransaction(
          id: 't6',
          name: 'Suresh Kirana',
          amount: 450,
          time: '12:30 PM',
          status: PaymentStatus.paid,
        ),
      ];

  // ---------------------------------------------------------------------
  // Payment review (unmatched incoming payment)
  // ---------------------------------------------------------------------
  static const double unmatchedAmount = 1500;
  static const String unmatchedTime = '6:42 PM';
  static const List<MatchOption> matchOptions = [
    MatchOption(name: 'Rahul Sharma', time: 'Today 6:42 PM', amount: 1500),
    MatchOption(name: 'Rahul Stores', time: 'Today 6:38 PM', amount: 1450),
  ];

  // ---------------------------------------------------------------------
  // Customers (derived list, styled consistently with Ledger)
  // ---------------------------------------------------------------------
  static List<Customer> buildCustomers() => [
        const Customer(
          id: 'c1',
          name: 'Rahul Sharma',
          initials: 'RS',
          totalAmount: 1200,
          lastTransactionTime: 'Today · 7:42 PM',
          status: PaymentStatus.paid,
        ),
        const Customer(
          id: 'c2',
          name: 'Anita Stores',
          initials: 'AS',
          totalAmount: 850,
          lastTransactionTime: 'Today · 6:18 PM',
          status: PaymentStatus.pending,
        ),
        const Customer(
          id: 'c3',
          name: 'Vikram Kumar',
          initials: 'VK',
          totalAmount: 2400,
          dueAmount: 900,
          lastTransactionTime: 'Today · 4:52 PM',
          status: PaymentStatus.partial,
        ),
        const Customer(
          id: 'c4',
          name: 'Priya Traders',
          initials: 'PT',
          totalAmount: 3600,
          lastTransactionTime: 'Today · 2:10 PM',
          status: PaymentStatus.paid,
        ),
        const Customer(
          id: 'c5',
          name: 'Suresh Kirana',
          initials: 'SK',
          totalAmount: 450,
          lastTransactionTime: 'Today · 12:30 PM',
          status: PaymentStatus.paid,
        ),
      ];

  // ---------------------------------------------------------------------
  // Business insights
  // ---------------------------------------------------------------------
  static const double weekRevenue = 84620;
  static const double weekRevenueChangePercent = 18;
  static const double collectionRate = 0.78;
  static const double pendingCollection = 2200;
  static const int transactionCount = 6;
  static const String topProduct = 'Rice Bag';

  static const List<String> weekDayLabels = ['Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  static const List<double> revenueTrend = [38, 30, 46, 58, 70, 63, 84.6];

  static const List<String> cashFlowLabels = ['-3', '-2', '-1', 'Today', '+1', '+2', '+3'];
  static const List<double> cashFlowValues = [22, 30, 36, 44, 56, 65, 74];
  static const int cashFlowTodayIndex = 3;

  static const int creditScore = 746;
  static const int creditScoreMin = 300;
  static const int creditScoreMax = 900;
  static const String creditScoreHeadline = 'Strong business activity';

  static const List<CreditFactor> creditFactors = [
    CreditFactor(label: 'Payment consistency', value: 'Strong'),
    CreditFactor(label: 'Revenue growth', value: 'Positive'),
    CreditFactor(label: 'Collection discipline', value: 'Good'),
  ];
}
```

---

## `lib/main.dart`

```dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'screens/main_shell.dart';
import 'theme/app_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // Lock to portrait — this is a mobile-only, portrait-optimized UI.
  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
  runApp(const VyaparPulseApp());
}

class VyaparPulseApp extends StatelessWidget {
  const VyaparPulseApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'VyaparPulse',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.dark,
      home: const MainShell(),
    );
  }
}
```

---

## `lib/models/customer.dart`

```dart
import 'transaction.dart';

class Customer {
  final String id;
  final String name;
  final String initials;
  final double totalAmount;
  final double? dueAmount;
  final String lastTransactionTime;
  final PaymentStatus status;

  const Customer({
    required this.id,
    required this.name,
    required this.initials,
    required this.totalAmount,
    required this.lastTransactionTime,
    required this.status,
    this.dueAmount,
  });
}
```

---

## `lib/models/misc_models.dart`

```dart
/// A candidate transaction an unmatched payment could belong to
/// (used on the Payment Review screen).
class MatchOption {
  final String name;
  final String time;
  final double amount;

  const MatchOption({
    required this.name,
    required this.time,
    required this.amount,
  });
}

/// A single row in the "VyaparPulse Credit Intelligence" breakdown.
class CreditFactor {
  final String label;
  final String value;
  final bool positive;

  const CreditFactor({
    required this.label,
    required this.value,
    this.positive = true,
  });
}

/// The parsed result of a voice-recorded sale, shown on the
/// "Confirm sale" card of the Record Sale screen.
class SaleDraft {
  final String customerName;
  final String productName;
  final int quantity;
  final double total;

  const SaleDraft({
    required this.customerName,
    required this.productName,
    required this.quantity,
    required this.total,
  });
}
```

---

## `lib/models/transaction.dart`

```dart
/// Status of a ledger transaction / payment.
enum PaymentStatus { paid, partial, pending, needsReview }

class AppTransaction {
  final String id;
  final String name;
  final double amount;
  final double? dueAmount;
  final String time;
  final PaymentStatus status;

  const AppTransaction({
    required this.id,
    required this.name,
    required this.amount,
    required this.time,
    required this.status,
    this.dueAmount,
  });

  AppTransaction copyWith({
    String? name,
    double? amount,
    double? dueAmount,
    String? time,
    PaymentStatus? status,
  }) {
    return AppTransaction(
      id: id,
      name: name ?? this.name,
      amount: amount ?? this.amount,
      dueAmount: dueAmount ?? this.dueAmount,
      time: time ?? this.time,
      status: status ?? this.status,
    );
  }
}
```

---

## `lib/screens/customers_screen.dart`

```dart
import 'package:flutter/material.dart';
import '../data/mock_data.dart';
import '../models/customer.dart';
import '../theme/app_colors.dart';
import '../theme/app_text_styles.dart';
import '../utils/currency_formatter.dart';
import '../widgets/app_card.dart';
import '../widgets/status_badge.dart';
import '../widgets/vyapar_app_bar.dart';

/// Tab 4 — "Customers". No Stitch design was supplied for this tab;
/// it's built to match the visual language of the other screens
/// (same cards, spacing, typography, status badges) since the bottom
/// nav references it. Swap in a real design here if one is provided.
class CustomersScreen extends StatefulWidget {
  const CustomersScreen({super.key});

  @override
  State<CustomersScreen> createState() => _CustomersScreenState();
}

class _CustomersScreenState extends State<CustomersScreen> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final customers = MockData.buildCustomers()
        .where((c) => _query.isEmpty || c.name.toLowerCase().contains(_query.toLowerCase()))
        .toList();

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
          children: [
            const VyaparAppBar(),
            const SizedBox(height: 20),
            const Text('Customers', style: AppTextStyles.h1),
            const SizedBox(height: 4),
            Text('${MockData.buildCustomers().length} customers', style: AppTextStyles.bodyMuted),
            const SizedBox(height: 16),
            Container(
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: TextField(
                onChanged: (v) => setState(() => _query = v),
                style: AppTextStyles.body,
                cursorColor: AppColors.gold,
                decoration: const InputDecoration(
                  border: InputBorder.none,
                  prefixIcon: Icon(Icons.search_rounded, color: AppColors.textTertiary, size: 20),
                  hintText: 'Search customers...',
                  hintStyle: AppTextStyles.bodyMuted,
                  contentPadding: EdgeInsets.symmetric(vertical: 14),
                ),
              ),
            ),
            const SizedBox(height: 18),
            if (customers.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 32),
                child: Center(child: Text('No customers found', style: AppTextStyles.bodyMuted)),
              )
            else
              for (int i = 0; i < customers.length; i++) ...[
                _CustomerCard(customer: customers[i]),
                if (i != customers.length - 1) const SizedBox(height: 10),
              ],
          ],
        ),
      ),
    );
  }
}

class _CustomerCard extends StatelessWidget {
  final Customer customer;
  const _CustomerCard({required this.customer});

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: () {},
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: AppColors.goldMuted,
              borderRadius: BorderRadius.circular(12),
            ),
            alignment: Alignment.center,
            child: Text(
              customer.initials,
              style: const TextStyle(color: AppColors.gold, fontWeight: FontWeight.w800, fontSize: 14),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(customer.name, style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text(customer.lastTransactionTime, style: AppTextStyles.small),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                CurrencyFormatter.format(customer.totalAmount),
                style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 4),
              StatusBadge(status: customer.status, fontSize: 10),
            ],
          ),
        ],
      ),
    );
  }
}
```

---

## `lib/screens/home_screen.dart`

```dart
import 'package:flutter/material.dart';
import '../data/mock_data.dart';
import '../theme/app_colors.dart';
import '../theme/app_text_styles.dart';
import '../utils/currency_formatter.dart';
import '../widgets/app_card.dart';
import '../widgets/metric_card.dart';
import '../widgets/section_header.dart';
import '../widgets/transaction_tile.dart';
import '../widgets/vyapar_app_bar.dart';

/// Tab 0 — the store dashboard: today's sales, received/pending,
/// quick actions and a recent-activity preview.
class HomeScreen extends StatelessWidget {
  final void Function(int index)? onNavigate;

  const HomeScreen({super.key, this.onNavigate});

  @override
  Widget build(BuildContext context) {
    final recent = MockData.buildTransactions().take(3).toList();

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
          children: [
            const VyaparAppBar(),
            const SizedBox(height: 22),
            Text(MockData.ownerGreeting, style: AppTextStyles.bodyMuted),
            const SizedBox(height: 2),
            Text(MockData.storeName, style: AppTextStyles.h1),
            const SizedBox(height: 20),
            _TodaysSalesCard(),
            const SizedBox(height: 16),
            AppCard(
              onTap: () => onNavigate?.call(2),
              child: Row(
                children: [
                  _GoldIconSquare(icon: Icons.mic_rounded),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Record a sale', style: AppTextStyles.h2),
                        const SizedBox(height: 3),
                        Text(
                          'Just say "Sold 10 notebooks t...',
                          style: AppTextStyles.small,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right_rounded, color: AppColors.textTertiary),
                ],
              ),
            ),
            const SizedBox(height: 12),
            AppCard(
              onTap: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Product management coming soon')),
                );
              },
              child: Row(
                children: [
                  _SurfaceIconSquare(icon: Icons.inventory_2_outlined),
                  const SizedBox(width: 14),
                  const Expanded(
                    child: Text('Manage products & prices', style: AppTextStyles.h2),
                  ),
                  const Icon(Icons.chevron_right_rounded, color: AppColors.textTertiary),
                ],
              ),
            ),
            const SizedBox(height: 26),
            SectionHeader(
              title: 'Recent activity',
              actionLabel: 'View ledger',
              onActionTap: () => onNavigate?.call(1),
            ),
            const SizedBox(height: 10),
            AppCard(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                children: [
                  for (int i = 0; i < recent.length; i++)
                    TransactionTile(tx: recent[i], showDivider: i != recent.length - 1),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TodaysSalesCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text("TODAY'S SALES", style: AppTextStyles.caption),
              Text(
                '${(MockData.collectedPercent * 100).round()}% collected',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.gold),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(CurrencyFormatter.format(MockData.todaysSales), style: AppTextStyles.hero),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: MockData.collectedPercent,
              backgroundColor: AppColors.divider,
              valueColor: const AlwaysStoppedAnimation(AppColors.gold),
              minHeight: 6,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: MetricPill(
                  child: MetricBlock(
                    icon: Icons.south_west_rounded,
                    label: 'Received',
                    value: CurrencyFormatter.format(MockData.receivedAmount),
                    valueColor: AppColors.green,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: MetricPill(
                  child: MetricBlock(
                    icon: Icons.north_east_rounded,
                    label: 'Pending',
                    value: CurrencyFormatter.format(MockData.pendingAmount),
                    valueColor: AppColors.amber,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _GoldIconSquare extends StatelessWidget {
  final IconData icon;
  const _GoldIconSquare({required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(color: AppColors.gold, borderRadius: BorderRadius.circular(12)),
      child: Icon(icon, color: Colors.black, size: 20),
    );
  }
}

class _SurfaceIconSquare extends StatelessWidget {
  final IconData icon;
  const _SurfaceIconSquare({required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: AppColors.surfaceElevated,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Icon(icon, color: AppColors.textPrimary, size: 20),
    );
  }
}
```

---

## `lib/screens/insights_screen.dart`

```dart
import 'package:flutter/material.dart';
import '../data/mock_data.dart';
import '../theme/app_colors.dart';
import '../theme/app_text_styles.dart';
import '../utils/currency_formatter.dart';
import '../widgets/app_card.dart';
import '../widgets/cash_flow_bars.dart';
import '../widgets/credit_score_bar.dart';
import '../widgets/revenue_trend_chart.dart';
import '../widgets/vyapar_app_bar.dart';

/// Tab 3 — "Business insights": revenue trend, key stats, cash-flow
/// forecast and the VyaparPulse credit intelligence score.
class InsightsScreen extends StatelessWidget {
  const InsightsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
          children: [
            const VyaparAppBar(),
            const SizedBox(height: 20),
            const Text('Business insights', style: AppTextStyles.h1),
            const SizedBox(height: 4),
            const Text('Last 7 days', style: AppTextStyles.bodyMuted),
            const SizedBox(height: 18),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(CurrencyFormatter.format(MockData.weekRevenue), style: AppTextStyles.hero),
                const SizedBox(width: 10),
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    children: [
                      const Icon(Icons.trending_up_rounded, color: AppColors.green, size: 16),
                      const SizedBox(width: 2),
                      Text(
                        '${MockData.weekRevenueChangePercent.round()}%',
                        style: const TextStyle(color: AppColors.green, fontWeight: FontWeight.w700, fontSize: 14),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            const Text('7-DAY REVENUE', style: AppTextStyles.caption),
            const SizedBox(height: 12),
            RevenueTrendChart(values: MockData.revenueTrend, labels: MockData.weekDayLabels),
            const SizedBox(height: 24),
            AppCard(
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: _StatBlock(
                          label: 'Collection rate',
                          value: '${(MockData.collectionRate * 100).round()}%',
                          valueColor: AppColors.green,
                        ),
                      ),
                      Expanded(
                        child: _StatBlock(
                          label: 'Pending',
                          value: CurrencyFormatter.format(MockData.pendingCollection),
                          valueColor: AppColors.amber,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  Row(
                    children: [
                      Expanded(
                        child: _StatBlock(
                          label: 'Transactions',
                          value: '${MockData.transactionCount}',
                        ),
                      ),
                      Expanded(
                        child: _StatBlock(
                          label: 'Top product',
                          value: MockData.topProduct,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 26),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('CASH FLOW · NEXT 7 DAYS', style: AppTextStyles.caption),
                Row(
                  children: [
                    _LegendDot(color: AppColors.textTertiary.withOpacity(0.6), label: 'Past'),
                    const SizedBox(width: 10),
                    const _LegendDot(color: AppColors.gold, label: 'Forecast'),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 14),
            CashFlowBars(
              values: MockData.cashFlowValues,
              labels: MockData.cashFlowLabels,
              todayIndex: MockData.cashFlowTodayIndex,
            ),
            const SizedBox(height: 10),
            const Text('Based on recent sales and collection patterns.', style: AppTextStyles.small),
            const SizedBox(height: 26),
            const Divider(color: AppColors.divider, height: 1),
            const SizedBox(height: 20),
            const Text('VYAPARPULSE CREDIT INTELLIGENCE', style: AppTextStyles.caption),
            const SizedBox(height: 12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text('${MockData.creditScore}', style: AppTextStyles.hero),
                const SizedBox(width: 10),
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    children: [
                      const Icon(Icons.trending_up_rounded, color: AppColors.green, size: 15),
                      const SizedBox(width: 3),
                      Text(
                        MockData.creditScoreHeadline,
                        style: const TextStyle(color: AppColors.green, fontWeight: FontWeight.w700, fontSize: 13),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            CreditScoreBar(
              score: MockData.creditScore,
              min: MockData.creditScoreMin,
              max: MockData.creditScoreMax,
            ),
            const SizedBox(height: 18),
            for (int i = 0; i < MockData.creditFactors.length; i++) ...[
              _CreditFactorRow(
                label: MockData.creditFactors[i].label,
                value: MockData.creditFactors[i].value,
              ),
              if (i != MockData.creditFactors.length - 1)
                const Divider(color: AppColors.divider, height: 22),
            ],
          ],
        ),
      ),
    );
  }
}

class _StatBlock extends StatelessWidget {
  final String label;
  final String value;
  final Color valueColor;

  const _StatBlock({
    required this.label,
    required this.value,
    this.valueColor = AppColors.textPrimary,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label.toUpperCase(), style: AppTextStyles.caption),
        const SizedBox(height: 6),
        Text(
          value,
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: valueColor),
        ),
      ],
    );
  }
}

class _LegendDot extends StatelessWidget {
  final Color color;
  final String label;
  const _LegendDot({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 7, height: 7, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 5),
        Text(label, style: AppTextStyles.small),
      ],
    );
  }
}

class _CreditFactorRow extends StatelessWidget {
  final String label;
  final String value;
  const _CreditFactorRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: AppTextStyles.bodyMuted),
        Text(
          value,
          style: const TextStyle(color: AppColors.green, fontWeight: FontWeight.w700, fontSize: 14),
        ),
      ],
    );
  }
}
```

---

## `lib/screens/ledger_screen.dart`

```dart
import 'package:flutter/material.dart';
import '../data/mock_data.dart';
import '../models/transaction.dart';
import '../theme/app_colors.dart';
import '../theme/app_text_styles.dart';
import '../utils/currency_formatter.dart';
import '../widgets/app_card.dart';
import '../widgets/transaction_tile.dart';
import '../widgets/vyapar_app_bar.dart';
import 'payment_review_screen.dart';

enum _Filter { all, paid, partial, pending }

/// Tab 1 — "Ledger": searchable, filterable transaction list, with a
/// banner for any unmatched incoming payment that needs review.
class LedgerScreen extends StatefulWidget {
  const LedgerScreen({super.key});

  @override
  State<LedgerScreen> createState() => _LedgerScreenState();
}

class _LedgerScreenState extends State<LedgerScreen> {
  late List<AppTransaction> _items = MockData.buildTransactions();
  _Filter _filter = _Filter.all;
  String _query = '';

  double get _total => _items.fold(0, (sum, t) => sum + t.amount);

  bool get _hasAttentionItem => _items.any((t) => t.status == PaymentStatus.needsReview);

  List<AppTransaction> get _filtered {
    return _items.where((t) {
      final matchesQuery = _query.isEmpty || t.name.toLowerCase().contains(_query.toLowerCase());
      final matchesFilter = switch (_filter) {
        _Filter.all => true,
        _Filter.paid => t.status == PaymentStatus.paid,
        _Filter.partial => t.status == PaymentStatus.partial,
        _Filter.pending => t.status == PaymentStatus.pending,
      };
      return matchesQuery && matchesFilter;
    }).toList();
  }

  Future<void> _openPaymentReview() async {
    final matchedName = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const PaymentReviewScreen()),
    );
    if (matchedName == null || !mounted) return;
    setState(() {
      _items = _items
          .map((t) => t.status == PaymentStatus.needsReview
              ? t.copyWith(name: matchedName, status: PaymentStatus.paid)
              : t)
          .toList();
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Matched to $matchedName')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
          children: [
            const VyaparAppBar(),
            const SizedBox(height: 20),
            const Text('Ledger', style: AppTextStyles.h1),
            const SizedBox(height: 4),
            Text(
              '${_items.length} transactions · ${CurrencyFormatter.format(_total)} total',
              style: AppTextStyles.bodyMuted,
            ),
            const SizedBox(height: 16),
            _SearchField(onChanged: (v) => setState(() => _query = v)),
            const SizedBox(height: 12),
            _FilterChips(
              selected: _filter,
              onSelected: (f) => setState(() => _filter = f),
            ),
            if (_hasAttentionItem) ...[
              const SizedBox(height: 16),
              _AttentionBanner(onTap: _openPaymentReview),
            ],
            const SizedBox(height: 16),
            if (filtered.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 32),
                child: Center(
                  child: Text('No transactions match this filter', style: AppTextStyles.bodyMuted),
                ),
              )
            else
              AppCard(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Column(
                  children: [
                    for (int i = 0; i < filtered.length; i++)
                      TransactionTile(tx: filtered[i], showDivider: i != filtered.length - 1),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _SearchField extends StatelessWidget {
  final ValueChanged<String> onChanged;
  const _SearchField({required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: TextField(
        onChanged: onChanged,
        style: AppTextStyles.body,
        cursorColor: AppColors.gold,
        decoration: const InputDecoration(
          border: InputBorder.none,
          prefixIcon: Icon(Icons.search_rounded, color: AppColors.textTertiary, size: 20),
          hintText: 'Search a customer...',
          hintStyle: AppTextStyles.bodyMuted,
          contentPadding: EdgeInsets.symmetric(vertical: 14),
        ),
      ),
    );
  }
}

class _FilterChips extends StatelessWidget {
  final _Filter selected;
  final ValueChanged<_Filter> onSelected;

  const _FilterChips({required this.selected, required this.onSelected});

  @override
  Widget build(BuildContext context) {
    const options = [
      (_Filter.all, 'All'),
      (_Filter.paid, 'Paid'),
      (_Filter.partial, 'Partial'),
      (_Filter.pending, 'Pending'),
    ];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: options.map((opt) {
          final isSelected = selected == opt.$1;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: GestureDetector(
              onTap: () => onSelected(opt.$1),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
                decoration: BoxDecoration(
                  color: isSelected ? AppColors.gold : AppColors.surfaceElevated,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: isSelected ? AppColors.gold : AppColors.border),
                ),
                child: Text(
                  opt.$2,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: isSelected ? Colors.black : AppColors.textSecondary,
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _AttentionBanner extends StatelessWidget {
  final VoidCallback onTap;
  const _AttentionBanner({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      color: AppColors.red.withOpacity(0.06),
      borderColor: AppColors.red.withOpacity(0.3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.warning_rounded, color: AppColors.red, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: const [
                    Text(
                      '1 payment needs your attention',
                      style: TextStyle(color: AppColors.red, fontWeight: FontWeight.w700, fontSize: 14),
                    ),
                    Text(
                      'REVIEW',
                      style: TextStyle(color: AppColors.red, fontWeight: FontWeight.w800, fontSize: 12, letterSpacing: 0.4),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                const Text('Tap to match it to a transaction', style: AppTextStyles.small),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
```

---

## `lib/screens/main_shell.dart`

```dart
import 'package:flutter/material.dart';
import '../widgets/bottom_nav.dart';
import 'customers_screen.dart';
import 'home_screen.dart';
import 'insights_screen.dart';
import 'ledger_screen.dart';
import 'record_sale_screen.dart';

/// Hosts the 5-tab bottom navigation and keeps each tab's state alive
/// via an IndexedStack (so e.g. filter selections on Ledger persist
/// when switching away and back).
class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _index = 0;

  void _goTo(int index) => setState(() => _index = index);

  @override
  Widget build(BuildContext context) {
    final pages = [
      HomeScreen(onNavigate: _goTo),
      const LedgerScreen(),
      const RecordSaleScreen(),
      const InsightsScreen(),
      const CustomersScreen(),
    ];

    return Scaffold(
      body: IndexedStack(index: _index, children: pages),
      bottomNavigationBar: AppBottomNav(currentIndex: _index, onTap: _goTo),
    );
  }
}
```

---

## `lib/screens/payment_review_screen.dart`

```dart
import 'package:flutter/material.dart';
import '../data/mock_data.dart';
import '../theme/app_colors.dart';
import '../theme/app_text_styles.dart';
import '../utils/currency_formatter.dart';
import '../widgets/app_card.dart';
import '../widgets/custom_button.dart';

/// Pushed from the Ledger's "needs your attention" banner. Lets the
/// user match an unrecognized incoming payment to a known transaction,
/// or leave it unmatched. Returns the matched customer name (or null)
/// via Navigator.pop.
class PaymentReviewScreen extends StatefulWidget {
  const PaymentReviewScreen({super.key});

  @override
  State<PaymentReviewScreen> createState() => _PaymentReviewScreenState();
}

class _PaymentReviewScreenState extends State<PaymentReviewScreen> {
  int? _selectedIndex; // index into options list, last index = "None of these"

  @override
  Widget build(BuildContext context) {
    final options = MockData.matchOptions;
    final totalOptions = options.length + 1; // + "None of these"

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () => Navigator.of(context).pop(),
                    child: const Icon(Icons.arrow_back_rounded, color: AppColors.textPrimary),
                  ),
                  const SizedBox(width: 16),
                  const Text(
                    'PAYMENT REVIEW',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textSecondary,
                      letterSpacing: 1.0,
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: AppColors.divider),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
                children: [
                  Row(
                    children: const [
                      Icon(Icons.warning_rounded, color: AppColors.red, size: 18),
                      SizedBox(width: 8),
                      Text(
                        'NEEDS YOUR ATTENTION',
                        style: TextStyle(color: AppColors.red, fontWeight: FontWeight.w700, fontSize: 12.5, letterSpacing: 0.5),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Text(CurrencyFormatter.format(MockData.unmatchedAmount), style: AppTextStyles.heroLarge),
                  const SizedBox(height: 10),
                  Text(
                    'received · ${MockData.unmatchedTime}. Which transaction does this belong to?',
                    style: AppTextStyles.bodyMuted,
                  ),
                  const SizedBox(height: 24),
                  for (int i = 0; i < options.length; i++) ...[
                    _MatchTile(
                      title: options[i].name,
                      subtitle: options[i].time,
                      amount: CurrencyFormatter.format(options[i].amount),
                      selected: _selectedIndex == i,
                      onTap: () => setState(() => _selectedIndex = i),
                    ),
                    const SizedBox(height: 10),
                  ],
                  _MatchTile(
                    title: 'None of these — leave unmatched',
                    subtitle: null,
                    amount: null,
                    selected: _selectedIndex == options.length,
                    onTap: () => setState(() => _selectedIndex = options.length),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
              child: PrimaryButton(
                label: 'Confirm match',
                enabled: _selectedIndex != null,
                onPressed: _selectedIndex == null
                    ? null
                    : () {
                        final isNone = _selectedIndex == options.length;
                        Navigator.of(context).pop(isNone ? null : options[_selectedIndex!].name);
                      },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MatchTile extends StatelessWidget {
  final String title;
  final String? subtitle;
  final String? amount;
  final bool selected;
  final VoidCallback onTap;

  const _MatchTile({
    required this.title,
    required this.subtitle,
    required this.amount,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      borderColor: selected ? AppColors.gold : AppColors.border,
      child: Row(
        children: [
          Container(
            width: 20,
            height: 20,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: selected ? AppColors.gold : AppColors.textTertiary, width: 2),
            ),
            alignment: Alignment.center,
            child: selected
                ? Container(
                    width: 10,
                    height: 10,
                    decoration: const BoxDecoration(color: AppColors.gold, shape: BoxShape.circle),
                  )
                : null,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w700)),
                if (subtitle != null) ...[
                  const SizedBox(height: 3),
                  Text(subtitle!, style: AppTextStyles.small),
                ],
              ],
            ),
          ),
          if (amount != null)
            Text(amount!, style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}
```

---

## `lib/screens/record_sale_screen.dart`

```dart
import 'package:flutter/material.dart';
import '../data/mock_data.dart';
import '../models/misc_models.dart';
import '../theme/app_colors.dart';
import '../theme/app_text_styles.dart';
import '../utils/currency_formatter.dart';
import '../widgets/app_card.dart';
import '../widgets/custom_button.dart';
import '../widgets/vyapar_app_bar.dart';

/// Tab 2 (center mic tab) — "Record a sale" voice-entry flow.
/// Mock-simulates speech recognition: tapping the mic "listens" briefly,
/// then reveals a transcript + a Confirm Sale card built from mock data.
class RecordSaleScreen extends StatefulWidget {
  const RecordSaleScreen({super.key});

  @override
  State<RecordSaleScreen> createState() => _RecordSaleScreenState();
}

class _RecordSaleScreenState extends State<RecordSaleScreen> {
  bool _isListening = false;
  bool _showConfirmation = false;

  void _startListening() {
    if (_isListening || _showConfirmation) return;
    setState(() => _isListening = true);
    Future.delayed(const Duration(milliseconds: 900), () {
      if (!mounted) return;
      setState(() {
        _isListening = false;
        _showConfirmation = true;
      });
    });
  }

  void _reset() {
    setState(() {
      _isListening = false;
      _showConfirmation = false;
    });
  }

  void _confirmSave() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Sale recorded')),
    );
    _reset();
  }

  @override
  Widget build(BuildContext context) {
    final draft = MockData.sampleSaleDraft;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const VyaparAppBar(),
              const SizedBox(height: 28),
              const Center(
                child: Column(
                  children: [
                    Text('Record a sale', style: AppTextStyles.h1),
                    SizedBox(height: 6),
                    Text('Speak naturally in any language', style: AppTextStyles.bodyMuted),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              AppCard(
                padding: const EdgeInsets.all(16),
                child: SizedBox(
                  width: double.infinity,
                  height: 84,
                  child: Align(
                    alignment: Alignment.topLeft,
                    child: Text(
                      _showConfirmation
                          ? MockData.sampleTranscript
                          : (_isListening ? 'Listening…' : 'Tap the mic and describe your sale...'),
                      style: _showConfirmation
                          ? AppTextStyles.body
                          : AppTextStyles.bodyMuted,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Expanded(
                child: _showConfirmation
                    ? _ConfirmSaleCard(
                        draft: draft,
                        onConfirm: _confirmSave,
                        onCancel: _reset,
                      )
                    : _IdleMic(isListening: _isListening, onTap: _startListening),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _IdleMic extends StatelessWidget {
  final bool isListening;
  final VoidCallback onTap;

  const _IdleMic({required this.isListening, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        GestureDetector(
          onTap: onTap,
          child: AnimatedScale(
            scale: isListening ? 1.08 : 1.0,
            duration: const Duration(milliseconds: 300),
            child: Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                color: AppColors.gold,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: AppColors.gold.withOpacity(isListening ? 0.5 : 0.3),
                    blurRadius: isListening ? 30 : 18,
                    spreadRadius: isListening ? 4 : 0,
                  ),
                ],
              ),
              child: const Icon(Icons.mic_rounded, color: Colors.black, size: 44),
            ),
          ),
        ),
        const SizedBox(height: 24),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Text(
            'Example: "${MockData.sampleTranscript}"',
            textAlign: TextAlign.center,
            style: AppTextStyles.small,
          ),
        ),
        const SizedBox(height: 40),
      ],
    );
  }
}

class _ConfirmSaleCard extends StatelessWidget {
  final SaleDraft draft;
  final VoidCallback onConfirm;
  final VoidCallback onCancel;

  const _ConfirmSaleCard({
    required this.draft,
    required this.onConfirm,
    required this.onCancel,
  });

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.topCenter,
      child: Padding(
        padding: const EdgeInsets.only(top: 12),
        child: AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('CONFIRM SALE', style: AppTextStyles.caption),
                  Row(
                    children: const [
                      Icon(Icons.edit_outlined, size: 14, color: AppColors.gold),
                      SizedBox(width: 4),
                      Text('Edit', style: TextStyle(color: AppColors.gold, fontSize: 12.5, fontWeight: FontWeight.w700)),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 14),
              _row('Customer', draft.customerName),
              const Divider(color: AppColors.divider, height: 24),
              _row('${draft.productName} x ${draft.quantity}', CurrencyFormatter.format(draft.total)),
              const Divider(color: AppColors.divider, height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Total', style: AppTextStyles.body),
                  Text(
                    CurrencyFormatter.format(draft.total),
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: PrimaryButton(
                      label: 'Confirm & save',
                      icon: Icons.check_rounded,
                      onPressed: onConfirm,
                    ),
                  ),
                  const SizedBox(width: 12),
                  IconSquareButton(icon: Icons.close_rounded, onPressed: onCancel),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _row(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: AppTextStyles.bodyMuted),
        Text(value, style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w700)),
      ],
    );
  }
}
```

---

## `lib/theme/app_colors.dart`

```dart
import 'package:flutter/material.dart';

/// Central color palette sampled from the VyaparPulse Stitch designs.
/// Keep every screen referencing these constants so the app stays visually
/// consistent instead of hardcoding one-off colors per widget.
class AppColors {
  AppColors._();

  // Backgrounds
  static const Color background = Color(0xFF121214);
  static const Color surface = Color(0xFF1B1B1F);
  static const Color surfaceElevated = Color(0xFF222226);
  static const Color inputFill = Color(0xFF19191C);

  // Borders / dividers
  static const Color border = Color(0xFF2A2A30);
  static const Color divider = Color(0xFF26262B);

  // Brand gold
  static const Color gold = Color(0xFFF3B94C);
  static const Color goldDark = Color(0xFFC98F2E);
  static const Color goldMuted = Color(0xFF4C3D1F);

  // Status colors
  static const Color green = Color(0xFF4ADE80);
  static const Color red = Color(0xFFF0625F);
  static const Color amber = Color(0xFFF2A93B);

  // Text
  static const Color textPrimary = Color(0xFFF5F5F7);
  static const Color textSecondary = Color(0xFF9A9AA2);
  static const Color textTertiary = Color(0xFF6E6E76);
}
```

---

## `lib/theme/app_text_styles.dart`

```dart
import 'package:flutter/material.dart';
import 'app_colors.dart';

/// Reusable text styles. Widgets should pull from here rather than
/// defining ad-hoc TextStyles so type stays consistent across screens.
class AppTextStyles {
  AppTextStyles._();

  static const TextStyle heroLarge = TextStyle(
    fontSize: 40,
    fontWeight: FontWeight.w800,
    color: AppColors.textPrimary,
    letterSpacing: -0.5,
    height: 1.05,
  );

  static const TextStyle hero = TextStyle(
    fontSize: 32,
    fontWeight: FontWeight.w800,
    color: AppColors.textPrimary,
    letterSpacing: -0.5,
    height: 1.05,
  );

  static const TextStyle h1 = TextStyle(
    fontSize: 22,
    fontWeight: FontWeight.w700,
    color: AppColors.textPrimary,
    height: 1.2,
  );

  static const TextStyle h2 = TextStyle(
    fontSize: 17,
    fontWeight: FontWeight.w700,
    color: AppColors.textPrimary,
  );

  static const TextStyle body = TextStyle(
    fontSize: 14.5,
    fontWeight: FontWeight.w500,
    color: AppColors.textPrimary,
  );

  static const TextStyle bodyMuted = TextStyle(
    fontSize: 14.5,
    fontWeight: FontWeight.w400,
    color: AppColors.textSecondary,
  );

  static const TextStyle caption = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w700,
    color: AppColors.textSecondary,
    letterSpacing: 0.6,
  );

  static const TextStyle small = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w500,
    color: AppColors.textSecondary,
  );

  static const TextStyle button = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.1,
  );
}
```

---

## `lib/theme/app_theme.dart`

```dart
import 'package:flutter/material.dart';
import 'app_colors.dart';

class AppTheme {
  AppTheme._();

  static ThemeData get dark {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: AppColors.background,
      primaryColor: AppColors.gold,
      colorScheme: const ColorScheme.dark(
        primary: AppColors.gold,
        secondary: AppColors.gold,
        surface: AppColors.surface,
        error: AppColors.red,
      ),
      splashColor: Colors.transparent,
      highlightColor: Colors.transparent,
      dividerColor: AppColors.divider,
      textSelectionTheme: const TextSelectionThemeData(
        cursorColor: AppColors.gold,
        selectionColor: Color(0x552F2416),
        selectionHandleColor: AppColors.gold,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.background,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppColors.surfaceElevated,
        contentTextStyle: const TextStyle(color: AppColors.textPrimary),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: CupertinoPageTransitionsBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
        },
      ),
    );
  }
}
```

---

## `lib/utils/currency_formatter.dart`

```dart
import 'package:intl/intl.dart';

/// Formats numbers as Indian Rupees with Indian digit grouping,
/// e.g. 12840 -> ₹12,840 and 184500 -> ₹1,84,500.
class CurrencyFormatter {
  CurrencyFormatter._();

  static final NumberFormat _format = NumberFormat.currency(
    locale: 'en_IN',
    symbol: '₹',
    decimalDigits: 0,
  );

  static String format(num amount) => _format.format(amount);
}
```

---

## `lib/widgets/app_card.dart`

```dart
import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

/// The base rounded, bordered dark card used across every screen.
/// Keeping this in one place is what makes every card in the app
/// (metrics, list containers, quick actions...) look consistent.
class AppCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Color? color;
  final Color? borderColor;
  final double radius;

  const AppCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
    this.color,
    this.borderColor,
    this.radius = 16,
  });

  @override
  Widget build(BuildContext context) {
    final content = Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: color ?? AppColors.surface,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: borderColor ?? AppColors.border, width: 1),
      ),
      child: child,
    );

    if (onTap == null) return content;

    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(radius),
      child: InkWell(
        borderRadius: BorderRadius.circular(radius),
        onTap: onTap,
        splashColor: AppColors.gold.withOpacity(0.06),
        highlightColor: AppColors.gold.withOpacity(0.03),
        child: content,
      ),
    );
  }
}
```

---

## `lib/widgets/bottom_nav.dart`

```dart
import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

/// The 5-tab bottom navigation bar: Home, Transactions, a raised gold
/// "Voice" mic button in the center, Insights, Customers.
class AppBottomNav extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;

  const AppBottomNav({
    super.key,
    required this.currentIndex,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.border, width: 1)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _NavItem(
                icon: Icons.home_rounded,
                label: 'Home',
                active: currentIndex == 0,
                onTap: () => onTap(0),
              ),
              _NavItem(
                icon: Icons.receipt_long_rounded,
                label: 'Transactions',
                active: currentIndex == 1,
                onTap: () => onTap(1),
              ),
              _MicItem(
                active: currentIndex == 2,
                onTap: () => onTap(2),
              ),
              _NavItem(
                icon: Icons.trending_up_rounded,
                label: 'Insights',
                active: currentIndex == 3,
                onTap: () => onTap(3),
              ),
              _NavItem(
                icon: Icons.people_alt_rounded,
                label: 'Customers',
                active: currentIndex == 4,
                onTap: () => onTap(4),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;

  const _NavItem({
    required this.icon,
    required this.label,
    required this.active,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = active ? AppColors.gold : AppColors.textTertiary;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 22, color: color),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 10.5,
              fontWeight: active ? FontWeight.w700 : FontWeight.w500,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

class _MicItem extends StatelessWidget {
  final bool active;
  final VoidCallback onTap;

  const _MicItem({required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        width: 46,
        height: 46,
        margin: const EdgeInsets.only(bottom: 14),
        decoration: BoxDecoration(
          color: AppColors.gold,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: AppColors.gold.withOpacity(0.35),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: const Icon(Icons.mic_rounded, color: Colors.black, size: 22),
      ),
    );
  }
}
```

---

## `lib/widgets/cash_flow_bars.dart`

```dart
import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

/// The "Cash flow · next 7 days" bar chart: grey bars for the past,
/// a white bar for "today", gold bars for the forecast.
class CashFlowBars extends StatelessWidget {
  final List<double> values;
  final List<String> labels;
  final int todayIndex;

  const CashFlowBars({
    super.key,
    required this.values,
    required this.labels,
    required this.todayIndex,
  });

  @override
  Widget build(BuildContext context) {
    final maxV = values.reduce(math.max);
    return Column(
      children: [
        SizedBox(
          height: 110,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: List.generate(values.length, (i) {
              final heightFactor = (values[i] / maxV).clamp(0.08, 1.0);
              Color color;
              if (i == todayIndex) {
                color = Colors.white;
              } else if (i < todayIndex) {
                color = AppColors.textTertiary.withOpacity(0.55);
              } else {
                color = AppColors.gold;
              }
              return Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: FractionallySizedBox(
                    heightFactor: heightFactor,
                    alignment: Alignment.bottomCenter,
                    child: Container(
                      decoration: BoxDecoration(
                        color: color,
                        borderRadius: const BorderRadius.vertical(top: Radius.circular(5)),
                      ),
                    ),
                  ),
                ),
              );
            }),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: List.generate(
            labels.length,
            (i) => Expanded(
              child: Center(
                child: Text(
                  labels[i],
                  style: TextStyle(
                    fontSize: 11,
                    color: i == todayIndex ? AppColors.textPrimary : AppColors.textSecondary,
                    fontWeight: i == todayIndex ? FontWeight.w700 : FontWeight.w400,
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
```

---

## `lib/widgets/credit_score_bar.dart`

```dart
import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_text_styles.dart';

/// The gold gradient progress bar under the VyaparPulse Credit Intelligence
/// score, with min/max range labels beneath it.
class CreditScoreBar extends StatelessWidget {
  final int score;
  final int min;
  final int max;

  const CreditScoreBar({
    super.key,
    required this.score,
    required this.min,
    required this.max,
  });

  @override
  Widget build(BuildContext context) {
    final pct = ((score - min) / (max - min)).clamp(0.0, 1.0);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: Container(
            height: 8,
            color: AppColors.divider,
            alignment: Alignment.centerLeft,
            child: FractionallySizedBox(
              widthFactor: pct,
              child: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [AppColors.goldDark, AppColors.gold],
                  ),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 6),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('$min', style: AppTextStyles.small),
            Text('$max', style: AppTextStyles.small),
          ],
        ),
      ],
    );
  }
}
```

---

## `lib/widgets/custom_button.dart`

```dart
import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_text_styles.dart';

/// The primary gold call-to-action button (e.g. "Confirm & save",
/// "Confirm match"). Automatically dims to a muted gold when disabled,
/// matching the Payment Review design.
class PrimaryButton extends StatelessWidget {
  final String label;
  final IconData? icon;
  final VoidCallback? onPressed;
  final bool enabled;

  const PrimaryButton({
    super.key,
    required this.label,
    this.icon,
    required this.onPressed,
    this.enabled = true,
  });

  @override
  Widget build(BuildContext context) {
    final isEnabled = enabled && onPressed != null;
    return SizedBox(
      height: 52,
      child: Material(
        color: isEnabled ? AppColors.gold : AppColors.goldMuted,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: isEnabled ? onPressed : null,
          child: Center(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (icon != null) ...[
                  Icon(icon, size: 18, color: isEnabled ? Colors.black : AppColors.textTertiary),
                  const SizedBox(width: 8),
                ],
                Text(
                  label,
                  style: AppTextStyles.button.copyWith(
                    color: isEnabled ? Colors.black : AppColors.textTertiary,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A small square icon-only button (e.g. the "✕" cancel button next to
/// "Confirm & save").
class IconSquareButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onPressed;
  final double size;

  const IconSquareButton({
    super.key,
    required this.icon,
    required this.onPressed,
    this.size = 52,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: Material(
        color: AppColors.surfaceElevated,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onPressed,
          child: Icon(icon, color: AppColors.textPrimary, size: 20),
        ),
      ),
    );
  }
}
```

---

## `lib/widgets/metric_card.dart`

```dart
import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_text_styles.dart';

/// A small labeled stat block, e.g. "RECEIVED ₹9,420" on Home or
/// "COLLECTION RATE 78%" on Insights. [valueColor] tints just the value.
class MetricBlock extends StatelessWidget {
  final IconData? icon;
  final String label;
  final String value;
  final Color valueColor;

  const MetricBlock({
    super.key,
    this.icon,
    required this.label,
    required this.value,
    this.valueColor = AppColors.textPrimary,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            if (icon != null) ...[
              Icon(icon, size: 13, color: valueColor),
              const SizedBox(width: 4),
            ],
            Text(label.toUpperCase(), style: AppTextStyles.caption),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          value,
          style: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w700,
            color: valueColor,
          ),
        ),
      ],
    );
  }
}

/// The bordered container that wraps a pair of [MetricBlock]s, used for
/// Received/Pending on Home.
class MetricPill extends StatelessWidget {
  final Widget child;

  const MetricPill({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surfaceElevated,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: child,
    );
  }
}
```

---

## `lib/widgets/revenue_trend_chart.dart`

```dart
import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_text_styles.dart';

/// The smooth gold area/line chart on the Business Insights screen
/// ("7-day revenue"). Hand-painted with CustomPainter so no chart
/// package dependency is needed for a single simple wave shape.
class RevenueTrendChart extends StatelessWidget {
  final List<double> values;
  final List<String> labels;

  const RevenueTrendChart({
    super.key,
    required this.values,
    required this.labels,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        SizedBox(
          height: 120,
          width: double.infinity,
          child: CustomPaint(painter: _RevenueChartPainter(values: values)),
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: labels.map((l) => Text(l, style: AppTextStyles.small)).toList(),
        ),
      ],
    );
  }
}

class _RevenueChartPainter extends CustomPainter {
  final List<double> values;
  _RevenueChartPainter({required this.values});

  @override
  void paint(Canvas canvas, Size size) {
    if (values.length < 2) return;

    final maxV = values.reduce(math.max);
    final minV = values.reduce(math.min);
    final range = (maxV - minV) == 0 ? 1 : (maxV - minV);
    final stepX = size.width / (values.length - 1);
    const topPad = 10.0;
    const bottomPad = 6.0;
    final usableHeight = size.height - topPad - bottomPad;

    final points = <Offset>[];
    for (int i = 0; i < values.length; i++) {
      final x = i * stepX;
      final normalized = (values[i] - minV) / range;
      final y = topPad + usableHeight - (normalized * usableHeight);
      points.add(Offset(x, y));
    }

    final linePath = Path()..moveTo(points.first.dx, points.first.dy);
    for (int i = 0; i < points.length - 1; i++) {
      final p0 = points[i];
      final p1 = points[i + 1];
      final mid = Offset((p0.dx + p1.dx) / 2, (p0.dy + p1.dy) / 2);
      linePath.quadraticBezierTo(p0.dx, p0.dy, mid.dx, mid.dy);
    }
    linePath.lineTo(points.last.dx, points.last.dy);

    final fillPath = Path.from(linePath)
      ..lineTo(points.last.dx, size.height)
      ..lineTo(points.first.dx, size.height)
      ..close();

    final fillPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          AppColors.gold.withOpacity(0.38),
          AppColors.gold.withOpacity(0.0),
        ],
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height));
    canvas.drawPath(fillPath, fillPaint);

    final linePaint = Paint()
      ..color = AppColors.gold
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(linePath, linePaint);
  }

  @override
  bool shouldRepaint(covariant _RevenueChartPainter oldDelegate) => oldDelegate.values != values;
}
```

---

## `lib/widgets/section_header.dart`

```dart
import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_text_styles.dart';

/// A small-caps muted section label with an optional gold action link,
/// e.g. "RECENT ACTIVITY" ... "View ledger".
class SectionHeader extends StatelessWidget {
  final String title;
  final String? actionLabel;
  final VoidCallback? onActionTap;

  const SectionHeader({
    super.key,
    required this.title,
    this.actionLabel,
    this.onActionTap,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(title.toUpperCase(), style: AppTextStyles.caption),
        if (actionLabel != null)
          GestureDetector(
            onTap: onActionTap,
            behavior: HitTestBehavior.opaque,
            child: Text(
              actionLabel!,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AppColors.gold,
              ),
            ),
          ),
      ],
    );
  }
}
```

---

## `lib/widgets/status_badge.dart`

```dart
import 'package:flutter/material.dart';
import '../models/transaction.dart';
import '../theme/app_colors.dart';

/// A small colored dot + caps label reflecting a [PaymentStatus],
/// e.g. "● PAID" in green or "● NEEDS REVIEW" in red.
class StatusBadge extends StatelessWidget {
  final PaymentStatus status;
  final double fontSize;

  const StatusBadge({super.key, required this.status, this.fontSize = 11});

  static Color colorFor(PaymentStatus status) {
    switch (status) {
      case PaymentStatus.paid:
        return AppColors.green;
      case PaymentStatus.partial:
        return AppColors.amber;
      case PaymentStatus.pending:
        return AppColors.amber;
      case PaymentStatus.needsReview:
        return AppColors.red;
    }
  }

  static String labelFor(PaymentStatus status) {
    switch (status) {
      case PaymentStatus.paid:
        return 'PAID';
      case PaymentStatus.partial:
        return 'PARTIAL';
      case PaymentStatus.pending:
        return 'PENDING';
      case PaymentStatus.needsReview:
        return 'NEEDS REVIEW';
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = colorFor(status);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 6,
          height: 6,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(
          labelFor(status),
          style: TextStyle(
            color: color,
            fontSize: fontSize,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.4,
          ),
        ),
      ],
    );
  }
}
```

---

## `lib/widgets/transaction_tile.dart`

```dart
import 'package:flutter/material.dart';
import '../models/transaction.dart';
import '../theme/app_colors.dart';
import '../theme/app_text_styles.dart';
import '../utils/currency_formatter.dart';
import 'status_badge.dart';

/// A single row in the Ledger / Recent activity lists:
/// name + status badge + time on the left, amount (and due, if
/// partial) on the right.
class TransactionTile extends StatelessWidget {
  final AppTransaction tx;
  final VoidCallback? onTap;
  final bool showDivider;

  const TransactionTile({
    super.key,
    required this.tx,
    this.onTap,
    this.showDivider = true,
  });

  @override
  Widget build(BuildContext context) {
    final row = Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  tx.name,
                  style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w700),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 5),
                Row(
                  children: [
                    StatusBadge(status: tx.status),
                    const SizedBox(width: 8),
                    Text('· ${tx.time}', style: AppTextStyles.small),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                CurrencyFormatter.format(tx.amount),
                style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w700),
              ),
              if (tx.dueAmount != null) ...[
                const SizedBox(height: 3),
                Text(
                  '${CurrencyFormatter.format(tx.dueAmount)} due',
                  style: const TextStyle(fontSize: 11.5, color: AppColors.amber, fontWeight: FontWeight.w600),
                ),
              ],
            ],
          ),
        ],
      ),
    );

    final content = Container(
      decoration: showDivider
          ? const BoxDecoration(
              border: Border(bottom: BorderSide(color: AppColors.divider, width: 1)),
            )
          : null,
      child: row,
    );

    if (onTap == null) return content;
    return InkWell(onTap: onTap, child: content);
  }
}
```

---

## `lib/widgets/vyapar_app_bar.dart`

```dart
import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

/// The "VyaparPulse [ONLINE]" header row shown at the top of the
/// Home, Ledger, Insights and Record Sale screens.
class VyaparAppBar extends StatelessWidget {
  const VyaparAppBar({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        RichText(
          text: const TextSpan(
            children: [
              TextSpan(
                text: 'Vyapar',
                style: TextStyle(
                  fontSize: 19,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
              TextSpan(
                text: 'Pulse',
                style: TextStyle(
                  fontSize: 19,
                  fontWeight: FontWeight.w800,
                  color: AppColors.gold,
                ),
              ),
            ],
          ),
        ),
        const _OnlineBadge(),
      ],
    );
  }
}

class _OnlineBadge extends StatelessWidget {
  const _OnlineBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: AppColors.green.withOpacity(0.08),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.green.withOpacity(0.4)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.wifi_rounded, size: 13, color: AppColors.green),
          const SizedBox(width: 4),
          Text(
            'ONLINE',
            style: TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w700,
              color: AppColors.green,
              letterSpacing: 0.4,
            ),
          ),
        ],
      ),
    );
  }
}
```

---

## `README.md`

```markdown
# VyaparPulse — Mobile Frontend (Flutter/Dart)

A **frontend-only** Flutter implementation of the VyaparPulse mobile app UI,
built to match the 7 supplied Stitch screen designs. Everything runs on
local/mock data — there is no backend, API, database, auth, or payment logic.

## Screens implemented

| Screen | Notes |
|---|---|
| **Home** | Store name, today's sales, received/pending, quick actions, recent activity |
| **Record a sale** | Idle mic state → simulated "listening" → transcript + Confirm Sale card |
| **Ledger** | Search, status filter chips, "needs attention" banner, transaction list |
| **Payment review** | Pushed from the Ledger's attention banner; match an unmatched payment |
| **Business insights** | 7-day revenue chart, stats grid, cash-flow forecast, credit score |
| **Customers** | *No Stitch design was supplied for this tab.* Built to match the same visual language (cards, spacing, type, status badges) since the bottom nav references it — swap in a real design here if/when one exists. |

All amounts use Indian rupee formatting (e.g. `₹12,840`, `₹1,84,500`) via the
`intl` package's `en_IN` locale.

## Project structure

```
lib/
  main.dart                 # app entry point
  theme/                    # colors, text styles, ThemeData
  models/                   # Transaction, Customer, SaleDraft, etc.
  data/                     # MockData — all static mock content lives here
  screens/                  # one file per screen + the bottom-nav shell
  widgets/                  # reusable pieces: AppCard, StatusBadge,
                             # TransactionTile, PrimaryButton, charts, etc.
```

## Running the project

This project was authored by hand (no Flutter SDK was available in the
authoring environment to run `flutter create`/`flutter analyze`), so please
run these steps after unzipping:

1. Open the `vyaparpulse/` folder in **Android Studio** or **VS Code**
   (with the Flutter & Dart extensions installed).
2. Run:
   ```bash
   flutter pub get
   ```
3. Connect an Android device or start an emulator, then:
   ```bash
   flutter run
   ```

### Android

The `android/` folder includes a standard Flutter Gradle project (Kotlin
`MainActivity`, manifest, launcher icons, themes) targeting `minSdk 21`.
This is the primary, fully-supported target per the brief ("common Android
phone screen sizes").

### iOS

An `ios/` project folder was **not** included. Xcode's `project.pbxproj` is
a generated, ID-heavy file that isn't safe to hand-author without the
Flutter tooling to produce it correctly — a hand-rolled version would risk
silently failing to open in Xcode. If you need iOS, generate the platform
folder yourself with:
```bash
flutter create --platforms=ios .
```
run from inside `vyaparpulse/`, which will scaffold a correct `ios/` folder
alongside the existing `lib/`.

## Notable implementation details

- **No chart package dependency.** The revenue trend (smooth gradient line)
  and cash-flow bars are hand-drawn with `CustomPainter` / plain widgets —
  kept dependencies to just `intl` and `cupertino_icons` per the brief.
- **Payment Review button state**: matches the design detail where the
  "Confirm match" button is a muted/disabled gold until an option is
  selected, then becomes the full vivid gold.
- **Local interactivity**: selecting a match on the Payment Review screen
  and confirming actually updates the Ledger's "Unknown UPI" entry to
  "Paid" in local state — all in-memory, no persistence/backend.
- **Record a sale** simulates voice recognition with a short delay before
  showing the transcript + confirm card, so the flow feels real without
  any actual speech-to-text integration.
```

---

## `pubspec.yaml`

```yaml
name: vyaparpulse
description: "VyaparPulse — business management & analytics app (frontend/UI only)."
publish_to: "none"
version: 1.0.0+1

environment:
  sdk: ">=3.3.0 <4.0.0"

dependencies:
  flutter:
    sdk: flutter
  cupertino_icons: ^1.0.6
  intl: ^0.19.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^4.0.0

flutter:
  uses-material-design: true
```

---

## `analysis_options.yaml`

```yaml
include: package:flutter_lints/flutter_lints.yaml

linter:
  rules:
    prefer_const_constructors: true
    prefer_const_literals_to_create_immutables: true
```

---

## `android/app/build.gradle`

```gradle
plugins {
    id "com.android.application"
    id "kotlin-android"
    id "dev.flutter.flutter-gradle-plugin"
}

def localProperties = new Properties()
def localPropertiesFile = rootProject.file("local.properties")
if (localPropertiesFile.exists()) {
    localPropertiesFile.withReader("UTF-8") { reader ->
        localProperties.load(reader)
    }
}

def flutterVersionCode = localProperties.getProperty("flutter.versionCode") ?: "1"
def flutterVersionName = localProperties.getProperty("flutter.versionName") ?: "1.0"

android {
    namespace "com.vyaparpulse.app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }

    kotlinOptions {
        jvmTarget = "1.8"
    }

    defaultConfig {
        applicationId "com.vyaparpulse.app"
        minSdk = 21
        targetSdk = flutter.targetSdkVersion
        versionCode flutterVersionCode.toInteger()
        versionName flutterVersionName
    }

    buildTypes {
        release {
            // Using the debug signing config here so `flutter run --release`
            // works out of the box. Replace with a real signing config
            // before publishing this app.
            signingConfig signingConfigs.debug
        }
    }
}

flutter {
    source = "../.."
}
```

---

## `android/app/src/main/AndroidManifest.xml`

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET"/>

    <application
        android:label="VyaparPulse"
        android:name="${applicationName}"
        android:icon="@mipmap/ic_launcher">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTop"
            android:theme="@style/LaunchTheme"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|smallestScreenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode"
            android:hardwareAccelerated="true"
            android:windowSoftInputMode="adjustResize">
            <meta-data
              android:name="io.flutter.embedding.android.NormalTheme"
              android:resource="@style/NormalTheme" />
            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
        </activity>
        <meta-data
            android:name="flutterEmbedding"
            android:value="2" />
    </application>
</manifest>
```

---

## `android/app/src/main/kotlin/com/vyaparpulse/app/MainActivity.kt`

```kotlin
package com.vyaparpulse.app

import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity()
```

---

## `android/app/src/main/res/drawable/launch_background.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@android:color/black" />
</layer-list>
```

---

## `android/app/src/main/res/values-night/styles.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="LaunchTheme" parent="@android:style/Theme.Black.NoTitleBar">
        <item name="android:windowBackground">@drawable/launch_background</item>
    </style>

    <style name="NormalTheme" parent="@android:style/Theme.Black.NoTitleBar">
        <item name="android:windowBackground">@android:color/black</item>
    </style>
</resources>
```

---

## `android/app/src/main/res/values/styles.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="LaunchTheme" parent="@android:style/Theme.Black.NoTitleBar">
        <item name="android:windowBackground">@drawable/launch_background</item>
    </style>

    <style name="NormalTheme" parent="@android:style/Theme.Black.NoTitleBar">
        <item name="android:windowBackground">@android:color/black</item>
    </style>
</resources>
```

---

## `android/build.gradle`

```gradle
buildscript {
    repositories {
        google()
        mavenCentral()
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.buildDir = "../build"
subprojects {
    project.buildDir = "${rootProject.buildDir}/${project.name}"
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register("clean", Delete) {
    delete rootProject.buildDir
}
```

---

## `android/gradle.properties`

```properties
org.gradle.jvmargs=-Xmx4G -XX:MaxMetaspaceSize=2G -XX:+HeapDumpOnOutOfMemoryError
android.useAndroidX=true
android.enableJetifier=true
android.nonTransitiveRClass=true
```

---

## `android/gradle/wrapper/gradle-wrapper.properties`

```properties
distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\://services.gradle.org/distributions/gradle-8.4-all.zip
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
```

---

## `android/settings.gradle`

```gradle
pluginManagement {
    def flutterSdkPath = {
        def properties = new Properties()
        file("local.properties").withInputStream { properties.load(it) }
        def flutterSdkPath = properties.getProperty("flutter.sdk")
        assert flutterSdkPath != null, "flutter.sdk not set in local.properties"
        return flutterSdkPath
    }()

    includeBuild("$flutterSdkPath/packages/flutter_tools/gradle")

    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

plugins {
    id "dev.flutter.flutter-plugin-loader" version "1.0.0"
    id "com.android.application" version "8.1.0" apply false
    id "org.jetbrains.kotlin.android" version "1.9.10" apply false
}

include ":app"
```
