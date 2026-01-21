"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from './use-toast';
import { EmployeeFormValues } from '@/app/dashboard/hr/components/employee-form';

export interface Employee extends EmployeeFormValues {
  id: string;
  createdAt: string;
}

export function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const mapRowToEmployee = (row: any): Employee => ({
    id: row.id,
    name: row.name,
    email: row.email,
    position: row.position,
    department: row.department,
    contact: row.contact,
    address: row.address,
    hireDate: row.hire_date ? new Date(row.hire_date) : undefined,
    birthDate: row.birth_date ? new Date(row.birth_date) : undefined,
    createdAt: row.created_at
  });

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('employees').select('*');
      if (error) throw error;

      const employeesData = (data || []).map(mapRowToEmployee);
      setEmployees(employeesData.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error("Error fetching employees: ", error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: '직원 정보를 불러오는 중 오류가 발생했습니다.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const addEmployee = async (data: EmployeeFormValues) => {
    setLoading(true);
    try {
      const id = crypto.randomUUID();
      const payload = {
        id,
        name: data.name,
        email: data.email,
        position: data.position,
        department: data.department,
        contact: data.contact,
        address: data.address,
        hire_date: data.hireDate ? new Date(data.hireDate).toISOString() : null,
        birth_date: data.birthDate ? new Date(data.birthDate).toISOString() : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase.from('employees').insert([payload]);
      if (error) throw error;

      toast({ title: "성공", description: "새 직원이 추가되었습니다." });
      await fetchEmployees();
    } catch (error) {
      console.error("Error adding employee:", error);
      toast({ variant: 'destructive', title: '오류', description: '직원 추가 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const updateEmployee = async (id: string, data: EmployeeFormValues) => {
    setLoading(true);
    try {
      const payload = {
        name: data.name,
        email: data.email,
        position: data.position,
        department: data.department,
        contact: data.contact,
        address: data.address,
        hire_date: data.hireDate ? new Date(data.hireDate).toISOString() : null,
        birth_date: data.birthDate ? new Date(data.birthDate).toISOString() : null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase.from('employees').update(payload).eq('id', id);
      if (error) throw error;

      toast({ title: "성공", description: "직원 정보가 수정되었습니다." });
      await fetchEmployees();
    } catch (error) {
      console.error("Error updating employee:", error);
      toast({ variant: 'destructive', title: '오류', description: '직원 정보 수정 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const deleteEmployee = async (id: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.from('employees').delete().eq('id', id);
      if (error) throw error;

      toast({ title: "성공", description: "직원 정보가 삭제되었습니다." });
      await fetchEmployees();
    } catch (error) {
      console.error("Error deleting employee:", error);
      toast({ variant: 'destructive', title: '오류', description: '직원 삭제 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const bulkAddEmployees = async (data: any[]) => {
    setLoading(true);
    try {
      const payloads = data.filter(row => row.email && row.name).map(row => ({
        id: crypto.randomUUID(),
        email: String(row.email),
        name: String(row.name),
        position: String(row.position || '직원'),
        department: String(row.department || '미지정'),
        contact: String(row.contact || ''),
        hire_date: row.hireDate ? new Date(row.hireDate).toISOString() : new Date().toISOString(),
        birth_date: row.birthDate ? new Date(row.birthDate).toISOString() : new Date().toISOString(),
        address: String(row.address || ''),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      // Supabase supports upsert, but the original logic was selective.
      // For simplicity, we'll do an insert/upsert for all.
      const { error } = await supabase.from('employees').upsert(payloads, { onConflict: 'email' });
      if (error) throw error;

      toast({ title: '처리 완료', description: `성공: 직원 정보가 업데이트/추가되었습니다.` });
      await fetchEmployees();
    } catch (error) {
      console.error("Error bulk adding employees:", error);
      toast({ variant: 'destructive', title: '오류', description: '직원 대량 추가 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  return {
    employees, loading, addEmployee, updateEmployee, deleteEmployee, bulkAddEmployees
  };
}
