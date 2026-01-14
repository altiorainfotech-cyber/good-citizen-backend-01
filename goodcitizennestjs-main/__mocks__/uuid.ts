export const v4 = jest.fn(() => 'test-uuid-1234-5678-9012-345678901234');
export const v1 = jest.fn(() => 'test-uuid-v1-1234-5678-9012-345678901234');
export const v3 = jest.fn(() => 'test-uuid-v3-1234-5678-9012-345678901234');
export const v5 = jest.fn(() => 'test-uuid-v5-1234-5678-9012-345678901234');

// Default export for compatibility
export default {
  v4,
  v1,
  v3,
  v5,
};