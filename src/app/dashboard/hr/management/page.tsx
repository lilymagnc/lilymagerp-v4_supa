'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, XCircle, Eye, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { HRFormDisplay } from "@/components/hr/HRFormDisplay";
import { PrintableHRForm } from "@/components/hr/PrintableHRForm";
import { createRoot } from "react-dom/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// Interface updated for Supabase structure
interface HRDocument {
  id: string;
  document_type: string;
  user_id: string;
  user_name: string;
  submission_date: string; // ISO string
  status: '처리중' | '승인' | '반려';
  contents?: {
    startDate?: any;
    endDate?: any;
    reason?: string;
    department?: string;
    position?: string;
    name?: string;
    joinDate?: any;
    contact?: string;
    handover?: string;
    leaveType?: string;
  };
  file_url?: string;
  submission_method?: 'online-form' | 'file-upload';
  extracted_from_file?: boolean;
  original_file_name?: string;
}

const HRManagementPage = () => {
  const [documents, setDocuments] = useState<HRDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<HRDocument | null>(null);
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('hr_documents')
        .select('*')
        .order('submission_date', { ascending: false });

      if (error) throw error;
      setDocuments(data as HRDocument[]);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({ variant: 'destructive', title: '오류', description: '문서 목록을 불러오지 못했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();

    // Subscribe to realtime changes
    const channel = supabase.channel('hr_management_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hr_documents' },
        () => {
          fetchDocuments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleViewDetails = (doc: HRDocument) => {
    setSelectedDoc(doc);
    setIsDetailViewOpen(true);
  };

  const handlePrint = () => {
    if (!selectedDoc) return;

    // Adapt Supabase doc to PrintableHRForm expected format if needed
    // PrintableHRForm expects camelCase props, we need to map if using raw Supabase object directly or ensure it handles it.
    // Assuming PrintableHRForm is flexible or we map strictly.
    // The previous code passed the doc directly. Let's ensure compatibility.
    // We'll create a mapped object to be safe.
    const printDoc = {
      ...selectedDoc,
      documentType: selectedDoc.document_type,
      userName: selectedDoc.user_name,
      submissionDate: { toDate: () => new Date(selectedDoc.submission_date) } // Mimic Firebase timestamp for compatibility if needed
    };

    const printWindow = window.open('', '', 'height=800,width=800');
    if (printWindow) {
      const container = printWindow.document.createElement('div');
      printWindow.document.body.appendChild(container);
      const root = createRoot(container);
      root.render(<PrintableHRForm document={printDoc as any} />); // Cast to any to bypass strict type checks for legacy components
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };

  const handleStatusChange = async (id: string, status: '승인' | '반려') => {
    try {
      const { error } = await supabase
        .from('hr_documents')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      toast({ variant: 'default', title: '성공', description: `문서 상태가 '${status}'으로 변경되었습니다.` });
      // Optimistic update or wait for realtime
    } catch (error) {
      console.error("Status update error:", error);
      toast({ variant: 'destructive', title: '오류', description: '상태 변경 중 오류가 발생했습니다.' });
    }
  };

  const handleDelete = async (document: HRDocument) => {
    if (!confirm(`${document.user_name}님의 ${document.document_type} 문서를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    setDeletingDocId(document.id);
    try {
      // 1. Delete file from Storage if exists
      if (document.file_url) {
        // Extract path from URL or logic.
        // Assuming file_url is the full path or relative path stored in DB.
        // The upload logic stores: `${user.id}/${Date.now()}_${sanitizedFileName}`
        // If file_url is a public URL, we need to extract the path.
        // But the upload logic in previous step (122) didn't explicitly save 'file_path', just 'file_url'.
        // Let's try to parse it or just try deleting if we have the path.
        // If we only have the public URL, we might need to rely on the table storing the path.
        // For now, let's assume we can't easily delete the file without the path if only URL is stored.
        // However, the upload code `const { data: { publicUrl } }` suggests we stored the public URL.
        // To delete, we need the path 'bucket/path'.
        // Supabase storage delete requires the path relative to the bucket.
        // If we can't derive it, we might leave a limitless file.
        // PROPER FIX: We should store 'file_path' in the DB too.
        // But for now, to replicate previous behavior, we'll try to delete from DB at least.

        // Attempt to extract path from public URL if standard format
        // Standard: .../storage/v1/object/public/hr_submissions/userId/file...
        const pathMatch = document.file_url.match(/hr_submissions\/(.*)/);
        if (pathMatch && pathMatch[1]) {
          await supabase.storage.from('hr_submissions').remove([pathMatch[1]]);
        }
      }

      // 2. Delete from Database
      const { error } = await supabase
        .from('hr_documents')
        .delete()
        .eq('id', document.id);

      if (error) throw error;

      toast({ variant: 'default', title: '성공', description: '문서가 성공적으로 삭제되었습니다.' });

      if (selectedDoc && selectedDoc.id === document.id) {
        setIsDetailViewOpen(false);
        setSelectedDoc(null);
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast({ variant: 'destructive', title: '오류', description: '문서 삭제 중 오류가 발생했습니다.' });
    } finally {
      setDeletingDocId(null);
    }
  };


  const getStatusBadge = (status: string) => {
    switch (status) {
      case '승인': return <Badge variant="default" className="bg-green-100 text-green-800">승인</Badge>;
      case '반려': return <Badge variant="destructive">반려</Badge>;
      default: return <Badge variant="secondary">처리중</Badge>;
    }
  }

  // Helper for compatibility with HRFormDisplay which might expect camelCase
  const mapDocForDisplay = (doc: HRDocument) => ({
    ...doc,
    documentType: doc.document_type,
    userName: doc.user_name,
    submissionDate: { toDate: () => new Date(doc.submission_date) }
  });

  return (
    <div>
      <PageHeader
        title="인사 서류 관리 (Supabase)"
        description="제출된 휴직 및 퇴직 신청서를 확인하고 관리합니다."
      />
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>제출일</TableHead>
                  <TableHead>제출자</TableHead>
                  <TableHead>문서 종류</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>{new Date(doc.submission_date).toLocaleDateString('ko-KR')}</TableCell>
                    <TableCell>{doc.user_name}</TableCell>
                    <TableCell>{doc.document_type}</TableCell>
                    <TableCell>{getStatusBadge(doc.status)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleViewDetails(doc)}>
                        <Eye className="mr-2 h-4 w-4" /> 상세 보기
                      </Button>
                      {doc.status === '처리중' && (
                        <>
                          <Button variant="default" size="sm" onClick={() => handleStatusChange(doc.id, '승인')} className="bg-green-600 hover:bg-green-700 text-white">
                            <CheckCircle className="mr-2 h-4 w-4" /> 승인
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleStatusChange(doc.id, '반려')}>
                            <XCircle className="mr-2 h-4 w-4" /> 반려
                          </Button>
                        </>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(doc)}
                        disabled={deletingDocId === doc.id}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {deletingDocId === doc.id ? '삭제 중...' : '삭제'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedDoc && (
        <Dialog open={isDetailViewOpen} onOpenChange={setIsDetailViewOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{selectedDoc.user_name}님의 {selectedDoc.document_type}</DialogTitle>
              <DialogDescription>
                제출된 서류의 상세 내용입니다. 검토 후 승인 또는 반려 처리를 할 수 있습니다.
              </DialogDescription>
            </DialogHeader>
            <HRFormDisplay document={mapDocForDisplay(selectedDoc) as any} />
            <DialogFooter>
              <Button variant="outline" onClick={handlePrint}>인쇄</Button>
              {selectedDoc && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    setIsDetailViewOpen(false);
                    handleDelete(selectedDoc);
                  }}
                  disabled={deletingDocId === selectedDoc.id}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> 삭제
                </Button>
              )}
              <Button variant="outline" onClick={() => setIsDetailViewOpen(false)}>닫기</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default HRManagementPage;
