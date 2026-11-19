import React from 'react';
import * as ReactDOMClient from 'react-dom/client';
import './index.css';
import './styles/dark.css';
import 'react-loading-skeleton/dist/skeleton.css';

import './styles/icons/icons.css';
import './styles/ptitsocial.css';
import 'moment/locale/vi';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './app/store';
import axios from 'axios';

// Gui cookie HttpOnly toi API. Token khong con duoc luu trong JavaScript.
axios.defaults.withCredentials = true;

const root = ReactDOMClient.createRoot(document.getElementById('backbook'));
root.render(
  <Provider store={store}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </Provider>
);
