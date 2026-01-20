"use client";
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDeliveryFees } from '@/hooks/use-delivery-fees';
import { useBranches } from '@/hooks/use-branches';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
export default function DeliveryFeesPage() {
  const { deliveryFees, loading, updateDeliveryFee, initializeDeliveryFees } = useDeliveryFees();
  const { branches } = useBranches();
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [editingFee, setEditingFee] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const filteredFees = deliveryFees.filter(fee => 
    selectedBranch === 'all' || fee.branchId === selectedBranch
  );
  const handleEdit = (feeId: string, currentFee: number) => {
    setEditingFee(feeId);
    setEditValue(currentFee.toString());
  };
  const handleSave = async (feeId: string) => {
    const newFee = parseInt(editValue);
    if (!isNaN(newFee)) {
      await updateDeliveryFee(feeId, { fee: newFee });
    }
    setEditingFee(null);
    setEditValue('');
  };
  return (
    <div>
      <PageHeader
        title="배송비 관리"
        description="지점별 배송비를 관리합니다."
      >
        <Button onClick={() => initializeDeliveryFees(branches)}>
          배송비 데이터 초기화
        </Button>
      </PageHeader>
      <Card>
        <CardHeader>
          <CardTitle>배송비 설정</CardTitle>
          <div className="flex gap-4">
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="지점 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 지점</SelectItem>
                {branches.map(branch => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>지점명</TableHead>
                <TableHead>지역</TableHead>
                <TableHead>배송비</TableHead>
                <TableHead>작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFees.map(fee => (
                <TableRow key={fee.id}>
                  <TableCell>{fee.branchName}</TableCell>
                  <TableCell>{fee.district}</TableCell>
                  <TableCell>
                    {editingFee === fee.id ? (
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        type="number"
                        className="w-24"
                      />
                    ) : (
                      `₩${fee.fee.toLocaleString()}`
                    )}
                  </TableCell>
                  <TableCell>
                    {editingFee === fee.id ? (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleSave(fee.id)}>
                          저장
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingFee(null)}>
                          취소
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => handleEdit(fee.id, fee.fee)}>
                        수정
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
