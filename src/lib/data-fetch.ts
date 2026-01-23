import { supabase } from "./supabase";

export async function getItemData(id: string, type: 'product' | 'material') {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 50));
  const tableName = type === 'product' ? 'products' : 'materials';

  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('id, name')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      return {
        id: data.id,
        name: data.name
      }
    }
    return null;
  } catch (e) {
    console.error(`Error fetching ${type} data`, e);
    return null;
  }
}

export async function getItemsData(ids: string[], type: 'product' | 'material') {
  await new Promise(resolve => setTimeout(resolve, 100));
  const results = await Promise.all(ids.map(id => getItemData(id, type)));
  return results.filter((item): item is { id: string; name: string } => item !== null);
}
