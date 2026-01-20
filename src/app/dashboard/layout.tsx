
"use client";
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useUserRole } from '@/hooks/use-user-role';
import { SidebarProvider, Sidebar, SidebarTrigger, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Boxes, ShoppingCart, Users, UserCog, LogOut, ClipboardList, Store, BookUser, Hammer, History, Briefcase, MapPin, Truck, Images, DollarSign, Target, BarChart3, Package, Receipt, Settings, Database, Percent, ArrowRightLeft, ExternalLink } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import React from 'react';
import Image from 'next/image';
import { ROLE_LABELS } from '@/types/user-role';
import { NotificationCenter } from '@/components/notification-center';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, loading } = useAuth();
    const { userRole, loading: roleLoading, isHQManager, isBranchUser, isBranchManager } = useUserRole();
    const router = useRouter();

    React.useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    const handleLogout = async () => {
        await signOut(auth);
        router.push('/login');
    };

    if (loading || roleLoading || !user) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                    <p>로딩 중...</p>
                </div>
            </div>
        );
    }

    const getRoleDisplayName = () => {
        if (user.isAnonymous) return '익명 사용자';
        if (userRole) return ROLE_LABELS[userRole.role];
        return '사용자';
    };

    return (
        <SidebarProvider defaultOpen={true}>
            <Sidebar className="no-print">
                <SidebarHeader className="p-4">
                    <div className="flex items-center justify-center">
                        <Image
                            src="https://ecimg.cafe24img.com/pg1472b45444056090/lilymagflower/web/upload/category/logo/v2_d13ecd48bab61a0269fab4ecbe56ce07_lZMUZ1lORo_top.jpg"
                            alt="Logo"
                            width={150}
                            height={40}
                            className="w-36 h-auto"
                            priority
                        />
                    </div>
                </SidebarHeader>
                <SidebarContent>
                    <SidebarMenu>
                        {/* 1. 대시보드 (모든 사용자) */}
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => router.push('/dashboard')}><LayoutDashboard />대시보드</SidebarMenuButton>
                        </SidebarMenuItem>

                        {/* 2. 샘플앨범 (모든 사용자) */}
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => router.push('/dashboard/sample-albums')}><Images />샘플앨범</SidebarMenuButton>
                        </SidebarMenuItem>


                        {/* 3. 주문 접수 (모든 사용자) */}
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => router.push('/dashboard/orders/new')}><ShoppingCart />주문 접수</SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => router.push('/dashboard/orders/new-mobile')} className="text-blue-600 bg-blue-50 hover:bg-blue-100"><ShoppingCart className="text-blue-600" />주문 접수 (Mobile)</SidebarMenuButton>
                        </SidebarMenuItem>

                        {/* 4. 주문 현황 (모든 사용자) */}
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => router.push('/dashboard/orders')}><ClipboardList />주문 현황</SidebarMenuButton>
                        </SidebarMenuItem>

                        {/* 외부 발주 관리 (모든 사용자) */}
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => router.push('/dashboard/outsource')} className="text-blue-600"><ExternalLink className="text-blue-600" />외부 발주 관리</SidebarMenuButton>
                        </SidebarMenuItem>



                        {/* 5. 픽업/배송예약관리 (모든 사용자) */}
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => router.push('/dashboard/pickup-delivery')}><Truck />픽업/배송예약관리</SidebarMenuButton>
                        </SidebarMenuItem>

                        {/* 6. 수령자 관리 (모든 사용자) */}
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => router.push('/dashboard/recipients')}><MapPin />수령자 관리</SidebarMenuButton>
                        </SidebarMenuItem>

                        {/* 7. 고객 관리 (모든 사용자) */}
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => router.push('/dashboard/customers')}><BookUser />고객 관리</SidebarMenuButton>
                        </SidebarMenuItem>

                        {/* 8. 거래처 관리 (모든 사용자) */}
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => router.push('/dashboard/partners')}><Briefcase />거래처 관리</SidebarMenuButton>
                        </SidebarMenuItem>

                        {/* 견적서 관리 (모든 사용자) */}
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => router.push('/dashboard/quotations')}><ClipboardList />견적서 관리</SidebarMenuButton>
                        </SidebarMenuItem>

                        {/* 인사 서류 신청 (모든 사용자) */}
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => router.push('/dashboard/hr/requests')}><Briefcase />인사 서류 신청</SidebarMenuButton>
                        </SidebarMenuItem>

                        {/* 본사 관리자만 접근 가능한 메뉴들 */}
                        {isHQManager() && (
                            <>
                                {/* 9. 상품 관리 (본사 관리자만) */}
                                <SidebarMenuItem>
                                    <SidebarMenuButton onClick={() => router.push('/dashboard/products')}><Boxes />상품 관리</SidebarMenuButton>
                                </SidebarMenuItem>
                                {/* 10. 자재 관리 (본사 관리자만) */}
                                <SidebarMenuItem>
                                    <SidebarMenuButton onClick={() => router.push('/dashboard/materials')}><Hammer />자재 관리</SidebarMenuButton>
                                </SidebarMenuItem>
                                {/* 11. 재고 변동 기록 (본사 관리자만) */}
                                <SidebarMenuItem>
                                    <SidebarMenuButton onClick={() => router.push('/dashboard/stock-history')}><History />재고 변동 기록</SidebarMenuButton>
                                </SidebarMenuItem>
                                {/* 12. 자재 요청 (본사 관리자만) */}
                                <SidebarMenuItem>
                                    <SidebarMenuButton onClick={() => router.push('/dashboard/material-request')}><Package />자재 요청</SidebarMenuButton>
                                </SidebarMenuItem>
                                {/* 13. 구매 관리 (본사 관리자만) */}
                                <SidebarMenuItem>
                                    <SidebarMenuButton onClick={() => router.push('/dashboard/purchase-management')}><ShoppingCart />구매 관리</SidebarMenuButton>
                                </SidebarMenuItem>
                                {/* 14. 간편 지출관리 (본사 관리자만) */}
                                <SidebarMenuItem>
                                    <SidebarMenuButton onClick={() => router.push('/dashboard/simple-expenses')}><Receipt />간편 지출관리</SidebarMenuButton>
                                </SidebarMenuItem>
                                {/* 15. 지점 관리 (본사 관리자만) */}
                                <SidebarMenuItem>
                                    <SidebarMenuButton onClick={() => router.push('/dashboard/branches')}><Store />지점 관리</SidebarMenuButton>
                                </SidebarMenuItem>
                                {/* 16. 비용 관리 (본사 관리자만) */}
                                <SidebarMenuItem>
                                    <SidebarMenuButton onClick={() => router.push('/dashboard/expenses')}><DollarSign />비용 관리</SidebarMenuButton>
                                </SidebarMenuItem>
                                {/* 17. 예산 관리 (본사 관리자만) */}
                                <SidebarMenuItem>
                                    <SidebarMenuButton onClick={() => router.push('/dashboard/budgets')}><Target />예산 관리</SidebarMenuButton>
                                </SidebarMenuItem>
                                {/* 18. 리포트 분석 (본사 관리자만) */}
                                <SidebarMenuItem>
                                    <SidebarMenuButton onClick={() => router.push('/dashboard/reports')}><BarChart3 />리포트 분석</SidebarMenuButton>
                                </SidebarMenuItem>
                                {/* 19. 인사 관리 (본사 관리자만) */}
                                <SidebarMenuItem>
                                    <SidebarMenuButton onClick={() => router.push('/dashboard/hr')}><Users />인사 관리</SidebarMenuButton>
                                </SidebarMenuItem>
                                {/* 인사 서류 관리 (본사 관리자만) */}
                                <SidebarMenuItem>
                                    <SidebarMenuButton onClick={() => router.push('/dashboard/hr/management')}><Users />신청서 관리</SidebarMenuButton>
                                </SidebarMenuItem>
                                {/* 20. 사용자 관리 (본사 관리자만) */}
                                <SidebarMenuItem>
                                    <SidebarMenuButton onClick={() => router.push('/dashboard/users')}><UserCog />사용자 관리</SidebarMenuButton>
                                </SidebarMenuItem>
                                {/* 21. 시스템 설정 (본사 관리자만) */}
                                <SidebarMenuItem>
                                    <SidebarMenuButton onClick={() => router.push('/dashboard/settings')}><Settings />시스템 설정</SidebarMenuButton>
                                </SidebarMenuItem>
                            </>
                        )}

                        {/* 지점 사용자용 메뉴들 */}
                        {!isHQManager() && (
                            <>
                                {/* 자재 요청 (지점 사용자) */}
                                <SidebarMenuItem>
                                    <SidebarMenuButton onClick={() => router.push('/dashboard/material-request')}><Package />자재 요청</SidebarMenuButton>
                                </SidebarMenuItem>
                                {/* 자재 관리 (지점 사용자) */}
                                <SidebarMenuItem>
                                    <SidebarMenuButton onClick={() => router.push('/dashboard/materials')}><Hammer />자재 관리</SidebarMenuButton>
                                </SidebarMenuItem>
                                {/* 간편 지출관리 (지점 사용자) */}
                                <SidebarMenuItem>
                                    <SidebarMenuButton onClick={() => router.push('/dashboard/simple-expenses')}><Receipt />간편 지출관리</SidebarMenuButton>
                                </SidebarMenuItem>
                            </>
                        )}
                    </SidebarMenu>
                </SidebarContent>
                <SidebarFooter className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                        <Avatar>
                            <AvatarImage src={user.photoURL ?? ''} />
                            <AvatarFallback>{user.email?.[0].toUpperCase() ?? 'U'}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col overflow-hidden">
                            <p className="text-sm font-medium truncate">{user.isAnonymous ? '익명 사용자' : user.email}</p>
                            <p className="text-xs text-muted-foreground">역할: {getRoleDisplayName()}</p>
                            {userRole?.branchName && (
                                <p className="text-xs text-muted-foreground">지점: {userRole.branchName}</p>
                            )}
                        </div>
                    </div>
                    <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}><LogOut className="mr-2 h-4 w-4" />로그아웃</Button>
                </SidebarFooter>
            </Sidebar>
            <main className="flex-1 print:flex-grow-0 print:w-full print:max-w-full print:p-0 print:m-0">
                <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:h-[60px] lg:px-6">
                    <SidebarTrigger className="xl:hidden" />
                    <div className="w-full flex-1">
                        {/* Header content can go here if needed */}
                    </div>
                    <div className="flex items-center gap-2">
                        <NotificationCenter />
                    </div>
                </header>
                <div className="p-4 lg:p-6">
                    {children}
                </div>
            </main>
        </SidebarProvider>
    );
}
