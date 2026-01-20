
"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, Trash2, Key, UserCheck, UserX, Clock } from "lucide-react";
import { UserForm } from "./user-form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { SystemUser } from "../page";
import { format } from "date-fns";
import { POSITIONS } from "@/lib/constants";

interface UserTableProps {
  users: SystemUser[];
  onDeleteUser: (userId: string, userEmail: string) => Promise<void>;
  onPasswordReset: (userId: string, userEmail: string) => Promise<void>;
  onToggleStatus: (userId: string, userEmail: string, currentStatus: boolean) => Promise<void>;
  onUserUpdated?: () => void; // 사용자 업데이트 콜백 추가
}

export function UserTable({ users, onDeleteUser, onPasswordReset, onToggleStatus, onUserUpdated }: UserTableProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  const [userToDelete, setUserToDelete] = useState<SystemUser | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleEdit = (user: SystemUser) => {
    setSelectedUser(user);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (user: SystemUser) => {
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (userToDelete) {
      await onDeleteUser(userToDelete.id, userToDelete.email);
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };

  const handlePasswordResetClick = async (user: SystemUser) => {
    await onPasswordReset(user.id, user.email);
  };

  const handleToggleStatusClick = async (user: SystemUser) => {
    await onToggleStatus(user.id, user.email, user.isActive !== false);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedUser(null);
  };

  const handleUserUpdated = () => {
    // 사용자 업데이트 후 폼 닫기 및 콜백 호출
    handleCloseForm();
    if (onUserUpdated) {
      onUserUpdated();
    }
  };

  const getStatusBadge = (user: SystemUser) => {
    if (user.isActive === false) {
      return <Badge variant="destructive" className="flex items-center gap-1">
        <UserX className="h-3 w-3" />
        비활성
      </Badge>;
    }
    return <Badge variant="default" className="flex items-center gap-1">
      <UserCheck className="h-3 w-3" />
      활성
    </Badge>;
  };

  const getPositionBadge = (position: string) => {
    let variant: "default" | "secondary" | "outline" | "destructive" = "outline";
    switch (position) {
      case POSITIONS.CEO:
        variant = "default";
        break;
      case POSITIONS.DIRECTOR:
        variant = "secondary";
        break;
      case POSITIONS.MANAGER:
        variant = "outline";
        break;
      case POSITIONS.SUPERVISOR:
        variant = "outline";
        break;
      case POSITIONS.STAFF:
        variant = "outline";
        break;
      default:
        variant = "outline";
    }
    return <Badge variant={variant}>{position}</Badge>;
  };

  const formatLastLogin = (lastLogin: any) => {
    if (!lastLogin) return '-';
    try {
      // Firestore Timestamp 객체인 경우
      if (lastLogin.toDate) {
        return format(lastLogin.toDate(), 'yyyy-MM-dd HH:mm');
      }
      // 문자열인 경우
      if (typeof lastLogin === 'string') {
        return format(new Date(lastLogin), 'yyyy-MM-dd HH:mm');
      }
      // Date 객체인 경우
      if (lastLogin instanceof Date) {
        return format(lastLogin, 'yyyy-MM-dd HH:mm');
      }
      // 숫자 타임스탬프인 경우
      if (typeof lastLogin === 'number') {
        return format(new Date(lastLogin), 'yyyy-MM-dd HH:mm');
      }
      return '-';
    } catch {
      return '-';
    }
  };

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이메일</TableHead>
                <TableHead>권한</TableHead>
                <TableHead>직위</TableHead>
                <TableHead>소속</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="hidden md:table-cell">마지막 로그인</TableHead>
                <TableHead>
                  <span className="sr-only">작업</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={user.role === '본사 관리자' ? 'default' : user.role === '가맹점 관리자' ? 'secondary' : 'outline'}
                    >
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {getPositionBadge(user.position || '직원')}
                  </TableCell>
                  <TableCell>{user.franchise}</TableCell>
                  <TableCell>
                    {getStatusBadge(user)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      {formatLastLogin(user.lastLogin)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button aria-haspopup="true" size="icon" variant="ghost">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">메뉴 토글</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>작업</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleEdit(user)}>권한 변경</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handlePasswordResetClick(user)}>
                          <Key className="mr-2 h-4 w-4" />
                          비밀번호 초기화
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleStatusClick(user)}>
                          {user.isActive !== false ? (
                            <>
                              <UserX className="mr-2 h-4 w-4" />
                              계정 비활성화
                            </>
                          ) : (
                            <>
                              <UserCheck className="mr-2 h-4 w-4" />
                              계정 활성화
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleDeleteClick(user)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          사용자 삭제
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>사용자 삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{userToDelete?.email}</strong> 사용자를 정말로 삭제하시겠습니까?
              <br />
              <span className="text-sm text-muted-foreground">
                이 작업은 되돌릴 수 없으며, 해당 사용자의 모든 데이터가 삭제됩니다.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-destructive hover:bg-destructive/90"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 사용자 폼 */}
      {isFormOpen && (
        <UserForm 
          isOpen={isFormOpen} 
          onOpenChange={handleCloseForm} 
          user={selectedUser} 
          onUserUpdated={handleUserUpdated} 
        />
      )}
    </>
  );
}
