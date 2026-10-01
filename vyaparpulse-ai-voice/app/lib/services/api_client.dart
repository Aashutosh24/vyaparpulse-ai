import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config.dart';
import '../models/product.dart';
import '../models/transaction.dart';

class BackendException implements Exception {
  final String message;
  const BackendException(this.message);
  @override
  String toString() => message;
}

/// Everything the app asks of the backend except the audio stream, which lives
/// in VoiceClient.
class ApiClient {
  final http.Client _http;
  ApiClient([http.Client? client]) : _http = client ?? http.Client();

  static const _timeout = Duration(seconds: 8);

  Future<dynamic> _get(String path) async {
    try {
      final res = await _http.get(AppConfig.http(path)).timeout(_timeout);
      if (res.statusCode >= 400) {
        throw BackendException('$path returned ${res.statusCode}');
      }
      return jsonDecode(utf8.decode(res.bodyBytes));
    } on BackendException {
      rethrow;
    } catch (e) {
      throw BackendException('Cannot reach ${AppConfig.backendUrl}. $e');
    }
  }

  Future<dynamic> _send(String method, String path, [Object? body]) async {
    try {
      final request = http.Request(method, AppConfig.http(path))
        ..headers['Content-Type'] = 'application/json';
      if (body != null) request.body = jsonEncode(body);

      final streamed = await _http.send(request).timeout(_timeout);
      final res = await http.Response.fromStream(streamed);
      if (res.statusCode >= 400) {
        throw BackendException('$path returned ${res.statusCode}');
      }
      if (res.body.isEmpty) return null;
      return jsonDecode(utf8.decode(res.bodyBytes));
    } on BackendException {
      rethrow;
    } catch (e) {
      throw BackendException('Cannot reach ${AppConfig.backendUrl}. $e');
    }
  }

  /// True when the backend answers and has a speech model loaded.
  Future<({bool reachable, bool speechReady, String? error})> health() async {
    try {
      final data = await _get('/health') as Map<String, dynamic>;
      final speech = (data['speech'] as Map?) ?? const {};
      return (
        reachable: true,
        speechReady: speech['ready'] == true,
        error: speech['error'] as String?,
      );
    } catch (e) {
      return (reachable: false, speechReady: false, error: e.toString());
    }
  }

  Future<List<Transaction>> transactions() async {
    final rows = await _get('/api/transactions') as List;
    return rows
        .map((r) => Transaction.fromJson(r as Map<String, dynamic>))
        .toList();
  }

  Future<DaySummary> summary() async =>
      DaySummary.fromJson(await _get('/api/summary') as Map<String, dynamic>);

  Future<List<Product>> products() async {
    final rows = await _get('/api/products') as List;
    return rows
        .map((r) => Product.fromJson(r as Map<String, dynamic>))
        .toList();
  }

  /// Runs typed text through the same extractor the microphone uses.
  Future<({bool accepted, String reason, Transaction? transaction})> sendText(
    String text,
  ) async {
    final data =
        await _send('POST', '/api/voice/text', {'text': text}) as Map<String, dynamic>;
    final txn = data['transaction'] as Map<String, dynamic>?;
    return (
      accepted: data['accepted'] == true,
      reason: (data['reason'] as String?) ?? '',
      transaction: txn == null ? null : Transaction.fromJson(txn),
    );
  }

  Future<void> setStatus(String id, TransactionStatus status) => _send(
        'PATCH',
        '/api/transactions/$id/status',
        {'status': status == TransactionStatus.paid ? 'PAID' : 'PENDING'},
      );

  Future<void> delete(String id) => _send('DELETE', '/api/transactions/$id');

  void close() => _http.close();
}
