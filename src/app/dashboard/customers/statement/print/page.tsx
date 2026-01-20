"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Printer, ArrowLeft, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCustomers } from "@/hooks/use-customers";
import { useOrders } from "@/hooks/use-orders";
import { useBranches } from "@/hooks/use-branches";
import { Customer } from "@/hooks/use-customers";
import { Order } from "@/hooks/use-orders";
import { Branch } from "@/hooks/use-branches";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface StatementData {
  customer: Customer;
  branch: Branch | null;
  period: {
    startDate: Date;
    endDate: Date;
  };
  orders: Order[];
  summary: {
    totalOrders: number;
    totalAmount: number;
    totalDeliveryFee: number;
    grandTotal: number;
  };
}

export default function StatementPrintPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { customers, loading: customersLoading } = useCustomers();
  const { orders, loading: ordersLoading } = useOrders();
  const { branches, loading: branchesLoading } = useBranches();
  const [statementData, setStatementData] = useState<StatementData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 데이터가 아직 로딩 중이면 대기
    if (customersLoading || ordersLoading || branchesLoading) {
      return;
    }

    const customerId = searchParams.get('customerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!customerId || !startDate || !endDate) {
      alert('필수 파라미터가 누락되었습니다.');
      router.back();
      return;
    }

    const customer = customers.find(c => c.id === customerId);
    if (!customer) {
      alert('고객 정보를 찾을 수 없습니다.');
      router.back();
      return;
    }

    // 고객의 담당지점 정보 찾기
    const branch = branches.find(b => b.name === customer.branch);
    const start = new Date(startDate);
    const end = new Date(endDate);

    // 고객의 주문 내역 필터링 - 연락처로 매칭
    const customerOrders = orders.filter(order => {
      let orderDate: Date;
      const orderDateValue = order.orderDate as any;
      
      // Firebase Timestamp 객체인 경우
      if (orderDateValue && typeof orderDateValue.toDate === 'function') {
        orderDate = orderDateValue.toDate();
      } 
      // Timestamp 객체의 seconds/nanoseconds 구조인 경우
      else if (orderDateValue && typeof orderDateValue.seconds === 'number') {
        orderDate = new Date(orderDateValue.seconds * 1000);
      }
      // 일반 Date 객체나 문자열인 경우
      else {
        orderDate = new Date(orderDateValue);
      }
      
      return order.orderer.contact === customer.contact && 
             orderDate >= start && 
             orderDate <= end;
    });

    const summary = {
      totalOrders: customerOrders.length,
      totalAmount: customerOrders.reduce((sum, order) => sum + (order.summary.total || 0), 0),
      totalDeliveryFee: customerOrders.reduce((sum, order) => sum + (order.summary.deliveryFee || 0), 0),
      grandTotal: customerOrders.reduce((sum, order) => sum + (order.summary.total || 0), 0)
    };

    setStatementData({
      customer,
      branch,
      period: { startDate: start, endDate: end },
      orders: customerOrders,
      summary
    });
    setLoading(false);
  }, [searchParams, customers, orders, branches, router, customersLoading, ordersLoading, branchesLoading]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    // PDF 다운로드 기능 (새 창에서 깔끔한 거래명세서만 표시하고 인쇄 후 자동으로 닫기)
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>거래명세서</title>
            <style>
              @page {
                size: A4;
                margin: 15mm;
              }
              body {
                margin: 0;
                padding: 0;
                background: white;
                font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
                font-size: 12px;
                line-height: 1.4;
                color: black;
              }
              .print-content {
                background: white;
                color: black;
                margin: 0;
                padding: 20px;
                font-size: 12px;
                line-height: 1.4;
              }
              .print-content table {
                width: 100%;
                border-collapse: collapse;
                margin: 0;
                padding: 0;
              }
              .print-content td, 
              .print-content th {
                border: 1px solid black;
                padding: 6px 8px;
                font-size: 11px;
                text-align: left;
                vertical-align: top;
              }
              .print-content th {
                background-color: #f5f5f5;
                font-weight: bold;
              }
              .print-title {
                font-size: 28px;
                font-weight: bold;
                text-align: center;
                margin: 20px 0;
                letter-spacing: 8px;
              }
              .print-header {
                margin-bottom: 20px;
              }
              .print-transaction {
                margin-bottom: 20px;
              }
              .print-total {
                background-color: #f5f5f5;
                font-weight: bold;
              }
            </style>
            <script>
              // 인쇄 후 창 자동으로 닫기
              window.addEventListener('afterprint', function() {
                window.close();
              });
              
              // 페이지 로드 완료 후 자동으로 인쇄 대화상자 열기
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                }, 100);
              };
            </script>
          </head>
          <body>
            ${document.querySelector('.print-content')?.outerHTML || ''}
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  if (loading || customersLoading || ordersLoading || branchesLoading) {
    return <div className="flex justify-center items-center h-64">로딩 중...</div>;
  }

  if (!statementData) {
    return <div className="flex justify-center items-center h-64">데이터를 불러올 수 없습니다.</div>;
  }

  return (
    <>
      {/* 인쇄용 CSS 스타일 */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 15mm;
          }
          
          body {
            margin: 0;
            padding: 0;
            background: white;
            font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: black;
          }
          
          .no-print {
            display: none !important;
          }
          
          .print-content {
            display: block !important;
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            font-size: 12px !important;
            line-height: 1.4 !important;
          }
          
          .print-content table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          .print-content td, 
          .print-content th {
            border: 1px solid black !important;
            padding: 6px 8px !important;
            font-size: 11px !important;
            text-align: left !important;
            vertical-align: top !important;
          }
          
          .print-content th {
            background-color: #f5f5f5 !important;
            font-weight: bold !important;
          }
          
          .print-title {
            font-size: 28px !important;
            font-weight: bold !important;
            text-align: center !important;
            margin: 20px 0 !important;
            letter-spacing: 8px !important;
          }
          
          .print-header {
            margin-bottom: 20px !important;
          }
          
          .print-transaction {
            margin-bottom: 20px !important;
          }
          
          .print-total {
            background-color: #f5f5f5 !important;
            font-weight: bold !important;
          }
        }
        
        @media screen {
          .print-content {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: white;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
            font-size: 12px;
            line-height: 1.4;
          }
          
          .print-content table {
            width: 100%;
            border-collapse: collapse;
            margin: 0;
            padding: 0;
          }
          
          .print-content td, 
          .print-content th {
            border: 1px solid black;
            padding: 6px 8px;
            font-size: 11px;
            text-align: left;
            vertical-align: top;
          }
          
          .print-content th {
            background-color: #f5f5f5;
            font-weight: bold;
          }
          
          .print-title {
            font-size: 28px;
            font-weight: bold;
            text-align: center;
            margin: 20px 0;
            letter-spacing: 8px;
          }
          
          .print-header {
            margin-bottom: 20px;
          }
          
          .print-transaction {
            margin-bottom: 20px;
          }
          
          .print-total {
            background-color: #f5f5f5;
            font-weight: bold;
          }
        }
      `}</style>

      {/* 인쇄 버튼 영역 */}
      <div className="no-print max-w-4xl mx-auto mb-4">
        <PageHeader
          title="거래명세서"
          description={`${statementData.customer.name} 고객의 거래명세서`}
        >
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              뒤로가기
            </Button>
            <Button variant="outline" onClick={handleDownloadPDF}>
              <Download className="mr-2 h-4 w-4" />
              인쇄/PDF저장
            </Button>
          </div>
        </PageHeader>
      </div>

      {/* 인쇄 영역 */}
      <div className="print-content">
        {/* 제목 */}
        <div className="print-title">
          거래명세서
        </div>

        {/* 헤더 정보 */}
        <div className="print-header">
          <table>
            <tbody>
              <tr>
                <td style={{ width: '50%', backgroundColor: '#f5f5f5', fontSize: '14px', fontWeight: 'bold' }}>
                  공급받는자
                </td>
                <td style={{ width: '50%', backgroundColor: '#f5f5f5', fontSize: '14px', fontWeight: 'bold' }}>
                  공급자
                </td>
              </tr>
              <tr>
                <td style={{ verticalAlign: 'top' }}>
                  <div style={{ marginBottom: '4px' }}>
                    <strong>성명:</strong> {statementData.customer.name}
                  </div>
                  {statementData.customer.companyName && (
                    <div style={{ marginBottom: '4px' }}>
                      <strong>회사명:</strong> {statementData.customer.companyName}
                    </div>
                  )}
                  <div style={{ marginBottom: '4px' }}>
                    <strong>연락처:</strong> {statementData.customer.contact}
                  </div>
                  <div style={{ marginBottom: '4px' }}>
                    <strong>담당지점:</strong> {statementData.customer.branch}
                  </div>
                </td>
                <td style={{ verticalAlign: 'top' }}>
                  <div style={{ marginBottom: '4px' }}>
                    <strong>상호:</strong> {statementData.branch?.name || '릴리맥'}
                  </div>
                  <div style={{ marginBottom: '4px' }}>
                    <strong>사업자등록번호:</strong> {statementData.branch?.businessNumber || '123-45-67890'}
                  </div>
                  <div style={{ marginBottom: '4px' }}>
                    <strong>주소:</strong> {statementData.branch?.address || '서울특별시 강남구'}
                  </div>
                  <div style={{ marginBottom: '4px' }}>
                    <strong>연락처:</strong> {statementData.branch?.phone || '02-1234-5678'}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* 거래기간 */}
          <table style={{ marginTop: '20px' }}>
            <tbody>
              <tr>
                <td style={{ width: '120px', backgroundColor: '#f5f5f5', fontSize: '14px', fontWeight: 'bold' }}>
                  거래기간
                </td>
                <td>
                  {format(statementData.period.startDate, "yyyy년 MM월 dd일", { locale: ko })} ~ 
                  {format(statementData.period.endDate, "yyyy년 MM월 dd일", { locale: ko })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 거래 내역 테이블 */}
        <div className="print-transaction">
          <table>
            <thead>
              <tr>
                <th style={{ width: '17%' }}>
                  거래일자
                </th>
                <th style={{ width: '50%' }}>
                  품목
                </th>
                <th style={{ width: '7%', textAlign: 'right' }}>
                  수량
                </th>
                <th style={{ width: '13%', textAlign: 'right' }}>
                  단가
                </th>
                <th style={{ width: '13%', textAlign: 'right' }}>
                  금액
                </th>
              </tr>
            </thead>
            <tbody>
              {statementData.orders.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', fontSize: '12px', color: '#6b7280', padding: '20px' }}>
                    해당 기간에 거래 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                statementData.orders.map((order, orderIndex) => {
                  // 주문의 각 상품을 개별 행으로 표시
                  return order.items.map((item, itemIndex) => (
                    <tr key={`${order.id}-${itemIndex}`}>
                      <td>
                        {(() => {
                          const orderDateValue = order.orderDate as any;
                          let orderDate: Date;
                          
                          if (orderDateValue && typeof orderDateValue.toDate === 'function') {
                            orderDate = orderDateValue.toDate();
                          } else if (orderDateValue && typeof orderDateValue.seconds === 'number') {
                            orderDate = new Date(orderDateValue.seconds * 1000);
                          } else {
                            orderDate = new Date(orderDateValue);
                          }
                          
                          return format(orderDate, "yyyy-MM-dd", { locale: ko });
                        })()}
                      </td>
                      <td>
                        {item.name}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {item.quantity}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {item.price.toLocaleString()}원
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {(item.price * item.quantity).toLocaleString()}원
                      </td>
                    </tr>
                  ));
                })
              )}
            </tbody>
            <tfoot>
              <tr className="print-total">
                <td colSpan={4} style={{ textAlign: 'right' }}>
                  합계
                </td>
                <td style={{ textAlign: 'right' }}>
                  {statementData.summary.grandTotal.toLocaleString()}원
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* 작성일 */}
        <div style={{ marginTop: '30px', textAlign: 'right', fontSize: '12px' }}>
          작성일: {format(new Date(), "yyyy년 MM월 dd일", { locale: ko })}
        </div>
      </div>
    </>
  );
} 
