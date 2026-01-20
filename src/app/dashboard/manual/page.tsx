import React from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';

const ManualPage = () => {
  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <PageHeader title="사용자 매뉴얼" description="시스템의 각 기능에 대한 사용 방법을 안내합니다." />
      <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6 border-b pb-4">제 1장: 대시보드</h2>
        
        <div className="space-y-8">
          <div>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">1.1. 대시보드 개요</h3>
            <p className="text-gray-700">
              대시보드는 로그인 후 가장 먼저 보게 되는 화면으로, 시스템의 현재 상태를 한눈에 파악할 수 있는 핵심 정보를 제공합니다. 사용자님의 역할(본사 관리자 또는 가맹점 직원)에 따라 표시되는 내용이 자동으로 최적화됩니다.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">1.2. 주요 기능</h3>
            
            <div className="space-y-4 pl-4 border-l-4 border-blue-500">
              <div>
                <h4 className="font-bold text-lg text-gray-700">핵심 요약 카드</h4>
                <p className="text-gray-600 mt-1">
                  대시보드 상단에는 가장 중요한 4가지 정보가 카드로 표시됩니다.
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-600 space-y-1">
                  <li><b>년 매출:</b> 현재 연도의 누적 매출액입니다.</li>
                  <li><b>등록 고객:</b> 시스템에 등록된 고객의 수입니다.</li>
                  <li><b>주간 주문:</b> 이번 주에 발생한 총 주문 건수입니다.</li>
                  <li><b>처리 대기:</b> 아직 처리가 필요한 주문 건수입니다.</li>
                </ul>
                <p className="text-sm text-blue-700 mt-2 p-2 bg-blue-50 rounded-md">※ 본사 관리자는 전체 지점의 합산 데이터를 보거나, 특정 지점을 선택하여 해당 지점의 데이터만 볼 수 있습니다.</p>
              </div>

              <div>
                <h4 className="font-bold text-lg text-gray-700">매출 현황 차트</h4>
                <p className="text-gray-600 mt-1">
                  일별, 주간별, 월별 매출 추이를 막대 차트로 확인할 수 있습니다. 각 차트의 우측 상단에 있는 날짜 입력 필드를 통해 원하는 기간을 직접 설정하여 데이터를 조회할 수 있습니다.
                </p>
                 <p className="text-sm text-blue-700 mt-2 p-2 bg-blue-50 rounded-md">※ 본사 관리자의 차트에는 모든 지점의 매출이 각기 다른 색상으로 표시되어 지점별 성과 비교가 용이합니다.</p>
              </div>

              <div>
                <h4 className="font-bold text-lg text-gray-700">최근 주문 목록</h4>
                <p className="text-gray-600 mt-1">
                  가장 최근에 들어온 주문들의 목록을 표 형태로 보여줍니다. 주문자, 상품명, 주문일, 상태 등 핵심 정보를 빠르게 확인할 수 있으며, 각 주문의 오른쪽에 있는 <Button size="sm" variant="outline">상세보기</Button> 버튼을 클릭하면 해당 주문의 모든 상세 정보가 담긴 팝업창이 나타납니다.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-lg text-gray-700">공지사항</h4>
                <p className="text-gray-600 mt-1">
                  대시보드 상단에 위치하며, 시스템 관리자가 전달하는 중요한 공지나 업데이트 내용을 확인할 수 있습니다.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-lg text-gray-700">바로가기 메뉴</h4>
                <p className="text-gray-600 mt-1">
                  자주 사용하는 기능인 '일정관리'와 '체크리스트'로 바로 이동할 수 있는 버튼을 제공하여 작업 효율을 높여줍니다.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
      <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6 border-b pb-4">제 2장: 일정 관리</h2>
        
        <div className="space-y-8">
          <div>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">2.1. 일정 관리 개요</h3>
            <p className="text-gray-700">
              일정 관리 페이지에서는 전사 또는 지점의 모든 스케줄을 통합하여 관리할 수 있습니다. 특히, 주문과 연동된 배송/픽업 날짜가 자동으로 표시되어, 별도로 입력할 필요 없이 모든 중요 일정을 한 곳에서 확인할 수 있습니다.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">2.2. 화면 구성</h3>
            <div className="space-y-4 pl-4 border-l-4 border-green-500">
              <div>
                <h4 className="font-bold text-lg text-gray-700">캘린더 뷰</h4>
                <p className="text-gray-600 mt-1">
                  화면의 중심에는 달력이 위치합니다. 우측 상단의 버튼을 통해 <b>월(Month)</b>, <b>주(Week)</b>, <b>일(Day)</b> 단위로 보기를 변경할 수 있습니다. 화살표 버튼으로 날짜를 이동하거나 'Today' 버튼으로 오늘 날짜로 즉시 돌아올 수 있습니다.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-lg text-gray-700">표시되는 일정 종류</h4>
                <ul className="list-disc list-inside mt-2 text-gray-600 space-y-1">
                  <li><b>수동 추가 일정:</b> 사용자가 직접 추가한 일정(회의, 휴가, 메모 등)입니다.</li>
                  <li><b className="text-red-600">자동 연동 일정:</b> '주문 관리'에서 입력된 고객의 <b>배송 예약</b> 또는 <b>픽업 예약</b> 날짜가 자동으로 달력에 표시됩니다. 이를 통해 배송/픽업 스케줄을 놓치지 않고 관리할 수 있습니다.</li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">2.3. 주요 기능</h3>
            <div className="space-y-4 pl-4 border-l-4 border-green-500">
              <div>
                <h4 className="font-bold text-lg text-gray-700">새 일정 추가</h4>
                <p className="text-gray-600 mt-1">
                  화면 우측 상단의 <Button size="sm">새 일정 추가</Button> 버튼을 클릭하여 새 일정을 등록할 수 있습니다. 일정 제목, 시작 및 종료 날짜/시간, 설명 등을 입력하는 팝업창이 나타납니다.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-lg text-gray-700">일정 조회, 수정 및 삭제</h4>
                <p className="text-gray-600 mt-1">
                  달력에 표시된 일정을 클릭하면 상세 내용을 볼 수 있는 팝업창이 열립니다. 이 팝업창에서 일정 내용을 수정하거나, 필요 없는 일정을 삭제할 수 있습니다. (단, 주문과 연동된 자동 일정은 주문 관리 메뉴에서 해당 주문을 수정/삭제해야 합니다.)
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
      <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6 border-b pb-4">제 3장: 체크리스트 관리</h2>
        
        <div className="space-y-8">
          <div>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">3.1. 체크리스트 개요</h3>
            <p className="text-gray-700">
              체크리스트는 매장의 일일, 주간, 월간 업무가 표준화된 절차에 따라 누락 없이 수행되도록 돕는 기능입니다. 관리자가 설정한 '템플릿'을 기반으로 체크리스트가 생성되며, 직원들은 이를 바탕으로 업무를 수행하고 결과를 기록합니다.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">3.2. 핵심 개념: 템플릿</h3>
            <p className="text-gray-700">
              체크리스트 기능의 가장 중요한 부분은 <b className="text-red-600">템플릿</b>입니다. 매번 같은 항목을 입력할 필요 없이, 관리자가 미리 '일일 점검 템플릿', '주간 마감 템플릿' 등을 만들어두면 됩니다. 템플릿에는 각 항목의 필수 여부도 설정할 수 있습니다.
            </p>
            <p className="text-sm text-blue-700 mt-2 p-2 bg-blue-50 rounded-md">※ 템플릿은 '빠른 액션' 메뉴의 <Button size="sm" variant="outline">템플릿 편집</Button> 버튼을 통해 본사 관리자만 생성 및 수정할 수 있습니다.</p>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">3.3. 주요 기능</h3>
            <div className="space-y-4 pl-4 border-l-4 border-purple-500">
              <div>
                <h4 className="font-bold text-lg text-gray-700">체크리스트 작성</h4>
                <p className="text-gray-600 mt-1">
                  '빠른 액션' 카드에서 <Button size="sm">일일 체크리스트</Button> 등 원하는 종류의 버튼을 클릭하여 작성을 시작합니다. 템플릿에 저장된 항목들이 자동으로 나타나며, 각 항목을 수행했는지 체크하고 특이사항을 기록할 수 있습니다.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-lg text-gray-700">진행 상황 확인</h4>
                <p className="text-gray-600 mt-1">
                  메인 화면의 통계 카드에서 종류별 체크리스트의 <b>평균 완료율</b>을 확인할 수 있습니다. 또한 '최근 체크리스트' 목록에서는 각 체크리스트의 담당자, 완료율, 현재 상태(완료, 진행중, 대기)를 바로 볼 수 있어 관리가 용이합니다.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-lg text-gray-700">과거 기록 조회</h4>
                <p className="text-gray-600 mt-1">
                  '빠른 액션'의 <Button size="sm" variant="outline">히스토리 보기</Button> 버튼을 클릭하면, 지금까지 작성된 모든 체크리스트의 목록을 확인하고 검색할 수 있습니다.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
      <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6 border-b pb-4">제 4장: 주문 관리</h2>
        
        <div className="space-y-8">
          <div>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">4.1. 주문 관리 개요</h3>
            <p className="text-gray-700">
              주문 관리 페이지는 시스템의 모든 주문을 생성, 조회, 수정, 관리하는 중앙 허브입니다. 이 페이지에서 제공하는 강력한 필터링과 일괄 작업 기능을 통해 모든 주문을 효율적으로 처리할 수 있습니다.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">4.2. 주문 생성 방법</h3>
            <div className="space-y-4 pl-4 border-l-4 border-red-500">
              <div>
                <h4 className="font-bold text-lg text-gray-700">신규 주문 접수</h4>
                <p className="text-gray-600 mt-1">
                  화면 우측 상단의 <Button size="sm">주문 접수</Button> 버튼을 클릭하면, 새로운 주문을 상세하게 입력할 수 있는 별도의 페이지로 이동합니다.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-lg text-gray-700">엑셀 일괄 업로드</h4>
                <p className="text-gray-600 mt-1">
                  <Button size="sm" variant="outline">엑셀 업로드</Button> 버튼을 클릭하여, 정해진 양식의 엑셀 파일을 통해 수십, 수백 개의 주문을 한 번에 시스템에 등록할 수 있습니다. 대량 주문 처리에 매우 유용합니다.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">4.3. 주문 검색 및 필터링</h3>
            <p className="text-gray-700">
              주문 목록 상단에 위치한 필터 막대를 사용하여 원하는 주문을 쉽게 찾을 수 있습니다.
            </p>
            <ul className="list-disc list-inside mt-2 text-gray-600 space-y-1">
              <li><b>검색:</b> 주문자명 또는 주문ID의 일부를 입력하여 검색합니다.</li>
              <li><b>지점 선택:</b> (본사 관리자 전용) 특정 지점의 주문만 모아 봅니다.</li>
              <li><b>주문 상태:</b> 처리중, 완료, 취소 등 주문의 진행 상태로 필터링합니다.</li>
              <li><b>결제 상태:</b> 완결, 미결 등 결제 상태로 필터링합니다.</li>
              <li><b>날짜 범위:</b> 특정 기간 동안 접수된 주문만 조회합니다.</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">4.4. 주문 목록 및 개별 작업</h3>
            <div className="space-y-4 pl-4 border-l-4 border-red-500">
              <div>
                <h4 className="font-bold text-lg text-gray-700">상세 정보 보기</h4>
                <p className="text-gray-600 mt-1">
                  주문 목록의 특정 행을 클릭하면, 해당 주문의 모든 정보(주문자, 상품, 결제 내역 등)를 담은 상세 팝업창이 나타납니다.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-lg text-gray-700">개별 작업 메뉴</h4>
                <p className="text-gray-600 mt-1">
                  각 주문 행의 가장 오른쪽에 있는 <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button> 버튼을 클릭하면, 해당 주문에 대한 다양한 작업을 수행할 수 있는 메뉴가 나타납니다.
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-600 space-y-1">
                  <li><b>주문서/메시지 인쇄:</b> 주문서나 고객에게 보낼 메시지를 인쇄합니다.</li>
                  <li><b>주문 수정:</b> 주문 내용을 수정합니다.</li>
                  <li><b>상태 변경:</b> 주문 또는 결제 상태를 변경합니다. (예: 처리중 → 완료)</li>
                  <li><b>주문 취소:</b> 주문을 취소 처리합니다. 금액이 0원으로 변경되고, 사용된 고객 포인트가 있다면 환불됩니다.</li>
                  <li><b>주문 삭제:</b> 주문 기록을 시스템에서 완전히 삭제합니다. <b className="text-red-600">(주의: 복구 불가능)</b></li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">4.5. 일괄 작업</h3>
            <div className="space-y-4 pl-4 border-l-4 border-red-500">
              <div>
                <h4 className="font-bold text-lg text-gray-700">일괄 삭제</h4>
                <p className="text-gray-600 mt-1">
                  주문 목록의 체크박스를 사용하여 여러 주문을 선택한 뒤, 나타나는 '선택된 주문 삭제' 버튼을 클릭하여 한 번에 삭제할 수 있습니다.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-lg text-gray-700">엑셀 다운로드</h4>
                <p className="text-gray-600 mt-1">
                  화면 우측 상단의 <Button size="sm" variant="outline">엑셀 다운로드</Button> 버튼을 클릭하면, <b>현재 필터링된 주문 목록</b>이 엑셀 파일로 다운로드됩니다. 이 파일은 일괄 업로드 양식과 호환되어, 다운로드 받은 파일을 수정하여 다시 업로드하는 방식으로 편리하게 작업할 수 있습니다.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
      <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6 border-b pb-4">제 5장: 고객 관리</h2>
        
        <div className="space-y-8">
          <div>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">5.1. 고객 관리 개요</h3>
            <p className="text-gray-700">
              고객 관리 페이지에서는 시스템에 등록된 모든 고객의 정보를 체계적으로 관리할 수 있습니다. 고객 정보 조회, 등급 관리, 포인트 적립/사용 내역 확인 등 고객 관계 관리(CRM)에 필요한 모든 기능을 제공합니다.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">5.2. 주요 기능</h3>
            <div className="space-y-4 pl-4 border-l-4 border-yellow-500">
              <div>
                <h4 className="font-bold text-lg text-gray-700">신규 고객 등록</h4>
                <p className="text-gray-600 mt-1">
                  화면 우측 상단의 <Button size="sm">신규 등록</Button> 버튼을 클릭하여 새로운 고객 정보를 입력할 수 있습니다. 이름, 연락처, 주소 등 기본 정보와 함께 고객 등급, 초기 포인트를 설정할 수 있습니다.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-lg text-gray-700">고객 검색 및 필터링</h4>
                <p className="text-gray-600 mt-1">
                  고객 목록 상단의 검색창과 필터를 사용하여 특정 고객을 쉽게 찾을 수 있습니다. 고객명, 연락처, 등급, 가입일 등 다양한 조건으로 검색이 가능합니다.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-lg text-gray-700">고객 상세 정보</h4>
                <p className="text-gray-600 mt-1">
                  고객 목록에서 특정 고객을 클릭하면, 해당 고객의 상세 정보 팝업창이 나타납니다. 이 팝업창에서는 다음 정보를 확인하고 관리할 수 있습니다.
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-600 space-y-1">
                  <li><b>기본 정보 수정:</b> 고객의 연락처, 주소 등의 정보를 수정합니다.</li>
                  <li><b>주문 내역 확인:</b> 해당 고객의 과거 모든 주문 기록을 조회합니다.</li>
                  <li><b>포인트 관리:</b> 수동으로 포인트를 적립하거나 차감할 수 있으며, 포인트 변동 이력을 확인할 수 있습니다.</li>
                  <li><b>메모 작성:</b> 고객 관련 특이사항을 메모로 남겨 관리할 수 있습니다.</li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold text-lg text-gray-700">일괄 작업</h4>
                <p className="text-gray-600 mt-1">
                  고객 목록에서 여러 고객을 선택한 후, 단체 메시지(SMS)를 발송하거나 선택된 고객 목록을 엑셀 파일로 다운로드할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6 border-b pb-4">제 6장: 상품 관리</h2>
        
        <div className="space-y-8">
          <div>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">6.1. 상품 관리 개요</h3>
            <p className="text-gray-700">
              상품 관리 페이지에서는 판매하는 모든 상품과 서비스의 정보를 등록하고 관리합니다. 상품 정보, 가격, 카테고리, 재고 등을 체계적으로 관리하여 주문 및 결제 프로세스와 원활하게 연동되도록 합니다.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">6.2. 주요 기능</h3>
            <div className="space-y-4 pl-4 border-l-4 border-indigo-500">
              <div>
                <h4 className="font-bold text-lg text-gray-700">상품 등록 및 수정</h4>
                <p className="text-gray-600 mt-1">
                  <Button size="sm">상품 등록</Button> 버튼을 통해 새로운 상품을 추가합니다. 상품명, 판매 가격, 카테고리, 상품 설명, 대표 이미지 등을 입력할 수 있습니다. 기존 상품을 클릭하여 언제든지 정보를 수정할 수 있습니다.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-lg text-gray-700">카테고리 관리</h4>
                <p className="text-gray-600 mt-1">
                  상품을 종류별로 묶어주는 카테고리를 생성, 수정, 삭제할 수 있습니다. 체계적인 카테고리 관리는 상품 검색 및 통계 분석의 효율성을 높여줍니다.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-lg text-gray-700">재고 관리</h4>
                <p className="text-gray-600 mt-1">
                  상품별로 재고 수량을 입력하고 관리할 수 있습니다. 주문이 발생하면 해당 상품의 재고가 자동으로 차감되며, 설정된 안전 재고 이하로 떨어질 경우 알림을 받을 수 있습니다.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-lg text-gray-700">상품 상태 관리</h4>
                <p className="text-gray-600 mt-1">
                  각 상품의 상태를 '판매중', '품절', '숨김' 등으로 변경할 수 있습니다. '숨김' 상태의 상품은 주문 접수 시 목록에 나타나지 않지만, 데이터는 삭제되지 않습니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6 border-b pb-4">제 7장: 통계 및 분석</h2>
        
        <div className="space-y-8">
          <div>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">7.1. 통계/분석 개요</h3>
            <p className="text-gray-700">
              통계 및 분석 페이지는 축적된 데이터를 기반으로 비즈니스 현황을 다각도로 분석하고, 인사이트를 도출할 수 있도록 돕습니다. 매출, 고객, 상품에 대한 상세한 분석 리포트를 제공하여 데이터 기반의 의사결정을 지원합니다.
            </p>
            <p className="text-sm text-blue-700 mt-2 p-2 bg-blue-50 rounded-md">※ 본사 관리자는 전체 지점의 통합 데이터 또는 특정 지점의 데이터를 선택하여 분석할 수 있습니다.</p>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">7.2. 주요 분석 리포트</h3>
            <div className="space-y-4 pl-4 border-l-4 border-teal-500">
              <div>
                <h4 className="font-bold text-lg text-gray-700">매출 분석</h4>
                <p className="text-gray-600 mt-1">
                  기간별(일/주/월/년), 상품별, 카테고리별, 고객 등급별 등 다양한 기준으로 매출을 분석합니다. 시각적인 차트와 상세 데이터를 통해 어떤 상품이 언제, 누구에게 잘 팔리는지 직관적으로 파악할 수 있습니다.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-lg text-gray-700">고객 분석</h4>
                <p className="text-gray-600 mt-1">
                  신규 고객과 재방문 고객의 비율, 고객 등급별 분포, 우수 고객(VIP) 리스트 등 고객 관련 데이터를 심층적으로 분석합니다. 고객의 구매 패턴을 이해하고 타겟 마케팅 전략을 수립하는 데 활용할 수 있습니다.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-lg text-gray-700">상품 분석</h4>
                <p className="text-gray-600 mt-1">
                  가장 많이 팔린 상품(Best-seller), 매출이 높은 상품, 특정 기간에 인기 있는 상품 등을 순위별로 확인할 수 있습니다. 재고 관리 및 신상품 기획에 중요한 기초 자료로 사용됩니다.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-lg text-gray-700">보고서 다운로드</h4>
                <p className="text-gray-600 mt-1">
                  화면에 표시된 모든 통계 데이터와 차트는 PDF 또는 엑셀 파일 형태로 다운로드할 수 있어, 내부 보고 자료로 손쉽게 활용 가능합니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6 border-b pb-4">제 8장: 지점 관리 (본사 관리자 전용)</h2>
        
        <div className="space-y-8">
          <div>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">8.1. 지점 관리 개요</h3>
            <p className="text-gray-700">
              본사 관리자 계정으로 로그인했을 때만 나타나는 메뉴입니다. 이 페이지에서는 프랜차이즈의 모든 지점 정보를 등록하고 관리하며, 각 지점의 운영 현황을 모니터링할 수 있습니다.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">8.2. 주요 기능</h3>
            <div className="space-y-4 pl-4 border-l-4 border-gray-500">
              <div>
                <h4 className="font-bold text-lg text-gray-700">신규 지점 등록</h4>
                <p className="text-gray-600 mt-1">
                  <Button size="sm">신규 지점 등록</Button> 버튼을 클릭하여 새로운 가맹점 정보를 시스템에 추가합니다. 지점명, 사업자 정보, 주소, 연락처, 담당자 정보 등을 입력합니다.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-lg text-gray-700">지점 정보 수정 및 관리</h4>
                <p className="text-gray-600 mt-1">
                  등록된 지점 목록에서 특정 지점을 선택하여 정보를 수정하거나, 계약 만료 등의 이유로 지점 계정을 비활성화할 수 있습니다.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-lg text-gray-700">지점별 직원 계정 관리</h4>
                <p className="text-gray-600 mt-1">
                  각 지점에 속한 직원 계정을 생성하고 관리합니다. 지점별로 직원을 추가하고, 각 직원의 시스템 접근 권한을 설정할 수 있습니다.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-lg text-gray-700">지점별 성과 조회</h4>
                <p className="text-gray-600 mt-1">
                  각 지점의 매출, 주문 건수, 고객 수 등 핵심 성과 지표(KPI)를 비교 분석할 수 있는 리포트를 제공합니다. 이를 통해 우수 지점을 파악하고 부진한 지점에 대한 지원 전략을 수립할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6 border-b pb-4">제 9장: 설정</h2>
        
        <div className="space-y-8">
          <div>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">9.1. 설정 개요</h3>
            <p className="text-gray-700">
              설정 페이지에서는 사용자의 개인 정보 관리부터 시스템 전반의 운영 방식을 제어하는 다양한 옵션을 관리할 수 있습니다. 메뉴는 사용자의 권한에 따라 다르게 표시됩니다.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">9.2. 주요 기능</h3>
            <div className="space-y-4 pl-4 border-l-4 border-pink-500">
              <div>
                <h4 className="font-bold text-lg text-gray-700">내 정보 수정</h4>
                <p className="text-gray-600 mt-1">
                  모든 사용자는 자신의 프로필 정보(이름, 연락처)를 수정하고 비밀번호를 변경할 수 있습니다. 보안을 위해 주기적인 비밀번호 변경을 권장합니다.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-lg text-gray-700">직원 계정 관리 (관리자 전용)</h4>
                <p className="text-gray-600 mt-1">
                  본사 또는 지점 관리자는 소속 직원의 계정을 생성, 수정, 비활성화할 수 있습니다. 각 직원에게 필요한 메뉴 접근 권한(역할)을 부여하여 체계적인 권한 관리가 가능합니다.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-lg text-gray-700">고객 등급 및 포인트 정책 (본사 관리자 전용)</h4>
                <p className="text-gray-600 mt-1">
                  고객 등급의 명칭(예: VIP, GOLD)과 등급별 혜택(예: 구매 시 추가 할인율, 포인트 적립률)을 설정할 수 있습니다. 이는 고객 관계 관리(CRM) 전략의 핵심 요소로 활용됩니다.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-lg text-gray-700">알림 설정</h4>
                <p className="text-gray-600 mt-1">
                  재고 부족, 신규 주문 접수 등 특정 이벤트가 발생했을 때 시스템 알림 또는 이메일 알림을 받을지 여부를 설정할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6 border-b pb-4">제 10장: 기타</h2>
        
        <div className="space-y-8">
          <div>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">10.1. 로그아웃</h3>
            <p className="text-gray-700">
              화면 좌측 하단 또는 우측 상단 프로필 메뉴에 있는 '로그아웃' 버튼을 클릭하여 시스템에서 안전하게 로그아웃할 수 있습니다. 공용 컴퓨터에서 사용 시, 업무 종료 후에는 반드시 로그아웃하여 주시기 바랍니다.
            </p>
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">10.2. 문의하기</h3>
            <p className="text-gray-700">
              시스템 사용 중 궁금한 점이나 기술적인 문제가 발생했을 경우, 주저하지 마시고 시스템 개발팀에 문의해주시기 바랍니다.
            </p>
          </div>
        </div>
      </div>
      <div className="mt-12 text-center text-gray-500">
        <p>이상으로 사용자 매뉴얼을 마칩니다. 본 매뉴얼이 원활한 시스템 사용에 도움이 되기를 바랍니다.</p>
        <p>최종 업데이트: 2025년 8월 23일</p>
      </div>
    </div>
  );
};

export default ManualPage;
