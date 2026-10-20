import * as Device from 'expo-device';
import { checkIntegrity, type DeviceIntegrity } from './deviceIntegrityCore';

export { DEVICE_WARNING } from './deviceIntegrityCore';
export type { DeviceIntegrity };

export const checkDeviceIntegrity = () => checkIntegrity(() => Device.isRootedExperimentalAsync());
