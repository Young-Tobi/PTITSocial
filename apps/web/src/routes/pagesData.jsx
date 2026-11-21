import React from 'react';
import academicPages from 'features/academic/routes';
import documentPages from 'features/documents/routes';

const Home = React.lazy(() => import('pages/home/index'));
const Login = React.lazy(() => import('pages/login/index'));
const Forgot = React.lazy(() => import('pages/forgot/index'));
const Profile = React.lazy(() => import('pages/profile/index'));
const FriendsPage = React.lazy(() => import('pages/friends/index'));
const PostPage = React.lazy(() => import('pages/post/PostPage'));
const Messages = React.lazy(() => import('pages/messages/index'));

const pagesData = [
  ...documentPages,
  ...academicPages,
  {
    path: '',
    element: <Home />,
    title: 'home',
    priv: true,
  },
  {
    path: '/activate/:token',
    element: <Home />,
    title: 'home',
    priv: true,
  },
  {
    path: '/profile',
    element: <Profile />,
    title: 'profile',
    priv: true,
  },
  {
    path: '/messages',
    element: <Messages />,
    title: 'messages',
    priv: true,
  },
  {
    path: '/messages/:chatId',
    element: <Messages />,
    title: 'messages',
    priv: true,
  },
  {
    path: '/friends',
    element: <FriendsPage />,
    title: 'profile',
    priv: true,
  },
  {
    path: '/friends/:type',
    element: <FriendsPage />,
    title: 'profile',
    priv: true,
  },
  {
    path: '/profile/:username',
    element: <Profile />,
    title: 'profile',
    priv: true,
  },
  {
    path: '/:username/posts/:post',
    element: <PostPage />,
    title: 'profile',
    priv: true,
  },
  {
    path: 'forgot',
    element: <Forgot />,
    title: 'home',
    priv: false,
  },
  {
    path: 'login',
    element: <Login />,
    title: 'login',
    priv: false,
  },
];

export default pagesData;
