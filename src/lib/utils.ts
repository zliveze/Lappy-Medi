import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateBMI(weight: number, height: number): number {
  if (height <= 0 || weight <= 0) return 0;
  const bmi = weight / (height * height);
  return Math.round(bmi * 100) / 100;
}

export function getPhysiqueFromBMI(bmi: number): { text: string; color: string } {
  if (bmi < 18) {
    return { text: 'Thiếu cân', color: 'text-yellow-600' };
  } else if (bmi <= 25) {
    return { text: 'Bình thường', color: 'text-green-600' };
  } else {
    return { text: 'Thừa cân', color: 'text-orange-600' };
  }
}
