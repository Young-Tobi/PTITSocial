import * as Yup from 'yup';
import isStrongPassword from 'validator/lib/isStrongPassword';
import { passwordValidation, passwordConfirmation, birthDateError } from './authValidation';

test('signup and reset passwords follow the same rules as the server', () => {
  for (const password of ['Aa1!bc', 'Aa1!bcd', 'Aa1!bcde', 'Password?123', 'weakpassword', 'NOLOWER!123', 'NoNumber!', 'NoSymbol123']) {
    expect(passwordValidation.isValidSync(password)).toBe(isStrongPassword(password));
  }
  const form = Yup.object({ password: passwordValidation, passwordConfirm: passwordConfirmation });
  expect(form.isValidSync({ password: 'Password?123', passwordConfirm: '' })).toBe(false);
  expect(form.isValidSync({ password: 'Password?123', passwordConfirm: 'Other!123' })).toBe(false);
  expect(form.isValidSync({ password: 'Password?123', passwordConfirm: 'Password?123' })).toBe(true);
});

test('birth date validates real calendar days, leap years and exact age boundaries', () => {
  const today = new Date(2026, 10, 19);
  const check = (year, month, day) => birthDateError({ birth_Year: year, birth_Month: month, birth_Day: day }, today);
  expect(check(2012, 11, 19)).toBe('');
  expect(check(2012, 11, 20)).not.toBe('');
  expect(check(1955, 11, 20)).toBe('');
  expect(check(1955, 11, 19)).not.toBe('');
  expect(check(2004, 2, 29)).toBe('');
  expect(check(2003, 2, 29)).not.toBe('');
  expect(check(2003, 4, 31)).not.toBe('');
  expect(check(2003, 1, 0)).not.toBe('');
});
