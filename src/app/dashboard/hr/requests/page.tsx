'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import {
  detectDocumentTypeFromFileName,
  parseDocxFile,
} from '@/lib/hr-docx-parser';
import {
  Document as DocxDocument,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
} from 'docx';
import { saveAs } from 'file-saver';

type HRDocumentType = '휴직원' | '퇴직원' | '휴가원';

const createSectionTitle = (text: string) =>
  new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 200 },
  });

const createLine = (label: string, placeholder: string) =>
  new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true }),
      new TextRun({ text: placeholder }),
    ],
    spacing: { before: 100, after: 150 },
  });

const createSubmissionParagraphs = (titleText: string) => [
  new Paragraph({
    text: `위와 같이 ${titleText}하고자 하오니 허가하여 주시기 바랍니다.`,
    alignment: AlignmentType.CENTER,
    spacing: { before: 600, after: 200 },
  }),
  createLine('작성일', 'YYYY-MM-DD'),
  new Paragraph({
    children: [
      new TextRun({ text: '신청인: ', bold: true }),
      new TextRun({ text: '________________ (인)' }),
    ],
    alignment: AlignmentType.RIGHT,
    spacing: { before: 200, after: 200 },
  }),
];

const createTableRow = (label: string, placeholder: string) =>
  new TableRow({
    children: [
      new TableCell({
        width: { size: 30, type: WidthType.PERCENTAGE },
        shading: { fill: 'F3F4F6', color: 'auto', type: ShadingType.CLEAR },
        margins: { top: 200, bottom: 200, left: 200, right: 200 },
        children: [
          new Paragraph({
            children: [new TextRun({ text: label, bold: true })],
          }),
        ],
      }),
      new TableCell({
        width: { size: 70, type: WidthType.PERCENTAGE },
        margins: { top: 200, bottom: 200, left: 200, right: 200 },
        children: [
          new Paragraph({
            children: [new TextRun({ text: placeholder })],
          }),
        ],
      }),
    ],
  });

const createInfoTable = (documentType: HRDocumentType) => {
  const rows = [
    createTableRow('소속', ''),
    createTableRow('직위', ''),
    createTableRow('성명', ''),
  ];

  if (documentType === '퇴직원') {
    rows.push(createTableRow('입사일', ''));
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
  });
};

const createContentTable = (documentType: HRDocumentType) => {
  if (documentType === '휴직원') {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        createTableRow('휴직 기간', ''),
        createTableRow('사유', ''),
        createTableRow('휴직 중 비상연락처', ''),
        createTableRow('업무 인수인계자', ''),
      ],
    });
  }

  if (documentType === '퇴직원') {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        createTableRow('퇴직 예정일', ''),
        createTableRow('사유', ''),
      ],
    });
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      createTableRow('휴가 종류', ''),
      createTableRow('휴가 기간', ''),
      createTableRow('사유', ''),
      createTableRow('휴가 중 비상연락처', ''),
    ],
  });
};

const buildTemplateDocument = (documentType: HRDocumentType) => {
  const titleMap: Record<HRDocumentType, string> = {
    휴직원: '휴직',
    퇴직원: '사직',
    휴가원: '휴가',
  };

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: documentType,
          bold: true,
          size: 48,
        }),
      ],
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    createSectionTitle('신청인 정보'),
    createInfoTable(documentType),
    new Paragraph({ text: '', spacing: { after: 200 } }),
  ];

  if (documentType === '휴직원') {
    children.push(
      createSectionTitle('휴직 신청 내용'),
      createContentTable(documentType),
    );
  } else if (documentType === '퇴직원') {
    children.push(
      createSectionTitle('사직 신청 내용'),
      createContentTable(documentType),
    );
  } else {
    children.push(
      createSectionTitle('휴가 신청 내용'),
      createContentTable(documentType),
    );
  }

  children.push(...createSubmissionParagraphs(titleMap[documentType]));

  return new DocxDocument({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });
};

const HRRequestsPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [downloadingType, setDownloadingType] = useState<HRDocumentType | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!user) {
      toast({ variant: "destructive", title: "오류", description: "로그인이 필요합니다." });
      return;
    }

    if (acceptedFiles.length === 0) {
      return;
    }

    const file = acceptedFiles[0];

    // 파일 크기 검증 (10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast({ variant: "destructive", title: "파일 크기 오류", description: "파일 크기는 10MB 이하여야 합니다." });
      return;
    }

    const fallbackDocumentType = detectDocumentTypeFromFileName(file.name);

    setUploading(true);

    try {
      const parsedResult = await parseDocxFile(file, fallbackDocumentType);
      const documentType = parsedResult?.documentType ?? fallbackDocumentType;

      const storage = getStorage();
      // 파일명 정리 (특수문자 제거)
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9가-힣._-]/g, '_');
      const storageRef = ref(storage, `hr_submissions/${user.uid}/${Date.now()}_${sanitizedFileName}`);
      
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      const documentData: Record<string, unknown> = {
        userId: user.uid,
        userName: parsedResult?.userName || user.displayName || 'Unknown User',
        documentType,
        submissionDate: serverTimestamp(),
        status: '처리중',
        fileUrl: downloadURL,
        submissionMethod: 'file-upload',
        originalFileName: file.name,
      };

      if (parsedResult?.contents) {
        documentData.contents = parsedResult.contents;
        documentData.extractedFromFile = true;
      } else {
        documentData.extractedFromFile = false;
      }

      await addDoc(collection(db, 'hr_documents'), documentData);

      toast({ variant: "default", title: "성공", description: `${documentType} 파일이 성공적으로 제출되었습니다.` });
      router.push('/dashboard/hr/requests'); // Refresh the page to show new status if needed
    } catch (error: any) {
      console.error("File upload error:", error);
      let errorMessage = "파일 제출 중 오류가 발생했습니다.";
      
      if (error.code === 'storage/unauthorized') {
        errorMessage = "파일 업로드 권한이 없습니다.";
      } else if (error.code === 'storage/canceled') {
        errorMessage = "파일 업로드가 취소되었습니다.";
      } else if (error.code === 'storage/quota-exceeded') {
        errorMessage = "저장 공간이 부족합니다.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({ variant: "destructive", title: "오류", description: errorMessage });
    } finally {
      setUploading(false);
    }
  }, [user, router, toast]);

  const handleTemplateDownload = useCallback(async (documentType: HRDocumentType) => {
    setDownloadingType(documentType);

    try {
      const doc = buildTemplateDocument(documentType);
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${documentType}_템플릿.docx`);

      toast({
        variant: 'default',
        title: '다운로드 완료',
        description: `${documentType} 템플릿이 Word 파일로 저장되었습니다.`,
      });
    } catch (error) {
      console.error('Template download error:', error);
      toast({ variant: 'destructive', title: '오류', description: '템플릿 생성 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.' });
    } finally {
      setDownloadingType(null);
    }
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, 
    multiple: false,
    accept: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'], // 구버전 Word 파일도 허용
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    onDropRejected: (rejectedFiles) => {
      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0];
        if (rejection.errors) {
          const error = rejection.errors[0];
          if (error.code === 'file-invalid-type') {
            toast({ variant: "destructive", title: "파일 형식 오류", description: "Word 파일(.docx, .doc)만 업로드 가능합니다." });
          } else if (error.code === 'file-too-large') {
            toast({ variant: "destructive", title: "파일 크기 오류", description: "파일 크기는 10MB 이하여야 합니다." });
          }
        }
      }
    }
  });

  if (!user) {
    return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                <p>사용자 정보를 불러오는 중...</p>
            </div>
        </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">인사 서류 신청</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* 1. 온라인으로 작성하기 */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">온라인으로 작성하기</h2>
            <p>웹사이트에서 직접 휴직 또는 퇴직 신청서를 작성하고 제출합니다.</p>
            <div className="card-actions justify-end">
              <button 
                className="btn btn-primary font-bold"
                onClick={() => router.push('/dashboard/hr/requests/new')}
              >
                작성하기
              </button>
            </div>
          </div>
        </div>

        {/* 2. 템플릿 다운로드 */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">템플릿 다운로드</h2>
            <p>온라인 작성 화면과 동일한 양식을 Word 파일(.docx)로 다운로드합니다.</p>
            <div className="card-actions justify-end flex-wrap gap-2 items-center">
              <button
                type="button"
                className={`btn btn-secondary font-bold ${downloadingType === '휴직원' ? 'loading' : ''}`}
                onClick={() => handleTemplateDownload('휴직원')}
                disabled={downloadingType !== null}
              >
                {downloadingType === '휴직원' ? '생성 중...' : '휴직원'}
              </button>
              <span className="font-bold text-base-content">/</span>
              <button
                type="button"
                className={`btn btn-secondary font-bold ${downloadingType === '퇴직원' ? 'loading' : ''}`}
                onClick={() => handleTemplateDownload('퇴직원')}
                disabled={downloadingType !== null}
              >
                {downloadingType === '퇴직원' ? '생성 중...' : '퇴직원'}
              </button>
              <span className="font-bold text-base-content">/</span>
              <button
                type="button"
                className={`btn btn-secondary font-bold ${downloadingType === '휴가원' ? 'loading' : ''}`}
                onClick={() => handleTemplateDownload('휴가원')}
                disabled={downloadingType !== null}
              >
                {downloadingType === '휴가원' ? '생성 중...' : '휴가원'}
              </button>
            </div>
          </div>
        </div>

        {/* 3. 작성된 파일 업로드 */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">작성된 파일 업로드</h2>
            <div 
              {...getRootProps()} 
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                ${isDragActive ? 'border-primary bg-primary/10' : 'border-base-300 hover:border-primary/50'}`}
            >
              <input {...getInputProps()} />
              {uploading ? (
                <p>업로드 중...</p>
              ) : (
                isDragActive ?
                  <p>파일을 여기에 놓으세요...</p> :
                  <p>작성된 신청서 파일을 드래그 앤 드롭하거나 클릭하여 선택하세요.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HRRequestsPage;