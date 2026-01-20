
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { createRoot } from 'react-dom/client';
import { PrintableHRForm } from '@/components/hr/PrintableHRForm';

const NewHRRequestPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const formRef = useRef<HTMLDivElement>(null);
  
  const [documentType, setDocumentType] = useState<'휴직원' | '퇴직원' | '휴가원'>('휴직원');
  
  // User profile info
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [name, setName] = useState('');

  // Form fields
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [contact, setContact] = useState('');
  const [handover, setHandover] = useState('');
  const [joinDate, setJoinDate] = useState('');
  const [leaveType, setLeaveType] = useState('연차'); // For vacation form

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.displayName || '');
      // 휴가원일 때는 비상연락처를 사용자 정보의 전화번호로 기본 설정하지 않을 수 있으므로,
      // documentType에 따라 조건부로 설정하거나 사용자가 직접 입력하도록 둡니다.
      // setContact(user.phoneNumber || ''); 
      const fetchUserData = async () => {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setDepartment(userData.department || '');
          setPosition(userData.position || '');
          if (userData.joinDate) {
            setJoinDate(userData.joinDate.toDate().toISOString().split('T')[0]);
          }
        }
      };
      fetchUserData();
    }
  }, [user]);

  const handlePdfDownload = async () => {
    const printableElement = document.getElementById('printable-content');
    if (!printableElement) return;

    let contents = {};
    if (documentType === '휴직원') {
      contents = {
        department, position, name,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        reason,
        contact,
        handover,
      };
    } else if (documentType === '퇴직원') { 
      contents = {
        department, position, name, 
        joinDate: joinDate ? new Date(joinDate) : null,
        endDate: endDate ? new Date(endDate) : null, // 퇴직예정일
        reason,
      };
    } else { // 휴가원
      contents = {
        department, position, name,
        leaveType,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        reason,
        contact,
      };
    }

    const doc = {
        documentType,
        userName: name,
        submissionDate: { toDate: () => new Date() },
        contents
    }

    const root = createRoot(printableElement);
    root.render(<PrintableHRForm document={doc as any} />);

    setTimeout(async () => {
        const canvas = await html2canvas(printableElement, { scale: 2 });
        const data = canvas.toDataURL('image/png');

        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgProperties = pdf.getImageProperties(data);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProperties.height * pdfWidth) / imgProperties.width;

        pdf.addImage(data, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`${name}_${documentType}.pdf`);

        root.unmount();
    }, 500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ variant: "destructive", title: "오류", description: "로그인이 필요합니다." });
      return;
    }

    setSubmitting(true);

    let contents = {};
    if (documentType === '휴직원') {
      contents = {
        department, position, name,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        reason,
        contact,
        handover,
      };
    } else if (documentType === '퇴직원') { 
      contents = {
        department, position, name, 
        joinDate: joinDate ? new Date(joinDate) : null,
        endDate: endDate ? new Date(endDate) : null, // 퇴직예정일
        reason,
      };
    } else { // 휴가원
      contents = {
        department, position, name,
        leaveType,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        reason,
        contact, // 휴가중 비상연락처
      };
    }

    try {
      await addDoc(collection(db, 'hr_documents'), {
        userId: user.uid,
        userName: name,
        documentType,
        submissionDate: serverTimestamp(),
        status: '처리중',
        contents,
      });

      toast({ variant: "success", title: "성공", description: "신청서가 성공적으로 제출되었습니다." });
      router.push('/dashboard/hr/requests');
    } catch (error) {
      console.error("Form submission error:", error);
      toast({ variant: "destructive", title: "오류", description: "신청서 제출 중 오류가 발생했습니다." });
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date().toLocaleDateString('ko-KR');

  return (
    <div className="p-8 max-w-4xl mx-auto bg-white shadow-lg rounded-lg" >
      <div ref={formRef} className="p-8">
        <div className="flex justify-center mb-8">
          <div className="tabs tabs-boxed">
            <a className={`tab ${documentType === '휴직원' ? 'tab-active' : ''}`} onClick={() => setDocumentType('휴직원')}>휴직원</a> 
            <a className={`tab mx-2 ${documentType === '퇴직원' ? 'tab-active' : ''}`} onClick={() => setDocumentType('퇴직원')}>퇴직원</a>
            <a className={`tab ${documentType === '휴가원' ? 'tab-active' : ''}`} onClick={() => setDocumentType('휴가원')}>휴가원</a>
          </div>
        </div>

        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold">{documentType}</h1>
        </div>

        <form onSubmit={(e) => e.preventDefault()} className="space-y-8">
          {/* 인적사항 */}
          <div className="border-t border-b py-4">
            <h3 className="text-lg font-semibold mb-4">신청인 정보</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label"><span className="label-text">소속</span></label>
                <input type="text" className="input input-bordered w-full" value={department} onChange={(e) => setDepartment(e.target.value)} />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">직위</span></label>
                <input type="text" className="input input-bordered w-full" value={position} onChange={(e) => setPosition(e.target.value)} />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">성명</span></label>
                <input type="text" className="input input-bordered w-full" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              {documentType === '퇴직원' && 
                <div className="form-control">
                  <label className="label"><span className="label-text">입사일</span></label>
                  <input type="date" className="input input-bordered w-full" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} />
                </div>
              }
            </div>
          </div>

          {/* 신청 내용 */}
          {documentType === '휴직원' ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">휴직 신청 내용</h3>
              <div className="form-control">
                <label className="label"><span className="label-text">휴직 기간</span></label>
                <div className="flex items-center gap-2">
                  <input type="date" className="input input-bordered w-full" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                  <span>~</span>
                  <input type="date" className="input input-bordered w-full" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                </div>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">사유</span></label>
                <input type="text" placeholder="예: 질병, 육아, 자기계발 등" className="input input-bordered w-full" value={reason} onChange={(e) => setReason(e.target.value)} required />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">휴직 중 비상연락처</span></label>
                <input type="text" className="input input-bordered w-full" value={contact} onChange={(e) => setContact(e.target.value)} required />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">업무 인수인계자</span></label>
                <input type="text" className="input input-bordered w-full" value={handover} onChange={(e) => setHandover(e.target.value)} required />
              </div>
            </div>
          ) : documentType === '퇴직원' ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">사직 신청 내용</h3>
              <div className="form-control">
                <label className="label"><span className="label-text">퇴직 예정일</span></label>
                <input type="date" className="input input-bordered w-full" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">사유</span></label>
                <textarea className="textarea textarea-bordered w-full h-24" placeholder="일신상의 사유로..." value={reason} onChange={(e) => setReason(e.target.value)} required />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">휴가 신청 내용</h3>
               <div className="form-control">
                <label className="label"><span className="label-text">휴가 종류</span></label>
                <select className="select select-bordered w-full" value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
                  <option>연차</option>
                  <option>병가</option>
                  <option>경조사</option>
                  <option>공가</option>
                  <option>기타</option>
                </select>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">휴가 기간</span></label>
                <div className="flex items-center gap-2">
                  <input type="date" className="input input-bordered w-full" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                  <span>~</span>
                  <input type="date" className="input input-bordered w-full" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                </div>
              </div>
               <div className="form-control">
                <label className="label"><span className="label-text">휴가 사유</span></label>
                <input type="text" placeholder="예: 개인 사정" className="input input-bordered w-full" value={reason} onChange={(e) => setReason(e.target.value)} required />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">휴가 중 비상연락처</span></label>
                <input type="text" className="input input-bordered w-full" value={contact} onChange={(e) => setContact(e.target.value)} required />
              </div>
            </div>
          )}

          {/* 최종 제출 */}
          <div className="text-center pt-8">
            <p className="mb-4">위와 같이 {documentType}을(를) 신청하오니 허가하여 주시기 바랍니다.</p>
            <p className="mb-8">{today}</p>
            <div className="flex items-center justify-center gap-2">
              <span className="font-medium">신청인:</span>
              <input type="text" className="input input-sm input-bordered w-32" value={name} onChange={(e) => setName(e.target.value)} placeholder="성명" />
              <span>(인)</span>
            </div>
          </div>
        </form>
      </div>
      <div id="printable-content" style={{ position: 'absolute', left: '-9999px' }}></div>
      <div className="flex justify-center gap-4 mt-8">
        <button type="button" className="btn btn-ghost" onClick={() => router.back()}>
          취소
        </button>
        <button type="button" className="btn btn-secondary" onClick={handlePdfDownload}>
          PDF로 저장
        </button>
        <button type="button" onClick={handleSubmit} className={`btn btn-primary ${submitting ? 'loading' : ''}`} disabled={submitting}>
          {submitting ? '제출 중...' : '제출하기'}
        </button>
      </div>
    </div>
  );
};

export default NewHRRequestPage;
