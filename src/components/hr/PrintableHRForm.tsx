'use client';

import React from 'react';

type DateLike = { toDate: () => Date } | Date | string | null | undefined;

interface HRDocument {
  documentType: string;
  userName: string;
  submissionDate: DateLike;
  contents?: {
    department?: string;
    position?: string;
    name?: string;
    joinDate?: DateLike;
    startDate?: DateLike;
    endDate?: DateLike;
    reason?: string;
    contact?: string;
    handover?: string;
    leaveType?: string;
  };
}

interface PrintableHRFormProps {
  document: HRDocument | null;
}

const formatDate = (value: DateLike) => {
  if (!value) return '-';

  if (value instanceof Date) {
    return value.toLocaleDateString('ko-KR');
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object' && value !== null) {
    const maybeDate = (value as { toDate?: () => Date }).toDate?.();
    if (maybeDate instanceof Date && !Number.isNaN(maybeDate.getTime())) {
      return maybeDate.toLocaleDateString('ko-KR');
    }
  }

  return '-';
};

const getTitleText = (documentType: string) => {
  if (documentType === '휴직원') return '휴직';
  if (documentType === '퇴직원') return '사직';
  if (documentType === '휴가원') return '휴가';
  return '';
};

export const PrintableHRForm: React.FC<PrintableHRFormProps> = ({ document }) => {
  if (!document) return null;

  const { documentType, userName, submissionDate, contents = {} } = document;
  const today = formatDate(submissionDate);
  const titleText = getTitleText(documentType);

  return (
    <div className="printable-hr-form">
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 20mm;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
        .printable-hr-form {
          font-family: 'Malgun Gothic', sans-serif;
          line-height: 1.6;
          color: #111827;
        }
        .printable-hr-form .printable-container {
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
        }
        .printable-hr-form h1 {
          text-align: center;
          font-size: 2.5rem;
          font-weight: bold;
          margin-bottom: 2rem;
          letter-spacing: 0.3rem;
        }
        .printable-hr-form .section {
          margin-top: 2rem;
        }
        .printable-hr-form .section--framed {
          border-top: 1px solid #d1d5db;
          border-bottom: 1px solid #d1d5db;
          padding: 1.5rem 0;
          margin-top: 0;
        }
        .printable-hr-form .section-title {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #d1d5db;
        }
        .printable-hr-form .info-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1rem;
          font-size: 0.95rem;
        }
        .printable-hr-form .info-grid p {
          margin: 0;
        }
        .printable-hr-form .content-box {
          border: 1px solid #e5e7eb;
          background-color: #f9fafb;
          padding: 1.25rem;
          border-radius: 0.5rem;
          font-size: 0.95rem;
        }
        .printable-hr-form .content-box p {
          margin: 0.25rem 0;
        }
        .printable-hr-form .submission-section {
          text-align: center;
          padding-top: 3rem;
        }
        .printable-hr-form .submission-section p {
          margin: 0 0 1.5rem 0;
        }
      `}</style>
      <div className="printable-container">
        <h1>{documentType}</h1>

        <div className="section section--framed">
          <h3 className="section-title">신청인 정보</h3>
          <div className="info-grid">
            <p><strong>소속:</strong> {contents.department || '-'}</p>
            <p><strong>직위:</strong> {contents.position || '-'}</p>
            <p><strong>성명:</strong> {contents.name || userName}</p>
            {documentType === '퇴직원' && (
              <p><strong>입사일:</strong> {formatDate(contents.joinDate)}</p>
            )}
          </div>
        </div>

        <div className="section">
          <h3 className="section-title">{titleText} 신청 내용</h3>
          <div className="content-box">
            {documentType === '휴직원' && (
              <>
                <p><strong>휴직 기간:</strong> {`${formatDate(contents.startDate)} ~ ${formatDate(contents.endDate)}`}</p>
                <p><strong>사유:</strong> {contents.reason || '-'}</p>
                <p><strong>휴직 중 비상연락처:</strong> {contents.contact || '-'}</p>
                <p><strong>업무 인수인계자:</strong> {contents.handover || '-'}</p>
              </>
            )}

            {documentType === '퇴직원' && (
              <>
                <p><strong>퇴직 예정일:</strong> {formatDate(contents.endDate)}</p>
                <p><strong>사유:</strong> {contents.reason || '-'}</p>
              </>
            )}

            {documentType === '휴가원' && (
              <>
                <p><strong>휴가 종류:</strong> {contents.leaveType || '-'}</p>
                <p><strong>휴가 기간:</strong> {`${formatDate(contents.startDate)} ~ ${formatDate(contents.endDate)}`}</p>
                <p><strong>사유:</strong> {contents.reason || '-'}</p>
                <p><strong>휴가 중 비상연락처:</strong> {contents.contact || '-'}</p>
              </>
            )}
          </div>
        </div>

        <div className="submission-section">
          <p>위와 같이 {titleText}하고자 하오니 허가하여 주시기 바랍니다.</p>
          <p>{today}</p>
          <p>신청인: {contents.name || userName} (인)</p>
        </div>
      </div>
    </div>
  );
};
