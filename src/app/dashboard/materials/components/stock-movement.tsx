
"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBranches } from "@/hooks/use-branches";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MinusCircle, PlusCircle, ScanLine, Store, Trash2, Wand2, Paperclip } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useMaterials } from "@/hooks/use-materials";
import { useAuth } from "@/hooks/use-auth";
import { Label } from "@/components/ui/label";
interface ScannedItem {
  id: string;
  name: string;
  quantity: number;
}
export function StockMovement() {
  const { branches } = useBranches();
  const { materials, loading: materialsLoading, updateStock } = useMaterials();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("stock-in");
  const [barcode, setBarcode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [receiptText, setReceiptText] = useState("");
  const [receiptPhoto, setReceiptPhoto] = useState<File | null>(null);
  const [receiptPhotoPreview, setReceiptPhotoPreview] = useState<string | null>(null);
  const [stockInList, setStockInList] = useState<ScannedItem[]>([]);
  const [stockOutList, setStockOutList] = useState<ScannedItem[]>([]);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const selectedBranchName = useMemo(() => {
    return branches.find(b => b.id === selectedBranchId)?.name || "지점";
  }, [selectedBranchId, branches]);
  useEffect(() => {
    if (selectedBranchId && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [selectedBranchId]);
  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode) return;
    const scannedId = barcode.trim();
    const material = materials.find(m => m.id === scannedId);
    if (!material) {
      toast({
        variant: "destructive",
        title: "자재 없음",
        description: `바코드 '${scannedId}'에 해당하는 자재를 찾을 수 없습니다.`,
      });
      setBarcode("");
      return;
    }
    const listUpdater = (list: ScannedItem[]): ScannedItem[] => {
        const existingItem = list.find(item => item.id === scannedId);
        if (existingItem) {
            return list.map(item =>
                item.id === scannedId ? { ...item, quantity: item.quantity + 1 } : item
            );
        }
        return [...list, { id: scannedId, name: material.name, quantity: 1 }];
    };
    if (activeTab === 'stock-in') {
      setStockInList(listUpdater);
    } else { // stock-out
      setStockOutList(listUpdater);
    }
    setBarcode("");
  };
  const updateQuantity = (list: 'in' | 'out', id: string, newQuantity: number) => {
    const quantity = Math.max(1, newQuantity);
    const setter = list === 'in' ? setStockInList : setStockOutList;
    setter(prev => prev.map(item => item.id === id ? { ...item, quantity } : item));
  };
  const removeItem = (list: 'in' | 'out', id: string) => {
    const setter = list === 'in' ? setStockInList : setStockOutList;
    setter(prev => prev.filter(item => item.id !== id));
  };
  const handleProcess = async () => {
    setIsProcessing(true);
    const list = activeTab === 'stock-in' ? stockInList : stockOutList;
    const type = activeTab === 'stock-in' ? 'in' : 'out';
    if (list.length === 0) {
      toast({ variant: "destructive", title: "목록이 비어있음", description: "처리할 자재를 먼저 스캔해주세요." });
      setIsProcessing(false);
      return;
    }
    if (!user) {
        toast({ variant: "destructive", title: "인증 오류", description: "사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요."});
        setIsProcessing(false);
        return;
    }
    await updateStock(list, type, selectedBranchName, user.email || "Unknown User");
    toast({
      title: "처리 완료",
      description: `${selectedBranchName}의 ${type === 'in' ? '입고' : '출고'}가 성공적으로 처리되었습니다.`
    });
    if(type === 'in') setStockInList([]);
    else setStockOutList([]);
    setIsProcessing(false);
  };
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setReceiptPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  const fileToDataUri = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
  }
  // const handleAiProcess = async () => {
  //   if (!receiptText.trim() && !receiptPhoto) {
  //       toast({ variant: "destructive", title: "내용 없음", description: "분석할 영수증 텍스트나 사진을 제공해주세요." });
  //       return;
  //   }
  //   setIsAiProcessing(true);
  //   try {
  //       let photoDataUri: string | undefined;
  //       if (receiptPhoto) {
  //           photoDataUri = await fileToDataUri(receiptPhoto);
  //   }
        // AI 기능 임시 비활성화
        // const result = await processReceipt({ receiptText, photoDataUri });
        const newItems: ScannedItem[] = [];
        // result.items.forEach(processedItem => {
        //     const material = materials.find(m => m.name === processedItem.itemName);
        //     if (material) {
        //         newItems.push({
        //             id: material.id,
        //             name: material.name,
        //             quantity: processedItem.quantity,
        //         });
        //     }
        // });
  //       setStockInList(prevList => {
  //           const updatedList = [...prevList];
  //           newItems.forEach(newItem => {
  //               const existingItemIndex = updatedList.findIndex(item => item.id === newItem.id);
  //               if (existingItemIndex > -1) {
  //                   updatedList[existingItemIndex].quantity += newItem.quantity;
  //               } else {
  //                   updatedList.push(newItem);
  //               }
  //           });
  //           return updatedList;
  //       });
  //       toast({
  //           title: "AI 분석 완료",
  //           description: `${newItems.length}개의 항목이 입고 목록에 추가되었습니다. 내용을 확인하고 입고 처리를 완료해주세요.`,
  //       });
  //       setReceiptText("");
  //       setReceiptPhoto(null);
  //       setReceiptPhotoPreview(null);
  //   } catch (error) {
  //       console.error("AI processing error:", error);
  //       toast({
  //           variant: "destructive",
  //           title: "AI 분석 오류",
  //           description: "영수증 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
  //       });
  //   } finally {
  //       setIsAiProcessing(false);
  //   }
  // };
  const renderList = (list: ScannedItem[], type: 'in' | 'out') => (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>자재명</TableHead>
              <TableHead className="w-[150px] text-center">수량</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length > 0 ? list.map(item => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>
                   <div className="flex items-center justify-center gap-2">
                      <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQuantity(type, item.id, item.quantity - 1)}><MinusCircle className="h-4 w-4"/></Button>
                      <Input type="number" value={item.quantity} onChange={(e) => updateQuantity(type, item.id, parseInt(e.target.value) || 1)} className="h-8 w-16 text-center" />
                      <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQuantity(type, item.id, item.quantity + 1)}><PlusCircle className="h-4 w-4"/></Button>
                  </div>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => removeItem(type, item.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                  자재를 스캔하여 목록에 추가하세요.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
  return (
    <div>
      <PageHeader
        title="재고 입출고"
        description="핸디 스캐너 또는 AI를 사용하여 자재 재고를 관리합니다."
      />
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>1. 지점 선택</CardTitle>
            <CardDescription>재고를 변경할 지점을 선택해주세요.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-muted-foreground" />
              <Select onValueChange={setSelectedBranchId} value={selectedBranchId ?? ''}>
                <SelectTrigger className="w-full sm:w-[300px]">
                  <SelectValue placeholder="지점 선택..." />
                </SelectTrigger>
                <SelectContent>
                  {branches.filter(b => b.type !== '본사').map(branch => (
                    <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        <fieldset disabled={!selectedBranchId || materialsLoading} className="space-y-6">
           {materialsLoading && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <p>자재 정보를 불러오는 중입니다...</p>
                </div>
            )}
          <Card>
            <CardHeader>
                <CardTitle>AI 입고 도우미 (Beta)</CardTitle>
                <CardDescription>거래명세서나 영수증 내용을 붙여넣거나, 사진을 업로드하여 입고 목록을 자동으로 채웁니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <Textarea 
                    placeholder="예시) 마르시아 장미 50단, 레드 카네이션 30단, 포장용 크라프트지 10롤..."
                    value={receiptText}
                    onChange={(e) => setReceiptText(e.target.value)}
                    rows={3}
                />
                <div>
                  <Label htmlFor="receipt-photo">영수증 사진</Label>
                  <div className="flex items-center gap-4 mt-1">
                    <Input
                      id="receipt-photo"
                      type="file"
                      ref={photoInputRef}
                      onChange={handlePhotoChange}
                      accept="image/*"
                      className="hidden"
                    />
                    <Button type="button" variant="outline" onClick={() => photoInputRef.current?.click()}>
                      <Paperclip className="mr-2 h-4 w-4" />
                      {receiptPhoto ? "사진 변경" : "사진 선택"}
                    </Button>
                    {receiptPhotoPreview && (
                      <div className="flex items-center gap-2">
                        <img src={receiptPhotoPreview} alt="영수증 미리보기" className="h-10 w-10 object-cover rounded-md" />
                        <span className="text-sm text-muted-foreground truncate max-w-[200px]">{receiptPhoto?.name}</span>
                         <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setReceiptPhoto(null); setReceiptPhotoPreview(null); }}>
                           <Trash2 className="h-4 w-4 text-destructive"/>
                         </Button>
                      </div>
                    )}
                  </div>
                </div>
                {/* <div className="flex items-center gap-2">
                    <Button onClick={handleAiProcess} disabled={isAiProcessing}>
                        {isAiProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                        AI로 분석하기
                    </Button>
                </div> */}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>바코드 스캔</CardTitle>
              <CardDescription>아래 입력란에 포커스를 맞추고 바코드를 스캔하세요.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleScan} className="flex items-center gap-2">
                <ScanLine className="h-6 w-6 text-muted-foreground" />
                <Input
                  ref={barcodeInputRef}
                  placeholder="바코드 스캔 또는 입력 후 Enter"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="max-w-sm"
                />
              </form>
            </CardContent>
          </Card>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex justify-between items-end">
                <TabsList>
                  <TabsTrigger value="stock-in">입고</TabsTrigger>
                  <TabsTrigger value="stock-out">출고</TabsTrigger>
                </TabsList>
                 <Button onClick={handleProcess} disabled={isProcessing}>
                    {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {activeTab === 'stock-in' ? `${selectedBranchName} 입고 처리` : `${selectedBranchName} 출고 처리`}
                </Button>
            </div>
            <TabsContent value="stock-in">
              {renderList(stockInList, 'in')}
            </TabsContent>
            <TabsContent value="stock-out">
              {renderList(stockOutList, 'out')}
            </TabsContent>
          </Tabs>
        </fieldset>
      </div>
    </div>
  );
}
