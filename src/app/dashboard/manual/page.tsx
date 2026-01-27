"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen, ChevronRight, LayoutDashboard, ShoppingCart,
  ClipboardList, ExternalLink, Truck, MapPin,
  BookUser, Briefcase, FileText, UserPlus,
  Package, Hammer, History, Receipt,
  Store, DollarSign, Target, BarChart3,
  Users, UserCog, Settings, Search, Menu, X,
  Camera, Plus, Copy, Building, AlertCircle
} from "lucide-react";

// --- UI Mockup Components (Visual Aids) ---

const BrowserFrame = ({ url, children }: { url: string; children: React.ReactNode }) => (
  <div className="border rounded-lg overflow-hidden shadow-sm bg-background my-6 ring-1 ring-slate-200">
    <div className="bg-slate-100 border-b px-4 py-2 flex items-center gap-2">
      <div className="flex gap-1.5">
        <div className="w-3 h-3 rounded-full bg-red-400" />
        <div className="w-3 h-3 rounded-full bg-amber-400" />
        <div className="w-3 h-3 rounded-full bg-green-400" />
      </div>
      <div className="ml-4 bg-white px-3 py-1 rounded-md text-xs text-slate-500 font-mono flex-1 border shadow-sm truncate">
        {url}
      </div>
    </div>
    <div className="p-0 bg-slate-50/50 min-h-[200px] max-h-[500px] overflow-y-auto custom-scrollbar">
      {children}
    </div>
  </div>
);

const FeatureCard = ({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) => (
  <Card className="bg-slate-50 border-slate-200 shadow-sm">
    <CardHeader className="pb-3 pt-5">
      <CardTitle className="text-base font-semibold flex items-center gap-2 text-slate-800">
        <Icon className="h-4 w-4 text-blue-600" />
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="text-sm text-slate-600 space-y-2">
      {children}
    </CardContent>
  </Card>
);

const StepGuide = ({ steps }: { steps: string[] }) => (
  <div className="ml-2 relative border-l-2 border-slate-200 pl-6 space-y-6 my-4">
    {steps.map((step, i) => (
      <div key={i} className="relative">
        <div className="absolute -left-[31px] top-0 flex h-6 w-6 items-center justify-center rounded-full bg-white ring-2 ring-slate-200 text-xs font-bold text-slate-600">
          {i + 1}
        </div>
        <p className="text-sm text-slate-700 leading-relaxed font-medium">{step}</p>
      </div>
    ))}
  </div>
);

const Highlight = ({ children }: { children: React.ReactNode }) => (
  <span className="font-semibold text-blue-700 bg-blue-50 px-1 py-0.5 rounded mx-1">{children}</span>
);

export default function ManualPage() {
  const { user } = useAuth();
  const [activeHash, setActiveHash] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const observerRefs = useRef<{ [key: string]: HTMLElement | null }>({});

  const isHQ = user?.role === '본사 관리자' || user?.email === 'lilymag0301@gmail.com';

  // --- Scroll Spy Logic ---
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveHash(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0px -60% 0px" } // Trigger when element is near top
    );

    Object.values(observerRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const headerOffset = 80;
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({ top: offsetPosition, behavior: "smooth" });
      setActiveHash(id);
      setIsMobileMenuOpen(false);
    }
  };

  // --- Menu Structure Definition ---
  const menuSections = [
    {
      title: "공통 필수 메뉴",
      items: [
        { id: "dashboard", label: "1. 대시보드", icon: LayoutDashboard },
        { id: "sample-albums", label: "2. 샘플 앨범", icon: BookOpen },
        { id: "orders-new", label: "3. 주문 접수 (PC)", icon: ShoppingCart },
        { id: "orders-mobile", label: "4. 주문 접수 (Mobile)", icon: ShoppingCart },
        { id: "orders-list", label: "5. 주문 현황", icon: ClipboardList },
        { id: "outsource", label: "6. 외부 발주 관리", icon: ExternalLink },
        { id: "pickup-delivery", label: "7. 픽업/배송 관리", icon: Truck },
        { id: "recipients", label: "8. 수령자 관리", icon: MapPin },
        { id: "customers", label: "9. 고객 관리", icon: BookUser },
        { id: "partners", label: "10. 거래처 관리", icon: Briefcase },
        { id: "quotations", label: "11. 견적서 관리", icon: FileText },
        { id: "hr-requests", label: "12. 인사 서류 신청", icon: UserPlus },
      ]
    },
    {
      title: "역할별 공통 메뉴",
      items: [
        { id: "materials", label: isHQ ? "14~15. 자재 및 재고" : "자재 관리 (지점)", icon: Hammer },
        { id: "material-request", label: isHQ ? "16. 자재 요청 (관리)" : "자재 요청 (신청)", icon: Package },
        { id: "purchase", label: "17. 구매 관리", icon: ShoppingCart },
        { id: "simple-expenses", label: isHQ ? "18. 간편 지출 (관리)" : "간편 지출관리", icon: Receipt },
      ]
    },
    ...(isHQ ? [{
      title: "본사 관리자 전용",
      items: [
        { id: "products", label: "13. 상품 관리", icon: Package },
        { id: "reports", label: "19. 리포트 분석", icon: BarChart3 },
        { id: "hr-management", label: "24. 인사 관리", icon: Users },
        { id: "settings", label: "25~26. 시스템 설정", icon: Settings },
      ]
    }] : [])
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* Mobile Menu Toggle */}
      <div className="lg:hidden sticky top-14 left-0 right-0 z-20 bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm">
        <span className="font-semibold text-sm">목차 보기</span>
        <Button variant="ghost" size="sm" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      <div className="flex container mx-auto max-w-7xl pt-4 lg:pt-8 gap-8 px-4 lg:px-6">

        {/* Left Sidebar Navigation (Sticky) */}
        <aside className={cn(
          "fixed inset-0 z-30 bg-white lg:bg-transparent lg:static lg:block lg:w-64 shrink-0 transition-transform duration-300 lg:translate-x-0 border-r lg:border-r-0 lg:border-none p-4 lg:p-0 overflow-y-auto lg:overflow-visible h-screen lg:h-auto",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="lg:sticky lg:top-24 space-y-8">
            <div className="flex items-center justify-between lg:hidden mb-4">
              <span className="font-bold text-lg">매뉴얼 목차</span>
              <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)}><X /></Button>
            </div>

            {menuSections.map((section, idx) => (
              <div key={idx}>
                <h4 className="font-bold text-slate-900 mb-3 px-2 text-sm uppercase tracking-wide">{section.title}</h4>
                <nav className="space-y-0.5">
                  {section.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => scrollToSection(item.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-all text-left",
                        activeHash === item.id
                          ? "bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-200"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      )}
                    >
                      <item.icon className={cn("h-4 w-4", activeHash === item.id ? "text-blue-600" : "text-slate-400")} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  ))}
                </nav>
              </div>
            ))}
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 space-y-16 pb-24">
          <div className="space-y-4">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">사용자 매뉴얼</h1>
            <div className="text-slate-500 text-lg">
              LilyMag ERP v4.0 시스템 사용을 위한 상세 가이드입니다.<br />
              현재 로그인하신 <Badge variant="outline" className="ml-1 font-bold">{isHQ ? "본사 관리자" : "지점 사용자"}</Badge> 권한에 맞는 기능만 표시됩니다.
            </div>
          </div>

          <Separator />

          {/* 1. Dashboard */}
          <section id="dashboard" ref={el => { if (el) observerRefs.current["dashboard"] = el; }} className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><LayoutDashboard className="h-6 w-6" /></div>
              <h2 className="text-2xl font-bold">1. 대시보드</h2>
            </div>
            <div className="prose max-w-none text-slate-600">
              <p>로그인 후 가장 먼저 만나는 화면입니다. 매장의 현재 상태를 한눈에 파악하고 주요 업무로 빠르게 이동할 수 있습니다.</p>

              <BrowserFrame url="/dashboard">
                <div className="p-6 grid gap-6">
                  <div className="grid grid-cols-4 gap-4">
                    {['오늘 매출', '신규 고객', '주간 주문', '미처리 주문'].map((t, i) => (
                      <div key={i} className="bg-white p-4 rounded border shadow-sm h-24 flex flex-col justify-between">
                        <span className="text-xs text-gray-500 font-medium">{t}</span>
                        <span className="text-2xl font-bold text-slate-800">{100 + i * 15}</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4 h-64">
                    <div className="bg-white border rounded p-4 flex items-center justify-center text-slate-300">매출 그래프 영역</div>
                    <div className="bg-white border rounded p-4 flex flex-col gap-2">
                      <div className="text-sm font-bold mb-2">빠른 실행</div>
                      <div className="flex gap-2">
                        <div className="flex-1 bg-slate-50 border border-dashed rounded flex flex-col items-center justify-center py-4 text-xs text-slate-500">일정관리</div>
                        <div className="flex-1 bg-slate-50 border border-dashed rounded flex flex-col items-center justify-center py-4 text-xs text-slate-500">체크리스트</div>
                      </div>
                    </div>
                  </div>
                </div>
              </BrowserFrame>

              <div className="grid md:grid-cols-2 gap-6 mt-6">
                <FeatureCard title="일정 관리 (캘린더)" icon={LayoutDashboard}>
                  <p>대시보드 내 <strong>[일정관리]</strong> 버튼을 클릭하면 캘린더 화면으로 이동합니다.</p>
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>픽업/배송 예약을 월간/주간/일간 뷰로 확인합니다.</li>
                    <li>일정을 클릭하면 주문 상세 정보를 팝업으로 볼 수 있습니다.</li>
                  </ul>
                </FeatureCard>
                <FeatureCard title="체크리스트" icon={LayoutDashboard}>
                  <p>대시보드 내 <strong>[체크리스트]</strong> 버튼을 클릭하여 일일 마감 업무를 수행합니다.</p>
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>오픈/마감/주간 업무 리스트를 확인하고 완료 체크를 합니다.</li>
                    <li>미완료 항목이 있을 경우 대시보드에 알림이 표시됩니다.</li>
                  </ul>
                </FeatureCard>
              </div>
            </div>
          </section>

          <Separator />

          {/* 2. Sample Albums */}
          <section id="sample-albums" ref={el => { if (el) observerRefs.current["sample-albums"] = el; }} className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-pink-100 rounded-lg text-pink-600"><BookOpen className="h-6 w-6" /></div>
              <h2 className="text-2xl font-bold">2. 샘플 앨범</h2>
            </div>
            <p className="text-slate-600">고객 상담 시 활용할 수 있는 포트폴리오 갤러리입니다. 태그를 통해 원하는 스타일의 상품 사진을 빠르게 찾을 수 있습니다.</p>

            <div className="grid md:grid-cols-2 gap-4 my-4">
              <div className="border p-4 rounded-lg bg-white">
                <h4 className="font-bold flex items-center gap-2 mb-2"><Search className="h-4 w-4" /> 검색 및 필터링</h4>
                <p className="text-sm text-slate-600">상단 검색창에 '장미', '생일' 등의 키워드를 입력하거나, 색상/스타일 태그 버튼을 눌러 관련된 샘플만 모아볼 수 있습니다.</p>
              </div>
              <div className="border p-4 rounded-lg bg-white">
                <h4 className="font-bold flex items-center gap-2 mb-2"><UserPlus className="h-4 w-4" /> 사진 업로드 (팝업)</h4>
                <p className="text-sm text-slate-600">우측 상단 <strong>[업로드]</strong> 버튼을 누르면 팝업이 뜹니다. 사진을 드래그하여 올리고, 관련 태그(#레드 #꽃다발)를 선택하여 저장하세요.</p>
              </div>
            </div>
          </section>

          <Separator />

          {/* 3. Orders (PC) */}
          <section id="orders-new" ref={el => { if (el) observerRefs.current["orders-new"] = el; }} className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-green-100 rounded-lg text-green-600"><ShoppingCart className="h-6 w-6" /></div>
              <h2 className="text-2xl font-bold">3. 주문 접수 (PC)</h2>
            </div>
            <p className="text-slate-600">전화 또는 방문 상담 시 PC에서 상세한 주문 정보를 입력하는 화면입니다.</p>

            <StepGuide steps={[
              "주문자 정보를 입력합니다. (이름/연락처로 기존 고객 검색 가능)",
              "수령 방식(매장픽업/배송/택배)을 선택하고 일시와 주소를 입력합니다.",
              "상품을 검색하여 추가하고, 옵션(포장, 메시지 카드 등)을 설정합니다.",
              "우측의 [영수증 미리보기]를 통해 금액과 내역을 고객에게 확인시켜줍니다.",
              "저장 버튼을 눌러 주문을 생성합니다. (결제는 추후 상태 변경 가능)"
            ]} />
          </section>

          <Separator />

          {/* 4. Orders (Mobile) */}
          <section id="orders-mobile" ref={el => { if (el) observerRefs.current["orders-mobile"] = el; }} className="scroll-mt-24 space-y-6">
            <h2 className="text-2xl font-bold">4. 주문 접수 (Mobile)</h2>
            <p className="text-slate-600">아이패드 등 태블릿 환경에 최적화된 터치 기반 주문 접수 화면입니다. 고객이 직접 상품 이미지를 보며 고를 수 있도록 사진 위주의 UI로 구성되어 있습니다.</p>
          </section>

          <Separator />

          {/* 5. Order List (Detailed) */}
          <section id="orders-list" ref={el => { if (el) observerRefs.current["orders-list"] = el; }} className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-violet-100 rounded-lg text-violet-600"><ClipboardList className="h-6 w-6" /></div>
              <h2 className="text-2xl font-bold">5. 주문 현황</h2>
            </div>
            <p className="text-slate-600">모든 주문 내역을 실시간으로 확인하고 제어하는 컨트롤 타워입니다.</p>

            <BrowserFrame url="/dashboard/orders">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-[10px] h-7">이관 관리</Button>
                    <Button size="sm" variant="outline" className="text-[10px] h-7">일일 정산</Button>
                    <Button size="sm" variant="outline" className="text-[10px] h-7">엑셀 저장</Button>
                  </div>
                  <div className="flex gap-2">
                    <div className="bg-slate-100 px-3 py-1 rounded text-xs text-slate-500 border border-slate-200 w-32">검색...</div>
                  </div>
                </div>
                <div className="border rounded-lg bg-white overflow-hidden shadow-sm">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b">
                      <tr>
                        <th className="p-3">수령일시</th><th className="p-3">수령인</th><th className="p-3">상품</th><th className="p-3">상태</th><th className="p-3">작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="p-3">05/20 14:00</td>
                        <td className="p-3">홍길동<br /><span className="text-[10px] text-slate-400">010-1234-****</span></td>
                        <td className="p-3 font-medium">로즈 핑크 꽃다발</td>
                        <td className="p-3"><Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-[9px] px-1.5 py-0">제작완료</Badge></td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-6 w-6 border"><FileText className="h-3 w-3" /></Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6 border"><ExternalLink className="h-3 w-3" /></Button>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </BrowserFrame>

            <div className="grid md:grid-cols-2 gap-6">
              <FeatureCard title="상단 컨트롤 영역" icon={Settings}>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="font-bold block">[이관 관리]</span>
                    <span className="text-slate-600">지점 간 주문 넘기기(발주) 및 받은 주문(수주) 내역을 확인하고 승인합니다.</span>
                  </div>
                  <div>
                    <span className="font-bold block">[일일 정산]</span>
                    <span className="text-slate-600">오늘의 카드/현금 매출을 확인하고 마감 리포트를 작성합니다.</span>
                  </div>
                </div>
              </FeatureCard>

              <FeatureCard title="행별 액션 (작업 열)" icon={ClipboardList}>
                <div className="space-y-3 text-sm">
                  <div className="flex gap-2 items-start">
                    <Button size="icon" variant="outline" className="h-5 w-5 shrink-0"><FileText className="h-3 w-3" /></Button>
                    <span className="text-slate-600"><strong>수정:</strong> 주문서의 모든 정보(주소, 상품 등)를 변경합니다.</span>
                  </div>
                  <div className="flex gap-2 items-start">
                    <Button size="icon" variant="outline" className="h-5 w-5 shrink-0"><ExternalLink className="h-3 w-3" /></Button>
                    <span className="text-slate-600"><strong>외부발주:</strong> 타 업체로 주문을 즉시 전송합니다.</span>
                  </div>
                  <div className="flex gap-2 items-start text-red-600">
                    <X className="h-4 w-4 shrink-0 mt-0.5" />
                    <span className="text-xs">삭제는 접수 당일에만 가능하며 권한이 필요합니다.</span>
                  </div>
                </div>
              </FeatureCard>
            </div>

            <div className="bg-amber-50 p-4 rounded-lg border border-amber-100 flex gap-3 text-sm text-amber-800">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <p><strong>팁:</strong> 주문 목록의 <strong>[상태 뱃지]</strong>를 클릭하면 제작중, 제작완료 등으로 빠르게 상태를 변경할 수 있습니다.</p>
            </div>
          </section>

          <Separator />

          {/* 6. Outsource */}
          <section id="outsource" ref={el => { if (el) observerRefs.current["outsource"] = el; }} className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-orange-100 rounded-lg text-orange-600"><ExternalLink className="h-6 w-6" /></div>
              <h2 className="text-2xl font-bold">6. 외부 발주 관리</h2>
            </div>
            <p className="text-slate-600">화환, 개업 화분 등 직접 제작이 어려운 상품을 협력 업체에 발주하고 진행 상황을 관리합니다.</p>

            <div className="grid md:grid-cols-2 gap-6">
              <BrowserFrame url="/dashboard/outsource">
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between bg-blue-50 p-2 rounded border border-blue-100">
                    <div className="text-xs">
                      <div className="font-bold">대박플라워 (협력사)</div>
                      <div className="text-[10px] text-blue-600">3단 축하화환 | 05/20 12:00</div>
                    </div>
                    <Badge className="bg-green-100 text-green-700 text-[9px]">전송완료</Badge>
                  </div>
                  <div className="flex items-center justify-between bg-white p-2 rounded border border-slate-200">
                    <div className="text-xs">
                      <div className="font-bold">서초난원 (협력사)</div>
                      <div className="text-[10px] text-slate-500">동양란 | 05/20 15:00</div>
                    </div>
                    <Badge variant="outline" className="text-[9px]">수정 대기</Badge>
                  </div>
                </div>
              </BrowserFrame>

              <div className="space-y-4">
                <FeatureCard title="주요 기능" icon={Settings}>
                  <ul className="text-sm space-y-2 text-slate-600">
                    <li><strong>발주서 자동 생성:</strong> 주문 정보가 협력사 전송용 양식으로 자동 변환됩니다.</li>
                    <li><strong>전송 내역 확인:</strong> 문자로 발송된 발주서가 파트너에게 잘 전달되었는지 확인합니다.</li>
                    <li><strong>협력사 정산:</strong> 월별 협력사 발주 금액을 합계하여 정산 데이터를 생성합니다.</li>
                  </ul>
                </FeatureCard>
              </div>
            </div>
          </section>

          {/* Skip 7, 8, 9, 10, 11, 12 for brevity but include place holders to keep structure consistent if requested */}
          <Separator />
          {/* 7. Pickup/Delivery */}
          <section id="pickup-delivery" ref={el => { if (el) observerRefs.current["pickup-delivery"] = el; }} className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><Truck className="h-6 w-6" /></div>
              <h2 className="text-2xl font-bold">7. 픽업/배송 관리</h2>
            </div>
            <p className="text-slate-600">주문건별 배송 기사를 배정하고 실시간 배송 상태를 추적합니다.</p>

            <div className="grid md:grid-cols-2 gap-6">
              <BrowserFrame url="/dashboard/pickup-delivery">
                <div className="p-4 space-y-3">
                  <div className="text-xs font-bold text-slate-500 mb-2">기사 배정 대기 목록</div>
                  <div className="border rounded p-3 bg-white flex justify-between items-center">
                    <div className="text-xs">
                      <div>홍길동 | 서초구 반포동...</div>
                      <div className="text-slate-400 mt-1">수령희망: 14:00</div>
                    </div>
                    <Button size="sm" variant="outline" className="text-[10px] h-6 bg-blue-50 text-blue-600 border-blue-200">기사 배정</Button>
                  </div>
                </div>
              </BrowserFrame>
              <FeatureCard title="핵심 기능" icon={Settings}>
                <ul className="text-sm space-y-2 text-slate-600">
                  <li><strong>라이더 선택:</strong> 자체 기사 또는 연동된 퀵 업체(바로고 등)에 배차를 요청합니다.</li>
                  <li><strong>배송 현황 추적:</strong> [배송중] → [배송완료] 상태를 실시간으로 업데이트합니다.</li>
                  <li><strong>완료 사진 전송:</strong> 배송 완료 시 현장 사진을 업로드하여 고객에게 알림을 보낼 수 있습니다.</li>
                </ul>
              </FeatureCard>
            </div>
          </section>

          <Separator />

          {/* 8. Recipients */}
          <section id="recipients" ref={el => { if (el) observerRefs.current["recipients"] = el; }} className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-slate-100 rounded-lg text-slate-600"><MapPin className="h-6 w-6" /></div>
              <h2 className="text-2xl font-bold">8. 수령자 관리</h2>
            </div>
            <p className="text-slate-600">반복적으로 선물을 받는 수령처(기업, 전시장 등)의 주소록입니다. 주문 접수 시 주소 검색 시간을 단축합니다.</p>
          </section>

          <Separator />

          {/* 9. Customers */}
          <section id="customers" ref={el => { if (el) observerRefs.current["customers"] = el; }} className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-pink-100 rounded-lg text-pink-600"><Users className="h-6 w-6" /></div>
              <h2 className="text-2xl font-bold">9. 고객 관리</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <BrowserFrame url="/dashboard/customers">
                <div className="p-4 space-y-4">
                  <div className="border rounded p-4 bg-white">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">👤</div>
                      <div>
                        <div className="text-sm font-bold">이영희 고객님</div>
                        <div className="text-[10px] text-slate-500">Gold 등급 | 010-9876-****</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-50 p-2 rounded text-center">
                      <div>총 주문: <span className="font-bold">12건</span></div>
                      <div>적립금: <span className="font-bold text-blue-600">5,400P</span></div>
                    </div>
                  </div>
                </div>
              </BrowserFrame>
              <FeatureCard title="고객 사후 관리" icon={Briefcase}>
                <ul className="text-sm space-y-2 text-slate-600">
                  <li><strong>개별 주문 이력:</strong> 특정 고객의 과거 주문 스타일, 선호 꽃 종류를 파악합니다.</li>
                  <li><strong>포인트 수기 조정:</strong> 이벤트나 컴플레인 처리 시 관리자가 포인트(P)를 직접 추가/차감합니다.</li>
                  <li><strong>기념일 자동 알림:</strong> 생일, 결혼기념일 등 예약된 기념일 전 알림을 발송합니다.</li>
                </ul>
              </FeatureCard>
            </div>
          </section>

          <Separator />

          {/* 10. Partners */}
          <section id="partners" ref={el => { if (el) observerRefs.current["partners"] = el; }} className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-amber-100 rounded-lg text-amber-600"><Briefcase className="h-6 w-6" /></div>
              <h2 className="text-2xl font-bold">10. 거래처 관리</h2>
            </div>
            <p className="text-slate-600">꽃 도매 시장, 부자재 공급업체 등 매입처 정보를 관리합니다. 사업자 등록번호, 담당자 연락처 등을 기록해 두세요.</p>
          </section>

          <Separator />

          {/* 11. Quotations */}
          <section id="quotations" ref={el => { if (el) observerRefs.current["quotations"] = el; }} className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600"><FileText className="h-6 w-6" /></div>
              <h2 className="text-2xl font-bold">11. 견적서 관리</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <p className="text-sm text-slate-600">대량 주문이나 기업 행사용 견적서를 공식 양식으로 작성합니다.</p>
                <StepGuide steps={[
                  "새 견적서 작성을 누르고 고객사와 품목을 입력합니다.",
                  "[PDF 저장] 버튼으로 깔끔한 양식의 문서를 생성합니다.",
                  "연동된 메일 서버를 통해 고객에게 즉시 발송합니다."
                ]} />
              </div>
              <BrowserFrame url="/dashboard/quotations/preview">
                <div className="p-6 bg-white flex flex-col items-center">
                  <div className="w-full text-center font-bold text-lg mb-4 border-b pb-2">견 적 서 (Quotation)</div>
                  <div className="w-full space-y-2 text-[10px]">
                    <div className="flex justify-between"><span>공급자: 릴리맥 플라워</span><span>날짜: 2024-05-20</span></div>
                    <div className="h-20 border flex items-center justify-center text-slate-300">품목 리스트 영역...</div>
                    <div className="text-right font-bold">총 합계: 550,000원</div>
                  </div>
                </div>
              </BrowserFrame>
            </div>
          </section>

          <Separator />

          {/* 12. HR Requests */}
          <section id="hr-requests" ref={el => { if (el) observerRefs.current["hr-requests"] = el; }} className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-rose-100 rounded-lg text-rose-600"><UserPlus className="h-6 w-6" /></div>
              <h2 className="text-2xl font-bold">12. 인사 서류 신청</h2>
            </div>
            <p className="text-slate-600">휴가를 신청하거나 재직/소득 증명서를 요청하는 페이지입니다. 본사 승인 후 효력이 발생합니다.</p>

            <BrowserFrame url="/dashboard/hr/requests">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg">나의 신청 내역</h3>
                  <Button size="sm" className="bg-blue-600 text-white">
                    <UserPlus className="h-4 w-4 mr-2" /> 새 신청 작성
                  </Button>
                </div>
                <div className="border rounded-lg bg-white overflow-hidden">
                  <div className="bg-slate-50 p-3 border-b grid grid-cols-4 font-bold text-xs text-slate-500">
                    <div>종류</div><div>날짜</div><div>상태</div><div>작업</div>
                  </div>
                  <div className="p-3 border-b grid grid-cols-4 items-center text-sm">
                    <div>연차 휴가</div><div>2024-05-20</div><div className="text-orange-500">승인 대기</div><div className="text-slate-400 text-xs text-center border px-1 rounded">취소</div>
                  </div>
                  <div className="p-3 grid grid-cols-4 items-center text-sm">
                    <div>증명서 발급</div><div>2024-05-10</div><div className="text-green-600">발급 완료</div><div className="text-slate-400 text-xs text-center border px-1 rounded">다운로드</div>
                  </div>
                </div>
              </div>
            </BrowserFrame>

            <div className="grid md:grid-cols-2 gap-6">
              <FeatureCard title="신청하기 및 상세 기능" icon={FileText}>
                <div className="space-y-3">
                  <div>
                    <span className="font-bold block text-sm mb-1">[신청하기] 버튼</span>
                    <span className="text-sm text-slate-600">팝업이 뜨며, 휴가(연차/반차/경조사) 또는 증명서(재직/소득/경력) 종류를 선택합니다.</span>
                  </div>
                  <div>
                    <span className="font-bold block text-sm mb-1">달력 & 사유 입력</span>
                    <span className="text-sm text-slate-600">휴가 기간을 달력에서 선택하고, 사유를 상세히 적습니다.</span>
                  </div>
                  <div>
                    <span className="font-bold block text-sm mb-1">[내역 조회] 및 탭</span>
                    <span className="text-sm text-slate-600"><strong>[대기중]</strong>, <strong>[승인됨]</strong>, <strong>[반려됨]</strong> 탭을 오가며 내 요청의 상태를 실시간으로 확인합니다.</span>
                  </div>
                </div>
              </FeatureCard>
              <FeatureCard title="수정 및 취소" icon={Settings}>
                <div className="space-y-3">
                  <div>
                    <span className="font-bold block text-sm mb-1">[취소] 버튼</span>
                    <span className="text-sm text-slate-600">아직 '승인 대기' 상태인 건은 본인이 직접 취소할 수 있습니다. 이미 승인된 건은 관리자에게 문의해야 합니다.</span>
                  </div>
                  <div>
                    <span className="font-bold block text-sm mb-1">알림 수신</span>
                    <span className="text-sm text-slate-600">신청이 승인되거나 반려되면 대시보드 알림 센터로 결과를 알려줍니다.</span>
                  </div>
                </div>
              </FeatureCard>
            </div>
          </section>

          <Separator className="h-2 bg-slate-100 my-12" />
          <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 text-center">
            <h3 className="text-xl font-bold text-blue-800 mb-2">여기서부터는 역할별 상세 기능입니다</h3>
            <p className="text-blue-600">현재 <strong>{isHQ ? "본사 관리자" : "지점 사용자"}</strong> 화면에 맞춰 설명이 표시됩니다.</p>
          </div>


          {/* 13. Material Request (Shared) */}
          <section id="material-request" ref={el => { if (el) observerRefs.current["material-request"] = el; }} className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-orange-100 rounded-lg text-orange-600"><Package className="h-6 w-6" /></div>
              <h2 className="text-2xl font-bold">{isHQ ? "16. 자재 요청 (관리자 뷰)" : "자재 요청 (지점 뷰)"}</h2>
            </div>
            {isHQ ? (
              <div className="prose max-w-none text-slate-600">
                <p>각 지점에서 올라온 자재 신청 내역을 검토하고 처리하는 관리자용 페이지입니다.</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>상태 필터:</strong> [요청됨] 상태인 건을 우선 확인합니다.</li>
                  <li><strong>승인 처리:</strong> 재고를 확인 후 <strong>[승인]</strong> 버튼을 누르면 배송 준비 상태로 넘어갑니다.</li>
                  <li><strong>반려:</strong> 재고 부족 등의 사유로 반려할 수 있습니다.</li>
                </ul>
              </div>
            ) : (
              <div className="prose max-w-none text-slate-600">
                <p>매장 운영에 필요한 포장재, 부자재 등을 본사에 주문하는 페이지입니다.</p>
                <StepGuide steps={[
                  "카테고리별로 필요한 자재를 찾아 수량을 입력하고 [담기]를 누릅니다.",
                  "우측 장바구니에서 내역을 확인하고 [요청하기] 버튼을 클릭합니다.",
                  "요청 목록 탭에서 본사 승인 여부와 배송 상태를 확인할 수 있습니다."
                ]} />
              </div>
            )}
          </section>

          <Separator />

          {/* 14. Materials (Shared) */}
          <section id="materials" ref={el => { if (el) observerRefs.current["materials"] = el; }} className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-amber-100 rounded-lg text-amber-600"><Hammer className="h-6 w-6" /></div>
              <h2 className="text-2xl font-bold">{isHQ ? "14. 자재 관리 (본사)" : "자재 관리 (지점)"}</h2>
            </div>
            {isHQ ? (
              <p className="text-slate-600">전사 자재 마스터 데이터를 등록하고, 본사 물류 창고의 재고를 관리하는 페이지입니다. 입고 처리는 여기서 수행합니다.</p>
            ) : (
              <p className="text-slate-600">우리 지점에 보관 중인 자재의 현재고를 확인하고, 실사(재고조사) 결과를 입력하여 전산 재고를 맞추는 화면입니다.</p>
            )}
          </section>

          <Separator />

          {/* 15. Simple Expenses (Shared) */}
          <section id="simple-expenses" ref={el => { if (el) observerRefs.current["simple-expenses"] = el; }} className="scroll-mt-24 space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-teal-100 rounded-lg text-teal-600"><Receipt className="h-6 w-6" /></div>
              <h2 className="text-2xl font-bold">{isHQ ? "18. 간편 지출관리 (관리자)" : "간편 지출관리"}</h2>
            </div>

            <div className="prose max-w-none text-slate-600 mb-6">
              <p>매장 운영에 필요한 소액 지출(식대, 소모품비 등)을 기록하고, 매월 반복되는 고정비를 관리합니다. 4개의 탭으로 구성되어 있습니다.</p>
            </div>

            <Tabs defaultValue="input" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-4">
                <TabsTrigger value="input">1. 지출 입력</TabsTrigger>
                <TabsTrigger value="fixed">2. 고정비 관리</TabsTrigger>
                <TabsTrigger value="history">3. 지출 내역</TabsTrigger>
                <TabsTrigger value="charts">4. 차트 분석</TabsTrigger>
              </TabsList>

              {/* Tab 1: Input */}
              <TabsContent value="input" className="space-y-4">
                <h3 className="text-lg font-bold border-l-4 border-teal-500 pl-3">지출 입력 (영수증 등록)</h3>
                <p className="text-sm text-slate-600">가장 자주 사용하는 탭입니다. 지출 내역을 직접 입력하거나 영수증을 첨부하여 증빙을 남길 수 있습니다.</p>

                <BrowserFrame url="/simple-expenses/input">
                  <div className="p-6 max-w-sm mx-auto border rounded bg-white shadow-sm space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500">지출 항목명</label>
                      <div className="border p-2 rounded text-sm text-slate-400 bg-slate-50">예: 비품 구매, 택시비 등</div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500">금액 (원)</label>
                      <div className="border p-2 rounded text-sm text-right font-bold text-slate-700">0</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="border p-2 rounded text-center text-[10px] font-bold bg-teal-50 text-teal-700 border-teal-200">식대 (점심)</div>
                      <div className="border p-2 rounded text-center text-[10px] text-slate-500">소모품비</div>
                    </div>
                    <div className="border-2 border-dashed border-slate-200 rounded-lg py-4 flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:bg-slate-50">
                      <Camera className="h-5 w-5 mb-1" />
                      <span className="text-[9px]">영수증 첨부 (선택)</span>
                    </div>
                    <Button className="w-full bg-teal-600 text-sm h-9">지출 등록</Button>
                  </div>
                </BrowserFrame>

                <div className="bg-slate-50 p-4 rounded-lg text-sm space-y-2">
                  <p><strong>• 영수증 선택 사항:</strong> 영수증이 없어도 직접 금액을 입력하여 등록할 수 있습니다.</p>
                  <p><strong>• 당일 합계:</strong> 화면 상단에 <strong>오늘 지출 합계</strong>가 표시되어, 마감 시재 점검에 활용할 수 있습니다.</p>
                </div>
              </TabsContent>

              {/* Tab 2: Fixed Costs */}
              <TabsContent value="fixed" className="space-y-4">
                <h3 className="text-lg font-bold border-l-4 border-teal-500 pl-3">고정비 관리 (템플릿)</h3>
                <p className="text-sm text-slate-600">월세, 인터넷비, 정수기 렌탈료 등 매달 똑같이 나가는 비용을 '템플릿'으로 저장해두는 곳입니다.</p>

                <div className="grid md:grid-cols-2 gap-4">
                  <FeatureCard title="템플릿 등록" icon={Plus}>
                    <p>우측 상단 <strong>[새 고정비 추가]</strong>를 눌러 '항목명(예: 월세)', '금액', '결제일'을 등록합니다.</p>
                  </FeatureCard>
                  <FeatureCard title="이번 달로 가져오기" icon={Copy}>
                    <p>매월 결제일이 되면 <strong>[이번 달 지출로 복사]</strong> 버튼을 누르세요.<br />일일이 다시 입력할 필요 없이 자동으로 지출 내역에 등록됩니다.</p>
                  </FeatureCard>
                </div>
              </TabsContent>

              {/* Tab 3: History */}
              <TabsContent value="history" className="space-y-4">
                <h3 className="text-lg font-bold border-l-4 border-teal-500 pl-3">지출 내역 (조회/수정)</h3>
                <p className="text-sm text-slate-600">과거에 입력한 모든 지출 데이터를 조회합니다.</p>
                <ul className="list-disc pl-5 text-sm space-y-1 text-slate-700">
                  <li><strong>날짜 필터:</strong> 특정 월(Month)을 캘린더에서 선택하여 조회합니다.</li>
                  <li><strong>수정/삭제:</strong> 오타가 있거나 중복 입력된 건은 리스트에서 클릭하여 수정하거나 삭제할 수 있습니다.</li>
                  <li><strong>증빙 확인:</strong> 클립 아이콘📎이 있는 건은 영수증 사진이 첨부된 건입니다. 클릭하면 원본을 볼 수 있습니다.</li>
                </ul>
              </TabsContent>

              {/* Tab 4: Charts */}
              <TabsContent value="charts" className="space-y-4">
                <h3 className="text-lg font-bold border-l-4 border-teal-500 pl-3">차트 분석</h3>
                <p className="text-sm text-slate-600">지출 흐름을 시각적으로 분석합니다.</p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="border rounded p-4 bg-white text-center">
                    <div className="text-xs font-bold mb-2 text-slate-500">카테고리별 비중 (Pie Chart)</div>
                    <div className="w-32 h-32 rounded-full border-8 border-teal-100 border-t-teal-500 mx-auto flex items-center justify-center text-xs">식대 45%</div>
                  </div>
                  <div className="border rounded p-4 bg-white text-center">
                    <div className="text-xs font-bold mb-2 text-slate-500">월별 지출 추이 (Bar Chart)</div>
                    <div className="flex items-end justify-center gap-2 h-32">
                      <div className="w-8 h-20 bg-slate-200"></div>
                      <div className="w-8 h-24 bg-slate-200"></div>
                      <div className="w-8 h-32 bg-teal-500 rounded-t"></div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {isHQ && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <h4 className="font-bold text-blue-800 flex items-center gap-2 mb-2"><Building className="h-4 w-4" /> [본사 전용] 본사 관리 탭</h4>
                <p className="text-sm text-blue-700">본사 관리자는 <strong>[본사 관리]</strong> 탭이 추가로 보입니다.<br />여기서 전 지점의 지출 내역을 통합 조회하고 Excel로 다운로드하여 세무 기장 자료로 활용합니다.</p>
              </div>
            )}
          </section>

          {/* HQ ONLY SECTIONS */}
          {isHQ && (
            <>
              <Separator className="h-2 bg-slate-100 my-12" />

              {/* 13. Products */}
              <section id="products" ref={el => { if (el) observerRefs.current["products"] = el; }} className="scroll-mt-24 space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600"><Package className="h-6 w-6" /></div>
                  <h2 className="text-2xl font-bold">13. 상품 관리</h2>
                </div>
                <p className="text-slate-600">POS와 모바일 주문 앱에 노출될 전체 상품군을 관리합니다.</p>

                <BrowserFrame url="/dashboard/products">
                  <div className="p-6">
                    <div className="flex justify-between mb-4">
                      <Button size="sm" className="bg-indigo-600 text-white">신규 상품 등록</Button>
                      <div className="flex gap-2">
                        <div className="text-xs border p-1 rounded font-medium">카테고리: 전체</div>
                        <div className="text-xs border p-1 rounded font-medium">상태: 판매중</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="border rounded-lg bg-white overflow-hidden shadow-sm">
                          <div className="h-24 bg-slate-100 flex items-center justify-center text-slate-400">이미지</div>
                          <div className="p-2 text-xs">
                            <div className="font-bold">프리미엄 꽃다발 ({i})</div>
                            <div className="text-blue-600 font-bold mt-1">55,000원</div>
                            <div className="mt-2 flex justify-between items-center">
                              <Badge className="text-[9px] bg-green-100 text-green-700">판매중</Badge>
                              <Settings className="h-3 w-3 text-slate-400" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </BrowserFrame>

                <div className="grid md:grid-cols-2 gap-6">
                  <FeatureCard title="상세 옵션 설정" icon={Settings}>
                    <p className="text-sm">단순 가격뿐만 아니라 '메시지 카드 여부', '포장지 색상 선택' 등 주문 시 필수/선택 옵션을 상품별로 다르게 구성할 수 있습니다.</p>
                  </FeatureCard>
                  <FeatureCard title="일괄 품절 제어" icon={Target}>
                    <p className="text-sm">특정 꽃 자재가 소진되었을 때, 해당 자재가 들어가는 모든 상품을 한 번의 클릭으로 전체 지점에서 <strong>[판매 중지]</strong> 처리할 수 있습니다.</p>
                  </FeatureCard>
                </div>
              </section>

              <Separator />

              {/* 14. Materials & 15. Stock History */}
              <section id="materials" ref={el => { if (el) observerRefs.current["materials"] = el; }} className="scroll-mt-24 space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-amber-100 rounded-lg text-amber-600"><Hammer className="h-6 w-6" /></div>
                  <h2 className="text-2xl font-bold">14. 자재 및 재고 관리</h2>
                </div>
                <p className="text-slate-600">부자재(화분, 포장지, 리본 등)의 마스터 정보를 관리하고 본사 물류고 재고를 실시간 확인합니다.</p>

                <div className="grid md:grid-cols-2 gap-6">
                  <FeatureCard title="입고 및 출고 기록" icon={History}>
                    <p className="text-sm">자재가 새로 들어오거나(입고), 지점에 배송될 때(출고) 모든 기록을 관리합니다. <strong>[재고 변동 이력]</strong> 탭에서 원인을 추적하세요.</p>
                  </FeatureCard>
                  <FeatureCard title="지재 적정 재고 알림" icon={AlertCircle}>
                    <p className="text-sm">자재별로 '최소 유지 재고'를 설정하면, 수량이 바닥나기 전 대시보드에서 <strong>발주 경고</strong>를 띄워줍니다.</p>
                  </FeatureCard>
                </div>
              </section>

              <Separator />

              {/* 16. Purchase Management */}
              <section id="purchase" ref={el => { if (el) observerRefs.current["purchase"] = el; }} className="scroll-mt-24 space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><DollarSign className="h-6 w-6" /></div>
                  <h2 className="text-2xl font-bold">16. 구매 / 발주 관리</h2>
                </div>
                <p className="text-slate-600">본사에서 거래처에 물건을 발주(PO)하고 매입 세금계산서를 대조하는 과정입니다.</p>
                <div className="bg-slate-50 p-4 rounded-lg border text-sm space-y-2">
                  <p><strong>Step 1:</strong> [발주서 생성]을 눌러 필요한 자재와 단가를 입력합니다.</p>
                  <p><strong>Step 2:</strong> 생성된 PDF 발주서를 거래처 이메일이나 카카오톡으로 전송합니다.</p>
                  <p><strong>Step 3:</strong> 실제 물건이 도착하면 <strong>[입고 승인]</strong>을 눌러 창고 재고를 업데이트합니다.</p>
                </div>
              </section>

              <Separator />

              {/* 19. Reports */}
              <section id="reports" ref={el => { if (el) observerRefs.current["reports"] = el; }} className="scroll-mt-24 space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><BarChart3 className="h-6 w-6" /></div>
                  <h2 className="text-2xl font-bold">19. 매출 분석 리포트</h2>
                </div>

                <BrowserFrame url="/dashboard/reports">
                  <div className="p-6">
                    <div className="text-center font-bold mb-4">월간 매출 추이 (지점 통합)</div>
                    <div className="flex items-end justify-center gap-4 h-40 border-b pb-2">
                      <div className="w-10 bg-blue-200 h-24 relative group">
                        <span className="invisible group-hover:visible absolute -top-6 left-0 text-[10px] w-full text-center font-bold">3천</span>
                      </div>
                      <div className="w-10 bg-blue-400 h-32 relative group">
                        <span className="invisible group-hover:visible absolute -top-6 left-0 text-[10px] w-full text-center font-bold">4천</span>
                      </div>
                      <div className="w-10 bg-blue-600 h-40 relative group">
                        <span className="invisible group-hover:visible absolute -top-6 left-0 text-[10px] w-full text-center font-bold">5.5천</span>
                      </div>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 mt-2 px-10">
                      <span>3월</span><span>4월</span><span>5월</span>
                    </div>
                  </div>
                </BrowserFrame>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded text-center">
                    <div className="text-xs text-slate-500">인기 상품 Top 5</div>
                    <div className="text-sm font-bold mt-1">로즈 번들</div>
                  </div>
                  <div className="p-4 border rounded text-center">
                    <div className="text-xs text-slate-500">우수 지점</div>
                    <div className="text-sm font-bold mt-1">서초 본점</div>
                  </div>
                  <div className="p-4 border rounded text-center">
                    <div className="text-xs text-slate-500">재방문율</div>
                    <div className="text-sm font-bold mt-1">68.5%</div>
                  </div>
                </div>
              </section>

              <Separator />

              {/* 24. HR Management (HQ) */}
              <section id="hr-management" ref={el => { if (el) observerRefs.current["hr-management"] = el; }} className="scroll-mt-24 space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-rose-100 rounded-lg text-rose-600"><Briefcase className="h-6 w-6" /></div>
                  <h2 className="text-2xl font-bold">24. 인사/신청서 관리</h2>
                </div>
                <p className="text-slate-600">모든 직원의 기본 정보와 지점에서 올라온 인사 신청(휴가 등)을 통합 관리합니다.</p>

                <BrowserFrame url="/dashboard/hr-management">
                  <div className="p-4">
                    <div className="text-xs font-bold mb-2">승인 대기 신청 (3건)</div>
                    <div className="space-y-2">
                      {[1, 2].map(i => (
                        <div key={i} className="flex items-center justify-between p-2 border rounded bg-white">
                          <div className="text-[10px]">
                            <span className="font-bold">강남점 김철수</span> | 주말 근무 대체 휴무 신청
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" className="h-6 px-2 text-[9px] bg-blue-600 text-white font-bold">승인</Button>
                            <Button size="sm" variant="outline" className="h-6 px-2 text-[9px] font-bold">반려</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </BrowserFrame>
              </section>

              <Separator />

              {/* 25. Users & 26. Settings */}
              <section id="settings" ref={el => { if (el) observerRefs.current["settings"] = el; }} className="scroll-mt-24 space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-slate-100 rounded-lg text-slate-600"><Settings className="h-6 w-6" /></div>
                  <h2 className="text-2xl font-bold">25~26. 사용자 및 시스템 설정</h2>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <FeatureCard title="계정 관리 (Users)" icon={Users}>
                    <p className="text-sm">새로운 지점용 계정을 생성하고 권한(지점장/직원)을 부여합니다. 퇴사한 직원은 즉시 계정을 비활성화 하세요.</p>
                  </FeatureCard>
                  <FeatureCard title="데이터 백업 및 공지" icon={Settings}>
                    <p className="text-sm">시스템 데이터를 수동으로 백업하거나, 전 지점 대시보드에 노출될 <strong>긴급 공지사항</strong>을 작성합니다.</p>
                  </FeatureCard>
                </div>
              </section>
            </>
          )}

          {/* Footer */}
          <div className="mt-20 pt-8 border-t flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
            <p className="font-medium">LilyMag ERP System v4.0 User Manual</p>
            <p>Technical Support: IT Team (02-1234-5678)</p>
          </div>

        </main>
      </div>
    </div>
  );
}
