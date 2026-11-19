import React from 'react';

const Home = React.lazy(() => import('pages/home/index'));
const Login = React.lazy(() => import('pages/login/index'));
const Forgot = React.lazy(() => import('pages/forgot/index'));
const Profile = React.lazy(() => import('pages/profile/index'));
const FriendsPage = React.lazy(() => import('pages/friends/index'));
const PostPage = React.lazy(() => import('pages/post/PostPage'));
const Messages = React.lazy(() => import('pages/messages/index'));
const FocusDiscover = React.lazy(() => import('pages/focus/FocusDiscover'));
const FocusCreate = React.lazy(() => import('pages/focus/FocusCreate'));
const FocusRoom = React.lazy(() => import('pages/focus/FocusRoom'));
const StudySpotMap = React.lazy(() => import('pages/studySpot/StudySpotMap'));
const StudySpotDetail = React.lazy(() => import('pages/studySpot/StudySpotDetail'));
const MyMeetups = React.lazy(() => import('pages/studySpot/MyMeetups'));

const pagesData = [
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
    path: 'focus',
    element: <FocusDiscover />,
    title: 'focus-discover',
    priv: true,
  },
  {
    path: 'focus/new',
    element: <FocusCreate />,
    title: 'focus-create',
    priv: true,
  },
  {
    path: 'focus/:roomId',
    element: <FocusRoom />,
    title: 'focus-room',
    priv: true,
  },
  {
    path: 'study-spots',
    element: <StudySpotMap />,
    title: 'study-spots',
    priv: true,
  },
  {
    path: 'study-spots/:locationId',
    element: <StudySpotDetail />,
    title: 'study-spot-detail',
    priv: true,
  },
  {
    path: 'study-meetups',
    element: <MyMeetups />,
    title: 'study-meetups',
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
