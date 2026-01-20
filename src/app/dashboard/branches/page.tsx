
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { PlusCircle, MoreHorizontal } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { BranchForm, BranchFormValues } from "./components/branch-form";
import { BranchDetails } from "./components/branch-details";
import { useBranches, Branch } from "@/hooks/use-branches";
import { Skeleton } from "@/components/ui/skeleton";
export default function BranchesPage() {
  const { branches, loading, addBranch, updateBranch, deleteBranch } = useBranches();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const handleAdd = () => {
    setSelectedBranch(null);
    setIsFormOpen(true);
  };
  const handleEdit = (branch: Branch) => {
    setIsDetailOpen(false);
    setSelectedBranch(branch);
    setIsFormOpen(true);
  };
  const handleRowClick = (branch: Branch) => {
    setSelectedBranch(branch);
    setIsDetailOpen(true);
  }
  const handleFormSubmit = async (data: BranchFormValues) => {
    if (selectedBranch?.id) {
      await updateBranch(selectedBranch.id, data);
    } else {
      await addBranch(data);
    }
    setIsFormOpen(false);
  };
  const handleDelete = async (branchId: string) => {
    await deleteBranch(branchId);
  };
  return (
    <div>
      <PageHeader
        title="지점 관리"
        description="본사 및 직영, 가맹점 정보를 관리합니다."
      >
        <Button onClick={handleAdd}>
          <PlusCircle className="mr-2 h-4 w-4" />
          지점 추가
        </Button>
      </PageHeader>
      <Card>
        <CardHeader>
            <CardTitle>지점 목록</CardTitle>
            <CardDescription>
                전체 지점 목록입니다. 직영점, 가맹점, 본사 정보를 확인할 수 있습니다.
            </CardDescription>
        </CardHeader>
        <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>지점명</TableHead>
              <TableHead>유형</TableHead>
              <TableHead className="hidden sm:table-cell">점장</TableHead>
              <TableHead className="hidden md:table-cell">연락처</TableHead>
              <TableHead className="hidden lg:table-cell">주소</TableHead>
              <TableHead>
                <span className="sr-only">작업</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))
            ) : branches.map((branch) => (
              <TableRow key={branch.id} onClick={() => handleRowClick(branch)} className="cursor-pointer">
                <TableCell className="font-medium">{branch.name}</TableCell>
                <TableCell>
                  <Badge variant={branch.type === '본사' ? 'default' : branch.type === '직영점' ? 'secondary' : 'outline'}>
                    {branch.type}
                  </Badge>
                </TableCell>
                <TableCell className="hidden sm:table-cell">{branch.manager || '-'}</TableCell>
                <TableCell className="hidden md:table-cell">{branch.phone}</TableCell>
                <TableCell className="hidden lg:table-cell">{branch.address}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <AlertDialog>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button aria-haspopup="true" size="icon" variant="ghost">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">메뉴 토글</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>작업</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleEdit(branch)}>수정</DropdownMenuItem>
                        <AlertDialogTrigger asChild>
                            <DropdownMenuItem className="text-destructive">삭제</DropdownMenuItem>
                        </AlertDialogTrigger>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>정말로 삭제하시겠습니까?</AlertDialogTitle>
                          <AlertDialogDescription>
                            이 작업은 되돌릴 수 없습니다. '{branch.name}' 지점 데이터가 서버에서 영구적으로 삭제됩니다.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>취소</AlertDialogCancel>
                          <AlertDialogAction 
                            className="bg-destructive hover:bg-destructive/90"
                            onClick={() => handleDelete(branch.id)}
                          >
                            삭제
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </CardContent>
      </Card>
      <BranchForm 
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleFormSubmit}
        branch={selectedBranch}
      />
      <BranchDetails 
        isOpen={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        branch={selectedBranch}
        onEdit={() => selectedBranch && handleEdit(selectedBranch)}
      />
    </div>
  );
}
