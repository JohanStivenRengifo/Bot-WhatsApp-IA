import { isValidPassword } from '../utils/passwordUtils';

describe('Password Utils', () => {
  describe('isValidPassword', () => {
    it('should return true for valid password', () => {
      const validPassword = 'MyPassword123!';
      expect(isValidPassword(validPassword)).toBe(true);
    });

    it('should return false for password without uppercase', () => {
      const invalidPassword = 'mypassword123!';
      expect(isValidPassword(invalidPassword)).toBe(false);
    });

    it('should return false for password without number', () => {
      const invalidPassword = 'MyPassword!';
      expect(isValidPassword(invalidPassword)).toBe(false);
    });

    it('should return false for password without special character', () => {
      const invalidPassword = 'MyPassword123';
      expect(isValidPassword(invalidPassword)).toBe(false);
    });

    it('should return false for password too short', () => {
      const invalidPassword = 'MyP1!';
      expect(isValidPassword(invalidPassword)).toBe(false);
    });
  });
});