
"use client";

import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, setDoc, addDoc, writeBatch, serverTimestamp, runTransaction, query, where, orderBy, limit, deleteDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { supabase } from '@/lib/supabase'; // 추가
import { useToast } from './use-toast';
import type { Material as MaterialData } from "@/app/dashboard/materials/components/material-table";
import type { MaterialFormValues } from '@/app/dashboard/materials/components/material-form';

export type Material = MaterialData;

const initialMaterials: Omit<Material, 'docId' | 'status'>[] = [
    { id: "M00001", name: "마르시아 장미", mainCategory: "생화", midCategory: "장미", price: 5000, supplier: "경부선꽃시장", stock: 100, size: "1단", color: "Pink", branch: "릴리맥광화문점" },
    { id: "M00001", name: "마르시아 장미", mainCategory: "생화", midCategory: "장미", price: 5000, supplier: "경부선꽃시장", stock: 80, size: "1단", color: "Pink", branch: "릴리맥여의도점" },
    { id: "M00002", name: "레드 카네이션", mainCategory: "생화", midCategory: "카네이션", price: 4500, supplier: "플라워팜", stock: 200, size: "1단", color: "Red", branch: "릴리맥여의도점" },
    { id: "M00003", name: "몬스테라", mainCategory: "화분", midCategory: "관엽식물", price: 25000, supplier: "플라워팜", stock: 0, size: "대", color: "Green", branch: "릴리맥광화문점" },
    { id: "M00004", name: "만천홍", mainCategory: "화분", midCategory: "난", price: 55000, supplier: "경부선꽃시장", stock: 30, size: "특", color: "Purple", branch: "릴리맥NC이스트폴점" },
    { id: "M00005", name: "포장용 크라프트지", mainCategory: "기타자재", midCategory: "기타", price: 1000, supplier: "자재월드", stock: 15, size: "1롤", color: "Brown", branch: "릴리맥여의도점" },
    { id: "M00006", name: "유칼립투스", mainCategory: "생화", midCategory: "기타", price: 3000, supplier: "플라워팜", stock: 50, size: "1단", color: "Green", branch: "릴리맥광화문점" },
];

export function useMaterials() {
    const [materials, setMaterials] = useState<Material[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const getStatus = (stock: number): string => {
        if (stock === 0) return 'out_of_stock';
        if (stock < 10) return 'low_stock';
        return 'active';
    }

    const fetchMaterials = useCallback(async () => {
        try {
            setLoading(true);

            // [Supabase 우선 조회]
            const { data: supabaseItems, error: supabaseError } = await supabase
                .from('materials')
                .select('*')
                .order('id', { ascending: true });

            if (!supabaseError && supabaseItems && supabaseItems.length > 0) {
                const mappedData = supabaseItems.map(item => ({
                    docId: item.id,
                    id: item.id, // Supabase primary key as fallback
                    name: item.name,
                    mainCategory: item.main_category,
                    midCategory: item.mid_category,
                    price: item.price,
                    supplier: item.supplier,
                    stock: item.stock,
                    size: item.size,
                    color: item.color,
                    branch: item.branch,
                    status: getStatus(item.stock)
                } as Material)).sort((a, b) => (a.id && b.id) ? a.id.localeCompare(b.id) : 0);

                setMaterials(mappedData);
                setLoading(false);
                return;
            }

            // Fallback: Firebase
            const materialsCollection = collection(db, 'materials');
            const querySnapshot = await getDocs(materialsCollection);

            if (querySnapshot.size <= 1) {
                const initDocRef = doc(materialsCollection, '_initialized');
                const initDoc = await getDoc(initDocRef);
                if (!initDoc.exists()) {
                    const batch = writeBatch(db);
                    initialMaterials.forEach((materialData) => {
                        const newDocRef = doc(materialsCollection);
                        batch.set(newDocRef, materialData);
                    });
                    batch.set(initDocRef, { seeded: true });
                    await batch.commit();

                    const seededSnapshot = await getDocs(materialsCollection);
                    const materialsData = seededSnapshot.docs
                        .filter(doc => doc.id !== '_initialized')
                        .map((doc) => {
                            const data = doc.data();
                            return {
                                docId: doc.id,
                                ...data,
                                status: getStatus(data.stock)
                            } as Material;
                        })
                        .filter(material =>
                            material &&
                            material.name &&
                            material.id &&
                            material.docId
                        )
                        .sort((a, b) => (a.id && b.id) ? a.id.localeCompare(b.id) : 0);
                    setMaterials(materialsData);
                    return;
                }
            }

            const materialsData = querySnapshot.docs
                .filter(doc => doc.id !== '_initialized')
                .map((doc) => {
                    const data = doc.data();
                    return {
                        docId: doc.id,
                        ...data,
                        status: getStatus(data.stock)
                    } as Material;
                })
                .filter(material =>
                    material &&
                    material.name &&
                    material.id &&
                    material.docId
                )
                .sort((a, b) => (a.id && b.id) ? a.id.localeCompare(b.id) : 0);
            setMaterials(materialsData);

        } catch (error) {
            console.error("Error fetching materials: ", error);
            toast({
                variant: 'destructive',
                title: '오류',
                description: '자재 정보를 불러오는 중 오류가 발생했습니다.',
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchMaterials();
    }, [fetchMaterials]);

    const generateNewId = async () => {
        const q = query(collection(db, "materials"), orderBy("id", "desc"), limit(1));
        const querySnapshot = await getDocs(q);
        let lastIdNumber = 0;
        if (!querySnapshot.empty) {
            const lastId = querySnapshot.docs[0].data().id;
            if (lastId && lastId.startsWith('M')) {
                lastIdNumber = parseInt(lastId.replace('M', ''), 10);
            }
        }
        return `M${String(lastIdNumber + 1).padStart(5, '0')}`;
    }

    // 기존 자재 ID를 6자리 M00000 형식으로 업데이트하는 함수
    const updateMaterialIds = async () => {
        try {
            setLoading(true);
            const materialsCollection = collection(db, 'materials');
            const querySnapshot = await getDocs(materialsCollection);

            let updateCount = 0;
            let currentNumber = 1;

            for (const docSnapshot of querySnapshot.docs) {
                if (docSnapshot.id === '_initialized') continue;

                const data = docSnapshot.data();
                const currentId = data.id;

                // 이미 M00000 형식이면 건너뛰기
                if (currentId && currentId.match(/^M\d{5}$/)) {
                    continue;
                }

                // 새로운 6자리 ID 생성
                const newId = `M${String(currentNumber).padStart(5, '0')}`;

                // 문서 업데이트
                await setDoc(docSnapshot.ref, { ...data, id: newId }, { merge: true });
                updateCount++;
                currentNumber++;
            }

            if (updateCount > 0) {
                toast({
                    title: "ID 업데이트 완료",
                    description: `${updateCount}개 자재의 ID가 M00000 형식으로 업데이트되었습니다.`
                });
                await fetchMaterials();
            }

        } catch (error) {
            console.error("Error updating material IDs:", error);
            toast({
                variant: 'destructive',
                title: '오류',
                description: '자재 ID 업데이트 중 오류가 발생했습니다.'
            });
        } finally {
            setLoading(false);
        }
    }

    const addMaterial = async (data: MaterialFormValues) => {
        setLoading(true);
        try {
            // 지점별로 구분하여 중복 체크
            const existingMaterialQuery = query(
                collection(db, "materials"),
                where("name", "==", data.name),
                where("branch", "==", data.branch)
            );
            const existingMaterialSnapshot = await getDocs(existingMaterialQuery);

            if (!existingMaterialSnapshot.empty) {
                toast({ variant: 'destructive', title: '중복된 자재', description: `'${data.branch}' 지점에 동일한 이름의 자재가 이미 존재합니다.` });
                setLoading(false);
                return;
            }

            const newId = await generateNewId();
            const docRef = doc(collection(db, "materials"));
            await setDoc(docRef, { ...data, id: newId });

            // [이중 저장: Supabase 추가]
            await supabase.from('materials').insert([{
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
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }]);

            toast({ title: "성공", description: `새 자재가 '${data.branch}' 지점에 추가되었습니다.` });
            await fetchMaterials();
        } catch (error) {
            console.error("Error adding material:", error);
            toast({ variant: 'destructive', title: '오류', description: '자재 추가 중 오류가 발생했습니다.' });
        } finally {
            setLoading(false);
        }
    }

    const updateMaterial = async (docId: string, materialId: string, data: MaterialFormValues) => {
        setLoading(true);
        try {
            // [이중 저장: Firebase]
            const docRef = doc(db, "materials", docId);
            await setDoc(docRef, { ...data, id: materialId }, { merge: true });

            // [이중 저장: Supabase]
            await supabase.from('materials').update({
                name: data.name,
                main_category: data.mainCategory,
                mid_category: data.midCategory,
                price: data.price,
                supplier: data.supplier,
                stock: data.stock,
                size: data.size,
                color: data.color,
                branch: data.branch,
                updated_at: new Date().toISOString()
            }).eq('id', docId);

            toast({ title: "성공", description: "자재 정보가 수정되었습니다." });
            await fetchMaterials();
        } catch (error) {
            console.error("Error updating material:", error);
            toast({ variant: 'destructive', title: '오류', description: '자재 수정 중 오류가 발생했습니다.' });
        } finally {
            setLoading(false);
        }
    }

    const deleteMaterial = async (docId: string) => {
        setLoading(true);
        try {
            // [이중 저장: Firebase]
            const docRef = doc(db, "materials", docId);
            await deleteDoc(docRef);

            // [이중 저장: Supabase]
            await supabase.from('materials').delete().eq('id', docId);

            await fetchMaterials();
            toast({ title: "성공", description: "자재가 삭제되었습니다." });
        } catch (error) {
            console.error("Error deleting material:", error);
            toast({ variant: 'destructive', title: '오류', description: '자재 삭제 중 오류가 발생했습니다.' });
        } finally {
            setLoading(false);
        }
    }

    const updateStock = async (
        items: { id: string; name: string; quantity: number, price?: number, supplier?: string }[],
        type: 'in' | 'out',
        branchName: string,
        operator: string
    ) => {
        const historyBatch = writeBatch(db);

        for (const item of items) {
            try {
                await runTransaction(db, async (transaction) => {
                    const materialQuery = query(collection(db, "materials"), where("id", "==", item.id), where("branch", "==", branchName));
                    const materialSnapshot = await getDocs(materialQuery);

                    if (materialSnapshot.empty) {
                        // 자재가 없으면 새로 생성
                        const newMaterialId = await generateNewId();
                        const newMaterialRef = doc(collection(db, "materials"));

                        const newMaterialData = {
                            id: newMaterialId,
                            name: item.name,
                            mainCategory: '원재료',
                            midCategory: '기타',
                            branch: branchName,
                            supplier: item.supplier || '',
                            price: item.price || 0,
                            stock: type === 'in' ? item.quantity : 0,
                            size: '',
                            color: '',
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp()
                        };

                        transaction.set(newMaterialRef, newMaterialData);

                        // [이중 저장: Supabase 새 자재 추가]
                        await supabase.from('materials').insert([{
                            id: newMaterialRef.id,
                            name: item.name,
                            main_category: '원재료',
                            mid_category: '기타',
                            branch: branchName,
                            supplier: item.supplier || '',
                            price: item.price || 0,
                            stock: type === 'in' ? item.quantity : 0,
                            size: '',
                            color: '',
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        }]);

                        // 새로 생성된 자재로 재고 업데이트
                        const materialDocRef = newMaterialRef;
                        const materialData = newMaterialData;
                        const currentStock = 0;
                        const change = type === 'in' ? item.quantity : -item.quantity;
                        const newStock = currentStock + change;

                        const updatePayload: { stock: number, price?: number, supplier?: string } = { stock: newStock };
                        if (type === 'in') {
                            if (item.price !== undefined) updatePayload.price = item.price;
                            if (item.supplier !== undefined) updatePayload.supplier = item.supplier;
                        }

                        transaction.update(materialDocRef, updatePayload);

                        const historyDocRef = doc(collection(db, "stockHistory"));
                        historyBatch.set(historyDocRef, {
                            date: serverTimestamp(),
                            type: type,
                            itemType: "material",
                            itemId: newMaterialId,
                            itemName: item.name,
                            quantity: item.quantity,
                            fromStock: currentStock,
                            toStock: newStock,
                            resultingStock: newStock,
                            branch: branchName,
                            operator: operator,
                            supplier: type === 'in' ? (item.supplier || materialData?.supplier) : materialData?.supplier,
                            price: type === 'in' ? (item.price || materialData?.price) : materialData?.price,
                            totalAmount: type === 'in' ? ((item.price || materialData?.price || 0) * item.quantity) : 0,
                        });

                        return; // 새 자재 생성 후 다음 아이템으로
                    }

                    const materialDocRef = materialSnapshot.docs[0].ref;
                    const materialDoc = await transaction.get(materialDocRef);

                    if (!materialDoc.exists()) {
                        throw new Error(`자재 문서를 찾을 수 없습니다: ${item.name} (${branchName})`);
                    }

                    const materialData = materialDoc.data();
                    const currentStock = materialData?.stock || 0;
                    const change = type === 'in' ? item.quantity : -item.quantity;
                    const newStock = currentStock + change;

                    const updatePayload: { stock: number, price?: number, supplier?: string } = { stock: newStock };
                    if (type === 'in') {
                        if (item.price !== undefined) updatePayload.price = item.price;
                        if (item.supplier !== undefined) updatePayload.supplier = item.supplier;
                    }

                    transaction.update(materialDocRef, updatePayload);

                    // [이중 저장: Supabase 재고 업데이트]
                    await supabase.from('materials').update({
                        stock: newStock,
                        price: updatePayload.price,
                        supplier: updatePayload.supplier,
                        updated_at: new Date().toISOString()
                    }).eq('id', materialDocRef.id);

                    const historyDocRef = doc(collection(db, "stockHistory"));
                    historyBatch.set(historyDocRef, {
                        date: serverTimestamp(),
                        type: type,
                        itemType: "material",
                        itemId: item.id,
                        itemName: item.name,
                        quantity: item.quantity,
                        fromStock: currentStock,
                        toStock: newStock,
                        resultingStock: newStock,
                        branch: branchName,
                        operator: operator,
                        supplier: type === 'in' ? (item.supplier || materialData?.supplier) : materialData?.supplier,
                        price: type === 'in' ? (item.price || materialData?.price) : materialData?.price,
                        totalAmount: type === 'in' ? ((item.price || materialData?.price || 0) * item.quantity) : 0,
                    });

                    // [이중 저장: Supabase 재고 히스토리 추가]
                    await supabase.from('stock_history').insert([{
                        id: historyDocRef.id,
                        date: new Date().toISOString(),
                        type: type,
                        item_type: "material",
                        item_id: item.id || (item as any).id, // Fallback if item.id is missing or new
                        item_name: item.name,
                        quantity: item.quantity,
                        from_stock: currentStock,
                        to_stock: newStock,
                        resulting_stock: newStock,
                        branch: branchName,
                        operator: operator,
                        supplier: type === 'in' ? (item.supplier || materialData?.supplier) : materialData?.supplier,
                        price: type === 'in' ? (item.price || materialData?.price) : materialData?.price,
                        total_amount: type === 'in' ? ((item.price || materialData?.price || 0) * item.quantity) : 0,
                        created_at: new Date().toISOString()
                    }]);
                });
            } catch (error) {
                console.error(error);
                toast({
                    variant: "destructive",
                    title: "재고 업데이트 오류",
                    description: `${item.name}의 재고를 업데이트하는 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`,
                });
                // Continue to next item
            }
        }

        await historyBatch.commit();
        await fetchMaterials();
    };

    const manualUpdateStock = async (
        itemId: string,
        itemName: string,
        newStock: number,
        branchName: string,
        operator: string
    ) => {
        try {
            await runTransaction(db, async (transaction) => {
                const materialQuery = query(collection(db, "materials"), where("id", "==", itemId), where("branch", "==", branchName));
                const materialSnapshot = await getDocs(materialQuery);

                if (materialSnapshot.empty) {
                    throw new Error(`자재를 찾을 수 없습니다: ${itemName} (${branchName})`);
                }

                const materialRef = materialSnapshot.docs[0].ref;
                const materialDoc = await transaction.get(materialRef);

                if (!materialDoc.exists()) {
                    throw new Error(`자재 문서를 찾을 수 없습니다: ${itemName} (${branchName})`);
                }

                const currentStock = materialDoc.data()?.stock || 0;

                transaction.update(materialRef, { stock: newStock });

                // [이중 저장: Supabase 재고 수동 업데이트]
                await supabase.from('materials').update({
                    stock: newStock,
                    updated_at: new Date().toISOString()
                }).eq('id', materialRef.id);

                const materialData = materialDoc.data();
                const historyDocRef = doc(collection(db, "stockHistory"));
                transaction.set(historyDocRef, {
                    date: serverTimestamp(),
                    type: "manual_update",
                    itemType: "material",
                    itemId: itemId,
                    itemName: itemName,
                    quantity: newStock - currentStock,
                    fromStock: currentStock,
                    toStock: newStock,
                    resultingStock: newStock,
                    branch: branchName,
                    operator: operator,
                    supplier: materialData.supplier || '',
                    price: materialData.price || 0,
                    totalAmount: (materialData.price || 0) * Math.abs(newStock - currentStock),
                });

                // [이중 저장: Supabase 재고 히스토리 수동 업데이트 추가]
                await supabase.from('stock_history').insert([{
                    id: historyDocRef.id,
                    date: new Date().toISOString(),
                    type: "manual_update",
                    item_type: "material",
                    item_id: itemId,
                    item_name: itemName,
                    quantity: newStock - currentStock,
                    from_stock: currentStock,
                    to_stock: newStock,
                    resulting_stock: newStock,
                    branch: branchName,
                    operator: operator,
                    supplier: materialData.supplier || '',
                    price: materialData.price || 0,
                    total_amount: (materialData.price || 0) * Math.abs(newStock - currentStock),
                    created_at: new Date().toISOString()
                }]);
            });

            toast({
                title: "업데이트 성공",
                description: `${itemName}의 재고가 ${newStock}으로 업데이트되었습니다.`,
            });
            await fetchMaterials();

        } catch (error) {
            console.error("Manual stock update error:", error);
            toast({
                variant: "destructive",
                title: "재고 업데이트 오류",
                description: `재고 업데이트 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`,
            });
        }
    };

    const bulkAddMaterials = async (data: any[], currentBranch: string) => {
        setLoading(true);
        let newCount = 0;
        let updateCount = 0;
        let errorCount = 0;
        let supplierAddedCount = 0;
        let categoryAddedCount = 0;

        const dataToProcess = data.filter(row => {
            const branchMatch = currentBranch === 'all' || row.branch === currentBranch;
            const hasName = row.name && String(row.name).trim() !== '';
            return branchMatch && hasName;
        });

        // 새로운 공급업체들을 수집
        const suppliersToAdd = new Set<string>();
        dataToProcess.forEach(row => {
            const supplier = String(row.supplier || '').trim();
            if (supplier && supplier !== '미지정' && supplier !== '') {
                suppliersToAdd.add(supplier);
            }
        });

        // 새로운 카테고리들을 수집
        const mainCategoriesToAdd = new Set<string>();
        const midCategoriesToAdd = new Set<string>();
        dataToProcess.forEach(row => {
            const mainCategory = String(row.mainCategory || '').trim();
            const midCategory = String(row.midCategory || '').trim();
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
                            type: '자재공급업체',
                            contact: '',
                            address: '',
                            items: '자재',
                            memo: `자재 업로드 시 자동 추가된 공급업체: ${supplierName}`,
                            createdAt: serverTimestamp()
                        };
                        const newPartnerDocRef = await addDoc(collection(db, 'partners'), partnerData);

                        // [이중 저장: Supabase 거래처 추가]
                        await supabase.from('partners').insert([{
                            id: newPartnerDocRef.id,
                            name: supplierName,
                            type: '자재공급업체',
                            items: '자재',
                            memo: partnerData.memo,
                            created_at: new Date().toISOString()
                        }]);

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

        await Promise.all(dataToProcess.map(async (row) => {
            try {
                const stock = Number(row.current_stock ?? row.stock ?? row.quantity);
                if (isNaN(stock)) return;

                const materialData = {
                    id: row.id || null,
                    name: String(row.name),
                    branch: String(row.branch),
                    stock: stock,
                    price: Number(row.price) || 0,
                    supplier: String(row.supplier) || '미지정',
                    mainCategory: String(row.mainCategory) || '기타자재',
                    midCategory: String(row.midCategory) || '기타',
                    size: String(row.size) || '기타',
                    color: String(row.color) || '기타',
                };

                // 지점별로 구분하여 자재 검색
                let q;
                if (materialData.id) {
                    q = query(collection(db, "materials"), where("id", "==", materialData.id), where("branch", "==", materialData.branch));
                } else {
                    q = query(collection(db, "materials"), where("name", "==", materialData.name), where("branch", "==", materialData.branch));
                }

                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    // 해당 지점에 같은 이름의 자재가 있으면 업데이트
                    const docRef = querySnapshot.docs[0].ref;
                    await setDoc(docRef, materialData, { merge: true });

                    // [이중 저장: Supabase 업데이트]
                    await supabase.from('materials').update({
                        name: materialData.name,
                        branch: materialData.branch,
                        stock: materialData.stock,
                        price: materialData.price,
                        supplier: materialData.supplier,
                        main_category: materialData.mainCategory,
                        mid_category: materialData.midCategory,
                        size: materialData.size,
                        color: materialData.color,
                        updated_at: new Date().toISOString()
                    }).eq('id', docRef.id);

                    updateCount++;

                } else {
                    // 해당 지점에 같은 이름의 자재가 없으면 새로 등록
                    let newId;

                    // ID 결정: 엑셀에 ID가 있으면 사용, 없으면 자동 생성
                    if (materialData.id && materialData.id.trim()) {
                        newId = materialData.id.trim();

                        // 중복 ID 검증 (같은 지점 내에서)
                        const duplicateQuery = query(
                            collection(db, "materials"),
                            where("id", "==", newId),
                            where("branch", "==", materialData.branch)
                        );
                        const duplicateSnapshot = await getDocs(duplicateQuery);

                        if (!duplicateSnapshot.empty) {
                            console.warn(`중복된 자재 ID (${newId})가 발견되어 자동 생성 ID를 사용합니다.`);
                            newId = await generateNewId();
                        }
                    } else {
                        newId = await generateNewId();
                    }

                    const newDocRef = doc(collection(db, "materials"));
                    await setDoc(newDocRef, {
                        ...materialData,
                        id: newId,
                        code: materialData.id || '', // 원본 엑셀 ID도 code 필드에 보존
                    });

                    // [이중 저장: Supabase 추가]
                    await supabase.from('materials').insert([{
                        id: newDocRef.id,
                        name: materialData.name,
                        branch: materialData.branch,
                        stock: materialData.stock,
                        price: materialData.price,
                        supplier: materialData.supplier,
                        main_category: materialData.mainCategory,
                        mid_category: materialData.midCategory,
                        size: materialData.size,
                        color: materialData.color,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }]);

                    newCount++;
                }
            } catch (error) {
                console.error("Error processing row:", row, error);
                errorCount++;
            }
        }));

        if (errorCount > 0) {
            toast({ variant: 'destructive', title: '일부 처리 오류', description: `${errorCount}개 항목 처리 중 오류가 발생했습니다.` });
        }

        let description = `성공: 신규 자재 ${newCount}개 추가, ${updateCount}개 업데이트 완료.`;
        if (supplierAddedCount > 0) {
            description += ` 새로운 공급업체 ${supplierAddedCount}개가 거래처 관리에 추가되었습니다.`;
        }
        if (categoryAddedCount > 0) {
            description += ` 새로운 카테고리 ${categoryAddedCount}개가 카테고리 관리에 추가되었습니다.`;
        }

        toast({ title: '처리 완료', description });
        await fetchMaterials();
    };
    return { materials, loading, updateStock, fetchMaterials, manualUpdateStock, addMaterial, updateMaterial, deleteMaterial, bulkAddMaterials, updateMaterialIds };
}
