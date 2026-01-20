
"use client";
import { Barcode } from "@/components/barcode";
export interface LabelItemData {
  id: string;
  name: string;
}
interface LabelItemProps {
  item: LabelItemData;
}
export function LabelItem({ item }: LabelItemProps) {
  return (
    <div className="bg-white p-2 flex flex-col items-center justify-center text-center h-[33.8mm]">
       <div className="flex justify-center w-full">
         <Barcode 
          value={item.id} 
          options={{
            format: "CODE39",
            displayValue: false,
            width: 2,
            height: 60,
            margin: 10
          }} 
        />
      </div>
      <p className="text-xs font-semibold mt-2">{item.id}</p>
      <p className="text-sm font-bold">{item.name}</p>
    </div>
  );
}
