/// The contract with the backend and the payment-matching module.
/// Mirrors backend/app/models/transaction.py exactly.

enum TransactionStatus { pending, paid }

class Transaction {
  final String id;
  final String? item;
  final int? quantity;
  final double amount;      // the bill, always the total
  final double? unitPrice;  // set when a rate was spoken or looked up
  final DateTime timestamp;
  final TransactionStatus status;
  final String rawText;
  final double? confidence;

  const Transaction({
    required this.id,
    this.item,
    this.quantity,
    required this.amount,
    this.unitPrice,
    required this.timestamp,
    this.status = TransactionStatus.pending,
    this.rawText = '',
    this.confidence,
  });

  bool get isPaid => status == TransactionStatus.paid;

  String get label {
    if (item == null) return 'Unnamed sale';
    final rate = unitPrice == null ? '' : ' @ ₹${_money(unitPrice!)}';
    return '$item ×${quantity ?? 1}$rate';
  }

  static String _money(double v) =>
      v % 1 == 0 ? v.toStringAsFixed(0) : v.toStringAsFixed(2);

  factory Transaction.fromJson(Map<String, dynamic> json) => Transaction(
        id: json['id'] as String,
        item: json['item'] as String?,
        quantity: (json['quantity'] as num?)?.toInt(),
        amount: (json['amount'] as num).toDouble(),
        unitPrice: (json['unit_price'] as num?)?.toDouble(),
        timestamp:
            DateTime.parse(json['timestamp'] as String).toLocal(),
        status: (json['status'] as String?)?.toUpperCase() == 'PAID'
            ? TransactionStatus.paid
            : TransactionStatus.pending,
        rawText: (json['raw_text'] as String?) ?? '',
        confidence: (json['confidence'] as num?)?.toDouble(),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'item': item,
        'quantity': quantity,
        'amount': amount,
        'unit_price': unitPrice,
        'timestamp': timestamp.toUtc().toIso8601String(),
        'status': status == TransactionStatus.paid ? 'PAID' : 'PENDING',
        'raw_text': rawText,
        'confidence': confidence,
      };
}

/// Day totals from GET /api/summary.
class DaySummary {
  final int totalCount;
  final double totalAmount;
  final int paidCount;
  final double paidAmount;
  final int pendingCount;
  final double pendingAmount;
  final List<String> overdueIds;

  const DaySummary({
    this.totalCount = 0,
    this.totalAmount = 0,
    this.paidCount = 0,
    this.paidAmount = 0,
    this.pendingCount = 0,
    this.pendingAmount = 0,
    this.overdueIds = const [],
  });

  factory DaySummary.fromJson(Map<String, dynamic> json) => DaySummary(
        totalCount: (json['total_transactions'] as num?)?.toInt() ?? 0,
        totalAmount: (json['total_amount'] as num?)?.toDouble() ?? 0,
        paidCount: (json['paid_count'] as num?)?.toInt() ?? 0,
        paidAmount: (json['paid_amount'] as num?)?.toDouble() ?? 0,
        pendingCount: (json['pending_count'] as num?)?.toInt() ?? 0,
        pendingAmount: (json['pending_amount'] as num?)?.toDouble() ?? 0,
        overdueIds:
            ((json['overdue_ids'] as List?) ?? const []).cast<String>(),
      );
}
