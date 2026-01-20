"use client";
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useOrders } from "@/hooks/use-orders";
import { useBranches } from "@/hooks/use-branches";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, XCircle, Download, Trash2, RefreshCw } from "lucide-react";
import * as XLSX from "xlsx";
import { Timestamp } from "firebase/firestore";

interface ExcelUploadDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ExcelOrderData {
  orderDate: string;
  branchName: string;
  orderItems: string;
  itemPrice: number;
  deliveryFee: number;
  paymentMethod: string;
  totalAmount: number;
  orderStatus: string;
  paymentStatus: string;
  ordererName: string;
  ordererContact: string;
  ordererEmail: string;
  deliveryMethod: string;
  pickupDate: string;
  recipientName: string;
  recipientContact: string;
  deliveryAddress: string;
  messageType: string;
  messageContent: string;
  specialRequests: string;
}

interface UploadResult {
  success: number;
  duplicate: number;
  error: number;
  errors: string[];
  uploadedOrderIds: string[]; // 업로드된 주문 ID들 저장
}

export function ExcelUploadDialog({ isOpen, onOpenChange }: ExcelUploadDialogProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const { addOrder, deleteOrder } = useOrders();
  const { branches } = useBranches();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.type === 'application/vnd.ms-excel') {
        setSelectedFile(file);
        setUploadResult(null);
      } else {
        toast({
          title: "파일 형식 오류",
          description: "엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.",
          variant: "destructive",
        });
      }
    }
  };

  const parseExcelData = (data: any[][]): ExcelOrderData[] => {
    const orders: ExcelOrderData[] = [];
    // 첫 번째 행은 헤더이므로 건너뛰기
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row.length < 20) continue; // 최소 20개 컬럼이 있어야 함
      try {
        const order: ExcelOrderData = {
          orderDate: row[0] || '',
          branchName: row[1] || '',
          orderItems: row[2] || '',
          itemPrice: Number(row[3]) || 0,
          deliveryFee: Number(row[4]) || 0,
          paymentMethod: row[5] || '',
          totalAmount: Number(row[6]) || 0,
          orderStatus: row[7] || 'processing',
          paymentStatus: row[8] || 'pending',
          ordererName: row[9] || '',
          ordererContact: row[10] || '',
          ordererEmail: row[11] || '',
          deliveryMethod: row[12] || 'pickup',
          pickupDate: row[13] || '',
          recipientName: row[14] || '',
          recipientContact: row[15] || '',
          deliveryAddress: row[16] || '',
          messageType: row[17] || 'none',
          messageContent: row[18] || '',
          specialRequests: row[19] || '',
        };
        // 필수 필드 검증 (지점명만 있으면 됨)
        if (order.branchName) {
          orders.push(order);
        }
      } catch (error) {
        // 파싱 오류는 조용히 처리
      }
    }
    return orders;
  };

  const convertToOrderFormat = (excelData: ExcelOrderData) => {
    // 지점 ID 찾기
    const branch = branches.find(b => b.name === excelData.branchName);
    if (!branch) {
      throw new Error(`지점을 찾을 수 없습니다: ${excelData.branchName}`);
    }

    // 주문 상품 파싱 - 등록되지 않은 상품명도 허용
    const orderItems = excelData.orderItems.split(',').map((item, index) => ({
      id: `excel_${Date.now()}_${index}`, // 엑셀 업로드용 ID
      name: item.trim(),
      price: excelData.itemPrice,
      quantity: 1,
      source: 'excel_upload' as const, // 출처 표시
      originalData: item.trim() // 원본 데이터 보존
    }));

    // 날짜 처리 - 날짜만 입력된 경우 시간 추가
    let orderDate = new Date(excelData.orderDate);
    if (isNaN(orderDate.getTime())) {
      // 날짜 파싱 실패 시 현재 시간으로 설정
      orderDate = new Date();
    }

    // 시간이 없는 경우 기본 시간 설정 (09:00)
    if (excelData.orderDate && !excelData.orderDate.includes(':')) {
      const dateOnly = new Date(excelData.orderDate);
      dateOnly.setHours(9, 0, 0, 0);
      orderDate = dateOnly;
    }

    // 수령 방법에 따른 정보 설정
    const isDelivery = excelData.deliveryMethod === 'delivery';
    const receiptType = isDelivery ? 'delivery_reservation' : 'pickup_reservation';

    // 픽업 정보 설정
    const pickupInfo = !isDelivery ? {
      date: excelData.pickupDate ? new Date(excelData.pickupDate).toISOString().split('T')[0] : '',
      time: excelData.pickupDate ? new Date(excelData.pickupDate).toTimeString().split(' ')[0] : '09:00:00',
      pickerName: excelData.recipientName || excelData.ordererName || '고객',
      pickerContact: excelData.recipientContact || excelData.ordererContact || ''
    } : null;

    // 배송 정보 설정
    const deliveryInfo = isDelivery ? {
      date: excelData.pickupDate ? new Date(excelData.pickupDate).toISOString().split('T')[0] : '',
      time: excelData.pickupDate ? new Date(excelData.pickupDate).toTimeString().split(' ')[0] : '09:00:00',
      recipientName: excelData.recipientName || excelData.ordererName || '고객',
      recipientContact: excelData.recipientContact || excelData.ordererContact || '',
      address: excelData.deliveryAddress || '',
      district: ''
    } : null;

    // 결제 수단 매핑
    const paymentMethodMap: { [key: string]: string } = {
      '카드': 'card',
      '현금': 'cash',
      '계좌이체': 'transfer',
      '메인페이': 'mainpay',
      '쇼핑몰': 'shopping_mall',
      '이페이': 'epay'
    };

    // 주문 상태 매핑
    const orderStatusMap: { [key: string]: string } = {
      'processing': 'processing',
      'completed': 'completed',
      'canceled': 'canceled',
      '처리중': 'processing',
      '완료': 'completed',
      '취소': 'canceled'
    };

    // 결제 상태 매핑
    const paymentStatusMap: { [key: string]: string } = {
      'pending': 'pending',
      'paid': 'paid',
      'completed': 'paid',
      '미결': 'pending',
      '완결': 'paid'
    };

    const order = {
      branchId: branch.id,
      branchName: excelData.branchName,
      orderDate: orderDate,
      status: (orderStatusMap[excelData.orderStatus] || 'processing') as 'processing' | 'completed' | 'canceled',
      items: orderItems,
      summary: {
        subtotal: excelData.itemPrice,
        discountAmount: 0,
        discountRate: 0,
        deliveryFee: excelData.deliveryFee,
        pointsUsed: 0,
        pointsEarned: Math.floor(excelData.itemPrice * 0.02),
        total: excelData.totalAmount
      },
      orderer: {
        name: excelData.ordererName || '고객',
        contact: excelData.ordererContact || '',
        company: '',
        email: excelData.ordererEmail || ''
      },
      isAnonymous: !excelData.ordererName || excelData.ordererName === '고객' || excelData.ordererName === '현금고객',
      registerCustomer: false, // 엑셀 업로드는 고객 등록 안함
      orderType: "store" as const,
      receiptType: receiptType as any,
      payment: {
        method: (paymentMethodMap[excelData.paymentMethod] || 'card') as "card" | "cash" | "transfer" | "mainpay" | "shopping_mall" | "epay",
        status: (paymentStatusMap[excelData.paymentStatus] || 'pending') as "paid" | "pending" | "completed",
        // 완결 상태로 엑셀 업로드되는 경우 completedAt 설정 (매출 날짜 정확한 기록)
        completedAt: ((paymentStatusMap[excelData.paymentStatus] === 'paid' ||
          paymentStatusMap[excelData.paymentStatus] === 'completed'))
          ? Timestamp.now()
          : undefined
      },
      pickupInfo: pickupInfo,
      deliveryInfo: deliveryInfo,
      message: excelData.messageType !== 'none' ? {
        type: excelData.messageType as "card" | "ribbon",
        content: excelData.messageContent
      } : {
        type: "card" as const,
        content: ""
      },
      request: excelData.specialRequests || '',
      source: 'excel_upload' as const // 출처 표시
    };

    return order;
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadResult(null);
    try {
      const data = await readExcelFile(selectedFile);
      const excelOrders = parseExcelData(data);
      if (excelOrders.length === 0) {
        toast({
          title: "데이터 없음",
          description: "유효한 주문 데이터가 없습니다.",
          variant: "destructive",
        });
        setUploading(false);
        return;
      }
      const result: UploadResult = {
        success: 0,
        duplicate: 0,
        error: 0,
        errors: [],
        uploadedOrderIds: []
      };
      // 업로드 (중복 체크 완화)
      for (let i = 0; i < excelOrders.length; i++) {
        const excelOrder = excelOrders[i];
        try {
          // 기존 데이터 업로드용이므로 중복 체크 완화
          const isDuplicate = await checkDuplicateOrder(excelOrder);
          if (isDuplicate) {
            result.duplicate++;
          } else {
            const orderData = convertToOrderFormat(excelOrder);
            const orderId = await addOrder(orderData);
            if (orderId) {
              result.uploadedOrderIds.push(orderId);
            }
            result.success++;
          }
        } catch (error) {
          result.error++;
          result.errors.push(`행 ${i + 2}: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        }
        setUploadProgress(((i + 1) / excelOrders.length) * 100);
      }
      setUploadResult(result);
      toast({
        title: "업로드 완료",
        description: `성공: ${result.success}개, 중복: ${result.duplicate}개, 오류: ${result.error}개`,
        variant: result.error > 0 ? "destructive" : "default",
      });
    } catch (error) {
      toast({
        title: "업로드 실패",
        description: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  // 일괄 삭제 기능
  const handleBulkDelete = async () => {
    if (!uploadResult || uploadResult.uploadedOrderIds.length === 0) {
      toast({
        title: "삭제할 주문 없음",
        description: "업로드된 주문이 없습니다.",
        variant: "destructive",
      });
      return;
    }

    const confirmed = window.confirm(
      `업로드된 ${uploadResult.uploadedOrderIds.length}개의 주문을 모두 삭제하시겠습니까?\n` +
      "이 작업은 되돌릴 수 없습니다."
    );

    if (!confirmed) return;

    setDeleting(true);
    try {
      let deletedCount = 0;
      for (const orderId of uploadResult.uploadedOrderIds) {
        try {
          await deleteOrder(orderId);
          deletedCount++;
        } catch (error) {
          console.error(`주문 삭제 실패: ${orderId}`, error);
        }
      }

      toast({
        title: "일괄 삭제 완료",
        description: `${deletedCount}개의 주문이 삭제되었습니다.`,
      });

      // 결과 초기화
      setUploadResult(null);
    } catch (error) {
      toast({
        title: "삭제 실패",
        description: "일괄 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const readExcelFile = (file: File): Promise<any[][]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          resolve(jsonData as any[][]);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const checkDuplicateOrder = async (order: ExcelOrderData): Promise<boolean> => {
    try {
      // 기존 데이터 업로드용 중복 체크 (완화된 기준)
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');

      // 주문일시를 Date 객체로 변환
      const orderDate = new Date(order.orderDate);
      const startOfDay = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());
      const endOfDay = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate(), 23, 59, 59);

      // 기존 주문 검색 (지점명 + 날짜 + 상품명 + 금액으로 중복 체크)
      const q = query(
        collection(db, 'orders'),
        where('branchName', '==', order.branchName)
      );

      const querySnapshot = await getDocs(q);

      // 같은 날짜에 같은 상품과 금액으로 주문한 내역이 있는지 확인
      for (const doc of querySnapshot.docs) {
        const existingOrder = doc.data();
        if (existingOrder.orderDate) {
          const existingDate = existingOrder.orderDate.toDate ?
            existingOrder.orderDate.toDate() :
            new Date(existingOrder.orderDate);

          // 같은 날짜인지 확인
          if (existingDate >= startOfDay && existingDate <= endOfDay) {
            // 상품명과 금액도 비교
            const existingItems = existingOrder.items?.map((item: any) => item.name).join(',') || '';
            const existingTotal = existingOrder.summary?.total || 0;

            if (existingItems === order.orderItems && existingTotal === order.totalAmount) {
              return true; // 중복 발견
            }
          }
        }
      }

      return false; // 중복 없음
    } catch (error) {
      return false; // 오류 발생 시 중복이 아닌 것으로 처리
    }
  };

  const downloadTemplate = () => {
    const template = [
      // === 기본 정보 (업로드/다운로드 공통) ===
      ['주문일시', '지점명', '주문상품', '상품금액', '배송비', '결제수단', '총금액', '주문상태', '결제상태', '주문자명', '주문자연락처', '주문자이메일', '수령방법', '픽업/배송일시', '수령인명', '수령인연락처', '배송주소', '메세지타입', '메세지내용', '요청사항'],
      ['2024-01-15', '강남점', '장미 10송이', '50000', '3000', '카드', '53000', 'processing', 'pending', '김철수', '010-1234-5678', 'kim@example.com', 'pickup', '2024-01-16', '', '', '', 'card', '생일 축하해요!', ''],
      ['2024-01-15', '강남점', '튤립 5송이', '30000', '0', '현금', '30000', 'completed', 'completed', '고객', '', '', 'pickup', '2024-01-15', '', '', '', 'none', '', '']
    ];
    const ws = XLSX.utils.aoa_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "주문템플릿");
    XLSX.writeFile(wb, "주문_업로드_템플릿.xlsx");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            엑셀 주문 일괄 업로드
          </DialogTitle>
          <DialogDescription>
            엑셀 파일을 통해 주문을 일괄 업로드합니다. 기존 매장 데이터 업로드에 최적화되어 있습니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {/* 템플릿 다운로드 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">엑셀 템플릿 다운로드</CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={downloadTemplate} variant="outline" className="w-full">
                <Download className="mr-2 h-4 w-4" />
                템플릿 다운로드
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                템플릿을 다운로드하여 데이터를 입력한 후 업로드하세요.
                <br />
                <span className="text-blue-600 font-medium">💡 팁:</span>
                • 날짜만 입력해도 됩니다 (시간은 자동으로 09:00으로 설정)
                <br />
                • 등록되지 않은 상품명도 입력 가능합니다
                <br />
                • 주문자명이 없으면 "고객"으로 자동 설정됩니다
              </p>
            </CardContent>
          </Card>
          {/* 파일 업로드 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">파일 선택</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="excel-upload"
                  disabled={uploading}
                />
                <label htmlFor="excel-upload" className="cursor-pointer">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-600">
                    {selectedFile ? selectedFile.name : "엑셀 파일을 선택하거나 드래그하세요"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    .xlsx, .xls 파일만 지원됩니다
                  </p>
                </label>
              </div>
            </CardContent>
          </Card>
          {/* 업로드 진행률 */}
          {uploading && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">업로드 진행 중...</CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={uploadProgress} className="w-full" />
                <p className="text-xs text-muted-foreground mt-2">
                  {Math.round(uploadProgress)}% 완료
                </p>
              </CardContent>
            </Card>
          )}
          {/* 업로드 결과 */}
          {uploadResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">업로드 결과</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">성공: {uploadResult.success}개</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm">중복: {uploadResult.duplicate}개</span>
                  </div>
                  {uploadResult.error > 0 && (
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <span className="text-sm">오류: {uploadResult.error}개</span>
                    </div>
                  )}
                  {uploadResult.errors.length > 0 && (
                    <div className="mt-3 p-3 bg-red-50 rounded-lg">
                      <p className="text-xs font-medium text-red-800 mb-2">오류 상세:</p>
                      <ul className="text-xs text-red-700 space-y-1">
                        {uploadResult.errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {/* 일괄 삭제 버튼 */}
                  {uploadResult.uploadedOrderIds.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <Button
                        onClick={handleBulkDelete}
                        variant="destructive"
                        size="sm"
                        disabled={deleting}
                        className="w-full"
                      >
                        {deleting ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            삭제 중...
                          </>
                        ) : (
                          <>
                            <Trash2 className="mr-2 h-4 w-4" />
                            업로드된 주문 일괄 삭제 ({uploadResult.uploadedOrderIds.length}개)
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2">
                        ⚠️ 잘못 업로드된 경우에만 사용하세요. 이 작업은 되돌릴 수 없습니다.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          {/* 액션 버튼 */}
          <div className="flex gap-2">
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="flex-1"
            >
              {uploading ? "업로드 중..." : "업로드 시작"}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={uploading}
            >
              닫기
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 
