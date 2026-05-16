import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Grade, CGPAResult, FutureCourse } from '../types/grade';
import { GRADE_POINT_MAP, normalizeLetterGrade } from '../types/grade';
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
  addFutureCourses: (courses: FutureCourse[]) => { added: number; skipped: number };
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

      addFutureCourses: (courses) => {
        const existing = get().futureCourses;
        // 按 courseCode 去重（无 code 时按课程名）
        const seen = new Set(
          existing.map((c) => c.courseCode || c.courseName)
        );
        const toAdd: FutureCourse[] = [];
        let skipped = 0;
        for (const c of courses) {
          const key = c.courseCode || c.courseName;
          if (seen.has(key)) {
            skipped++;
            continue;
          }
          seen.add(key);
          toAdd.push(c);
        }
        if (toAdd.length > 0) {
          set((state) => ({ futureCourses: [...state.futureCourses, ...toAdd] }));
        }
        return { added: toAdd.length, skipped };
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
      version: 1,
      // v0 → v1: 厦马 4.0 制不再保留 'A+'，把历史持久化数据归一化为 'A'
      migrate: (persisted: unknown, version: number) => {
        const state = (persisted ?? {}) as Partial<GradeState>;
        if (version < 1 && Array.isArray(state.grades)) {
          state.grades = state.grades.map((g) => {
            const letter = normalizeLetterGrade(g.letterGrade as unknown as string);
            return {
              ...g,
              letterGrade: letter,
              gradePoint: GRADE_POINT_MAP[letter],
            };
          });
        }
        return state as GradeState;
      },
    }
  )
);
