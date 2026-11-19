import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { request, useDocuments } from './api';
import { Layout, State, Person, Pager } from './Common';
import styles from './documents.module.css';
function Item({ report, reasons }) {
  const [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false);
  const client = useQueryClient();
  async function apply(action) {
    if (reason.trim().length < 5 || reason.length > 1000)
      return toast.error('Lý do xử lý cần 5–1.000 ký tự.');
    setBusy(true);
    try {
      if (action === 'hide' || action === 'restore')
        await request('/moderation/documents/' + report.document._id + '/status', 'PATCH', {
          status: action === 'hide' ? 'hidden' : 'published',
          reason,
        });
      if (action !== 'restore' && report.status === 'pending')
        await request('/moderation/reports/' + report._id, 'PATCH', {
          status: action === 'dismiss' ? 'dismissed' : 'resolved',
          resolution: reason,
        });
      await client.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Đã xử lý báo cáo.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className={styles.card}>
      <h2>
        {report.document ? (
          <Link to={'/documents/' + report.document._id}>{report.document.title}</Link>
        ) : (
          'Tài liệu đã bị xóa'
        )}
      </h2>
      <Person author={report.reporter} time={report.createdAt} />
      <p>{reasons?.find((r) => r.id === report.reason)?.name}</p>
      <p className={styles.body}>{report.body}</p>
      {report.resolution && <p>Kết quả: {report.resolution}</p>}
      {(report.status === 'pending' || report.document?.status === 'hidden') && (
        <>
          <label>
            Lý do xử lý
            <textarea value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} />
          </label>
          <div className={styles.bar}>
            {report.document && (
              <button
                disabled={busy}
                onClick={() => apply(report.document.status === 'hidden' ? 'restore' : 'hide')}
              >
                {report.document.status === 'hidden' ? 'Khôi phục tài liệu' : 'Ẩn tài liệu'}
              </button>
            )}
            {report.status === 'pending' && (
              <>
                <button disabled={busy} onClick={() => apply('dismiss')}>
                  Bác báo cáo
                </button>
                <button disabled={busy} onClick={() => apply('resolve')}>
                  Đánh dấu đã xử lý
                </button>
              </>
            )}
          </div>
        </>
      )}
    </article>
  );
}
export default function Moderation() {
  const [status, setStatus] = useState('pending'),
    [page, setPage] = useState(1);
  const catalog = useDocuments('/catalog'),
    query = useDocuments('/moderation/reports?status=' + status + '&page=' + page);
  return (
    <Layout>
      <h1>Quản lý báo cáo tài liệu</h1>
      <label>
        Trạng thái báo cáo
        <select
          aria-label="Trạng thái báo cáo"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="pending">Chờ xử lý</option>
          <option value="resolved">Đã xử lý</option>
          <option value="dismissed">Đã bác</option>
        </select>
      </label>
      <State query={query}>
        {query.data?.data.map((report) => (
          <Item key={report._id} report={report} reasons={catalog.data?.data.reasons} />
        ))}
        {!query.data?.total && <p>Không có báo cáo.</p>}
        <Pager page={page} total={query.data?.total || 0} change={setPage} />
      </State>
    </Layout>
  );
}
