"use client";

import React from 'react';
import Image from 'next/image';
import { Quotation } from '@/types/quotation';
import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

interface PrintableQuotationProps {
    data: Quotation;
}

export class PrintableQuotation extends React.Component<PrintableQuotationProps> {
    render() {
        const { data } = this.props;
        if (!data) return null;

        const formatDate = (date: Timestamp | Date) => {
            if (!date) return "-";
            const d = date instanceof Timestamp ? date.toDate() : date;
            return format(d, "yyyy-MM-dd");
        };

        return (
            <div className="p-6 bg-white text-black font-sans max-w-[210mm] mx-auto min-h-[297mm] relative">
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div className="w-1/2">
                        <div className="relative w-[180px] h-[50px] mb-2">
                            <Image
                                src="https://ecimg.cafe24img.com/pg1472b45444056090/lilymagflower/web/upload/category/logo/v2_d13ecd48bab61a0269fab4ecbe56ce07_lZMUZ1lORo_top.jpg"
                                alt="Logo"
                                fill
                                className="object-contain object-left"
                                priority
                                unoptimized
                            />
                        </div>
                        <h1 className="text-3xl font-bold tracking-wider text-gray-800">견 적 서</h1>
                        <p className="text-xs text-gray-500 mt-1">QUOTATION</p>
                    </div>
                    <div className="w-1/2 text-right text-xs space-y-1">
                        <div className="flex justify-end gap-4">
                            <span className="font-bold w-20 text-left">견적번호</span>
                            <span className="w-28 text-left">{data.quotationNumber}</span>
                        </div>
                        <div className="flex justify-end gap-4">
                            <span className="font-bold w-20 text-left">견적일자</span>
                            <span className="w-28 text-left">{formatDate(data.createdAt)}</span>
                        </div>
                        <div className="flex justify-end gap-4">
                            <span className="font-bold w-20 text-left">유효기간</span>
                            <span className="w-28 text-left">{formatDate(data.validUntil)}</span>
                        </div>
                        <div className="flex justify-end gap-4">
                            <span className="font-bold w-20 text-left">담당자</span>
                            <span className="w-28 text-left">릴리맥</span>
                        </div>
                    </div>
                </div>

                {/* Supplier & Customer Info */}
                <div className="flex border border-black mb-6">
                    {/* Supplier (Provider) */}
                    <div className="w-1/2 border-r border-black p-3">
                        <h3 className="font-bold text-base mb-2 border-b border-gray-300 pb-1">공급자 (Provider)</h3>
                        <div className="space-y-1 text-xs">
                            <div className="flex">
                                <span className="w-16 font-bold text-gray-600">상호</span>
                                <span>{data.provider?.name || "릴리맥 (LilyMag)"}</span>
                            </div>
                            <div className="flex">
                                <span className="w-16 font-bold text-gray-600">대표자</span>
                                <span>{data.provider?.representative || "김선영"}</span>
                            </div>
                            <div className="flex">
                                <span className="w-16 font-bold text-gray-600">주소</span>
                                <span>{data.provider?.address || "서울시 영등포구 국제금융로8길 25 주택건설회관 B1"}</span>
                            </div>
                            <div className="flex">
                                <span className="w-16 font-bold text-gray-600">연락처</span>
                                <span>{data.provider?.contact || "02-782-4563"}</span>
                            </div>
                            <div className="flex">
                                <span className="w-16 font-bold text-gray-600">이메일</span>
                                <span>{data.provider?.email || "lilymagshop@naver.com"}</span>
                            </div>
                        </div>
                    </div>

                    {/* Customer (Receiver) */}
                    <div className="w-1/2 p-3">
                        <h3 className="font-bold text-base mb-2 border-b border-gray-300 pb-1">공급받는자 (Customer)</h3>
                        <div className="space-y-1 text-xs">
                            <div className="flex">
                                <span className="w-16 font-bold text-gray-600">성명/상호</span>
                                <span>{data.customer.companyName ? `${data.customer.companyName} (${data.customer.name})` : data.customer.name}</span>
                            </div>
                            <div className="flex">
                                <span className="w-16 font-bold text-gray-600">연락처</span>
                                <span>{data.customer.contact}</span>
                            </div>
                            <div className="flex">
                                <span className="w-16 font-bold text-gray-600">이메일</span>
                                <span>{data.customer.email || "-"}</span>
                            </div>
                            <div className="flex">
                                <span className="w-16 font-bold text-gray-600">주소</span>
                                <span>{data.customer.address || "-"}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Total Amount */}
                <div className="mb-6 border-b-2 border-black pb-1">
                    <div className="flex justify-between items-end">
                        <span className="font-bold text-base">견적금액 (Total Amount)</span>
                        <span className="font-bold text-xl">₩ {data.summary.totalAmount.toLocaleString()} <span className="text-xs font-normal text-gray-600">(VAT 포함)</span></span>
                    </div>
                </div>

                {/* Items Table */}
                <table className="w-full border-collapse border border-black mb-6 text-xs">
                    <thead>
                        <tr className="bg-gray-100 text-center">
                            <th className="border border-black p-1 w-[5%]">No</th>
                            <th className="border border-black p-1 w-[40%]">품목명 (Description)</th>
                            <th className="border border-black p-1 w-[10%]">규격</th>
                            <th className="border border-black p-1 w-[10%]">수량</th>
                            <th className="border border-black p-1 w-[15%]">단가</th>
                            <th className="border border-black p-1 w-[20%]">공급가액</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.items.map((item, index) => (
                            <tr key={index}>
                                <td className="border border-black p-1 text-center">{index + 1}</td>
                                <td className="border border-black p-1">
                                    <div className="font-bold">{item.name}</div>
                                    {item.description && <div className="text-[10px] text-gray-500">{item.description}</div>}
                                </td>
                                <td className="border border-black p-1 text-center">{item.unit || "EA"}</td>
                                <td className="border border-black p-1 text-center">{item.quantity}</td>
                                <td className="border border-black p-1 text-right">{item.price.toLocaleString()}</td>
                                <td className="border border-black p-1 text-right">{(item.price * item.quantity).toLocaleString()}</td>
                            </tr>
                        ))}
                        {/* Fill empty rows if needed */}
                        {Array.from({ length: Math.max(0, 10 - data.items.length) }).map((_, i) => (
                            <tr key={`empty-${i}`}>
                                <td className="border border-black p-1 text-center">&nbsp;</td>
                                <td className="border border-black p-1">&nbsp;</td>
                                <td className="border border-black p-1">&nbsp;</td>
                                <td className="border border-black p-1">&nbsp;</td>
                                <td className="border border-black p-1">&nbsp;</td>
                                <td className="border border-black p-1">&nbsp;</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colSpan={5} className="border border-black p-1 text-right font-bold bg-gray-50">소계 (Subtotal)</td>
                            <td className="border border-black p-1 text-right font-bold bg-gray-50">{data.summary.subtotal.toLocaleString()}</td>
                        </tr>
                        <tr>
                            <td colSpan={5} className="border border-black p-1 text-right font-bold bg-gray-50">할인 (Discount)</td>
                            <td className="border border-black p-1 text-right font-bold bg-gray-50 text-red-600">-{data.summary.discountAmount.toLocaleString()}</td>
                        </tr>
                        <tr>
                            <td colSpan={5} className="border border-black p-1 text-right font-bold bg-gray-50">부가세 (VAT)</td>
                            <td className="border border-black p-1 text-right font-bold bg-gray-50">{data.summary.taxAmount.toLocaleString()}</td>
                        </tr>
                        <tr>
                            <td colSpan={5} className="border border-black p-1 text-right font-bold bg-gray-100 text-base">합계 (Total)</td>
                            <td className="border border-black p-1 text-right font-bold bg-gray-100 text-base">{data.summary.totalAmount.toLocaleString()}</td>
                        </tr>
                    </tfoot>
                </table>

                {/* Terms & Notes */}
                <div className="mb-8">
                    <h4 className="font-bold border-b border-black mb-1 pb-1 text-sm">비고 및 조건 (Terms & Conditions)</h4>
                    <div className="text-xs whitespace-pre-wrap text-gray-700 min-h-[80px]">
                        {data.terms}
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center mt-auto pt-4 border-t border-gray-300">
                    <p className="text-gray-500 text-xs">Thank you for your business.</p>
                    <p className="font-bold mt-1 text-sm">Lilymag Flower & Garden</p>
                </div>
            </div>
        );
    }
}
