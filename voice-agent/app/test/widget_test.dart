import 'package:flutter_test/flutter_test.dart';

import 'package:merchant_voice_agent_app/config.dart';

void main() {
  test('backend address accepts bare IPs, host:port and full URLs', () {
    expect(AppConfig.normalize('192.168.1.7'), 'http://192.168.1.7:8000');
    expect(AppConfig.normalize('192.168.1.7:9000'), 'http://192.168.1.7:9000');
    expect(AppConfig.normalize('http://10.0.2.2:8000/'), 'http://10.0.2.2:8000');
    expect(AppConfig.normalize('  '), AppConfig.defaultUrl);
  });

  test('websocket URL is derived from the http one', () {
    AppConfig.backendUrl = 'http://192.168.1.7:8000';
    expect(AppConfig.ws('/ws/audio').toString(), 'ws://192.168.1.7:8000/ws/audio');
  });
}
