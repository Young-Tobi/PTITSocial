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
const QuizLibrary = React.lazy(() => import('pages/quiz/index'));
const QuizEditor = React.lazy(() => import('pages/quiz/Editor'));
const QuizRoom = React.lazy(() => import('pages/quiz/Room'));
const CodingLibrary = React.lazy(() => import('pages/coding/index'));
const CodingCreate = React.lazy(() => import('pages/coding/Create'));
const CodingRoom = React.lazy(() => import('pages/coding/Room'));

const Learning = React.lazy(() => import('pages/learning/index'));
const Flashcards = React.lazy(() => import('pages/learning/Flashcards'));
const Roadmaps = React.lazy(() => import('pages/learning/Roadmaps'));
const FocusDiscover = React.lazy(() => import('pages/focus/FocusDiscover'));
const FocusCreate = React.lazy(() => import('pages/focus/FocusCreate'));
const FocusRoom = React.lazy(() => import('pages/focus/FocusRoom'));
const StudySpotMap = React.lazy(() => import('pages/studySpot/StudySpotMap'));
const StudySpotDetail = React.lazy(() => import('pages/studySpot/StudySpotDetail'));
const MyMeetups = React.lazy(() => import('pages/studySpot/MyMeetups'));

const pagesData = [
  ...academicPages,
  ...documentPages,
  { path: '/learning/flashcards', element: <Flashcards />, title: 'flashcards', priv: true },
  {
    path: '/learning/flashcards/:deckId',
    element: <Flashcards />,
    title: 'flashcard-deck',
    priv: true,
  },
  { path: '/learning', element: <Roadmaps />, title: 'roadmaps', priv: true },
  { path: '/learning/roadmaps/:roadmapId', element: <Roadmaps />, title: 'roadmap', priv: true },
  { path: '/learning/ai', element: <Learning />, title: 'learning-ai', priv: true },
  {
    path: '/learning/ai/:sessionId',
    element: <Learning />,
    title: 'learning-ai-detail',
    priv: true,
  },
  { path: '/learning/:sessionId', element: <Learning />, title: 'learning-detail', priv: true },
  { path: '/focus', element: <FocusDiscover />, title: 'focus', priv: true },
  { path: '/focus/new', element: <FocusCreate />, title: 'focus-new', priv: true },
  { path: '/focus/:roomId', element: <FocusRoom />, title: 'focus-room', priv: true },
  { path: '/study-spots', element: <StudySpotMap />, title: 'study-spots', priv: true },
  { path: '/study-spots/my-meetups', element: <MyMeetups />, title: 'study-meetups', priv: true },
  { path: '/study-meetups', element: <MyMeetups />, title: 'study-meetups', priv: true },
  {
    path: '/study-spots/:locationId',
    element: <StudySpotDetail />,
    title: 'study-spot-detail',
    priv: true,
  },

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
