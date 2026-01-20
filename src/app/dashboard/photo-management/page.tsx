"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Camera, Trash2, Eye, Calendar, Package, Search, Filter, Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useOrders } from "@/hooks/use-orders";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBranches } from "@/hooks/use-branches";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useUserRole } from "@/hooks/use-user-role";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Image from "next/image";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";

export default function PhotoManagementPage() {
  const { orders, loading, updateOrder } = useOrders();
  const { branches } = useBranches();
  const { user } = useAuth();
  const { isAdmin, userBranch } = useUserRole();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [dateFilter, setDateFilter] = useState("all"); // all, today, week, month
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);

  // 배송완료 사진이 있는 주문들만 필터링
  const photosData = useMemo(() => {
    let filteredOrders = orders.filter(order => 
      order.deliveryInfo?.completionPhotoUrl && 
      order.status === 'completed'
    );

    // 권한에 따른 지점 필터링
    if (!isAdmin && userBranch) {
      filteredOrders = filteredOrders.filter(order => order.branchName === userBranch);
    } else if (selectedBranch !== 'all') {
      filteredOrders = filteredOrders.filter(order => order.branchName === selectedBranch);
    }

    // 검색어 필터링
    if (searchTerm) {
      filteredOrders = filteredOrders.filter(order =>
        order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.orderer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.orderer.contact.includes(searchTerm)
      );
    }

    // 날짜 필터링
    if (dateFilter !== 'all') {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      filteredOrders = filteredOrders.filter(order => {
        const completedAt = order.deliveryInfo?.completedAt;
        if (!completedAt) return false;
        
        const completedDate = completedAt.toDate ? completedAt.toDate() : new Date(completedAt);
        
        switch (dateFilter) {
          case 'today':
            return completedDate >= startOfDay;
          case 'week':
            const weekAgo = new Date(startOfDay.getTime() - 7 * 24 * 60 * 60 * 1000);
            return completedDate >= weekAgo;
          case 'month':
            const monthAgo = new Date(startOfDay.getTime() - 30 * 24 * 60 * 60 * 1000);
            return completedDate >= monthAgo;
          default:
            return true;
        }
      });
    }

    return filteredOrders.map(order => ({
      orderId: order.id,
      customerName: order.orderer.name,
      customerContact: order.orderer.contact,
      branchName: order.branchName,
      photoUrl: order.deliveryInfo?.completionPhotoUrl!,
      completedAt: order.deliveryInfo?.completedAt,
      totalAmount: order.summary.total
    }));
  }, [orders, selectedBranch, searchTerm, dateFilter, isAdmin, userBranch]);

  const handleDeletePhoto = async (orderId: string, photoUrl: string) => {
    try {
      // Firebase Storage에서 사진 삭제
      const { deleteFile } = await import('@/lib/firebase-storage');
      await deleteFile(photoUrl);

      // Firestore에서 completionPhotoUrl 제거
      const order = orders.find(o => o.id === orderId);
      if (order && order.deliveryInfo) {
        const updatedDeliveryInfo = {
          ...order.deliveryInfo,
          completionPhotoUrl: null,
        };

        await updateOrder(orderId, {
          deliveryInfo: updatedDeliveryInfo
        });

        toast({
          title: "사진 삭제 완료",
          description: "배송완료 사진이 삭제되었습니다."
        });
      }
    } catch (error) {
      console.error('사진 삭제 실패:', error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: '사진 삭제 중 오류가 발생했습니다.',
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedPhotos.length === 0) return;

    try {
      const deletePromises = selectedPhotos.map(async (orderId) => {
        const photoData = photosData.find(p => p.orderId === orderId);
        if (photoData) {
          // Firebase Storage에서 사진 삭제
          const { deleteFile } = await import('@/lib/firebase-storage');
          await deleteFile(photoData.photoUrl);

          // Firestore에서 completionPhotoUrl 제거
          const order = orders.find(o => o.id === orderId);
          if (order && order.deliveryInfo) {
            const updatedDeliveryInfo = {
              ...order.deliveryInfo,
              completionPhotoUrl: null,
            };

            await updateOrder(orderId, {
              deliveryInfo: updatedDeliveryInfo
            });
          }
        }
      });

      await Promise.all(deletePromises);
      setSelectedPhotos([]);

      toast({
        title: "일괄 삭제 완료",
        description: `${selectedPhotos.length}개의 사진이 삭제되었습니다.`
      });
    } catch (error) {
      console.error('일괄 삭제 실패:', error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: '일괄 삭제 중 오류가 발생했습니다.',
      });
    }
  };

  const togglePhotoSelection = (orderId: string) => {
    setSelectedPhotos(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedPhotos.length === photosData.length) {
      setSelectedPhotos([]);
    } else {
      setSelectedPhotos(photosData.map(p => p.orderId));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="배송완료 사진 관리" description="배송완료 사진을 일괄 관리합니다" />
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="배송완료 사진 관리" 
        description="배송완료 사진을 일괄 관리하고 정리합니다"
        icon={Camera}
      />

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">총 사진</p>
                <p className="text-2xl font-bold">{photosData.length}개</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">이번 주</p>
                <p className="text-2xl font-bold">
                  {photosData.filter(p => {
                    const completedDate = p.completedAt?.toDate ? p.completedAt.toDate() : new Date(p.completedAt);
                    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                    return completedDate >= weekAgo;
                  }).length}개
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-orange-600" />
              <div>
                <p className="text-sm text-muted-foreground">오늘</p>
                <p className="text-2xl font-bold">
                  {photosData.filter(p => {
                    const completedDate = p.completedAt?.toDate ? p.completedAt.toDate() : new Date(p.completedAt);
                    const today = new Date();
                    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                    return completedDate >= startOfDay;
                  }).length}개
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-600" />
              <div>
                <p className="text-sm text-muted-foreground">선택됨</p>
                <p className="text-2xl font-bold">{selectedPhotos.length}개</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 필터 및 검색 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="주문번호, 고객명, 연락처로 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            {isAdmin && (
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="지점 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 지점</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.name}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="기간" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="today">오늘</SelectItem>
                <SelectItem value="week">이번 주</SelectItem>
                <SelectItem value="month">이번 달</SelectItem>
              </SelectContent>
            </Select>
            {selectedPhotos.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4" />
                    선택 삭제 ({selectedPhotos.length})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>사진 일괄 삭제</AlertDialogTitle>
                    <AlertDialogDescription>
                      선택된 {selectedPhotos.length}개의 배송완료 사진을 삭제하시겠습니까?
                      이 작업은 되돌릴 수 없습니다.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700">
                      삭제
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 사진 목록 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>배송완료 사진 목록</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSelectAll}
                className="text-xs"
              >
                {selectedPhotos.length === photosData.length ? '전체 해제' : '전체 선택'}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">선택</TableHead>
                  <TableHead>사진</TableHead>
                  <TableHead>주문번호</TableHead>
                  <TableHead>고객명</TableHead>
                  <TableHead>연락처</TableHead>
                  <TableHead>지점</TableHead>
                  <TableHead>완료일시</TableHead>
                  <TableHead>주문금액</TableHead>
                  <TableHead className="text-center">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {photosData.length > 0 ? (
                  photosData.map((photo) => (
                    <TableRow key={photo.orderId}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedPhotos.includes(photo.orderId)}
                          onChange={() => togglePhotoSelection(photo.orderId)}
                          className="h-4 w-4"
                        />
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <div className="relative w-16 h-16 cursor-pointer hover:opacity-80 transition-opacity">
                              <Image
                                src={photo.photoUrl}
                                alt="배송완료 사진"
                                fill
                                className="object-cover rounded-md"
                              />
                            </div>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>배송완료 사진 - {photo.orderId}</DialogTitle>
                              <DialogDescription>주문 {photo.orderId}의 배송완료 사진입니다.</DialogDescription>
                            </DialogHeader>
                            <div className="relative w-full h-96">
                              <Image
                                src={photo.photoUrl}
                                alt="배송완료 사진"
                                fill
                                className="object-contain"
                              />
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{photo.orderId}</TableCell>
                      <TableCell>{photo.customerName}</TableCell>
                      <TableCell>{photo.customerContact}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{photo.branchName}</Badge>
                      </TableCell>
                      <TableCell>
                        {photo.completedAt ? 
                          format(photo.completedAt.toDate ? photo.completedAt.toDate() : new Date(photo.completedAt), 'MM/dd HH:mm') 
                          : '-'
                        }
                      </TableCell>
                      <TableCell>₩{photo.totalAmount.toLocaleString()}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(photo.photoUrl, '_blank')}
                            className="text-xs"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>사진 삭제</AlertDialogTitle>
                                <AlertDialogDescription>
                                  주문 {photo.orderId}의 배송완료 사진을 삭제하시겠습니까?
                                  이 작업은 되돌릴 수 없습니다.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>취소</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDeletePhoto(photo.orderId, photo.photoUrl)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  삭제
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center h-24 text-muted-foreground">
                      <div className="space-y-2">
                        <Camera className="h-8 w-8 mx-auto text-muted-foreground" />
                        <p>배송완료 사진이 없습니다.</p>
                        <p className="text-sm">배송 완료 시 사진을 업로드하면 여기에 표시됩니다.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
