import React from 'react';

const Home = React.lazy(() => import('pages/home/index'));
const Login = React.lazy(() => import('pages/login/index'));
const Forgot = React.lazy(() => import('pages/forgot/index'));
const Profile = React.lazy(() => import('pages/profile/index'));
const FriendsPage = React.lazy(() => import('pages/friends/index'));
const PostPage = React.lazy(() => import('pages/post/PostPage'));
const Messages = React.lazy(() => import('pages/messages/index'));
const QuizLibrary = React.lazy(() => import('pages/quiz/index'));
const QuizEditor = React.lazy(() => import('pages/quiz/Editor'));
const QuizRoom = React.lazy(() => import('pages/quiz/Room'));
const CodingLibrary = React.lazy(() => import('pages/coding/index'));
const CodingCreate = React.lazy(() => import('pages/coding/Create'));
const CodingRoom = React.lazy(() => import('pages/coding/Room'));

const pagesData = [
  { path: '/coding', element: <CodingLibrary />, title: 'coding', priv: true },
  { path: '/coding/new', element: <CodingCreate />, title: 'coding', priv: true },
  { path: '/coding/rooms/:roomId', element: <CodingRoom />, title: 'coding', priv: true },
  { path: '/quiz', element: <QuizLibrary />, title: 'quiz', priv: true },
  { path: '/quiz/new', element: <QuizEditor key="new" />, title: 'quiz', priv: true },
  { path: '/quiz/:quizId/edit', element: <QuizEditor />, title: 'quiz', priv: true },
  { path: '/quiz/rooms/:roomId', element: <QuizRoom />, title: 'quiz', priv: true },
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
