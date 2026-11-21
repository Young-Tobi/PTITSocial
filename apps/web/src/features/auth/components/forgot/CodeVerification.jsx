import { useState } from 'react';
import Card from 'shared/components/ui/Card/Card';
import styles from './style.module.css';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import LoginInput from 'shared/components/inputs/login/index';
import FormLoader from 'shared/components/FormLoader/index';
import { Link } from 'react-router-dom';
import axios from 'axios';

function CodeVerification({ setVisible, setUserInfos, userInfos }) {
  const { email, code = '' } = userInfos;
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCodeChange = (e) => {
    const { name, value } = e.target;
    setUserInfos({ ...userInfos, [name]: value });
  };

  const forgotValidation = Yup.object({
    code: Yup.string().required('Vui lòng nhập mã xác nhận').matches(/^\d{6}$/, 'Mã xác nhận gồm 6 chữ số'),
  });

  const submitHandler = async (values) => {
    try {
      setLoading(true);
      const { data } = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/v1/users/resetPassword`,
        {
          email,
          code: values.code,
        },
        {
          withCredentials: true,
        }
      );
      setUserInfos({ ...userInfos, token: data.data.token });
      setVisible(3);
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
      <div className={styles.header}>Nhập mã xác nhận</div>
      {error ? (
        <div className={styles.error}>
          <div className={styles.error_header}>Chưa thể xác nhận mã</div>
          <span>{error}</span>
        </div>
      ) : (
        ''
      )}

      <div className={styles.content}>
        <span className={styles.text}>
          Kiểm tra email và nhập mã gồm 6 chữ số. Mã có hiệu lực trong 10 phút.
        </span>
        <Formik
          enableReinitialize
          initialValues={{ code }}
          validationSchema={forgotValidation}
          onSubmit={(values) => {
            submitHandler(values);
          }}
        >
          {(formik) => (
            <Form noValidate>
              <FormLoader loading={loading} className={styles.code_form}>
                <LoginInput
                  className={styles.input}
                  type="text"
                  name="code"
                  placeholder="Mã xác nhận"
                  onChange={handleCodeChange}
                  disabled={loading}
                />
                <div className={styles.label_col}>
                  <span>Mã đã được gửi đến:</span>
                  <span>{userInfos.email}</span>
                </div>
              </FormLoader>

              <div className={styles.btns}>
                <Link className="gray_btn" to="/login">
                  Hủy
                </Link>
                <button type="submit" className="btn_blue" disabled={loading}>
                  Tiếp tục
                </button>
              </div>
            </Form>
          )}
        </Formik>
      </div>
    </Card>
  );
}

export default CodeVerification;
