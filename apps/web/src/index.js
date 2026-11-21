import React from 'react';
import * as ReactDOMClient from 'react-dom/client';
import './index.css';
import './styles/dark.css';
import 'react-loading-skeleton/dist/skeleton.css';

import './styles/icons/icons.css';
import './styles/ptitsocial.css';
import './app/locale';
import 'moment/locale/vi';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './app/store';
import axios from 'axios';
import Cookies from 'js-cookie';
import { normalizeMediaLinks } from './shared/lib/mediaLinks';

axios.interceptors.response.use((response) => {
  normalizeMediaLinks(response.data);
  return response;
});

// Existing JavaScript token cookies are retired; the API sets the HttpOnly session cookie.
Cookies.remove('token');
delete axios.defaults.headers.common.Authorization;
axios.defaults.withCredentials = true;

const root = ReactDOMClient.createRoot(document.getElementById('root'));
root.render(
  <Provider store={store}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </Provider>
);
