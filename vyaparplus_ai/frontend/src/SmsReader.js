import { PermissionsAndroid, Platform } from 'react-native';
import SmsAndroid from 'react-native-get-sms-android'; // Android-only native module
import { api } from './api';

/**
 * Real Android SMS integration — reads the device inbox and forwards each
 * message to the backend exactly the way mock data does (same POST /payments
 * shape), so the parser/matcher never need to know which source a message
 * came from.
 *
 * ⚠️ READ THIS BEFORE SHIPPING: Google Play policy requires an app to be
 * registered as the device's default SMS (or Assistant) handler before it
 * is permitted to request READ_SMS at all. This code works correctly on a
 * sideloaded/dev-installed APK — the OS permission system itself has no
 * such restriction, only Play Store's review/distribution policy does. So
 * this is genuinely useful for local testing and demos, but cannot be
 * published to the Play Store as a regular (non-default-SMS-handler) app.
 * Real-world alternatives for a production version: bank/UPI webhook or
 * API integration, or having the merchant forward/paste relevant SMS
 * manually into the "New Sale"-style flow.
 */

export async function requestSmsPermission() {
  if (Platform.OS !== 'android') {
    throw new Error('SMS reading is Android-only.');
  }
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.READ_SMS,
    {
      title: 'SMS Permission',
      message: 'VyaparPlus AI needs to read incoming bank SMS to verify payments.',
      buttonPositive: 'Allow',
    }
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

/**
 * Reads the most recent `maxCount` inbox messages and syncs each one to the
 * backend via POST /payments. The backend's sms_id de-duplication means
 * calling this repeatedly (e.g. on a pull-to-refresh) is safe — already-seen
 * messages are simply returned as-is, not re-inserted.
 */
export function readInboxAndSync({ maxCount = 20 } = {}) {
  return new Promise((resolve, reject) => {
    const filter = { box: 'inbox', maxCount };

    SmsAndroid.list(
      JSON.stringify(filter),
      (fail) => reject(new Error(fail)),
      async (count, smsList) => {
        const messages = JSON.parse(smsList);
        const results = [];

        for (const sms of messages) {
          try {
            const result = await api.createPaymentMessage({
              sms_id: String(sms._id),
              sender: sms.address,
              raw_sms: sms.body,
              sms_timestamp: new Date(Number(sms.date)).toISOString(),
            });
            results.push(result);
          } catch (e) {
            // One bad/unreachable message shouldn't block the rest of the
            // inbox sync — log and move on.
            console.warn('Failed to sync SMS', sms._id, e);
          }
        }

        resolve(results);
      }
    );
  });
}
