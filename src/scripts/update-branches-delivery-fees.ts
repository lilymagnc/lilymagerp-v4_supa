import { collection, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
// 각 지점별 배송비 데이터
const branchDeliveryFees = {
  "릴리맥광화문점": [
    { district: "종로구", fee: 10000 }, { district: "동작구", fee: 18000 },
    { district: "중구", fee: 10000 }, { district: "광진구", fee: 18000 },
    { district: "서대문구", fee: 13000 }, { district: "중랑구", fee: 18000 },
    { district: "성북구", fee: 13000 }, { district: "강북구", fee: 20000 },
    { district: "성동구", fee: 13000 }, { district: "송파구", fee: 20000 },
    { district: "용산구", fee: 14000 }, { district: "강동구", fee: 20000 },
    { district: "동대문구", fee: 14000 }, { district: "구로구", fee: 20000 },
    { district: "영등포구", fee: 15000 }, { district: "강서구", fee: 20000 },
    { district: "은평구", fee: 15000 }, { district: "관악구", fee: 20000 },
    { district: "마포구", fee: 16000 }, { district: "노원구", fee: 20000 },
    { district: "양천구", fee: 18000 }, { district: "도봉구", fee: 20000 },
    { district: "강남구", fee: 18000 }, { district: "금천구", fee: 20000 },
    { district: "서초구", fee: 18000 },
    { district: "기타", fee: 25000 }
  ],
  "릴리맥NC이스트폴점": [
    { district: "종로구", fee: 18000 }, { district: "동작구", fee: 21000 },
    { district: "중구", fee: 17000 }, { district: "광진구", fee: 10000 },
    { district: "서대문구", fee: 21000 }, { district: "중랑구", fee: 16000 },
    { district: "성북구", fee: 17000 }, { district: "강북구", fee: 20000 },
    { district: "성동구", fee: 14000 }, { district: "송파구", fee: 12000 },
    { district: "용산구", fee: 17000 }, { district: "강동구", fee: 12000 },
    { district: "동대문구", fee: 15000 }, { district: "구로구", fee: 24000 },
    { district: "영등포구", fee: 23000 }, { district: "강서구", fee: 27000 },
    { district: "은평구", fee: 22000 }, { district: "관악구", fee: 21000 },
    { district: "마포구", fee: 23000 }, { district: "노원구", fee: 21000 },
    { district: "양천구", fee: 25000 }, { district: "도봉구", fee: 22000 },
    { district: "강남구", fee: 13000 }, { district: "금천구", fee: 25000 },
    { district: "서초구", fee: 16000 },
    { district: "기타", fee: 30000 }
  ],
  "릴리맥여의도점": [
    { district: "강남구", fee: 20000 }, { district: "도봉구", fee: 25000 }, { district: "송파구", fee: 23000 },
    { district: "강동구", fee: 25000 }, { district: "동대문구", fee: 18000 }, { district: "양천구", fee: 13000 },
    { district: "강북구", fee: 23000 }, { district: "동작구", fee: 13000 }, { district: "영등포구", fee: 10000 },
    { district: "강서구", fee: 14000 }, { district: "마포구", fee: 13000 }, { district: "용산구", fee: 14000 },
    { district: "관악구", fee: 13000 }, { district: "서대문구", fee: 15000 }, { district: "은평구", fee: 20000 },
    { district: "광진구", fee: 20000 }, { district: "서초구", fee: 18000 }, { district: "종로구", fee: 16000 },
    { district: "구로구", fee: 13000 }, { district: "성동구", fee: 18000 }, { district: "중구", fee: 16000 },
    { district: "금천구", fee: 13000 }, { district: "성북구", fee: 20000 }, { district: "중랑구", fee: 23000 },
    { district: "노원구", fee: 25000 },
    { district: "기타", fee: 30000 }
  ],
  "릴리맥여의도2호점": [
    { district: "강남구", fee: 20000 }, { district: "도봉구", fee: 25000 }, { district: "송파구", fee: 23000 },
    { district: "강동구", fee: 25000 }, { district: "동대문구", fee: 18000 }, { district: "양천구", fee: 13000 },
    { district: "강북구", fee: 23000 }, { district: "동작구", fee: 13000 }, { district: "영등포구", fee: 10000 },
    { district: "강서구", fee: 14000 }, { district: "마포구", fee: 13000 }, { district: "용산구", fee: 14000 },
    { district: "관악구", fee: 13000 }, { district: "서대문구", fee: 15000 }, { district: "은평구", fee: 20000 },
    { district: "광진구", fee: 20000 }, { district: "서초구", fee: 18000 }, { district: "종로구", fee: 16000 },
    { district: "구로구", fee: 13000 }, { district: "성동구", fee: 18000 }, { district: "중구", fee: 16000 },
    { district: "금천구", fee: 13000 }, { district: "성북구", fee: 20000 }, { district: "중랑구", fee: 23000 },
    { district: "노원구", fee: 25000 },
    { district: "기타", fee: 30000 }
  ]
};
export async function updateBranchesWithDeliveryFees() {
  try {
    const branchesCollection = collection(db, 'branches');
    const querySnapshot = await getDocs(branchesCollection);
    const batch = writeBatch(db);
    let updateCount = 0;
    querySnapshot.docs.forEach((docSnapshot) => {
      if (docSnapshot.id === '_initialized') return;
      const branchData = docSnapshot.data();
      const branchName = branchData.name;
      // 해당 지점의 배송비 데이터가 있는지 확인
      if (branchDeliveryFees[branchName as keyof typeof branchDeliveryFees]) {
        const deliveryFees = branchDeliveryFees[branchName as keyof typeof branchDeliveryFees];
        // 배송비 정보가 없거나 비어있으면 업데이트
        if (!branchData.deliveryFees || branchData.deliveryFees.length === 0) {
          const docRef = doc(db, 'branches', docSnapshot.id);
          batch.update(docRef, {
            deliveryFees: deliveryFees,
            surcharges: { mediumItem: 2000, largeItem: 5000, express: 10000 }
          });
          updateCount++;
          } else {
          }
      } else {
        }
    });
    if (updateCount > 0) {
      await batch.commit();
      } else {
      }
    return { success: true, updatedCount: updateCount };
  } catch (error) {
    console.error('배송비 정보 업데이트 중 오류:', error);
    return { success: false, error };
  }
}
// 브라우저 콘솔에서 실행할 수 있도록 전역으로 노출
if (typeof window !== 'undefined') {
  (window as any).updateBranchesWithDeliveryFees = updateBranchesWithDeliveryFees;
}
