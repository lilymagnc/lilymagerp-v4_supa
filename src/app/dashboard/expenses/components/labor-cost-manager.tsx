"use client";

import React, { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/types/simple-expense';
import { useLaborCosts, EmployeeFinancial, SalaryStatement } from '@/hooks/use-labor-costs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileDown, Calendar as CalendarIcon, Save, Printer, Edit, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// 4대보험/세금 자동계산 헬퍼 함수
export function calculateDeductions(
    type: string,
    grossPay: number,
    mealAllowance: number,
    incomeTaxInput: number = 0
) {
    if (type === '프리랜서') {
        const bizTax = Math.floor(grossPay * 0.03);
        const localBizTax = Math.floor(bizTax * 0.1);
        const freelancerTax = bizTax + localBizTax;
        return {
            national_pension: 0,
            health_insurance: 0,
            long_term_care: 0,
            employment_insurance: 0,
            income_tax: 0,
            local_income_tax: 0,
            freelancer_tax: freelancerTax,
            total_deductions: freelancerTax
        };
    } else {
        // 과세 소득 = 총 지급액 - 비과세식대
        const taxablePay = Math.max(0, grossPay - mealAllowance);

        // 국민연금 (4.5%, 상한액 생략)
        const np = Math.floor(taxablePay * 0.045);
        // 건보료 (3.545%)
        const hi = Math.floor(taxablePay * 0.03545);
        // 장기요양 (건보료의 12.95%)
        const ltc = Math.floor(hi * 0.1295);
        // 고용보험 (0.9%)
        const ei = Math.floor(taxablePay * 0.009);
        // 소득세 & 지방소득세
        const it = incomeTaxInput || 0;
        const lit = Math.floor(it * 0.1);

        // 4대보험 합계 및 총 공제
        const totalDeductions = np + hi + ltc + ei + it + lit;

        return {
            national_pension: np,
            health_insurance: hi,
            long_term_care: ltc,
            employment_insurance: ei,
            income_tax: it,
            local_income_tax: lit,
            freelancer_tax: 0,
            total_deductions: totalDeductions
        };
    }
}

export function LaborCostManager() {
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    const { employees, financials, statements, loading, saveFinancial, saveStatement, refresh } = useLaborCosts(selectedMonth);

    const [selectedEmp, setSelectedEmp] = useState<any>(null);
    const [isFinDialogOpen, setIsFinDialogOpen] = useState(false);
    const [isStatementDialogOpen, setIsStatementDialogOpen] = useState(false);

    // === 금융/계약 폼 상태 ===
    const [finForm, setFinForm] = useState<EmployeeFinancial>({
        id: '', employee_id: '', employment_type: '정규직', salary_type: '월급', base_salary: 0, bank_name: '', account_number: ''
    });

    // === 급여 명세 폼 상태 ===
    // Note: custom_allowance... is mapped into an object.
    const [stmtForm, setStmtForm] = useState<Partial<SalaryStatement>>({});

    const handleOpenFin = (emp: any) => {
        setSelectedEmp(emp);
        const existing = financials[emp.id];
        if (existing) {
            setFinForm({ ...existing });
        } else {
            setFinForm({
                employee_id: emp.id,
                employment_type: '정규직',
                salary_type: '월급',
                base_salary: 0,
                bank_name: '',
                account_number: ''
            });
        }
        setIsFinDialogOpen(true);
    };

    const handleSaveFin = async () => {
        await saveFinancial({ ...finForm, employee_id: selectedEmp.id });
        setIsFinDialogOpen(false);
    };

    const handleOpenStmt = (emp: any) => {
        if (!financials[emp.id]) {
            alert("직원 계약/계좌 정보(계약탭)를 먼저 등록해주세요.");
            return;
        }
        const fin = financials[emp.id];
        setSelectedEmp(emp);

        const existing = statements[emp.id];
        if (existing) {
            setStmtForm({ ...existing });
        } else {
            // Initialize based on financial DB
            const bp = fin.base_salary || 0;
            const initStmt: Partial<SalaryStatement> = {
                employee_id: emp.id,
                branch_name: emp.department || '미지정',
                payment_year_month: selectedMonth,
                employment_type: fin.employment_type,
                status: 'draft',

                base_pay: bp,
                overtime_pay: 0,
                meal_allowance: fin.employment_type === '정규직' ? 200000 : 0, // 기본 식대 20비과세
                custom_allowance_name: '',
                custom_allowance: 0,

                income_tax: 0, // manual input
            };

            const newGross = bp + initStmt.meal_allowance!;
            initStmt.gross_pay = newGross;

            const calc = calculateDeductions(fin.employment_type, newGross, initStmt.meal_allowance!, 0);
            setStmtForm({ ...initStmt, ...calc, net_pay: newGross - calc.total_deductions });
        }
        setIsStatementDialogOpen(true);
    };

    const handleStmtChange = (field: keyof SalaryStatement, val: any) => {
        setStmtForm(prev => {
            const next = { ...prev, [field]: val };

            // Auto trigger gross/net calculation if money related fields changed
            const bp = Number(next.base_pay || 0);
            const op = Number(next.overtime_pay || 0);
            const ma = Number(next.meal_allowance || 0);
            const ca = Number(next.custom_allowance || 0);

            const gross = bp + op + ma + ca;
            next.gross_pay = gross;

            // recalculate taxes depending on employment_type
            const empType = next.employment_type || '정규직';
            if (empType === '프리랜서') {
                const calc = calculateDeductions('프리랜서', gross, 0, 0);
                Object.assign(next, calc);
            } else {
                const manualIt = Number(next.income_tax || 0);
                const calc = calculateDeductions('정규직', gross, ma, manualIt);
                Object.assign(next, calc);
            }

            next.net_pay = next.gross_pay! - next.total_deductions!;

            return next as Partial<SalaryStatement>;
        });
    };

    const handleSaveStmt = async (status: string) => {
        const finalData = { ...stmtForm, status } as SalaryStatement;
        await saveStatement(finalData);
        setIsStatementDialogOpen(false);
    };

    const printRef = useRef<HTMLDivElement>(null);
    const handlePrint = (emp: any) => {
        // Print logic - standard window.print implementation
        const existing = statements[emp.id];
        if (!existing) return;

        const printContent = document.getElementById(`payslip-print-${emp.id}`);
        if (printContent) {
            const originalContents = document.body.innerHTML;
            document.body.innerHTML = printContent.innerHTML;
            window.print();
            document.body.innerHTML = originalContents;
            window.location.reload(); // restore react app state completely
        }
    };

    return (
        <div className="space-y-4">
            {/* Top Filter Selection */}
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    인건비 및 급여 관리
                </h2>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium mr-2">귀속 연월:</span>
                    <div className="flex items-center border rounded-md">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                const [y, m] = selectedMonth.split('-');
                                let d = new Date(Number(y), Number(m) - 2);
                                setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                            }}
                        >-</Button>
                        <span className="px-4 font-bold">{selectedMonth}</span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                const [y, m] = selectedMonth.split('-');
                                let d = new Date(Number(y), Number(m));
                                setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                            }}
                        >+</Button>
                    </div>
                    <Button variant="outline" size="icon" onClick={() => refresh()}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead>이름</TableHead>
                                <TableHead>소속/직위</TableHead>
                                <TableHead>고용 형태</TableHead>
                                <TableHead>계좌 정보</TableHead>
                                <TableHead>급여/정산 (이번달)</TableHead>
                                <TableHead>지급 상태</TableHead>
                                <TableHead className="text-right">작업</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={7} className="text-center py-4">로딩 중...</TableCell></TableRow>
                            ) : (
                                employees.map(emp => {
                                    const fin = financials[emp.id];
                                    const stmt = statements[emp.id];
                                    return (
                                        <TableRow key={emp.id}>
                                            <TableCell className="font-medium">{emp.name}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{emp.department} / {emp.position}</TableCell>
                                            <TableCell>
                                                {fin ? (
                                                    <Badge variant={fin.employment_type === '정규직' ? 'default' : (fin.employment_type === '프리랜서' ? 'secondary' : 'outline')}>
                                                        {fin.employment_type} ({fin.salary_type})
                                                    </Badge>
                                                ) : <span className="text-xs text-muted-foreground">미등록</span>}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {fin?.bank_name ? `${fin.bank_name} (${fin.account_number})` : '-'}
                                            </TableCell>
                                            <TableCell>
                                                {stmt ? (
                                                    <div className="flex flex-col gap-1">
                                                        <div className="font-bold text-sm">실수령액: {formatCurrency(stmt.net_pay || 0)}</div>
                                                        <div className="text-xs text-muted-foreground">공제액: {formatCurrency(stmt.total_deductions || 0)}</div>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-red-500 font-medium">이번 달 계산 안 됨</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {stmt?.status === 'confirmed' ? (
                                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">확정 (회계반영됨)</Badge>
                                                ) : stmt?.status === 'draft' ? (
                                                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">임시저장</Badge>
                                                ) : '-'}
                                            </TableCell>
                                            <TableCell className="text-right flex gap-2 justify-end">
                                                <Button variant="outline" size="sm" onClick={() => handleOpenFin(emp)} className="text-xs">
                                                    계약/설정
                                                </Button>
                                                <Button variant="default" size="sm" onClick={() => handleOpenStmt(emp)} className="text-xs">
                                                    정산 및 명세서
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* 1. 계약 및 금융 정보 모달 */}
            <Dialog open={isFinDialogOpen} onOpenChange={setIsFinDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{selectedEmp?.name} - 계약 및 자동계산 설정</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>고용 형태</Label>
                            <Select value={finForm.employment_type} onValueChange={v => setFinForm({ ...finForm, employment_type: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="정규직">정규직 (4대보험 가입자)</SelectItem>
                                    <SelectItem value="프리랜서">프리랜서 (3.3% 원천징수)</SelectItem>
                                    <SelectItem value="아르바이트">아르바이트 (시급 및 4대보험)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>급여 산정 기준</Label>
                            <Select value={finForm.salary_type} onValueChange={v => setFinForm({ ...finForm, salary_type: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="월급">월급제 (고정기본급)</SelectItem>
                                    <SelectItem value="시급">시급제</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>기준 급여/시급 (기본급)</Label>
                            <Input type="number" value={finForm.base_salary} onChange={e => setFinForm({ ...finForm, base_salary: Number(e.target.value) })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>주거래 은행</Label>
                                <Input placeholder="예: 신한은행" value={finForm.bank_name} onChange={e => setFinForm({ ...finForm, bank_name: e.target.value })} />
                            </div>
                            <div className="grid gap-2">
                                <Label>계좌 번호</Label>
                                <Input placeholder="하이픈(-) 포함" value={finForm.account_number} onChange={e => setFinForm({ ...finForm, account_number: e.target.value })} />
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsFinDialogOpen(false)}>취소</Button>
                        <Button onClick={handleSaveFin}><Save className="mr-2 h-4 w-4" />설정 저장</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* 2. 월 급여 정산 및 명세서 모달 */}
            <Dialog open={isStatementDialogOpen} onOpenChange={setIsStatementDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            <div className="flex justify-between items-center pr-10">
                                <span>{selectedEmp?.name} - {selectedMonth} 급여/용역비 정산</span>
                                <Badge variant={stmtForm?.status === 'confirmed' ? "default" : "outline"}>
                                    {stmtForm?.status === 'confirmed' ? '장부 확정됨' : '초안 (작성중)'}
                                </Badge>
                            </div>
                        </DialogTitle>
                    </DialogHeader>

                    {stmtForm && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">

                            {/* 좌측: 직접 입력 폼 (근태 / 수당 / 직접 계산 값) */}
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-sm font-bold bg-slate-100 p-2 rounded mb-3 flex items-center justify-between">
                                        1. 지급 항목 (세전)
                                    </h3>

                                    {/* 프리랜서는 간략화된 폼 표시 */}
                                    {stmtForm.employment_type === '프리랜서' ? (
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center">
                                                <Label className="text-xs">용역 대금 (세전 총액)</Label>
                                                <Input type="number" className="w-[150px] text-right"
                                                    value={stmtForm.base_pay || 0}
                                                    onChange={e => handleStmtChange('base_pay', e.target.value)} />
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-2 border-t pt-2">
                                                프리랜서는 기본 대금 입력 시, 자동으로 총액에서 3.3%를 제하고 실수령액이 계산됩니다.
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center">
                                                <Label className="text-xs">기본급</Label>
                                                <Input type="number" className="w-[150px] text-right"
                                                    value={stmtForm.base_pay || 0}
                                                    onChange={e => handleStmtChange('base_pay', e.target.value)} />
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <Label className="text-xs">연장 휴일 수당</Label>
                                                <Input type="number" className="w-[150px] text-right"
                                                    value={stmtForm.overtime_pay || 0}
                                                    onChange={e => handleStmtChange('overtime_pay', e.target.value)} />
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <Label className="text-xs">식대 (비과세 한도 20만)</Label>
                                                <Input type="number" className="w-[150px] text-right"
                                                    value={stmtForm.meal_allowance || 0}
                                                    onChange={e => handleStmtChange('meal_allowance', e.target.value)} />
                                            </div>
                                            <div className="flex items-center gap-2 w-full mt-2 border-t pt-2">
                                                <Input className="flex-1 text-xs" placeholder="기타 수당 이름"
                                                    value={stmtForm.custom_allowance_name || ''}
                                                    onChange={e => handleStmtChange('custom_allowance_name', e.target.value)} />
                                                <Input type="number" className="w-[150px] text-right" placeholder="금액"
                                                    value={stmtForm.custom_allowance || 0}
                                                    onChange={e => handleStmtChange('custom_allowance', e.target.value)} />
                                            </div>

                                            <div className="bg-blue-50/50 p-2 rounded mt-2 border border-blue-100 flex justify-between items-center font-bold">
                                                <span className="text-sm">지급 총액 (과세대상: {formatCurrency(stmtForm.gross_pay! - stmtForm.meal_allowance!)})</span>
                                                <span className="text-blue-700">{formatCurrency(stmtForm.gross_pay || 0)}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <h3 className="text-sm font-bold bg-slate-100 p-2 rounded mb-3 flex items-center justify-between">
                                        2. 공제 항목 (세금 및 4대보험)
                                        <span className="font-normal text-xs text-muted-foreground mr-1">자동 계산됨</span>
                                    </h3>

                                    {stmtForm.employment_type === '프리랜서' ? (
                                        <div className="space-y-2 text-sm text-muted-foreground">
                                            <div className="flex justify-between border-b pb-1">
                                                <span>사업소득세 (3%)</span>
                                                <span>{formatCurrency(stmtForm.freelancer_tax! - Math.floor(stmtForm.freelancer_tax! / 1.1) * 0.1 || 0)}</span>
                                            </div>
                                            <div className="flex justify-between border-b pb-1">
                                                <span>지방소득세 (0.3%)</span>
                                                <span>{formatCurrency(Math.floor(stmtForm.freelancer_tax! / 11) || 0)}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-2 text-sm text-muted-foreground">
                                            <div className="flex justify-between border-b pb-1">
                                                <span>국민연금 (4.5%)</span>
                                                <span>{formatCurrency(stmtForm.national_pension || 0)}</span>
                                            </div>
                                            <div className="flex justify-between border-b pb-1">
                                                <span>건강보험 (3.545%)</span>
                                                <span>{formatCurrency(stmtForm.health_insurance || 0)}</span>
                                            </div>
                                            <div className="flex justify-between border-b pb-1">
                                                <span>장기요양보험</span>
                                                <span>{formatCurrency(stmtForm.long_term_care || 0)}</span>
                                            </div>
                                            <div className="flex justify-between border-b pb-1">
                                                <span>고용보험 (0.9%)</span>
                                                <span>{formatCurrency(stmtForm.employment_insurance || 0)}</span>
                                            </div>
                                            <div className="flex justify-between items-center pt-2">
                                                <span className="font-bold text-black border-l-2 border-slate-300 pl-2">근로소득세 수동입력</span>
                                                <Input type="number" className="w-[100px] text-right font-bold h-7 mx-2"
                                                    value={stmtForm.income_tax || 0}
                                                    onChange={e => handleStmtChange('income_tax', e.target.value)} />
                                            </div>
                                            <div className="flex justify-between border-b pb-1 ml-3 text-xs">
                                                <span>지방소득세 (소득세 10% 자동)</span>
                                                <span>{formatCurrency(stmtForm.local_income_tax || 0)}</span>
                                            </div>
                                        </div>
                                    )}
                                    <div className="bg-red-50/50 p-2 rounded mt-3 border border-red-100 flex justify-between items-center font-bold">
                                        <span className="text-sm">공제 총액</span>
                                        <span className="text-red-600">- {formatCurrency(stmtForm.total_deductions || 0)}</span>
                                    </div>
                                </div>

                            </div>

                            {/* 우측: 실제 명세서 렌더링 뷰 (Preview & Print Template) */}
                            <div className="bg-slate-100 p-4 rounded-xl flex flex-col justify-between">

                                <div id={`payslip-print-${selectedEmp?.id}`} className="bg-white border rounded-lg p-6 shadow-sm flex-1 print:p-0 print:border-none print:shadow-none min-h-[400px]">
                                    <h2 className="text-2xl font-black text-center mb-6 tracking-wide border-b-2 border-black pb-4">
                                        급 여 명 세 서
                                    </h2>

                                    <div className="flex justify-between mb-4 text-sm font-medium">
                                        <span className="text-gray-600">성명: <span className="text-black ml-1 text-base">{selectedEmp?.name}</span></span>
                                        <span className="text-gray-600">귀속: <span className="text-black ml-1 tracking-wider">{stmtForm.payment_year_month?.replace('-', '년 ')}월</span></span>
                                        <span className="text-gray-600">지점: <span className="text-black ml-1 text-base">{stmtForm.branch_name}</span></span>
                                    </div>

                                    <table className="w-full text-xs border-collapse border border-gray-300 mb-6">
                                        <thead>
                                            <tr className="bg-gray-100">
                                                <th className="border border-gray-300 p-2 text-center w-1/2 text-sm" colSpan={2}>지급 내역</th>
                                                <th className="border border-gray-300 p-2 text-center w-1/2 text-sm" colSpan={2}>공제 내역</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {stmtForm.employment_type === '프리랜서' ? (
                                                <>
                                                    <tr>
                                                        <td className="border border-gray-300 px-2 py-1.5 font-medium text-gray-700">도급/용역 대금</td>
                                                        <td className="border border-gray-300 px-2 py-1.5 text-right font-bold">{formatCurrency(stmtForm.base_pay || 0)}</td>
                                                        <td className="border border-gray-300 px-2 py-1.5 font-medium text-gray-700">사업소득세(3%)</td>
                                                        <td className="border border-gray-300 px-2 py-1.5 text-right font-medium text-red-600">{formatCurrency(stmtForm.freelancer_tax! - Math.floor(stmtForm.freelancer_tax! / 1.1) * 0.1 || 0)}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="border border-gray-300 px-2 py-1.5 border-b-0 h-[80px]"></td>
                                                        <td className="border border-gray-300 px-2 py-1.5 border-b-0 text-right"></td>
                                                        <td className="border border-gray-300 px-2 py-1.5 font-medium text-gray-700">지방소득세(0.3%)</td>
                                                        <td className="border border-gray-300 px-2 py-1.5 text-right font-medium text-red-600">{formatCurrency(Math.floor(stmtForm.freelancer_tax! / 11) || 0)}</td>
                                                    </tr>
                                                </>
                                            ) : (
                                                <>
                                                    <tr className="bg-white">
                                                        <td className="border border-gray-300 px-2 py-1.5 font-medium text-gray-700">기본급</td>
                                                        <td className="border border-gray-300 px-2 py-1.5 text-right font-bold">{formatCurrency(stmtForm.base_pay || 0)}</td>

                                                        <td className="border border-gray-300 px-2 py-1.5 font-medium text-gray-700">국민연금</td>
                                                        <td className="border border-gray-300 px-2 py-1.5 text-right text-red-600">{formatCurrency(stmtForm.national_pension || 0)}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="border border-gray-300 px-2 py-1.5 font-medium text-gray-700">연장/휴일 수당</td>
                                                        <td className="border border-gray-300 px-2 py-1.5 text-right font-medium">{formatCurrency(stmtForm.overtime_pay || 0)}</td>

                                                        <td className="border border-gray-300 px-2 py-1.5 font-medium text-gray-700">건강보험</td>
                                                        <td className="border border-gray-300 px-2 py-1.5 text-right text-red-600">{formatCurrency(stmtForm.health_insurance || 0)}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="border border-gray-300 px-2 py-1.5 font-medium text-gray-700">식대 (비과세)</td>
                                                        <td className="border border-gray-300 px-2 py-1.5 text-right font-medium text-blue-600">{formatCurrency(stmtForm.meal_allowance || 0)}</td>

                                                        <td className="border border-gray-300 px-2 py-1.5 font-medium text-gray-700">장기/고용보험</td>
                                                        <td className="border border-gray-300 px-2 py-1.5 text-right text-red-600">{formatCurrency((stmtForm.long_term_care || 0) + (stmtForm.employment_insurance || 0))}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="border border-gray-300 px-2 py-1.5 font-medium text-gray-700 text-[10px] break-all max-w-[80px]">기타: {stmtForm.custom_allowance_name}</td>
                                                        <td className="border border-gray-300 px-2 py-1.5 text-right font-medium text-blue-600">{formatCurrency(stmtForm.custom_allowance || 0)}</td>

                                                        <td className="border border-gray-300 px-2 py-1.5 font-medium text-gray-700">소득세/지방세</td>
                                                        <td className="border border-gray-300 px-2 py-1.5 text-right text-red-600">{formatCurrency((stmtForm.income_tax || 0) + (stmtForm.local_income_tax || 0))}</td>
                                                    </tr>
                                                </>
                                            )}

                                            {/* 합계행 */}
                                            <tr className="bg-gray-50 font-bold border-t-2 border-black">
                                                <td className="border border-gray-300 px-2 py-2 text-center text-sm" colSpan={1}>지급총액</td>
                                                <td className="border border-gray-300 px-2 py-2 text-right text-sm text-blue-700">{formatCurrency(stmtForm.gross_pay || 0)}</td>
                                                <td className="border border-gray-300 px-2 py-2 text-center text-sm" colSpan={1}>공제총액</td>
                                                <td className="border border-gray-300 px-2 py-2 text-right text-sm text-red-600">{formatCurrency(stmtForm.total_deductions || 0)}</td>
                                            </tr>
                                        </tbody>
                                    </table>

                                    <div className="bg-slate-800 text-white rounded p-4 flex justify-between items-center shadow-inner">
                                        <span className="text-lg font-bold">차인지급액 (실수령액)</span>
                                        <span className="text-2xl font-black">{formatCurrency(stmtForm.net_pay || 0)} <span className="text-sm font-normal">원</span></span>
                                    </div>

                                    <div className="mt-8 text-center text-xs text-gray-500">
                                        위와 같이 임금(용역비)을 확인 및 정산합니다.<br /><br />
                                        {new Date().toISOString().split('T')[0].split('-').join('. ')}<br /><br />
                                        <strong>(주)릴리맥</strong>
                                    </div>
                                </div>

                                {/* 컨트롤 버튼 */}
                                <div className="flex justify-end gap-2 mt-4 no-print">
                                    <Button variant="outline" onClick={() => handleSaveStmt('draft')}>
                                        임시 저장
                                    </Button>
                                    {stmtForm.status === 'confirmed' ? (
                                        <Button variant="default" className="bg-blue-600 hover:bg-blue-700" onClick={() => handlePrint(selectedEmp)}>
                                            <Printer className="mr-2 h-4 w-4" /> 명세서 인쇄 (PDF 저장)
                                        </Button>
                                    ) : (
                                        <Button variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => handleSaveStmt('confirmed')}>
                                            <Save className="mr-2 h-4 w-4" /> 회계 장부 반영 (최종 확정)
                                        </Button>
                                    )}
                                </div>

                            </div>
                        </div>
                    )}

                </DialogContent>
            </Dialog>
        </div>
    );
}
