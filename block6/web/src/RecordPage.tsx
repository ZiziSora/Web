import { useParams } from 'react-router-dom';
import { type Resource } from './api';
import { Delete } from './pages/admin/Delete';
import { Editor } from './pages/admin/Editor';

export function RecordPage({ resource, mode }: { resource: Resource; mode: 'edit' | 'delete' }) {
  const { id } = useParams();
  return mode === 'edit' ? <Editor key={resource + id} resource={resource} /> : <Delete key={resource + id} resource={resource} />;
}
