
// This is a placeholder file for data fetching logic.
// In a real app, you would fetch data from a database or API.
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "./firebase";
export async function getItemData(id: string, type: 'product' | 'material') {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 50));
  const collectionName = type === 'product' ? 'products' : 'materials';
  const q = query(collection(db, collectionName), where("id", "==", id), limit(1));
  try {
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        const data = doc.data();
        return {
            id: data.id,
            name: data.name
        }
    }
    return null;
  } catch(e) {
      console.error("Error fetching item data", e);
      return null;
  }
}
export async function getItemsData(ids: string[], type: 'product' | 'material') {
  await new Promise(resolve => setTimeout(resolve, 100));
  const results = await Promise.all(ids.map(id => getItemData(id, type)));
  return results.filter((item): item is { id: string; name: string } => item !== null);
}
