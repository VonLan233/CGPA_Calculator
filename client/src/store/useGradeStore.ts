import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Grade, CGPAResult, FutureCourse } from '../types/grade';
import { calculateCGPA } from '../utils/cgpaCalculator';

interface GradeState {
  // 成绩数据
  grades: Grade[];
  cgpaResult: CGPAResult | null;

  // 规划数据
  targetCGPA: number;
  futureCourses: FutureCourse[];

  // Actions
  addGrade: (grade: Grade) => void;
  addGrades: (grades: Grade[]) => void;
  updateGrade: (id: string, updates: Partial<Grade>) => void;
  removeGrade: (id: string) => void;
  clearAllGrades: () => void;

  setTargetCGPA: (cgpa: number) => void;
  addFutureCourse: (course: FutureCourse) => void;
  removeFutureCourse: (id: string) => void;
  clearFutureCourses: () => void;

  recalculateCGPA: () => void;
}

export const useGradeStore = create<GradeState>()(
  persist(
    (set, get) => ({
      grades: [],
      cgpaResult: null,
      targetCGPA: 3.5,
      futureCourses: [],

      addGrade: (grade) => {
        set((state) => ({ grades: [...state.grades, grade] }));
        get().recalculateCGPA();
      },

      addGrades: (newGrades) => {
        set((state) => ({ grades: [...state.grades, ...newGrades] }));
        get().recalculateCGPA();
      },

      updateGrade: (id, updates) => {
        set((state) => ({
          grades: state.grades.map((g) =>
            g.id === id ? { ...g, ...updates } : g
          ),
        }));
        get().recalculateCGPA();
      },

      removeGrade: (id) => {
        set((state) => ({
          grades: state.grades.filter((g) => g.id !== id),
        }));
        get().recalculateCGPA();
      },

      clearAllGrades: () => {
        set({ grades: [], cgpaResult: null });
      },

      setTargetCGPA: (cgpa) => {
        set({ targetCGPA: cgpa });
      },

      addFutureCourse: (course) => {
        set((state) => ({ futureCourses: [...state.futureCourses, course] }));
      },

      removeFutureCourse: (id) => {
        set((state) => ({
          futureCourses: state.futureCourses.filter((c) => c.id !== id),
        }));
      },

      clearFutureCourses: () => {
        set({ futureCourses: [] });
      },

      recalculateCGPA: () => {
        const { grades } = get();
        const result = calculateCGPA(grades);
        set({ cgpaResult: result });
      },
    }),
    {
      name: 'cgpa-calculator-storage',
    }
  )
);
