import React from 'react';
const List = React.lazy(() => import('./List'));
const Detail = React.lazy(() => import('./Detail'));
const NewDocument = React.lazy(() => import('./Form').then((m) => ({ default: m.NewDocument })));
const EditDocument = React.lazy(() => import('./Form').then((m) => ({ default: m.EditDocument })));
const Moderation = React.lazy(() => import('./Moderation'));
export default [
  { path: '/documents', element: <List /> },
  { path: '/documents/new', element: <NewDocument /> },
  { path: '/documents/mine', element: <List scope="/mine" /> },
  { path: '/documents/saved', element: <List scope="/saved" /> },
  { path: '/documents/moderation', element: <Moderation /> },
  { path: '/documents/:id/edit', element: <EditDocument /> },
  { path: '/documents/:id', element: <Detail /> },
].map((route) => ({ ...route, priv: true, title: 'documents' }));
