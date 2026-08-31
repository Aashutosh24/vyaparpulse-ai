// Real, live integration test -- imports the actual adapter classes and
// canonical mapping functions used by the app, and calls them against the
// real running voice-agent and backend servers. Run with:
//   node --experimental-strip-types integration_test.ts
// Not a unit test with mocks: if this passes, the real code path (voice
// text -> canonical -> backend transaction -> backend read-back) actually
// works end to end, not just "compiles."
import assert from 'node:assert/strict';
import { VoiceAgentClient } from './src/services/voiceAgentClient.ts';
import { BackendApiClient } from './src/services/backendClient.ts';
import { mapVoiceToCanonical, mapCanonicalToBackendRequests } from './src/services/canonicalTransaction.ts';

const VOICE_URL = process.env.VOICE_URL ?? 'http://127.0.0.1:8203';
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://127.0.0.1:8202';

async function main() {
  const voice = new VoiceAgentClient(VOICE_URL);
  const backend = new BackendApiClient(BACKEND_URL, 'integration_test_merchant');

  console.log('1. voice.sendText() against the real voice agent...');
  const voiceResult = await voice.sendText('two samosas for fifty rupees', 0.94);
  assert.equal(voiceResult.accepted, true, 'voice agent should accept a clean utterance');
  assert.ok(voiceResult.transaction, 'accepted result must include a transaction');
  assert.equal(voiceResult.transaction!.item, 'Samosa');
  assert.equal(voiceResult.transaction!.quantity, 2);
  assert.equal(voiceResult.transaction!.amount, 50);
  console.log('   OK ->', JSON.stringify(voiceResult.transaction));

  console.log('2. mapVoiceToCanonical() on the real voice response...');
  const canonical = mapVoiceToCanonical(voiceResult.transaction!);
  assert.equal(canonical.items.length, 1);
  assert.equal(canonical.items[0].name, 'Samosa');
  assert.equal(canonical.amount, 50);
  assert.equal(canonical.voice?.confidence, 0.94);
  console.log('   OK ->', JSON.stringify(canonical));

  console.log('3. mapCanonicalToBackendRequests() + backend.createTransaction() against the real backend...');
  const requests = mapCanonicalToBackendRequests(canonical, 'integration_test_merchant');
  assert.equal(requests.length, 1, 'single-item voice sale should produce exactly one backend request');
  const created = await backend.createTransaction(requests[0]);
  assert.equal(created.item, 'Samosa');
  assert.equal(created.quantity, 2);
  assert.equal(created.amount, 50);
  assert.equal(created.status, 'PENDING');
  assert.equal(created.merchant_id, 'integration_test_merchant');
  console.log('   OK -> backend assigned transaction_id', created.transaction_id);

  console.log('4. backend.getTransaction() reads back the same record by its authoritative id...');
  const fetched = await backend.getTransaction(created.transaction_id);
  assert.equal(fetched.transaction_id, created.transaction_id);
  assert.equal(fetched.amount, 50);
  console.log('   OK -> read-back matches');

  console.log('5. backend.getInsights() reflects the new transaction...');
  const insights = await backend.getInsights(7, 'integration_test_merchant');
  assert.ok(insights.transaction_count >= 1, 'the transaction just created should be counted');
  console.log('   OK ->', JSON.stringify(insights));

  console.log('6. multi-item cart -> multiple backend requests (manual-entry shape)...');
  const multiItemCanonical = {
    items: [
      { name: 'Chai', qty: 2, unitPrice: 15 },
      { name: 'Biscuit', qty: 3, unitPrice: 10 },
    ],
    amount: 60,
    customerName: 'Test Customer',
    status: 'pending' as const,
    timestamp: new Date().toISOString(),
    source: 'manual' as const,
  };
  const multiRequests = mapCanonicalToBackendRequests(multiItemCanonical, 'integration_test_merchant');
  assert.equal(multiRequests.length, 2, 'a 2-line-item cart must become 2 backend requests -- confirmed gap #2');
  const createdMulti = await Promise.all(multiRequests.map((r) => backend.createTransaction(r)));
  assert.equal(createdMulti[0].item, 'Chai');
  assert.equal(createdMulti[1].item, 'Biscuit');
  console.log('   OK -> 2 separate transaction_ids:', createdMulti.map((t) => t.transaction_id).join(', '));

  console.log('\nALL 6 REAL, LIVE INTEGRATION CHECKS PASSED');
}

main().catch((err) => {
  console.error('INTEGRATION TEST FAILED:', err);
  process.exit(1);
});
