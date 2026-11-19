import { useState } from 'react';
import Card from 'shared/components/ui/Card/Card';
import styles from './style.module.css';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import LoginInput from 'shared/components/inputs/login/index';
import FormLoader from 'shared/components/FormLoader/index';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useDispatch } from 'react-redux';
import { login } from 'app/slices/userSlice';
import { passwordValidation, passwordConfirmation } from 'shared/lib/authValidation';

function ChangePassword({ setUserInfos, userInfos }) {
  const { email, token, password = '', passwordConfirm = '' } = userInfos;
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setUserInfos({ ...userInfos, [name]: value });
  };

  const changePasswordValid = Yup.object({
    password: passwordValidation,
    passwordConfirm: passwordConfirmation,
  });

  const submitHandler = async (values) => {
    try {
      setLoading(true);
      const { data } = await axios.patch(
        `${process.env.REACT_APP_BACKEND_URL}/api/v1/users/resetPassword`,
        {
          email,
          token,
          password: values.password,
          passwordConfirm: values.passwordConfirm,
        },
        {
          withCredentials: true,
        }
      );
      dispatch(login(data));
      setError('');
      setLoading(false);
    } catch (error) {
      setError(error.response?.data?.message || 'Không thể kết nối máy chủ. Vui lòng thử lại.');
      setTimeout(() => {
        setLoading(false);
      }, 1000);
    }
  };

  return (
    <Card className={styles.wrap}>
      <div className={styles.header}>Đặt lại mật khẩu</div>
      {error ? (
        <div className={styles.error}>
          <div className={styles.error_header}>Chưa thể đổi mật khẩu</div>
          <span>{error}</span>
        </div>
      ) : (
        ''
      )}

      <div className={styles.content}>
        <span className={styles.text}>Mật khẩu cần ít nhất 8 ký tự, gồm chữ thường, chữ hoa, số và ký tự đặc biệt.</span>
        <Formik
          enableReinitialize
          initialValues={{ password, passwordConfirm }}
          validationSchema={changePasswordValid}
          onSubmit={(values) => {
            submitHandler(values);
          }}
        >
          {(formik) => (
            <Form noValidate>
              <FormLoader loading={loading} className={styles.form}>
                <LoginInput
                  className={styles.input}
                  type="password"
                  name="password"
                  placeholder="Mật khẩu mới"
                  onChange={handlePasswordChange}
                  disabled={loading}
                />
                <LoginInput
                  className={styles.input}
                  type="password"
                  name="passwordConfirm"
                  placeholder="Nhập lại mật khẩu mới"
                  onChange={handlePasswordChange}
                  disabled={loading}
                />
              </FormLoader>

              <div className={styles.btns}>
                <Link className="gray_btn" to="/login">
                  Hủy
                </Link>
                <button type="submit" className="btn_blue" disabled={loading}>
                  Đổi mật khẩu
                </button>
              </div>
            </Form>
          )}
        </Formik>
      </div>
    </Card>
  );
}

export default ChangePassword;
