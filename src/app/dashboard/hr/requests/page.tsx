'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table as UiTable,
  TableBody,
  TableCell as UiTableCell,
  TableHead,
  TableHeader,
  TableRow as UiTableRow,
} from "@/components/ui/table";
import {
  FileText,
  Upload,
  Download,
  Plus,
  History,
  FileDown,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

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
    alignment: AlignmentType.CENTER,
    rows,
  });
};

const createContentTable = (documentType: HRDocumentType) => {
  if (documentType === '휴직원') {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      alignment: AlignmentType.CENTER,
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
      alignment: AlignmentType.CENTER,
      rows: [
        createTableRow('퇴직 예정일', ''),
        createTableRow('사유', ''),
      ],
    });
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.CENTER,
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

interface HRRequest {
  id: string;
  document_type: string;
  submission_date: string;
  status: string;
  file_url?: string;
  original_file_name?: string;
  submission_method: string;
}

const HRRequestsPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [downloadingType, setDownloadingType] = useState<HRDocumentType | null>(null);
  const [requests, setRequests] = useState<HRRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  // Fetch requests using Supabase
  useEffect(() => {
    if (!user) return;

    const fetchRequests = async () => {
      try {
        const { data, error } = await supabase
          .from('hr_documents')
          .select('*')
          .eq('user_id', user.id)
          .order('submission_date', { ascending: false });

        if (error) throw error;
        setRequests(data as HRRequest[]);
      } catch (error) {
        console.error('Error fetching HR requests:', error);
      } finally {
        setLoadingRequests(false);
      }
    };

    fetchRequests();

    // Subscribe to realtime changes
    const channel = supabase.channel('hr_documents_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hr_documents',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          // Simply refetch for simplicity, or handle optimistic updates
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!user) {
      toast({ variant: "destructive", title: "오류", description: "로그인이 필요합니다." });
      return;
    }

    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
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

      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9가-힣._-]/g, '_');
      const filePath = `${user.id}/${Date.now()}_${sanitizedFileName}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('hr_submissions')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('hr_submissions')
        .getPublicUrl(filePath);

      const documentData: Record<string, unknown> = {
        id: crypto.randomUUID(),
        user_id: user.id,
        user_name: parsedResult?.userName || user.email?.split('@')[0] || 'Unknown User',
        document_type: documentType,
        status: '처리중',
        file_url: publicUrl,
        submission_method: 'file-upload',
        original_file_name: file.name,
        submission_date: new Date().toISOString(),
      };

      if (parsedResult?.contents) {
        documentData.contents = parsedResult.contents;
        documentData.extracted_from_file = true;
      } else {
        documentData.extracted_from_file = false;
      }

      const { error: insertError } = await supabase
        .from('hr_documents')
        .insert(documentData);

      if (insertError) throw insertError;

      toast({ variant: "default", title: "성공", description: `${documentType} 파일이 성공적으로 제출되었습니다.` });
    } catch (error: any) {
      console.error("File upload error:", error);
      toast({ variant: "destructive", title: "오류", description: error.message || "파일 제출 중 오류가 발생했습니다." });
    } finally {
      setUploading(false);
    }
  }, [user, toast]);

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
      toast({ variant: 'destructive', title: '오류', description: '템플릿 생성 중 문제가 발생했습니다.' });
    } finally {
      setDownloadingType(null);
    }
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
    },
    maxSize: 10 * 1024 * 1024,
    onDropRejected: (rejectedFiles) => {
      if (rejectedFiles.length > 0) {
        const error = rejectedFiles[0].errors[0];
        if (error.code === 'file-invalid-type') {
          toast({ variant: "destructive", title: "파일 형식 오류", description: "Word 파일(.docx, .doc)만 업로드 가능합니다." });
        } else if (error.code === 'file-too-large') {
          toast({ variant: "destructive", title: "파일 크기 오류", description: "파일 크기는 10MB 이하여야 합니다." });
        }
      }
    }
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case '승인':
        return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" /> 승인됨</Badge>;
      case '반려':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" /> 반려됨</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> 처리중</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl animate-in fade-in duration-500">
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100">인사 서류 신청</h1>
        <p className="text-muted-foreground text-lg">휴직, 퇴직, 휴가 등 인사 관련 서류를 간편하게 신청하고 관리하세요.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        {/* 1. Online Form */}
        <Card className="shadow-lg hover:shadow-xl transition-all duration-300 border-primary/10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <FileText className="w-24 h-24 text-primary" />
          </div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Plus className="w-6 h-6 text-primary" />
              온라인 작성
            </CardTitle>
            <CardDescription>
              웹사이트에서 직접 신청서를 작성하여 제출합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-32 flex flex-col justify-end">
            <p className="text-sm text-gray-500 mb-4">
              별도의 파일 없이 즉시 작성할 수 있어 가장 빠르고 편리한 방법입니다.
            </p>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full text-lg font-semibold h-12 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary"
              onClick={() => router.push('/dashboard/hr/requests/new')}
            >
              새 신청서 작성하기
            </Button>
          </CardFooter>
        </Card>

        {/* 2. Upload File */}
        <Card className="shadow-lg hover:shadow-xl transition-all duration-300 border-blue-500/10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Upload className="w-24 h-24 text-blue-500" />
          </div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Upload className="w-6 h-6 text-blue-500" />
              파일 업로드
            </CardTitle>
            <CardDescription>
              작성된 신청서 파일을 업로드하여 제출합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-32 flex flex-col justify-end">
            <p className="text-sm text-gray-500">
              이미 작성된 Word 파일이 있다면 이곳에 끌어다 놓으세요.
            </p>
          </CardContent>
          <CardFooter className="flex-col gap-2">
            <div
              {...getRootProps()}
              className={`w-full h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors
                ${isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary hover:bg-gray-50'}`}
            >
              <input {...getInputProps()} />
              {uploading ? (
                <div className="flex items-center gap-2 text-primary animate-pulse">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>업로드 중...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center text-gray-500">
                  <Upload className="w-6 h-6 mb-1 opacity-50" />
                  <span className="text-sm font-medium">클릭하거나 파일을 드롭하세요</span>
                </div>
              )}
            </div>
          </CardFooter>
        </Card>

        {/* 3. Download Templates */}
        <Card className="shadow-lg hover:shadow-xl transition-all duration-300 border-gray-500/10 relative overflow-hidden group bg-gray-50/50 dark:bg-gray-900/20">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Download className="w-24 h-24 text-gray-500" />
          </div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <FileDown className="w-6 h-6 text-gray-500" />
              양식 다운로드
            </CardTitle>
            <CardDescription>
              필요한 신청서 양식을 다운로드합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button variant="outline" className="w-full justify-between group/btn hover:border-gray-400" onClick={() => handleTemplateDownload('휴직원')} disabled={!!downloadingType}>
              <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-orange-400" />휴직원 양식</span>
              {downloadingType === '휴직원' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 opacity-0 group-hover/btn:opacity-100 transition-opacity" />}
            </Button>
            <Button variant="outline" className="w-full justify-between group/btn hover:border-gray-400" onClick={() => handleTemplateDownload('퇴직원')} disabled={!!downloadingType}>
              <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-400" />퇴직원 양식</span>
              {downloadingType === '퇴직원' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 opacity-0 group-hover/btn:opacity-100 transition-opacity" />}
            </Button>
            <Button variant="outline" className="w-full justify-between group/btn hover:border-gray-400" onClick={() => handleTemplateDownload('휴가원')} disabled={!!downloadingType}>
              <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-400" />휴가원 양식</span>
              {downloadingType === '휴가원' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 opacity-0 group-hover/btn:opacity-100 transition-opacity" />}
            </Button>
          </CardContent>
          <CardFooter className="pt-0">
            <p className="text-xs text-muted-foreground w-full text-center">다운로드 후 작성하여 업로드하세요.</p>
          </CardFooter>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b">
          <History className="w-5 h-5 text-gray-500" />
          <h2 className="text-2xl font-bold">나의 신청 내역</h2>
        </div>

        <Card className="bg-white dark:bg-gray-900 border-none shadow-md">
          {loadingRequests ? (
            <div className="p-8 text-center text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 opacity-50" />
              불러오는 중...
            </div>
          ) : requests.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>아직 신청한 내역이 없습니다.</p>
            </div>
          ) : (
            <UiTable>
              <TableHeader>
                <UiTableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                  <TableHead className="w-[120px]">신청일</TableHead>
                  <TableHead className="w-[100px]">종류</TableHead>
                  <TableHead>파일명 / 제목</TableHead>
                  <TableHead className="w-[100px]">상태</TableHead>
                  <TableHead className="w-[100px] text-right">관리</TableHead>
                </UiTableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => (
                  <UiTableRow key={req.id} className="hover:bg-gray-50 transition-colors">
                    <UiTableCell className="font-medium text-gray-600">
                      {req.submission_date ? format(new Date(req.submission_date), 'yyyy-MM-dd') : '-'}
                    </UiTableCell>
                    <UiTableCell>
                      <Badge variant="outline" className="font-normal">{req.document_type || '기타'}</Badge>
                    </UiTableCell>
                    <UiTableCell className="max-w-[300px] truncate" title={req.original_file_name || req.document_type}>
                      {req.original_file_name || `${req.document_type} 신청서`}
                    </UiTableCell>
                    <UiTableCell>
                      {getStatusBadge(req.status)}
                    </UiTableCell>
                    <UiTableCell className="text-right">
                      {req.file_url && (
                        <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
                          <a href={req.file_url} target="_blank" rel="noopener noreferrer" title="다운로드">
                            <Download className="w-4 h-4 text-gray-500 hover:text-primary" />
                          </a>
                        </Button>
                      )}
                    </UiTableCell>
                  </UiTableRow>
                ))}
              </TableBody>
            </UiTable>
          )}
        </Card>
      </div>
    </div>
  );
};

export default HRRequestsPage;