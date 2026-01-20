'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';

// This is a simplified interface for display purposes
interface HRDocument {
  documentType: string;
  userName: string;
  submissionDate: { toDate: () => Date };
  contents?: {
    department?: string;
    position?: string;
    name?: string;
    joinDate?: any;
    startDate?: any;
    endDate?: any;
    reason?: string;
    contact?: string;
    handover?: string;
    leaveType?: string;
  };
  fileUrl?: string;
}

interface HRFormDisplayProps {
  document: HRDocument | null;
}

export const HRFormDisplay: React.FC<HRFormDisplayProps> = ({ document }) => {
  if (!document) return null;

  const { documentType, userName, submissionDate, contents = {}, fileUrl } = document;
  const today = submissionDate.toDate().toLocaleDateString('ko-KR');

  const handleDownloadFile = () => {
    if (fileUrl) {
      window.open(fileUrl, '_blank');
    }
  };

  const formatDate = (value: any) => {
    if (!value) return '';
    try {
      if (typeof value.toDate === 'function') {
        const date = value.toDate();
        return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('ko-KR') : '';
      }
      const date = value instanceof Date ? value : new Date(value);
      return !Number.isNaN(date.getTime()) ? date.toLocaleDateString('ko-KR') : '';
    } catch (error) {
      console.warn('Date format error:', error);
      return '';
    }
  };

  const isLeaveOfAbsence = documentType === '휴직원' || documentType === '휴직계';
  const isResignation = documentType === '퇴직원' || documentType === '퇴직계';
  const isVacation = documentType === '휴가원' || documentType === '휴가계';

  const renderApplicationTitle = () => {
    if (isLeaveOfAbsence) return '휴직';
    if (isVacation) return '휴가';
    return '사직';
  };

  const renderContactLabel = () => {
    if (isLeaveOfAbsence) return '휴직 중 비상연락처';
    if (isVacation) return '휴가 중 비상연락처';
    return '비상연락처';
  };

  const renderPeriodLabel = () => {
    if (isLeaveOfAbsence) return '휴직 기간';
    if (isVacation) return '휴가 기간';
    return '기간';
  };

  const startDateText = formatDate(contents.startDate);
  const endDateText = formatDate(contents.endDate);
  const joinDateText = formatDate(contents.joinDate);

  return (
    <div className="p-8 bg-white rounded-lg">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold">{documentType}</h1>
      </div>

      {/* 파일 업로드로 제출된 경우 파일 다운로드 버튼 표시 */}
      {fileUrl && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                작성된 파일이 업로드되었습니다.
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadFile}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              파일 다운로드
            </Button>
          </div>
        </div>
      )}

      {/* 인적사항 */}
      <div className="border-t border-b py-4">
        <h3 className="text-lg font-semibold mb-4">신청인 정보</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <p><strong>소속:</strong> {contents.department || '-'}</p>
          <p><strong>직위:</strong> {contents.position || '-'}</p>
          <p><strong>성명:</strong> {contents.name || userName}</p>
          {isResignation && (
            <p><strong>입사일:</strong> {joinDateText || '-'}</p>
          )}
        </div>
      </div>

      {/* 신청 내용 - 파일 업로드로 제출된 경우에는 내용이 없을 수 있음 */}
      {contents && (contents.reason || contents.startDate || contents.endDate || contents.leaveType || contents.contact || contents.handover || contents.joinDate) && (
        <div className="mt-8 space-y-4">
          <h3 className="text-lg font-semibold">{renderApplicationTitle()} 신청 내용</h3>
          <div className="p-4 border rounded-md bg-gray-50 text-sm space-y-2">
            {isLeaveOfAbsence && (
              <>
                <p><strong>{renderPeriodLabel()}:</strong> {startDateText || ''} {startDateText && endDateText && ' ~ '} {endDateText || ''}</p>
                <p><strong>사유:</strong> {contents.reason || '-'}</p>
                <p><strong>{renderContactLabel()}:</strong> {contents.contact || '-'}</p>
                <p><strong>업무 인수인계자:</strong> {contents.handover || '-'}</p>
              </>
            )}
            {isVacation && (
              <>
                <p><strong>휴가 종류:</strong> {contents.leaveType || '-'}</p>
                <p><strong>{renderPeriodLabel()}:</strong> {startDateText || ''} {startDateText && endDateText && ' ~ '} {endDateText || ''}</p>
                <p><strong>사유:</strong> {contents.reason || '-'}</p>
                <p><strong>{renderContactLabel()}:</strong> {contents.contact || '-'}</p>
              </>
            )}
            {isResignation && (
              <>
                <p><strong>퇴직 예정일:</strong> {endDateText || '-'}</p>
                <p><strong>사유:</strong> {contents.reason || '-'}</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* 파일 업로드로만 제출된 경우 안내 메시지 */}
      {fileUrl && (!contents || (!contents.reason && !contents.startDate && !contents.endDate && !contents.leaveType)) && (
        <div className="mt-8 p-4 border rounded-md bg-yellow-50 text-sm">
          <p className="text-yellow-800">
            이 신청서는 파일 업로드로 제출되었습니다. 위의 "파일 다운로드" 버튼을 클릭하여 작성된 파일을 확인하세요.
          </p>
        </div>
      )}

      {/* 최종 제출 */}
      <div className="text-center pt-12">
        <p className="mb-4">위와 같이 {renderApplicationTitle()}하고자 하오니 허가하여 주시기 바랍니다.</p>
        <p className="mb-8">{today}</p>
        <p className="mb-10">신청인: {contents.name || userName} (인)</p>
      </div>
    </div>
  );
};
