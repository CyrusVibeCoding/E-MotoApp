import AsyncStorage from '@react-native-async-storage/async-storage';
import { createStorage } from './storageCore';
export { emptyData } from './storageCore';
export type { Data } from './storageCore';
// Shared serialized writer: old checkpoints cannot overwrite newer saves.
export const { readData, writeData } = createStorage(AsyncStorage);
