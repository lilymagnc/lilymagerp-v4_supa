
"use client";
import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  addDoc, 
  serverTimestamp, 
  query, 
  where,
  deleteDoc, 
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from './use-toast';
import { EmployeeFormValues } from '@/app/dashboard/hr/components/employee-form';
export interface Employee extends EmployeeFormValues {
  id: string;
  createdAt: Timestamp;
}
export function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const employeesCollection = collection(db, 'employees');
      const q = query(employeesCollection);
      const employeesData = (await getDocs(q)).docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          hireDate: data.hireDate?.toDate ? data.hireDate.toDate() : data.hireDate,
          birthDate: data.birthDate?.toDate ? data.birthDate.toDate() : data.birthDate,
          createdAt: data.createdAt,
        } as Employee;
      });
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
      const employeeWithTimestamp = {
        ...data,
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'employees'), employeeWithTimestamp);
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
      const employeeDocRef = doc(db, 'employees', id);
      await setDoc(employeeDocRef, data, { merge: true });
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
      await deleteDoc(doc(db, 'employees', id));
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
    let newCount = 0;
    let updateCount = 0;
    let errorCount = 0;
    await Promise.all(data.map(async (row) => {
      try {
        if (!row.email || !row.name) return;
        const employeeData = {
          email: String(row.email),
          name: String(row.name),
          position: String(row.position || '직원'),
          department: String(row.department || '미지정'),
          contact: String(row.contact || ''),
          hireDate: row.hireDate ? new Date(row.hireDate) : new Date(),
          birthDate: row.birthDate ? new Date(row.birthDate) : new Date(),
          address: String(row.address || ''),
        };
        const q = query(collection(db, "employees"), where("email", "==", employeeData.email));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const docRef = querySnapshot.docs[0].ref;
          await setDoc(docRef, employeeData, { merge: true });
          updateCount++;
        } else {
          await addDoc(collection(db, "employees"), { ...employeeData, createdAt: serverTimestamp() });
          newCount++;
        }
      } catch (error) {
        console.error("Error processing row:", row, error);
        errorCount++;
      }
    }));
    setLoading(false);
    if (errorCount > 0) {
      toast({ 
        variant: 'destructive', 
        title: '일부 처리 오류', 
        description: `${errorCount}개 항목 처리 중 오류가 발생했습니다.` 
      });
    }
    toast({ 
      title: '처리 완료', 
      description: `성공: 신규 직원 ${newCount}명 추가, ${updateCount}명 업데이트 완료.`
    });
    await fetchEmployees();
  };
  return { 
    employees, 
    loading, 
    addEmployee, 
    updateEmployee, 
    deleteEmployee, 
    bulkAddEmployees 
  };
}
