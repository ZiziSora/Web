import { RotateCcw, ArrowLeft } from 'lucide-react';
import { Link,useLocation } from 'react-router-dom';
import { ApiError,labels,type Resource } from '../api';
import { Loading } from './Loading';

export function State({ loading, error, retry }: { loading: boolean; error?: ApiError; retry: () => void }) {
  const { pathname } = useLocation();
  const admin = pathname.startsWith('/admin/');
  const resource = pathname.split('/')[admin ? 2 : 1] as Resource;
  const label = labels[resource];
  const missing = error?.code === 'NOT_FOUND';
  const back = admin && label ? '/admin/' + resource : '/dishes';
  const backLabel = admin && label ? 'Về danh sách ' + label : 'Về thực đơn';
  if (loading) return <Loading />;
  return <section className="status-panel" role={error ? 'alert' : 'status'}>
    <div className="status-art" aria-hidden="true"><span className="status-code">{missing ? '404' : '!'}</span></div>
    <div className="status-copy"><p className="eyebrow">THE TABLE</p>
      <h1>{missing ? label ? 'Không tìm thấy ' + label : 'Trang này không còn ở đây.' : 'Chưa thể tải thông tin.'}</h1>
      <p>{missing ? label ? 'Thông tin bạn tìm có thể đã được xóa hoặc đường dẫn chưa đúng. Hãy quay lại danh sách để chọn nội dung hiện có.' : 'Đường dẫn có thể chưa đúng. Hãy trở về thực đơn để tiếp tục khám phá.' : error?.message}</p>
      <div className="status-actions">{!missing && <button className="button" onClick={retry}><RotateCcw aria-hidden="true" focusable="false" /> Thử lại</button>}<Link className={'button ' + (!missing ? 'secondary' : '')} to={back}><ArrowLeft aria-hidden="true" focusable="false" /> {backLabel}</Link></div>
    </div>
  </section>;
}
