import React from 'react';
const QuestionList = React.lazy(() => import('./pages/QuestionList'));
const NewQuestion = React.lazy(() => import('./pages/NewQuestion'));
const QuestionDetail = React.lazy(() => import('./pages/QuestionDetail'));
const Interests = React.lazy(() => import('./pages/Interests'));
const academicPages = [
  { path: '/questions', element: <QuestionList />, title: 'academic-list', priv: true },
  { path: '/questions/new', element: <NewQuestion />, title: 'academic-new', priv: true },
  { path: '/questions/interests', element: <Interests />, title: 'academic-interests', priv: true },
  {
    path: '/questions/:questionId',
    element: <QuestionDetail />,
    title: 'academic-detail',
    priv: true,
  },
];
export default academicPages;
