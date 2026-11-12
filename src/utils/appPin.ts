// The app PIN on this phone: a salted hash and a wrong-try counter in secure storage. Cleared on sign out.
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { attemptsLeft, checkPin, makePinRecord, parsePinRecord, pinBlocked, weakPinReason } from './pinCore';

const PIN_ITEM = 'wr.appPin.v1';
const FAILS_ITEM = 'wr.appPin.fails.v1';
const supported = Platform.OS !== 'web';

export type PinCheck = { ok: true } | { ok: false; left: number; blocked: boolean };

const readFails = async (): Promise<number> => {
  try {
    const n = Number(await SecureStore.getItemAsync(FAILS_ITEM));
    return Number.isInteger(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
};
const writeFails = (n: number) => SecureStore.setItemAsync(FAILS_ITEM, String(n)).catch(() => {});

export const appPin = {
  supported,

  async isSet(): Promise<boolean> {
    if (!supported) return false;
    try {
      return parsePinRecord(await SecureStore.getItemAsync(PIN_ITEM)) !== null;
    } catch {
      return false;
    }
  },

  /** True once the PIN has been refused too many times in a row. Another unlock (fingerprint, face or a code) clears it. */
  async isBlocked(): Promise<boolean> {
    return pinBlocked(await readFails());
  },

  async set(pin: string): Promise<void> {
    const weak = weakPinReason(pin);
    if (weak) throw new Error(weak);
    const salt = Crypto.getRandomBytes(16);
    await SecureStore.setItemAsync(PIN_ITEM, JSON.stringify(makePinRecord(pin, salt)));
    await writeFails(0);
  },

  async verify(pin: string): Promise<PinCheck> {
    const rec = parsePinRecord(await SecureStore.getItemAsync(PIN_ITEM).catch(() => null));
    const fails = await readFails();
    if (!rec) return { ok: false, left: 0, blocked: true };
    if (pinBlocked(fails)) return { ok: false, left: 0, blocked: true };
    if (checkPin(pin, rec)) {
      await writeFails(0);
      return { ok: true };
    }
    const next = fails + 1;
    await writeFails(next);
    return { ok: false, left: attemptsLeft(next), blocked: pinBlocked(next) };
  },

  /** Called after a stronger unlock (fingerprint, face or an emailed code) so a blocked PIN works again. */
  async resetAttempts(): Promise<void> {
    if (supported) await writeFails(0);
  },

  async remove(): Promise<void> {
    if (!supported) return;
    await SecureStore.deleteItemAsync(PIN_ITEM).catch(() => {});
    await SecureStore.deleteItemAsync(FAILS_ITEM).catch(() => {});
  },
};
