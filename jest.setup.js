/* global jest */
// In-memory AsyncStorage so store tests can read/write without a device.
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

// The app must never touch the network on its own. Any fetch that a test didn't explicitly
// stub fails loudly, so an accidental request shows up as a test failure.
global.fetch = jest.fn(() => Promise.reject(new Error('Unexpected network request in test')));

// SafeAreaProvider waits for native insets before rendering children; use the library's test mock.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
