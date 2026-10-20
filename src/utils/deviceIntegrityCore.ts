export interface DeviceIntegrity {
  /** True when the OS reports the phone as rooted (Android) or jailbroken (iOS). */
  compromised: boolean;
  /** True when the check could not run. Treated as "no finding", never as a failure. */
  unknown: boolean;
}

/**
 * Runs a probe that asks the OS whether the phone is rooted or jailbroken. This is a warning
 * signal, not a lock: custom ROMs and some developer phones trip it, and a determined attacker can
 * hide root. The app tells the person and records nothing about them.
 */
export async function checkIntegrity(probe: () => Promise<boolean>): Promise<DeviceIntegrity> {
  try {
    return { compromised: Boolean(await probe()), unknown: false };
  } catch {
    return { compromised: false, unknown: true };
  }
}

export const DEVICE_WARNING =
  'This phone looks rooted or jailbroken. Other apps on it may be able to read your health records. Use WelliRecord on a phone you trust.';
