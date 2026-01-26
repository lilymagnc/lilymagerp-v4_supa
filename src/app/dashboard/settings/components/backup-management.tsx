"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Database,
  Download,
  Upload,
  RefreshCw,
  Clock,
  User,
  CheckCircle,
  AlertCircle,
  Info,
  Trash,
  Folder,
  Archive,
  Eye,
  FileJson,
  FileSpreadsheet
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import * as XLSX from 'xlsx';

interface BackupRecord {
  id: string; // Folder name
  timestamp: string; // Display string or ISO
  type: "auto" | "manual";
  status: "completed";
  dateObj: Date;
}

function isValidDate(d: any) {
  return d instanceof Date && !isNaN(d.getTime());
}

export default function BackupManagement() {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState<string | null>(null);
  const [deletingBackupId, setDeletingBackupId] = useState<string | null>(null);
  const [backupToDelete, setBackupToDelete] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");
  const [downloadingExcel, setDownloadingExcel] = useState<string | null>(null);

  // Viewer States
  const [viewingBackup, setViewingBackup] = useState<string | null>(null);
  const [viewFiles, setViewFiles] = useState<{ name: string, size: number }[]>([]);
  const [viewContent, setViewContent] = useState<any[] | null>(null);
  const [viewFileName, setViewFileName] = useState<string>("");
  const [loadingView, setLoadingView] = useState(false);

  const { toast } = useToast();
  const { user } = useAuth();
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadBackups();
  }, []);

  // 수동 정리 (스마트 정리: 수동/월별 보존, 일반 자동만 최신 7개 유지)
  const handleManualCleanup = async () => {
    // 1. 카테고리 분류
    const manualBackups = backups.filter(b => b.type === 'manual');
    const monthlyBackups = backups.filter(b => b.type !== 'manual' && isValidDate(b.dateObj) && b.dateObj.getDate() === 1);

    // 삭제 후보군: 수동도 아니고, 매월 1일자도 아닌 "일반 자동 백업"
    const dailyBackups = backups.filter(b => {
      if (b.type === 'manual') return false;
      if (isValidDate(b.dateObj) && b.dateObj.getDate() === 1) return false;
      return true;
    });

    // 2. 일반 자동 백업 내림차순 정렬 (최신이 위로)
    const sortedDaily = [...dailyBackups].sort((a, b) => b.id.localeCompare(a.id));

    // 3. 최신 7개 제외하고 나머지 선택
    if (sortedDaily.length <= 7) {
      toast({
        title: "정리할 대상이 없습니다.",
        description: "삭제 가능한 오래된 일반 자동 백업이 없습니다. (수동 및 월별 백업은 보호됩니다)"
      });
      return;
    }

    const targets = sortedDaily.slice(7);

    // 4. 사용자 확인
    const startMsg = `[삭제 대상 발견: ${targets.length}개]\n`;
    const protectMsg = `※ 보호됨: 수동 백업(${manualBackups.length}개), 월별 1일자(${monthlyBackups.length}개)는 삭제되지 않습니다.\n`;
    const deleteMsg = `\n오래된 일반 자동 백업 ${targets.length}개를 삭제하시겠습니까?\n(${targets[0].id} 포함 과거 데이터)`;

    if (!window.confirm(`${startMsg}${protectMsg}${deleteMsg}`)) {
      return;
    }

    try {
      setLoading(true);
      toast({ title: "정리 시작", description: `${targets.length}개의 오래된 백업을 삭제 중입니다...` });

      // 실제 스토리지 삭제 요청 (병렬 처리)
      await Promise.all(targets.map(async (backup) => {
        const { data: files } = await supabase.storage.from('backups').list(backup.id);
        if (files && files.length > 0) {
          const paths = files.map(f => `${backup.id}/${f.name}`);
          await supabase.storage.from('backups').remove(paths);
        }
      }));

      // UI에서 즉시 제거 (서버 로딩 기다리지 않음)
      const targetIds = targets.map(t => t.id);
      setBackups(prev => prev.filter(b => !targetIds.includes(b.id)));

      toast({
        title: "정리 완료",
        description: `오래된 자동 백업 ${targets.length}개를 목록에서 제거했습니다.`
      });

    } catch (error) {
      console.error("Cleanup failed:", error);
      toast({ variant: 'destructive', title: "오류", description: "삭제 중 문제가 발생했습니다." });
    } finally {
      setLoading(false);
    }
  };

  const runSmartCleanup = async (records: BackupRecord[]) => {
    const now = new Date();
    const retentionLimit = new Date();
    retentionLimit.setDate(now.getDate() - 14);

    const backupsToDelete: string[] = [];

    records.forEach((backup) => {
      if (backup.type === 'manual') return;
      const backupDate = backup.dateObj;
      if (!isValidDate(backupDate)) return;
      if (backupDate > retentionLimit) return;
      if (backupDate.getDate() === 1) return;
      backupsToDelete.push(backup.id);
    });

    if (backupsToDelete.length > 0) {
      console.log("Running smart cleanup for:", backupsToDelete);
      try {
        await Promise.all(backupsToDelete.map(async (folderName) => {
          const { data: files } = await supabase.storage.from('backups').list(folderName);
          if (files && files.length > 0) {
            const paths = files.map(f => `${folderName}/${f.name}`);
            await supabase.storage.from('backups').remove(paths);
          }
        }));

        toast({
          title: "백업 자동 정리",
          description: `보관 기한이 지난 백업 ${backupsToDelete.length}개를 정리했습니다.`,
        });
        setBackups(prev => prev.filter(b => !backupsToDelete.includes(b.id)));
      } catch (e) {
        console.error("Auto cleanup failed:", e);
      }
    }
  };

  const loadBackups = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.storage.from('backups').list('', {
        sortBy: { column: 'name', order: 'desc' },
        search: '',
      });

      if (error) {
        toast({ variant: "destructive", title: "Storage 권한 오류", description: "백업 목록을 불러올 수 없습니다." });
        return;
      }
      if (!data || data.length === 0) {
        setBackups([]);
        return;
      }

      const parsedRecords: BackupRecord[] = data
        .filter(item => !item.metadata || item.id === null)
        .map((folder) => {
          const dateObj = new Date(folder.name);
          return {
            id: folder.name,
            timestamp: folder.name,
            type: folder.name.includes("manual") ? "manual" : "auto",
            status: "completed",
            dateObj: isNaN(dateObj.getTime()) ? new Date() : dateObj
          };
        });

      setBackups(parsedRecords);
      // 로딩을 즉시 종료하여 목록을 먼저 보여줌
      setLoading(false);

      // 자동 정리 작업은 백그라운드에서 조용히 실행 (await 없이 실행)
      runSmartCleanup(parsedRecords).catch(err => console.error("Background cleanup error:", err));

    } catch (error) {
      console.error("백업 목록 로드 실패:", error);
      setLoading(false);
    }
  };

  const fetchTableDataWithTimeout = async (table: string, timeoutMs: number = 10000) => {
    const fetchPromise = supabase.from(table).select('*').then(({ data, error }) => {
      if (error) throw error;
      return data;
    });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout fetching ${table}`)), timeoutMs)
    );
    return Promise.race([fetchPromise, timeoutPromise]);
  };

  const createManualBackup = async () => {
    try {
      setCreatingBackup(true);
      setProgress("준비 중...");

      const tables = [
        'orders', 'customers', 'products', 'materials', 'partners', 'employees',
        'branches', 'budgets', 'recipients',
        'simple_expenses', 'stock_history', 'quotations', 'material_requests',
        'point_history', 'photos',
        'albums', 'checklist_templates', 'checklists', 'workers',
        'order_transfers', 'display_board',
        'supplier_suggestions', 'fixed_cost_templates'
      ];

      const now = new Date();
      const folderName = `${now.toISOString().replace(/[:.]/g, '-')}-manual`;
      let successCount = 0;
      let processedCount = 0;
      const BATCH_SIZE = 5;

      for (let i = 0; i < tables.length; i += BATCH_SIZE) {
        const batch = tables.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (table) => {
          try {
            processedCount++;
            setProgress(`${Math.round((processedCount / tables.length) * 100)}% (${processedCount}/${tables.length})`);
            const data: any = await fetchTableDataWithTimeout(table, 10000);
            if (data) {
              const fileContent = JSON.stringify(data, null, 2);
              const blob = new Blob([fileContent], { type: 'application/json' });
              const { error: uploadError } = await supabase.storage.from('backups').upload(`${folderName}/${table}.json`, blob, { contentType: 'application/json' });
              if (uploadError) throw uploadError;
              successCount++;
            }
          } catch (error: any) {
            console.warn(`Backup skipped for ${table}:`, error.message);
          }
        }));
      }

      if (successCount > 0) {
        toast({ title: "성공", description: `${successCount}개 테이블 데이터 백업 완료.` });
        loadBackups();
      } else {
        throw new Error("백업할 데이터를 가져오지 못했습니다.");
      }
    } catch (error: any) {
      console.error("수동 백업 실패:", error);
      toast({ variant: "destructive", title: "실패", description: "백업 중 오류가 발생했습니다." });
    } finally {
      setCreatingBackup(false);
      setProgress("");
    }
  };

  const restoreBackup = async (folderName: string) => {
    try {
      setRestoringBackup(folderName);
      toast({ title: "복원 시작", description: "전체 데이터를 분석하여 복원 중입니다..." });

      const { data: files, error: listError } = await supabase.storage.from('backups').list(folderName);
      if (listError || !files || files.length === 0) throw new Error("백업 폴더가 비어있거나 접근할 수 없습니다.");

      let successTableCount = 0;
      let failTableCount = 0;

      for (const file of files) {
        if (!file.name.endsWith('.json')) continue;
        const tableName = file.name.replace('.json', '');
        const { data: blob, error: downloadError } = await supabase.storage.from('backups').download(`${folderName}/${file.name}`);
        if (downloadError || !blob) continue;

        const text = await blob.text();
        const rows = JSON.parse(text);

        if (Array.isArray(rows) && rows.length > 0) {
          const { error: upsertError } = await supabase.from(tableName).upsert(rows);
          if (upsertError) {
            console.error(`Error restoring table ${tableName}:`, upsertError);
            failTableCount++;
          } else {
            successTableCount++;
          }
        }
      }
      toast({ title: "복원 완료", description: `${successTableCount}개 항목 복원 성공 (실패 ${failTableCount})` });
    } catch (error: any) {
      console.error("백업 복원 실패:", error);
      toast({ variant: "destructive", title: "오류", description: error.message || "백업 복원 중 오류가 발생했습니다." });
    } finally {
      setRestoringBackup(null);
    }
  };

  const downloadFullExcel = async (backupId: string) => {
    try {
      setDownloadingExcel(backupId);
      toast({ title: "엑셀 생성 중", description: "모든 백업 데이터를 하나의 엑셀 파일로 변환하고 있습니다..." });

      const { data: files, error: listError } = await supabase.storage.from('backups').list(backupId);
      if (listError || !files) throw new Error("파일 목록을 가져올 수 없습니다.");

      const workbook = XLSX.utils.book_new();
      let sheetCount = 0;

      // 중요한 테이블을 앞쪽에 배치
      const priorityTables = ['orders', 'customers', 'products', 'materials', 'simple_expenses'];
      const sortedFiles = files.sort((a, b) => {
        const nameA = a.name.replace('.json', '');
        const nameB = b.name.replace('.json', '');
        const idxA = priorityTables.indexOf(nameA);
        const idxB = priorityTables.indexOf(nameB);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return nameA.localeCompare(nameB);
      });

      for (const file of sortedFiles) {
        if (!file.name.endsWith('.json')) continue;

        const tableName = file.name.replace('.json', '');
        const sheetName = tableName.slice(0, 31);

        const { data: blob, error: downloadError } = await supabase.storage
          .from('backups')
          .download(`${backupId}/${file.name}`);

        if (downloadError || !blob) continue;

        const text = await blob.text();
        const rawData = JSON.parse(text);

        if (Array.isArray(rawData)) {
          // 객체나 배열 데이터가 엑셀에서 누락되지 않도록 문자열로 변환 (Flattening)
          const processedData = rawData.map((row: any) => {
            const newRow: any = { ...row };
            Object.keys(newRow).forEach(key => {
              const val = newRow[key];
              if (val && typeof val === 'object') {
                // 객체나 배열이면 JSON 문자열로 변환하여 셀에 표시
                newRow[key] = JSON.stringify(val);
              }
            });
            return newRow;
          });

          const worksheet = XLSX.utils.json_to_sheet(processedData);
          XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
          sheetCount++;
        }
      }

      if (sheetCount > 0) {
        XLSX.writeFile(workbook, `LilyMag_Backup_${backupId}.xlsx`);
        toast({ title: "다운로드 완료", description: "엑셀 파일이 생성되었습니다." });
      } else {
        toast({ variant: 'destructive', title: "실패", description: "변환할 데이터가 없습니다." });
      }

    } catch (error: any) {
      console.error("Excel download failed:", error);
      toast({ variant: 'destructive', title: "오류", description: "엑셀 다운로드 중 문제가 발생했습니다." });
    } finally {
      setDownloadingExcel(null);
    }
  };

  const openBackupViewer = async (backupId: string) => {
    try {
      setViewingBackup(backupId);
      setViewFiles([]);
      setViewContent(null);
      setLoadingView(true);
      const { data: files, error } = await supabase.storage.from('backups').list(backupId);
      if (error) throw error;

      if (files) {
        const sorted = files.sort((a, b) => {
          const priority = ['orders', 'customers', 'products'];
          const getP = (name: string) => {
            const n = name.replace('.json', '');
            const idx = priority.indexOf(n);
            return idx === -1 ? 99 : idx;
          };
          return getP(a.name) - getP(b.name);
        });
        setViewFiles(sorted.map(f => ({ name: f.name, size: f.metadata?.size || 0 })));
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: '실패', description: '파일 목록을 불러오지 못했습니다.' });
    } finally {
      setLoadingView(false);
    }
  };

  const loadFileContent = async (fileName: string) => {
    if (!viewingBackup) return;
    try {
      setLoadingView(true);
      setViewFileName(fileName);
      setViewContent(null);
      const { data, error } = await supabase.storage.from('backups').download(`${viewingBackup}/${fileName}`);
      if (error) throw error;
      const text = await data.text();
      const json = JSON.parse(text);
      if (Array.isArray(json)) {
        setViewContent(json.slice(0, 100)); // Preview first 100 rows
      } else {
        setViewContent([{ ...json }]);
      }
    } catch (e) {
      toast({ variant: 'destructive', title: '실패', description: '파일 내용을 읽을 수 없습니다.' });
      setViewContent([]);
    } finally {
      setLoadingView(false);
    }
  };

  const confirmDeleteBackup = (backupId: string) => {
    setBackupToDelete(backupId);
  };

  const handleDeleteConfirmed = async () => {
    if (!backupToDelete) return;
    try {
      setDeletingBackupId(backupToDelete);
      const { data: files } = await supabase.storage.from('backups').list(backupToDelete);
      if (files && files.length > 0) {
        const paths = files.map(f => `${backupToDelete}/${f.name}`);
        await supabase.storage.from('backups').remove(paths);
      }
      setBackups((prev) => prev.filter((b) => b.id !== backupToDelete));
      toast({ title: "삭제 완료", description: "백업 폴더가 삭제되었습니다." });
    } catch (error) {
      console.error("백업 삭제 실패:", error);
      toast({ variant: "destructive", title: "오류", description: "백업 삭제 중 오류가 발생했습니다." });
    } finally {
      setDeletingBackupId(null);
      setBackupToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>백업 폴더를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              백업 통계
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>전체 백업 세트:</span>
                <span className="font-semibold">{backups.length}개</span>
              </div>
              <div className="flex justify-between">
                <span>월별 아카이브:</span>
                <span className="font-semibold text-blue-600">
                  {backups.filter(b => b.dateObj && b.dateObj.getDate() === 1).length}개
                </span>
              </div>
              <div className="flex justify-between">
                <span>최신 백업:</span>
                <span className="font-semibold truncate w-32 text-right">
                  {backups.length > 0 ? backups[0].timestamp : "없음"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              백업 실행
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                <span className="font-bold">전체 히스토리</span>를 백업합니다.
              </p>
            </div>
            <Button onClick={createManualBackup} disabled={creatingBackup} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              {creatingBackup ? `백업 중... ${progress}` : "수동 백업 생성"}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              보관 정책
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm mb-4">
              <p className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>최근 2주: 매일 보관</span>
              </p>
              <p className="flex items-center gap-2">
                <Archive className="h-4 w-4 text-blue-500" />
                <span>매월 1일: 영구 보관</span>
              </p>
              <p className="flex items-center gap-2">
                <Trash className="h-4 w-4 text-gray-400" />
                <span>그 외: 14일 경과 시 자동 삭제</span>
              </p>
            </div>

            <div className="pt-4 border-t">
              <p className="text-xs text-gray-500 mb-2 font-medium">긴급 정리 (즉시 실행)</p>
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={handleManualCleanup}
              >
                <Trash className="h-4 w-4 mr-2" />
                1주일 지난 백업 모두 삭제
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            백업 폴더 목록
          </CardTitle>
          <CardDescription>
            자동 정리 정책에 의해 관리되는 백업 목록입니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <div className="text-center py-8">
              <Folder className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">백업 폴더가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {backups.map((backup) => {
                const date = backup.dateObj || new Date();
                const isMonthly = !isNaN(date.getTime()) && date.getDate() === 1;

                return (
                  <div key={backup.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${isMonthly ? 'bg-blue-100' : 'bg-yellow-100'}`}>
                        {isMonthly ? <Archive className="h-4 w-4 text-blue-600" /> : <Folder className="h-4 w-4 text-yellow-600" />}
                      </div>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {backup.id}
                          {isMonthly && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">월별 아카이브</span>}
                        </div>
                        <div className="text-xs text-gray-500">
                          {backup.type === 'manual' ? '수동 백업' : '자동 백업'} • {isValidDate(date) ? date.toLocaleDateString() : backup.timestamp}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadFullExcel(backup.id)}
                        disabled={!!downloadingExcel}
                        className="h-8 text-green-700 border-green-200 hover:bg-green-50"
                      >
                        {downloadingExcel === backup.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />}
                        엑셀 저장
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openBackupViewer(backup.id)}
                        className="h-8"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        내용
                      </Button>

                      <div className="h-4 w-px bg-gray-300 mx-1" />

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => restoreBackup(backup.id)}
                        disabled={restoringBackup === backup.id}
                        className="h-8"
                      >
                        <Upload className="h-3.5 w-3.5 mr-1" />
                        복원
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => confirmDeleteBackup(backup.id)}
                        disabled={deletingBackupId === backup.id}
                        className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                      >
                        <Trash className="h-3.5 w-3.5 mr-1" />
                        삭제
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 백업 뷰어 다이얼로그 */}
      {viewingBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <FileJson className="h-5 w-5 text-blue-600" />
                  백업 뷰어: {viewingBackup}
                </h3>
                <p className="text-xs text-gray-500">DB 복원 없이 파일 내용을 미리 확인합니다.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setViewingBackup(null)}>닫기</Button>
            </div>

            <div className="flex-1 flex overflow-hidden">
              <div className="w-64 border-r bg-gray-50 overflow-y-auto p-2 border-r-gray-200">
                <h4 className="text-xs font-semibold text-gray-500 mb-2 px-2 uppercase tracking-tighter">Files</h4>
                {viewFiles.map(f => (
                  <button
                    key={f.name}
                    onClick={() => loadFileContent(f.name)}
                    className={`w-full text-left px-3 py-2 text-sm rounded-md mb-1 transition-colors flex justify-between items-center
                             ${viewFileName === f.name ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-gray-200 text-gray-700'}`}
                  >
                    <span className="truncate">{f.name.replace('.json', '')}</span>
                    <span className="text-[10px] text-gray-400">{(f.size / 1024).toFixed(1)}K</span>
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-auto p-0 bg-white relative">
                {loadingView && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10">
                    <RefreshCw className="h-8 w-8 animate-spin text-blue-500 mb-2" />
                    <p className="text-sm text-gray-500">데이터 로딩 중...</p>
                  </div>
                )}

                {!viewFileName ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <Eye className="h-16 w-16 mb-4 opacity-10" />
                    <p>왼쪽 목록에서 확인할 파일을 선택하세요.</p>
                  </div>
                ) : viewContent ? (
                  <div className="h-full flex flex-col">
                    <div className="p-3 border-b bg-gray-50 flex justify-between items-center">
                      <div className="font-semibold text-sm">{viewFileName}</div>
                      <span className="text-xs text-gray-500 bg-white border px-2 py-0.5 rounded shadow-sm">
                        미리보기 (상위 {viewContent.length}개)
                      </span>
                    </div>
                    <div className="flex-1 overflow-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                          <tr>
                            {viewContent.length > 0 && Object.keys(viewContent[0]).slice(0, 10).map(key => (
                              <th key={key} className="px-3 py-2 text-left font-medium text-gray-600 border-b border-r last:border-r-0 whitespace-nowrap bg-gray-50">
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {viewContent.map((row, i) => (
                            <tr key={i} className="hover:bg-blue-50/50 border-b last:border-0 group">
                              {Object.keys(row).slice(0, 10).map((key, idx) => (
                                <td key={idx} className="px-3 py-2 border-r last:border-r-0 max-w-[200px] truncate text-gray-700 group-hover:text-black">
                                  {typeof row[key] === 'object' ? JSON.stringify(row[key]) : String(row[key])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 text-red-500">데이터를 표시할 수 없습니다.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={!!backupToDelete} onOpenChange={(open) => !open && setBackupToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>백업 폴더 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 이 백업 폴더를 삭제하시겠습니까?
              <br />
              내부의 모든 데이터 파일이 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirmed} className="bg-red-600 hover:bg-red-700">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
