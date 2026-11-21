import * as Yup from 'yup';
import isStrongPassword from 'validator/lib/isStrongPassword';

export const passwordValidation = Yup.string()
  .required('Vui lòng nhập mật khẩu')
  .min(8, 'Mật khẩu cần ít nhất 8 ký tự')
  .test(
    'strong-password',
    'Mật khẩu cần có chữ thường, chữ hoa, số và ký tự đặc biệt',
    (value) => !value || isStrongPassword(value)
  );

export const passwordConfirmation = Yup.string()
  .required('Vui lòng nhập lại mật khẩu')
  .oneOf([Yup.ref('password')], 'Mật khẩu nhập lại chưa khớp');

export function birthDateError(values, today = new Date()) {
  const year = Number(values.birth_Year);
  const month = Number(values.birth_Month);
  const day = Number(values.birth_Day);
  const date = new Date(year, month - 1, day);
  if (
    ![year, month, day].every(Number.isInteger) ||
    date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day
  ) return 'Ngày sinh không hợp lệ';
  let age = today.getFullYear() - year;
  if (today.getMonth() < month - 1 ||
      (today.getMonth() === month - 1 && today.getDate() < day)) age -= 1;
  return age >= 14 && age <= 70 ? '' : 'Vui lòng nhập ngày sinh thật (từ 14 đến 70 tuổi)';
}
