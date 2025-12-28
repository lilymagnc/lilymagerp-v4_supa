
"use client";
import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, writeBatch, query, orderBy, limit, setDoc, where, deleteDoc, getDoc, serverTimestamp, runTransaction, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { supabase } from '@/lib/supabase'; // 추가
import { useToast } from './use-toast';
import type { ProductFormValues } from '@/app/dashboard/products/components/product-form';
export interface Product {
  id: string;
  docId: string;
  name: string;
  mainCategory: string;
  midCategory: string;
  price: number;
  supplier: string;
  stock: number;
  size: string;
  color: string;
  branch: string;
  code?: string;
  category?: string;
  status: string; // required로 변경
}
// 초기 샘플 데이터 추가
const initialProducts: Omit<Product, 'docId' | 'status'>[] = [
  { id: "P90001", name: "샘플상품지우지마세요", mainCategory: "의류", midCategory: "상의", price: 45000, supplier: "공급업체1", stock: 10, size: "M", color: "White", branch: "릴리맥광화문점" },
];
export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const getStatus = (stock: number): string => {
    if (stock === 0) return 'out_of_stock';
    if (stock < 10) return 'low_stock';
    return 'active';
  }
  // 샘플 상품 ID 업데이트 함수
  const updateSampleProductId = async () => {
    try {
      const sampleQuery = query(
        collection(db, 'products'),
        where('name', '==', '샘플상품지우지마세요'),
        where('id', '==', 'P00001')
      );
      const sampleSnapshot = await getDocs(sampleQuery);

      if (!sampleSnapshot.empty) {
        const sampleDoc = sampleSnapshot.docs[0];
        await setDoc(sampleDoc.ref, { id: 'P90001' }, { merge: true });
      }
    } catch (error) {
      console.error('샘플 상품 ID 업데이트 오류:', error);
    }
  };

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);

      // [Supabase 우선 조회]
      const { data: supabaseItems, error: supabaseError } = await supabase
        .from('products')
        .select('*')
        .order('id', { ascending: true });

      if (!supabaseError && supabaseItems && supabaseItems.length > 0) {
        const mappedData = supabaseItems.map(item => ({
          docId: item.id,
          id: item.code || '',
          name: item.name,
          mainCategory: item.main_category,
          midCategory: item.mid_category,
          price: item.price,
          supplier: item.supplier,
          stock: item.stock,
          size: item.size,
          color: item.color,
          branch: item.branch,
          code: item.code,
          category: (item as any).category,
          status: getStatus(item.stock)
        } as Product)).sort((a, b) => (a.id && b.id) ? a.id.localeCompare(b.id) : 0);

        setProducts(mappedData);
        setLoading(false);
        return;
      }

      // 샘플 상품 ID 업데이트 (한 번만 실행)
      await updateSampleProductId();

      const productsCollection = collection(db, 'products');
      const querySnapshot = await getDocs(productsCollection);
      // 자재관리와 동일한 초기화 로직 추가
      if (querySnapshot.size <= 1) {
        const initDocRef = doc(productsCollection, '_initialized');
        const initDoc = await getDoc(initDocRef);
        if (!initDoc.exists()) {
          const batch = writeBatch(db);
          initialProducts.forEach((productData) => {
            const newDocRef = doc(productsCollection);
            batch.set(newDocRef, productData);
          });
          batch.set(initDocRef, { seeded: true });
          await batch.commit();
          const seededSnapshot = await getDocs(productsCollection);
          const productsData = seededSnapshot.docs
            .filter(doc => doc.id !== '_initialized')
            .map((doc) => {
              const data = doc.data();
              return {
                docId: doc.id,
                name: data.name || '',
                code: data.code || '',
                price: data.price || 0,
                ...data,
                status: getStatus(data.stock)
              } as Product;
            }).sort((a, b) => (a.id && b.id) ? a.id.localeCompare(b.id) : 0);
          setProducts(productsData);
          return;
        }
      }
      const productsData = querySnapshot.docs
        .filter(doc => doc.id !== '_initialized')
        .map((doc) => {
          const data = doc.data();
          return {
            docId: doc.id,
            name: data.name || '',
            code: data.code || '',
            price: data.price || 0,
            ...data,
            status: getStatus(data.stock)
          } as Product;
        }).sort((a, b) => (a.id && b.id) ? a.id.localeCompare(b.id) : 0);
      setProducts(productsData);
    } catch (error) {
      console.error("Error fetching products: ", error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: '상품 정보를 불러오는 중 오류가 발생했습니다.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);
  // 새로운 ID 생성 함수 추가
  const generateNewId = async () => {
    const q = query(collection(db, "products"), orderBy("id", "desc"), limit(1));
    const querySnapshot = await getDocs(q);
    let lastIdNumber = 0;
    if (!querySnapshot.empty) {
      const lastId = querySnapshot.docs[0].data().id;
      if (lastId && lastId.startsWith('P')) {
        lastIdNumber = parseInt(lastId.replace('P', ''), 10);
      }
    }
    return `P${String(lastIdNumber + 1).padStart(5, '0')}`;
  }
  const addProduct = async (data: ProductFormValues) => {
    setLoading(true);
    try {
      // 같은 이름의 상품이 있는지 확인 (지점 무관)
      const existingProductQuery = query(
        collection(db, "products"),
        where("name", "==", data.name)
      );
      const existingProductSnapshot = await getDocs(existingProductQuery);
      let productId: string;
      if (!existingProductSnapshot.empty) {
        // 같은 이름의 상품이 있으면 기존 ID 사용
        productId = existingProductSnapshot.docs[0].data().id;
      } else {
        // 같은 이름의 상품이 없으면 새 ID 생성
        productId = await generateNewId();
      }
      const productWithTimestamp = {
        ...data,
        id: productId, // 기존 ID 또는 새 ID 사용
        createdAt: serverTimestamp(),
      };
      const docRef = doc(collection(db, 'products'));
      await setDoc(docRef, productWithTimestamp);

      // [이중 저장: Supabase]
      await supabase.from('products').insert([{
        id: docRef.id,
        name: data.name,
        main_category: data.mainCategory,
        mid_category: data.midCategory,
        price: data.price,
        supplier: data.supplier,
        stock: data.stock,
        size: data.size,
        color: data.color,
        branch: data.branch,
        code: productId,
        status: getStatus(data.stock),
        updated_at: new Date().toISOString()
      }]);

      toast({ title: "성공", description: `새 상품이 '${data.branch}' 지점에 추가되었습니다.` });
      await fetchProducts();
    } catch (error) {
      console.error("Error adding product:", error);
      toast({ variant: 'destructive', title: '오류', description: '상품 추가 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };
  const updateProduct = async (docId: string, data: ProductFormValues) => {
    setLoading(true);
    try {
      // [이중 저장: Firebase]
      const docRef = doc(db, "products", docId);
      await setDoc(docRef, data, { merge: true });

      // [이중 저장: Supabase]
      await supabase.from('products').update({
        name: data.name,
        main_category: data.mainCategory,
        mid_category: data.midCategory,
        price: data.price,
        supplier: data.supplier,
        stock: data.stock,
        size: data.size,
        color: data.color,
        branch: data.branch,
        status: getStatus(data.stock),
        updated_at: new Date().toISOString()
      }).eq('id', docId);

      toast({ title: "성공", description: "상품 정보가 수정되었습니다." });
      await fetchProducts();
    } catch (error) {
      console.error("Error updating product:", error);
      toast({ variant: 'destructive', title: '오류', description: '상품 수정 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };
  const deleteProduct = async (docId: string) => {
    setLoading(true);
    try {
      // [이중 저장: Firebase]
      await deleteDoc(doc(db, 'products', docId));

      // [이중 저장: Supabase]
      await supabase.from('products').delete().eq('id', docId);

      toast({ title: "성공", description: "상품이 삭제되었습니다." });
      await fetchProducts();
    } catch (error) {
      console.error("Error deleting product:", error);
      toast({ variant: 'destructive', title: '오류', description: '상품 삭제 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };
  const bulkAddProducts = async (data: any[], selectedBranch?: string) => {
    setLoading(true);
    let newCount = 0;
    let deleteCount = 0;
    let errorCount = 0;
    let supplierAddedCount = 0;
    let categoryAddedCount = 0;
    // 새로운 공급업체들을 수집
    const suppliersToAdd = new Set<string>();
    data.forEach(row => {
      // 엑셀 필드명 매핑 (한글 필드명을 영문 필드명으로 변환)
      const supplier = String(row.supplier || row.공급업체 || '').trim();
      if (supplier && supplier !== '미지정' && supplier !== '') {
        suppliersToAdd.add(supplier);
      }
    });
    // 새로운 카테고리들을 수집
    const mainCategoriesToAdd = new Set<string>();
    const midCategoriesToAdd = new Set<string>();
    data.forEach(row => {
      // 엑셀 필드명 매핑 (한글 필드명을 영문 필드명으로 변환)
      const mainCategory = String(row.mainCategory || row.대분류 || '').trim();
      const midCategory = String(row.midCategory || row.중분류 || '').trim();
      if (mainCategory && mainCategory !== '기타자재') {
        mainCategoriesToAdd.add(mainCategory);
      }
      if (midCategory && midCategory !== '기타') {
        midCategoriesToAdd.add(midCategory);
      }
    });
    // 공급업체들을 거래처 관리에 추가
    if (suppliersToAdd.size > 0) {
      try {
        for (const supplierName of suppliersToAdd) {
          const nameQuery = query(collection(db, "partners"), where("name", "==", supplierName));
          const nameSnapshot = await getDocs(nameQuery);
          if (nameSnapshot.empty) {
            const partnerData = {
              name: supplierName,
              type: '상품공급업체',
              contact: '',
              address: '',
              items: '상품',
              memo: `상품 업로드 시 자동 추가된 공급업체: ${supplierName}`,
              createdAt: serverTimestamp()
            };
            await addDoc(collection(db, 'partners'), partnerData);
            supplierAddedCount++;
          }
        }
      } catch (error) {
        console.error("Error adding suppliers to partners:", error);
      }
    }
    // 새로운 카테고리들을 카테고리 관리에 추가
    if (mainCategoriesToAdd.size > 0 || midCategoriesToAdd.size > 0) {
      try {
        // 대분류 카테고리 추가
        for (const mainCategory of mainCategoriesToAdd) {
          const mainQuery = query(collection(db, "categories"), where("name", "==", mainCategory), where("type", "==", "main"));
          const mainSnapshot = await getDocs(mainQuery);
          if (mainSnapshot.empty) {
            const categoryData = {
              name: mainCategory,
              type: 'main',
              createdAt: serverTimestamp()
            };
            await addDoc(collection(db, 'categories'), categoryData);
            categoryAddedCount++;
          }
        }
        // 중분류 카테고리 추가
        for (const midCategory of midCategoriesToAdd) {
          const midQuery = query(collection(db, "categories"), where("name", "==", midCategory), where("type", "==", "mid"));
          const midSnapshot = await getDocs(midQuery);
          if (midSnapshot.empty) {
            const categoryData = {
              name: midCategory,
              type: 'mid',
              createdAt: serverTimestamp()
            };
            await addDoc(collection(db, 'categories'), categoryData);
            categoryAddedCount++;
          }
        }
      } catch (error) {
        console.error("Error adding categories:", error);
      }
    }

    // 엑셀 데이터에 포함된 지점들의 기존 상품 모두 삭제
    const branchesInExcel = [...new Set(data.map(row => {
      const branch = String(row.branch || row.지점 || '').trim();
      return branch;
    }).filter(Boolean))];

    if (branchesInExcel.length > 0) {
      try {
        for (const branch of branchesInExcel) {
          // [이중 저장: Firebase 삭제]
          const existingProductsQuery = query(
            collection(db, "products"),
            where("branch", "==", branch)
          );
          const existingProductsSnapshot = await getDocs(existingProductsQuery);

          const deletePromises = existingProductsSnapshot.docs.map(doc => deleteDoc(doc.ref));
          await Promise.all(deletePromises);

          // [이중 저장: Supabase 삭제]
          await supabase.from('products').delete().eq('branch', branch);

          deleteCount += existingProductsSnapshot.size;
        }
      } catch (error) {
        console.error("Error deleting existing products:", error);
        errorCount++;
      }
    }

    // 같은 상품명에 같은 ID를 부여하기 위한 매핑 테이블
    const productNameToIdMap = new Map<string, string>();

    // 현재 최대 ID 조회하여 자동생성 ID 시작점 설정
    let currentIdNumber = 0;
    const maxIdQuery = query(collection(db, "products"), orderBy("id", "desc"), limit(1));
    const maxIdSnapshot = await getDocs(maxIdQuery);
    if (!maxIdSnapshot.empty) {
      const lastId = maxIdSnapshot.docs[0].data().id;
      if (lastId && lastId.startsWith('P')) {
        const idNumber = parseInt(lastId.replace('P', ''), 10);
        if (!isNaN(idNumber)) {
          currentIdNumber = idNumber;
        }
      }
    }

    // 순차 처리로 변경하여 ID 매핑이 올바르게 동작하도록 함
    for (let index = 0; index < data.length; index++) {
      const row = data[index];
      try {
        // 엑셀 필드명 매핑 (한글 필드명을 영문 필드명으로 변환)
        const mappedRow = {
          name: row.name || row.상품명 || '',
          mainCategory: row.mainCategory || row.대분류 || '',
          midCategory: row.midCategory || row.중분류 || '',
          price: row.price || row.가격 || 0,
          supplier: row.supplier || row.공급업체 || '',
          stock: row.stock || row.재고 || 0,
          size: row.size || row.규격 || '',
          color: row.color || row.색상 || '',
          branch: row.branch || row.지점 || '',
          code: row.code || row.코드 || row.상품코드 || '', // 상품코드 필드 추가
          category: row.category || row.카테고리 || ''
        };

        if (!mappedRow.name) {
          return;
        }
        const productName = String(mappedRow.name);
        const productBranch = String(mappedRow.branch || '');
        const productCode = String(mappedRow.code || '');

        // 상품 데이터 준비 (엑셀의 모든 필드를 완전히 덮어쓰기)
        const productData = {
          name: productName,
          mainCategory: String(mappedRow.mainCategory || ''),
          midCategory: String(mappedRow.midCategory || ''),
          price: Number(mappedRow.price) || 0,
          supplier: String(mappedRow.supplier || ''),
          stock: Number(mappedRow.stock) || 0,
          size: String(mappedRow.size || ''),
          color: String(mappedRow.color || ''),
          branch: productBranch,
          code: productCode,
          category: String(mappedRow.category || ''),
          updatedAt: serverTimestamp(), // 업데이트 시간 추가
        };

        // 모든 상품을 새로 추가 (기존 상품은 이미 삭제됨)
        const docRef = doc(collection(db, "products"));

        // 상품 ID 결정 로직: 엑셀에 코드가 있으면 무조건 그것을 사용 (상품명 중복 무시)
        let productId;
        if (productCode && productCode.trim()) {
          // 1. 엑셀에 코드가 있으면 무조건 사용 (각 행이 독립적으로 처리됨)
          productId = productCode.trim();
        } else if (productNameToIdMap.has(productName)) {
          // 2. 엑셀에 코드가 없고, 같은 상품명이 이미 처리되었으면 기존 ID 재사용
          productId = productNameToIdMap.get(productName)!;
        } else {
          // 3. 엑셀에 코드가 없고, 새로운 상품명이면 새 ID 생성
          currentIdNumber++;
          productId = `P${String(currentIdNumber).padStart(5, '0')}`;
          productNameToIdMap.set(productName, productId);
        }

        await setDoc(docRef, {
          ...productData,
          id: productId,
          createdAt: serverTimestamp()
        });

        // [이중 저장: Supabase 추가]
        await supabase.from('products').insert([{
          id: docRef.id,
          name: productData.name,
          main_category: productData.mainCategory,
          mid_category: productData.midCategory,
          price: productData.price,
          supplier: productData.supplier,
          stock: productData.stock,
          size: productData.size,
          color: productData.color,
          branch: productData.branch,
          code: productId,
          status: getStatus(productData.stock),
          updated_at: new Date().toISOString()
        }]);

        newCount++;
      } catch (error) {
        console.error("Error processing product:", error);
        errorCount++;
      }
    }
    setLoading(false);
    if (errorCount > 0) {
      toast({
        variant: 'destructive',
        title: '일부 처리 오류',
        description: `${errorCount}개 항목 처리 중 오류가 발생했습니다.`
      });
    }
    let description = `성공: 기존 상품 ${deleteCount}개 삭제, 신규 상품 ${newCount}개 추가 완료.`;
    if (supplierAddedCount > 0) {
      description += ` 새로운 공급업체 ${supplierAddedCount}개가 거래처 관리에 추가되었습니다.`;
    }
    if (categoryAddedCount > 0) {
      description += ` 새로운 카테고리 ${categoryAddedCount}개가 카테고리 관리에 추가되었습니다.`;
    }
    if (errorCount > 0) {
      description += ` (${errorCount}개 항목 처리 중 오류 발생)`;
    }

    toast({
      title: '처리 완료',
      description
    });
    // 상품 목록 새로고침 (약간의 지연 후)
    setTimeout(async () => {
      await fetchProducts();
    }, 1000);
  };
  const manualUpdateStock = async (productId: string, productName: string, newStock: number, branch: string, userEmail: string) => {
    try {
      setLoading(true);
      // 자재와 동일한 방식으로 쿼리를 사용하여 문서 찾기
      const productQuery = query(
        collection(db, 'products'),
        where("id", "==", productId),
        where("branch", "==", branch)
      );
      const productSnapshot = await getDocs(productQuery);
      if (productSnapshot.empty) {
        throw new Error(`상품을 찾을 수 없습니다: ${productName} (${branch})`);
      }
      const productDocRef = productSnapshot.docs[0].ref;
      await setDoc(productDocRef, {
        stock: newStock,
        lastUpdated: serverTimestamp(),
        updatedBy: userEmail
      }, { merge: true });

      // [이중 저장: Supabase]
      await supabase.from('products').update({
        stock: newStock,
        status: getStatus(newStock),
        updated_at: new Date().toISOString()
      }).eq('id', productSnapshot.docs[0].id);

      // 재고 히스토리 추가
      const productData = productSnapshot.docs[0].data();
      const currentStock = productData?.stock || 0;
      const historyDocRef = doc(collection(db, "stockHistory"));
      await setDoc(historyDocRef, {
        date: serverTimestamp(),
        type: "manual_update",
        itemType: "product",
        itemId: productId,
        itemName: productName,
        quantity: newStock - currentStock,
        fromStock: currentStock,
        toStock: newStock,
        resultingStock: newStock,
        branch: branch,
        operator: userEmail,
        supplier: productData.supplier || '',
        price: productData.price || 0,
        totalAmount: (productData.price || 0) * Math.abs(newStock - currentStock),
      });

      // [이중 저장: Supabase 재고 히스토리 추가]
      await supabase.from('stock_history').insert([{
        id: historyDocRef.id,
        date: new Date().toISOString(),
        type: "manual_update",
        item_type: "product",
        item_id: productId,
        item_name: productName,
        quantity: newStock - currentStock,
        from_stock: currentStock,
        to_stock: newStock,
        resulting_stock: newStock,
        branch: branch,
        operator: userEmail,
        supplier: productData.supplier || '',
        price: productData.price || 0,
        total_amount: (productData.price || 0) * Math.abs(newStock - currentStock),
        created_at: new Date().toISOString()
      }]);
      toast({
        title: "성공",
        description: `${productName}의 재고가 ${newStock}개로 업데이트되었습니다.`
      });
      await fetchProducts();
    } catch (error) {
      console.error("Error updating stock:", error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: `재고 업데이트 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`
      });
    } finally {
      setLoading(false);
    }
  };
  // 기존 상품들에 ID 필드를 추가하는 마이그레이션 함수
  // migrateProductIds 함수 제거
  // 재고 업데이트 함수 (자재와 동일한 방식)
  const updateStock = async (
    items: { id: string; name: string; quantity: number, price?: number, supplier?: string }[],
    type: 'in' | 'out',
    branchName: string,
    operator: string
  ) => {
    for (const item of items) {
      try {
        await runTransaction(db, async (transaction) => {
          const productQuery = query(collection(db, "products"), where("id", "==", item.id), where("branch", "==", branchName));
          const productSnapshot = await getDocs(productQuery);
          if (productSnapshot.empty) {
            throw new Error(`상품을 찾을 수 없습니다: ${item.name} (${branchName})`);
          }
          const productDocRef = productSnapshot.docs[0].ref;
          const productDoc = await transaction.get(productDocRef);
          if (!productDoc.exists()) {
            throw new Error(`상품 문서를 찾을 수 없습니다: ${item.name} (${branchName})`);
          }
          const productData = productDoc.data();
          const currentStock = productData?.stock || 0;
          const change = type === 'in' ? item.quantity : -item.quantity;
          const newStock = currentStock + change;
          const updatePayload: { stock: number, price?: number, supplier?: string } = { stock: newStock };
          if (type === 'in') {
            if (item.price !== undefined) updatePayload.price = item.price;
            if (item.supplier !== undefined) updatePayload.supplier = item.supplier;
          }
          transaction.update(productDocRef, updatePayload);

          // [이중 저장: Supabase]
          await supabase.from('products').update({
            stock: newStock,
            status: getStatus(newStock),
            price: (updatePayload as any).price,
            supplier: (updatePayload as any).supplier,
            updated_at: new Date().toISOString()
          }).eq('id', productSnapshot.docs[0].id);

          // [이중 저장: Supabase 재고 히스토리 추가]
          const historyDocRef = doc(collection(db, "stockHistory"));
          const historyData = {
            date: serverTimestamp(),
            type: type,
            itemType: "product",
            itemId: item.id,
            itemName: item.name,
            quantity: item.quantity,
            fromStock: currentStock,
            toStock: newStock,
            resultingStock: newStock,
            branch: branchName,
            operator: operator,
            supplier: type === 'in' ? (item.supplier || productData?.supplier) : productData?.supplier,
            price: type === 'in' ? (item.price || productData?.price) : productData?.price,
            totalAmount: type === 'in' ? ((item.price || productData?.price || 0) * item.quantity) : 0,
          };
          await setDoc(historyDocRef, historyData);

          await supabase.from('stock_history').insert([{
            id: historyDocRef.id,
            date: new Date().toISOString(),
            type: type,
            item_type: "product",
            item_id: item.id,
            item_name: item.name,
            quantity: item.quantity,
            from_stock: currentStock,
            to_stock: newStock,
            resulting_stock: newStock,
            branch: branchName,
            operator: operator,
            supplier: historyData.supplier,
            price: historyData.price,
            total_amount: historyData.totalAmount,
            created_at: new Date().toISOString()
          }]);
        });
      } catch (error) {
        console.error(`상품 재고 업데이트 오류 (${item.name}):`, error);
        throw error;
      }
    }
  };
  return {
    products,
    loading,
    addProduct,
    updateProduct,
    deleteProduct,
    bulkAddProducts,
    manualUpdateStock,
    updateStock,
    fetchProducts,
  };
}
