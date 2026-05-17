import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Grade, CGPAResult, FutureCourse, LetterGrade } from '../types/grade';
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
  /**
   * 批量添加 future courses，按 courseCode/courseName 去重。
   * 返回实际加入的课程（用于调用方统计正确的重修数等）。
   */
  addFutureCourses: (courses: FutureCourse[]) => { added: FutureCourse[]; skipped: number };
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
        return { added: toAdd, skipped };
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
      // v0 → v1: 厦马 4.0 制不再保留 'A+'，把历史持久化数据归一化为 'A'。
      // 注意：grades 改写后 cgpaResult 也可能持有过期值（甚至含 'A+' 分布键），
      // 直接清空触发下游重算，避免出现 NaN/旧 key 不一致。
      migrate: (persisted: unknown, version: number) => {
        const state = (persisted ?? {}) as Partial<GradeState>;
        if (version < 1) {
          if (Array.isArray(state.grades)) {
            const migrated = state.grades.map((g) => {
              const letter: LetterGrade = normalizeLetterGrade(
                g.letterGrade as unknown as string
              );
              return {
                ...g,
                letterGrade: letter,
                gradePoint: GRADE_POINT_MAP[letter],
              };
            });
            // 若有任何成绩被改写，cgpaResult 重算一次保持一致
            const changed = migrated.some(
              (m, i) =>
                state.grades![i].letterGrade !== m.letterGrade ||
                state.grades![i].gradePoint !== m.gradePoint
            );
            state.grades = migrated;
            if (changed) {
              state.cgpaResult = calculateCGPA(migrated);
            }
          } else {
            // 没有 grades 但旧的 cgpaResult 可能仍含 A+ 分布键，置空让下游兜底
            state.cgpaResult = null;
          }
        }
        return state as GradeState;
      },
    }
  )
);
