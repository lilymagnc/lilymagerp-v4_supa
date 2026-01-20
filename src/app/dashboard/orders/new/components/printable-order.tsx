
"use client";
import React from 'react';
import Image from 'next/image';
export interface OrderPrintData {
    orderDate: string;
    ordererName: string;
    ordererContact: string;
    items: string;
    totalAmount: number;
    deliveryFee: number;
    paymentMethod: string;
    paymentStatus: '미결' | '완결' | string;
    deliveryDate: string;
    recipientName: string;
    recipientContact: string;
    deliveryAddress: string;
    message: string;
    messageType: 'card' | 'ribbon'; // 메시지 타입 추가
    isAnonymous: boolean;
    branchInfo: {
        name: string;
        address: string;
        contact: string;
        account: string;
    };
    transferInfo?: {
        originalBranchName: string;
        processBranchName: string;
    };
    outsourceInfo?: {
        partnerName: string;
        partnerPrice: number;
    };
}
interface PrintableOrderProps {
    data: OrderPrintData | null;
}
const paymentMethodMap = {
    card: "카드",
    cash: "현금",
    transfer: "계좌이체",
    mainpay: "메인페이",
    shopping_mall: "쇼핑몰",
    epay: "이페이"
};
// Use a class component to ensure compatibility with react-to-print's ref handling.
export class PrintableOrder extends React.Component<PrintableOrderProps> {
    render() {
        const { data } = this.props;
        if (!data) return null;
        const Checkbox = ({ checked }: { checked: boolean }) => (
            <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '1px solid black', marginRight: '4px', position: 'relative', verticalAlign: 'middle' }}>
                {checked && <span style={{ position: 'absolute', top: '-3px', left: '2px', fontSize: '14px' }}>✔</span>}
            </span>
        );
        const paymentMethodText = paymentMethodMap[data.paymentMethod as keyof typeof paymentMethodMap] || data.paymentMethod;
        const renderSection = (title: string, isReceipt: boolean) => (
            <div className="mb-4">
                <div className="text-center mb-4">
                    {!isReceipt && (
                        <>
                            <div className="mx-auto" style={{ width: '150px', height: '60px', position: 'relative' }}>
                                <Image
                                    src="https://ecimg.cafe24img.com/pg1472b45444056090/lilymagflower/web/upload/category/logo/v2_d13ecd48bab61a0269fab4ecbe56ce07_lZMUZ1lORo_top.jpg"
                                    alt="Logo"
                                    fill
                                    className="object-contain"
                                    priority
                                    unoptimized
                                />
                            </div>
                            <h1 className="text-2xl font-bold mt-2">
                                릴리맥 플라워앤가든 {title}
                                {data.outsourceInfo && (
                                    <span className="text-sm font-normal ml-2">
                                        ({data.outsourceInfo.partnerName})
                                    </span>
                                )}
                                {data.transferInfo && (
                                    <span className="text-sm font-normal ml-2">
                                        (주문이관 : {data.transferInfo.originalBranchName} -&gt; {data.transferInfo.processBranchName})
                                    </span>
                                )}
                            </h1>
                        </>
                    )}
                    {isReceipt && (
                        <>
                            <div className="mx-auto" style={{ width: '100px', height: '40px', position: 'relative' }}>
                                <Image
                                    src="https://ecimg.cafe24img.com/pg1472b45444056090/lilymagflower/web/upload/category/logo/v2_d13ecd48bab61a0269fab4ecbe56ce07_lZMUZ1lORo_top.jpg"
                                    alt="Logo"
                                    fill
                                    className="object-contain"
                                    priority
                                    unoptimized
                                />
                            </div>
                            <h1 className="text-2xl font-bold mt-2">{title}</h1>
                        </>
                    )}
                </div>
                <table className="w-full border-collapse border border-black text-sm">
                    <tbody>
                        <tr>
                            <td className="border border-black p-1 font-bold w-[15%] text-center">주문일</td>
                            <td className="border border-black p-1 w-[25%]">{data.orderDate}</td>
                            <td className="border border-black p-1 font-bold w-[10%] text-center">주문자</td>
                            <td className="border border-black p-1 w-[15%]">{data.isAnonymous && isReceipt ? '익명' : data.ordererName}</td>
                            <td className="border border-black p-1 font-bold w-[10%] text-center">연락처</td>
                            <td className="border border-black p-1 w-[25%]">{data.isAnonymous && isReceipt ? '-' : data.ordererContact}</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-1 font-bold align-top h-12 text-center">항목/수량</td>
                            <td className="border border-black p-1 align-top whitespace-pre-wrap" colSpan={5}>{data.items}</td>
                        </tr>
                        {!isReceipt && (
                            <>
                                <tr>
                                    <td className="border border-black p-1 font-bold text-center">결제정보</td>
                                    <td className="border border-black p-1" colSpan={5}>
                                        <div className="flex items-center justify-between">
                                            <span>금액: ₩{data.totalAmount.toLocaleString()}</span>
                                            <span>배송비: ₩{data.deliveryFee.toLocaleString()}</span>
                                            <div className="flex items-center gap-2">
                                                <span>결제수단: {paymentMethodText}</span>
                                                <div className="flex items-center gap-2 pr-2">
                                                    <div className="flex items-center"><Checkbox checked={data.paymentStatus === '미결'} /><span>미결</span></div>
                                                    <div className="flex items-center"><Checkbox checked={data.paymentStatus === '완결'} /><span>완결</span></div>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            </>
                        )}
                        <tr>
                            <td className="border border-black p-1 font-bold text-center">배송일/시간</td>
                            <td className="border border-black p-1">{data.deliveryDate}</td>
                            <td className="border border-black p-1 font-bold text-center">받는 분</td>
                            <td className="border border-black p-1">{data.recipientName}</td>
                            <td className="border border-black p-1 font-bold text-center">연락처</td>
                            <td className="border border-black p-1">{data.recipientContact}</td>
                        </tr>
                        <tr>
                            <td className={`border border-black p-1 font-bold align-top ${isReceipt ? 'h-20' : 'h-16'} text-center`}>배송지주소</td>
                            <td colSpan={5} className="border border-black p-1 align-top">{data.deliveryAddress}</td>
                        </tr>
                        {!isReceipt && (
                            <tr>
                                <td className="border border-black p-1 font-bold align-top h-16 text-center">
                                    전달메세지<br />
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="flex items-center"><Checkbox checked={data.messageType === 'card'} /><span>카드</span></div>
                                        <div className="flex items-center"><Checkbox checked={data.messageType === 'ribbon'} /><span>리본</span></div>
                                    </div>
                                </td>
                                <td colSpan={5} className="border border-black p-1 align-top">
                                    {data.message}
                                </td>
                            </tr>
                        )}
                        {isReceipt && (
                            <tr>
                                <td className="border border-black p-1 font-bold text-center">인수자성명</td>
                                <td colSpan={5} className="border border-black p-1 h-16"></td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        );
        return (
            <div className="p-4 bg-white text-black font-sans px-[10mm]">
                {renderSection('주문서', false)}
                <div className="border-t-2 border-dashed border-gray-400 my-8"></div>
                {renderSection('인수증', true)}
                <div className="mt-8">
                    <table className="w-full border-collapse border-black text-xs">
                        <tbody>
                            <tr>
                                <td className="border border-black p-1 font-bold w-[20%]">릴리맥여의도점</td>
                                <td className="border border-black p-1 w-[30%]">010-8241-9518</td>
                                <td className="border border-black p-1 font-bold w-[20%]">릴리맥여의도2호점</td>
                                <td className="border border-black p-1 w-[30%]">010-7939-9518</td>
                            </tr>
                            <tr>
                                <td className="border border-black p-1 font-bold">릴리맥NC이스트폴점</td>
                                <td className="border border-black p-1">010-2908-5459</td>
                                <td className="border border-black p-1 font-bold">릴리맥광화문점</td>
                                <td className="border border-black p-1">010-2385-9518</td>
                            </tr>
                            <tr>
                                <td className="border border-black p-1 font-bold">[온라인쇼핑몰]</td>
                                <td className="border border-black p-1" colSpan={3}>www.lilymagshop.co.kr</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }
}
