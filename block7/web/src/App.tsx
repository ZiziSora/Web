import React from 'react';
import { Navigate,Route,Routes } from 'react-router-dom';
import { RecordPage } from './RecordPage';
import { ApiError,labels,type Resource } from './api';
import { State } from './components/State';
import { Layout } from './components/layout/Layout';
import { Detail } from './pages/Detail';
import { Menu } from './pages/Menu';
import { Editor } from './pages/admin/Editor';
import { List } from './pages/admin/List';

export function App() { return <Layout><Routes>
      <Route path="/" element={<Navigate to="/dishes" replace />} />
      <Route path="/dishes" element={<Menu />} />
      <Route path="/dishes/:id" element={<Detail />} />
      <Route path="/admin" element={<Navigate to="/admin/dishes" replace />} />
      {(Object.keys(labels) as Resource[]).map(r => <React.Fragment key={r}>
        <Route path={'/admin/' + r} element={<List key={r} resource={r} />} />
        <Route path={'/admin/' + r + '/new'} element={<Editor key={r + 'new'} resource={r} />} />
        <Route path={'/admin/' + r + '/:id/edit'} element={<RecordPage resource={r} mode="edit" />} />
        <Route path={'/admin/' + r + '/:id/delete'} element={<RecordPage resource={r} mode="delete" />} />
      </React.Fragment>)}
      <Route path="*" element={<State loading={false} error={new ApiError('Trang không tồn tại.', 'NOT_FOUND')} retry={() => {}} />} />
    </Routes></Layout>; }
