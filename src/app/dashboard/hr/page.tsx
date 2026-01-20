
"use client";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { PlusCircle, FileUp, Search } from "lucide-react";
import { ImportButton } from "@/components/import-button";
import { EmployeeTable } from "./components/employee-table";
import { EmployeeForm, EmployeeFormValues } from "./components/employee-form";
import { useEmployees, Employee } from "@/hooks/use-employees";
import { useBranches } from "@/hooks/use-branches";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { POSITION_OPTIONS } from "@/lib/constants";
export default function HrPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const { employees, loading, addEmployee, updateEmployee, deleteEmployee, bulkAddEmployees } = useEmployees();
  const { branches } = useBranches();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedPosition, setSelectedPosition] = useState("all");
  const filteredEmployees = useMemo(() => {
    return employees
      .filter(emp => (selectedBranch === "all" || emp.department === selectedBranch))
      .filter(emp => String(emp.name ?? '').toLowerCase().includes(searchTerm.toLowerCase()) || String(emp.email ?? '').toLowerCase().includes(searchTerm.toLowerCase()));
  }, [employees, searchTerm, selectedBranch]);
  const handleAdd = () => {
    setSelectedEmployee(null);
    setIsFormOpen(true);
  };
  const handleEdit = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsFormOpen(true);
  };
  const handleFormSubmit = async (data: EmployeeFormValues) => {
    if (selectedEmployee?.id) {
      await updateEmployee(selectedEmployee.id, data);
    } else {
      await addEmployee(data);
    }
    setIsFormOpen(false);
    setSelectedEmployee(null);
  };
  const handleDelete = async (id: string) => {
    await deleteEmployee(id);
  };
  const handleImport = async (data: any[]) => {
    await bulkAddEmployees(data);
  };
  return (
    <div>
      <PageHeader
        title="인사 관리"
        description="직원 정보를 등록하고 관리하세요."
      >
        <div className="flex items-center gap-2">
          <ImportButton resourceName="직원" onImport={handleImport}>
            <FileUp className="mr-2 h-4 w-4" />
            엑셀로 가져오기
          </ImportButton>
          <Button onClick={handleAdd}>
            <PlusCircle className="mr-2 h-4 w-4" />
            직원 추가
          </Button>
        </div>
      </PageHeader>
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <div className="relative w-full sm:w-auto flex-1 sm:flex-initial">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="이름, 이메일 검색..."
                className="w-full rounded-lg bg-background pl-8"
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="소속 지점" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 지점</SelectItem>
                {branches.map(branch => (
                  <SelectItem key={branch.id} value={branch.name}>{branch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

          </div>
        </CardContent>
      </Card>
      {loading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmployeeTable 
          employees={filteredEmployees}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
      <EmployeeForm 
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleFormSubmit}
        employee={selectedEmployee}
      />
    </div>
  );
}
