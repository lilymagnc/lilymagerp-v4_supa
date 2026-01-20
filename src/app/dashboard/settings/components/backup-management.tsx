"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
import { collection, query, orderBy, getDocs, doc, deleteDoc, Timestamp, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getFunctions, httpsCallable } from "firebase/functions";
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

interface BackupRecord {
  id: string;
  timestamp: any;
  type: "auto" | "manual";
  createdBy?: string;
  status: "completed" | "failed";
  dataSize?: number;
}

export default function BackupManagement() {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState<string | null>(null);
  const [deletingBackupId, setDeletingBackupId] = useState<string | null>(null);
  const [backupToDelete, setBackupToDelete] = useState<string | null>(null); // 삭제 확인용 상태
  const { toast } = useToast();
  const functions = getFunctions();
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadBackups();
  }, []);

  const cleanupOldBackups = async (backupsList: BackupRecord[]) => {
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const oldAutoBackups = backupsList.filter(backup => {
        // 자동 백업이면서 1주일 지난 백업 필터링
        if (backup.type !== 'auto') return false;

        let backupDate;
        if (backup.timestamp?.toDate) {
          backupDate = backup.timestamp.toDate();
        } else if (backup.timestamp instanceof Date) {
          backupDate = backup.timestamp;
        } else {
          backupDate = new Date(backup.timestamp);
        }

        return backupDate < oneWeekAgo;
      });

      if (oldAutoBackups.length > 0) {


        // 배치 삭제 실행 (Firestore 배치 쓰기 사용)
        const batch = writeBatch(db);
        oldAutoBackups.forEach(backup => {
          const docRef = doc(db, "backups", backup.id);
          batch.delete(docRef);
        });

        await batch.commit();


        toast({
          title: "자동 정리 완료",
          description: `1주일이 지난 자동 백업 ${oldAutoBackups.length}개를 삭제했습니다.`,
        });

        // 목록 새로고침 없이 상태에서 제거
        setBackups(prev => prev.filter(b => !oldAutoBackups.find(old => old.id === b.id)));
      }
    } catch (error) {
      console.error("오래된 백업 정리 중 오류:", error);
    }
  };

  const loadBackups = async () => {
    try {
      setLoading(true);
      const backupsQuery = query(collection(db, "backups"), orderBy("timestamp", "desc"));
      const snapshot = await getDocs(backupsQuery);
      const backupsData: BackupRecord[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as any;
        backupsData.push({
          id: docSnap.id,
          timestamp: data.timestamp,
          type: data.type,
          createdBy: data.createdBy,
          status: data.status,
          dataSize: data.data ? JSON.stringify(data.data).length : 0,
        });
      });
      setBackups(backupsData);

      // 백업 목록 로드 후 정리 로직 실행
      cleanupOldBackups(backupsData);

    } catch (error) {
      console.error("백업 목록 로드 실패:", error);
      toast({
        variant: "destructive",
        title: "오류",
        description: "백업 목록을 불러오는 중 오류가 발생했습니다.",
      });
    } finally {
      setLoading(false);
    }
  };

  const createManualBackup = async () => {
    try {
      setCreatingBackup(true);
      const manualBackup = httpsCallable(functions, "manualBackup");
      await manualBackup();
      toast({ title: "성공", description: "수동 백업이 완료되었습니다." });
      loadBackups();
    } catch (error) {
      console.error("수동 백업 실패:", error);
      toast({ variant: "destructive", title: "오류", description: "백업 생성 중 오류가 발생했습니다." });
    } finally {
      setCreatingBackup(false);
    }
  };

  const restoreBackup = async (backupId: string) => {
    try {
      setRestoringBackup(backupId);
      const restoreBackupFunction = httpsCallable(functions, "restoreBackup");
      await restoreBackupFunction({ backupId });
      toast({ title: "성공", description: "백업 복원이 완료되었습니다." });
    } catch (error) {
      console.error("백업 복원 실패:", error);
      toast({ variant: "destructive", title: "오류", description: "백업 복원 중 오류가 발생했습니다." });
    } finally {
      setRestoringBackup(null);
    }
  };

  const confirmDeleteBackup = (backupId: string) => {
    setBackupToDelete(backupId);
  };

  const handleDeleteConfirmed = async () => {
    if (!backupToDelete) return;

    try {
      setDeletingBackupId(backupToDelete);
      await deleteDoc(doc(db, "backups", backupToDelete));
      setBackups((prev) => prev.filter((b) => b.id !== backupToDelete));
      toast({ title: "삭제 완료", description: "백업이 삭제되었습니다." });
    } catch (error) {
      console.error("백업 삭제 실패:", error);
      toast({ variant: "destructive", title: "오류", description: "백업 삭제 중 오류가 발생했습니다." });
    } finally {
      setDeletingBackupId(null);
      setBackupToDelete(null);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "알 수 없음";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString("ko-KR");
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>백업 목록을 불러오는 중...</p>
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
                <span>전체 백업 수:</span>
                <span className="font-semibold">{backups.length}개</span>
              </div>
              <div className="flex justify-between">
                <span>자동 백업:</span>
                <span className="font-semibold">{backups.filter((b) => b.type === "auto").length}개</span>
              </div>
              <div className="flex justify-between">
                <span>수동 백업:</span>
                <span className="font-semibold">{backups.filter((b) => b.type === "manual").length}개</span>
              </div>
              <div className="flex justify-between">
                <span>최근 백업:</span>
                <span className="font-semibold">{backups.length > 0 ? formatDate(backups[0].timestamp) : "없음"}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              백업 설정
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-gray-600">자동 백업은 매일 새벽 2시에 실행됩니다.</p>
              <p className="text-sm text-gray-600">백업 데이터는 현재 <span className="font-bold text-blue-600">최근 7일분</span>만 유지됩니다.</p>
              <p className="text-xs text-gray-400">(7일이 지난 자동 백업은 자동 삭제됩니다)</p>
            </div>
            <Button onClick={createManualBackup} disabled={creatingBackup} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              {creatingBackup ? "백업 생성 중..." : "수동 백업 생성"}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              백업 정보
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p>• 백업 데이터는 Firestore에 저장됩니다</p>
              <p>• 자동 백업은 매일 새벽 2시에 실행됩니다</p>
              <p>• 백업 복원 시 기존 데이터가 덮어쓰기됩니다</p>
              <p>• <strong>데이터 보존 정책:</strong> 자동 백업은 생성일 기준 7일간 보관 후 자동 삭제됩니다. 수동 백업은 삭제되지 않습니다.</p>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            백업 목록
          </CardTitle>
        </CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <div className="text-center py-8">
              <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">백업이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {backups.map((backup) => (
                <div key={backup.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {backup.type === "auto" ? (
                        <div className="bg-blue-100 p-2 rounded-full">
                          <Clock className="h-4 w-4 text-blue-600" />
                        </div>
                      ) : (
                        <div className="bg-green-100 p-2 rounded-full">
                          <User className="h-4 w-4 text-green-600" />
                        </div>
                      )}
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {backup.type === "auto" ? "자동 백업" : "수동 백업"}
                          {backup.status === "completed" ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" /> 완료
                            </span>
                          ) : (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" /> 실패
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{formatDate(backup.timestamp)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-500 hidden sm:block">
                      {backup.dataSize ? formatFileSize(backup.dataSize) : "크기 정보 없음"}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => restoreBackup(backup.id)}
                        disabled={restoringBackup === backup.id || backup.status !== "completed"}
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
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!backupToDelete} onOpenChange={(open) => !open && setBackupToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>백업 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 이 백업 데이터를 삭제하시겠습니까?
              <br />
              이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirmed}
              className="bg-red-600 hover:bg-red-700"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


