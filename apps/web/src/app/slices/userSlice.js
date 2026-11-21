import { createSlice } from '@reduxjs/toolkit';
import axios from 'axios';
import Cookies from 'js-cookie';
import { normalizeMediaLinks } from 'shared/lib/mediaLinks';

const initialValue = {
  userinfo: Cookies.get('user') ? normalizeMediaLinks(JSON.parse(Cookies.get('user'))) : null,
  theme: 'light',
  fcm: Cookies.get('fcm') ? JSON.parse(Cookies.get('fcm')) : null,
};
export const userSlice = createSlice({
  name: 'user',
  initialState: initialValue,

  reducers: {
    login: (state, action) => {
      state.userinfo = action.payload.data.user;
      state.theme = 'light';
      Cookies.remove('theme');
      Cookies.remove('token');
      delete axios.defaults.headers.common.Authorization;
      Cookies.set('user', JSON.stringify(action.payload.data.user), {
        expires: 90,
      });
    },

    updateProfilePhoto: (state, action) => {
      state.userinfo.photo = action.payload;
      Cookies.set('user', JSON.stringify(state.userinfo), {
        expires: 90,
      });
    },

    updateCoverPhoto: (state, action) => {
      state.userinfo.cover = action.payload;
      Cookies.set('user', JSON.stringify(state.userinfo), {
        expires: 90,
      });
    },

    updateNStats: (state, action) => {
      state.userinfo.recivedRequestsCount =
        action.payload.recivedRequestsCount >= 0
          ? action.payload.recivedRequestsCount
          : state.userinfo.recivedRequestsCount;

      state.userinfo.unseenMessages =
        action.payload.unseenMessages >= 0
          ? action.payload.unseenMessages
          : state.userinfo.unseenMessages;

      state.userinfo.unseenNotification =
        action.payload.unseenNotification >= 0
          ? action.payload.unseenNotification
          : state.userinfo.unseenNotification;

      Cookies.set('user', JSON.stringify(state.userinfo), {
        expires: 90,
      });
    },

    reciveNoti: (state, action) => {
      if (action.payload?.type === 'notification') {
        state.userinfo.unseenNotification = state.userinfo.unseenNotification + 1;
      } else if (action?.payload.type === 'message') {
        state.userinfo.unseenMessages = state.userinfo.unseenMessages + 1;
      }

      Cookies.set('user', JSON.stringify(state.userinfo), {
        expires: 90,
      });
    },

    logout: (state, action) => {
      state.userinfo = null;
      delete axios.defaults.headers.common.Authorization;
      Cookies.set('user', null);
      Cookies.set('token', null);
    },

    changeTheme: (state, action) => {
      state.theme = action.payload;
    },
  },
});
export const {
  login,
  logout,
  updateProfilePhoto,
  updateCoverPhoto,
  changeTheme,
  updateNStats,
  reciveNoti,
} = userSlice.actions;

export default userSlice.reducer;
