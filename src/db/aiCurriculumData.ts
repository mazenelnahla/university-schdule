import type { Database } from 'sql.js';

export interface AiCurriculumCourseDef {
  code: string;
  name: string;
  creditHours: number;
  department: string;
  yearId: number; // 5 = YEAR_PREP, 1 = YEAR_1, 2 = YEAR_2, 3 = YEAR_3, 4 = YEAR_4
  semester: number; // 1 or 2
  levelName: string;
  colorHex: string;
  prerequisiteCodes: string[];
  targetGroup?: 'ALL' | 'GROUP_A' | 'GROUP_B'; // For Preparatory Year: Group A vs Group B
}

export const AI_CURRICULUM_COURSES: AiCurriculumCourseDef[] = [
  // -------------------------------------------------------------
  // LEVEL 0 (Preparatory Year) - Semester 1 (YEAR_PREP / id: 5)
  // -------------------------------------------------------------
  {
    code: 'BSC 011',
    name: 'Mathematics I',
    creditHours: 3,
    department: 'Basic Sciences',
    yearId: 5,
    semester: 1,
    levelName: 'Level 0',
    colorHex: '#8b5cf6',
    prerequisiteCodes: [],
  },
  {
    code: 'BSC 031',
    name: 'Physics I',
    creditHours: 3,
    department: 'Basic Sciences',
    yearId: 5,
    semester: 1,
    levelName: 'Level 0',
    colorHex: '#06b6d4',
    prerequisiteCodes: [],
  },
  {
    code: 'BSC 021',
    name: 'Mechanics I',
    creditHours: 3,
    department: 'Basic Sciences',
    yearId: 5,
    semester: 1,
    levelName: 'Level 0',
    colorHex: '#d97706',
    prerequisiteCodes: [],
  },
  {
    code: 'BSC 041',
    name: 'Chemical Engineering',
    creditHours: 3,
    department: 'Basic Sciences',
    yearId: 5,
    semester: 1,
    levelName: 'Level 0',
    colorHex: '#d97706',
    prerequisiteCodes: [],
    targetGroup: 'GROUP_A',
  },
  {
    code: 'PRD 031',
    name: 'Engineering Drawing and Projection',
    creditHours: 3,
    department: 'Production Engineering',
    yearId: 5,
    semester: 1,
    levelName: 'Level 0',
    colorHex: '#d97706',
    prerequisiteCodes: [],
    targetGroup: 'GROUP_A',
  },
  {
    code: 'GUR 0C1',
    name: 'University Requirement (1)',
    creditHours: 1,
    department: 'General University Requirements',
    yearId: 5,
    semester: 1,
    levelName: 'Level 0',
    colorHex: '#64748b',
    prerequisiteCodes: [],
  },

  // -------------------------------------------------------------
  // LEVEL 0 (Preparatory Year) - Semester 2 (YEAR_PREP / id: 5)
  // -------------------------------------------------------------
  {
    code: 'BSC 012',
    name: 'Mathematics II',
    creditHours: 3,
    department: 'Basic Sciences',
    yearId: 5,
    semester: 2,
    levelName: 'Level 0',
    colorHex: '#8b5cf6',
    prerequisiteCodes: ['BSC 011'],
  },
  {
    code: 'BSC 032',
    name: 'Physics II',
    creditHours: 3,
    department: 'Basic Sciences',
    yearId: 5,
    semester: 2,
    levelName: 'Level 0',
    colorHex: '#06b6d4',
    prerequisiteCodes: ['BSC 031'],
  },
  {
    code: 'BSC 022',
    name: 'Mechanics II',
    creditHours: 3,
    department: 'Basic Sciences',
    yearId: 5,
    semester: 2,
    levelName: 'Level 0',
    colorHex: '#d97706',
    prerequisiteCodes: ['BSC 021'],
  },
  {
    code: 'PRD 041',
    name: 'Production Technology',
    creditHours: 3,
    department: 'Production Engineering',
    yearId: 5,
    semester: 2,
    levelName: 'Level 0',
    colorHex: '#d97706',
    prerequisiteCodes: [],
    targetGroup: 'GROUP_B',
  },
  {
    code: 'CCE 031',
    name: 'Introduction to Computer Science',
    creditHours: 3,
    department: 'Artificial Intelligence & Computer Engineering',
    yearId: 5,
    semester: 2,
    levelName: 'Level 0',
    colorHex: '#10b981',
    prerequisiteCodes: [],
    targetGroup: 'GROUP_B',
  },
  {
    code: 'GUR 0C2',
    name: 'University Requirement (2)',
    creditHours: 2,
    department: 'General University Requirements',
    yearId: 5,
    semester: 2,
    levelName: 'Level 0',
    colorHex: '#64748b',
    prerequisiteCodes: [],
  },

  // -------------------------------------------------------------
  // LEVEL 1 (Freshman) - Semester 1 (YEAR_1 / id: 1)
  // -------------------------------------------------------------
  {
    code: 'EPM 113',
    name: 'Electromagnetic Fields',
    creditHours: 3,
    department: 'Electrical Engineering',
    yearId: 1,
    semester: 1,
    levelName: 'Level 1',
    colorHex: '#06b6d4',
    prerequisiteCodes: ['BSC 012'],
  },
  {
    code: 'EPM 116',
    name: 'Electrical Circuits & Measurements 1',
    creditHours: 3,
    department: 'Electrical Engineering',
    yearId: 1,
    semester: 1,
    levelName: 'Level 1',
    colorHex: '#f59e0b',
    prerequisiteCodes: [],
  },
  {
    code: 'CCE 141',
    name: 'Logic Design 1',
    creditHours: 3,
    department: 'Artificial Intelligence & Computer Engineering',
    yearId: 1,
    semester: 1,
    levelName: 'Level 1',
    colorHex: '#6366f1',
    prerequisiteCodes: [],
  },
  {
    code: 'CCE 111',
    name: 'Computer Programming 1',
    creditHours: 3,
    department: 'Artificial Intelligence & Computer Engineering',
    yearId: 1,
    semester: 1,
    levelName: 'Level 1',
    colorHex: '#10b981',
    prerequisiteCodes: [],
  },
  {
    code: 'BSC 111',
    name: 'Mathematics III',
    creditHours: 3,
    department: 'Basic Sciences',
    yearId: 1,
    semester: 1,
    levelName: 'Level 1',
    colorHex: '#8b5cf6',
    prerequisiteCodes: ['BSC 012'],
  },
  {
    code: 'GUR 1C1',
    name: 'University Requirement (3)',
    creditHours: 2,
    department: 'General University Requirements',
    yearId: 1,
    semester: 1,
    levelName: 'Level 1',
    colorHex: '#64748b',
    prerequisiteCodes: [],
  },

  // -------------------------------------------------------------
  // LEVEL 1 (Freshman) - Semester 2 (YEAR_1 / id: 1)
  // -------------------------------------------------------------
  {
    code: 'BSC 112',
    name: 'Statistics & Numerical Analysis',
    creditHours: 3,
    department: 'Basic Sciences',
    yearId: 1,
    semester: 2,
    levelName: 'Level 1',
    colorHex: '#8b5cf6',
    prerequisiteCodes: ['BSC 012'],
  },
  {
    code: 'EPM 117',
    name: 'Electrical Circuits & Measurements 2',
    creditHours: 3,
    department: 'Electrical Engineering',
    yearId: 1,
    semester: 2,
    levelName: 'Level 1',
    colorHex: '#f59e0b',
    prerequisiteCodes: ['EPM 116'],
  },
  {
    code: 'CCE 142',
    name: 'Logic Design 2',
    creditHours: 3,
    department: 'Artificial Intelligence & Computer Engineering',
    yearId: 1,
    semester: 2,
    levelName: 'Level 1',
    colorHex: '#6366f1',
    prerequisiteCodes: ['CCE 141'],
  },
  {
    code: 'CCE 112',
    name: 'Computer Programming 2',
    creditHours: 3,
    department: 'Artificial Intelligence & Computer Engineering',
    yearId: 1,
    semester: 2,
    levelName: 'Level 1',
    colorHex: '#10b981',
    prerequisiteCodes: ['CCE 111'],
  },
  {
    code: 'CCE 131',
    name: 'Mathematics for Machine Learning',
    creditHours: 3,
    department: 'Artificial Intelligence & Computer Engineering',
    yearId: 1,
    semester: 2,
    levelName: 'Level 1',
    colorHex: '#84cc16',
    prerequisiteCodes: [],
  },
  {
    code: 'GUR 1C2',
    name: 'University Requirement (4)',
    creditHours: 2,
    department: 'General University Requirements',
    yearId: 1,
    semester: 2,
    levelName: 'Level 1',
    colorHex: '#64748b',
    prerequisiteCodes: [],
  },

  // -------------------------------------------------------------
  // LEVEL 2 (Sophomore) - Semester 1 (YEAR_2 / id: 2)
  // -------------------------------------------------------------
  {
    code: 'EPM 213',
    name: 'Electronics & Digital Circuits',
    creditHours: 3,
    department: 'Electrical Engineering',
    yearId: 2,
    semester: 1,
    levelName: 'Level 2',
    colorHex: '#f59e0b',
    prerequisiteCodes: [],
  },
  {
    code: 'CCE 221',
    name: 'Control Systems Engineering 1',
    creditHours: 3,
    department: 'Artificial Intelligence & Computer Engineering',
    yearId: 2,
    semester: 1,
    levelName: 'Level 2',
    colorHex: '#ef4444',
    prerequisiteCodes: [],
  },
  {
    code: 'CCE 231',
    name: 'Machine Learning 1',
    creditHours: 3,
    department: 'Artificial Intelligence & Computer Engineering',
    yearId: 2,
    semester: 1,
    levelName: 'Level 2',
    colorHex: '#84cc16',
    prerequisiteCodes: ['CCE 112', 'CCE 131'],
  },
  {
    code: 'CCE 211',
    name: 'Data Structures & Algorithms',
    creditHours: 3,
    department: 'Artificial Intelligence & Computer Engineering',
    yearId: 2,
    semester: 1,
    levelName: 'Level 2',
    colorHex: '#10b981',
    prerequisiteCodes: ['CCE 112'],
  },
  {
    code: 'GUR2C1',
    name: 'University Requirement (5)',
    creditHours: 2,
    department: 'General University Requirements',
    yearId: 2,
    semester: 1,
    levelName: 'Level 2',
    colorHex: '#64748b',
    prerequisiteCodes: [],
  },
  {
    code: 'GUR2E1',
    name: 'Elective University (1)',
    creditHours: 2,
    department: 'General University Requirements',
    yearId: 2,
    semester: 1,
    levelName: 'Level 2',
    colorHex: '#64748b',
    prerequisiteCodes: [],
  },

  // -------------------------------------------------------------
  // LEVEL 2 (Sophomore) - Semester 2 (YEAR_2 / id: 2)
  // -------------------------------------------------------------
  {
    code: 'CCE 241',
    name: 'Computer Architecture & Organization',
    creditHours: 3,
    department: 'Artificial Intelligence & Computer Engineering',
    yearId: 2,
    semester: 2,
    levelName: 'Level 2',
    colorHex: '#6366f1',
    prerequisiteCodes: ['CCE 142'],
  },
  {
    code: 'CCE 222',
    name: 'Control Systems Engineering 2',
    creditHours: 3,
    department: 'Artificial Intelligence & Computer Engineering',
    yearId: 2,
    semester: 2,
    levelName: 'Level 2',
    colorHex: '#ef4444',
    prerequisiteCodes: ['CCE 221'],
  },
  {
    code: 'CCE 232',
    name: 'Machine Learning 2',
    creditHours: 3,
    department: 'Artificial Intelligence & Computer Engineering',
    yearId: 2,
    semester: 2,
    levelName: 'Level 2',
    colorHex: '#84cc16',
    prerequisiteCodes: ['CCE 231'],
  },
  {
    code: 'CCE 242',
    name: 'Digital Signal Processing',
    creditHours: 3,
    department: 'Artificial Intelligence & Computer Engineering',
    yearId: 2,
    semester: 2,
    levelName: 'Level 2',
    colorHex: '#6366f1',
    prerequisiteCodes: [],
  },
  {
    code: 'CCE 212',
    name: 'Database Systems',
    creditHours: 3,
    department: 'Artificial Intelligence & Computer Engineering',
    yearId: 2,
    semester: 2,
    levelName: 'Level 2',
    colorHex: '#6366f1',
    prerequisiteCodes: ['CCE 211'],
  },
  {
    code: 'GUR 2E2',
    name: 'Elective University (2)',
    creditHours: 2,
    department: 'General University Requirements',
    yearId: 2,
    semester: 2,
    levelName: 'Level 2',
    colorHex: '#64748b',
    prerequisiteCodes: [],
  },

  // -------------------------------------------------------------
  // LEVEL 3 (Junior) - Semester 1 (YEAR_3 / id: 3)
  // -------------------------------------------------------------
  {
    code: 'CCE 311',
    name: 'Operating Systems',
    creditHours: 3,
    department: 'Artificial Intelligence & Computer Engineering',
    yearId: 3,
    semester: 1,
    levelName: 'Level 3',
    colorHex: '#6366f1',
    prerequisiteCodes: ['CCE 241'],
  },
  {
    code: 'CCE 321',
    name: 'Embedded Systems',
    creditHours: 3,
    department: 'Artificial Intelligence & Computer Engineering',
    yearId: 3,
    semester: 1,
    levelName: 'Level 3',
    colorHex: '#6366f1',
    prerequisiteCodes: ['CCE 222', 'CCE 242'],
  },
  {
    code: 'CCE 351',
    name: 'Computer Networks',
    creditHours: 2,
    department: 'Artificial Intelligence & Computer Engineering',
    yearId: 3,
    semester: 1,
    levelName: 'Level 3',
    colorHex: '#0ea5e9',
    prerequisiteCodes: [],
  },
  {
    code: 'CCE 312',
    name: 'Parallel Processing',
    creditHours: 3,
    department: 'Artificial Intelligence & Computer Engineering',
    yearId: 3,
    semester: 1,
    levelName: 'Level 3',
    colorHex: '#6366f1',
    prerequisiteCodes: ['CCE 241'],
  },
  {
    code: 'EPM 3EX',
    name: 'Elective Course (1)',
    creditHours: 2,
    department: 'Electrical Engineering',
    yearId: 3,
    semester: 1,
    levelName: 'Level 3',
    colorHex: '#64748b',
    prerequisiteCodes: [],
  },
  {
    code: 'GFR 3E1',
    name: 'Elective Faculty (1)',
    creditHours: 2,
    department: 'General University Requirements',
    yearId: 3,
    semester: 1,
    levelName: 'Level 3',
    colorHex: '#64748b',
    prerequisiteCodes: [],
  },

  // -------------------------------------------------------------
  // LEVEL 3 (Junior) - Semester 2 (YEAR_3 / id: 3)
  // -------------------------------------------------------------
  {
    code: 'CCE 352',
    name: 'Wireless Networks',
    creditHours: 3,
    department: 'Artificial Intelligence & Computer Engineering',
    yearId: 3,
    semester: 2,
    levelName: 'Level 3',
    colorHex: '#0ea5e9',
    prerequisiteCodes: ['CCE 351'],
  },
  {
    code: 'CCE 331',
    name: 'Deep Learning',
    creditHours: 3,
    department: 'Artificial Intelligence & Computer Engineering',
    yearId: 3,
    semester: 2,
    levelName: 'Level 3',
    colorHex: '#84cc16',
    prerequisiteCodes: ['CCE 232'],
  },
  {
    code: 'CCE 332',
    name: 'Image Processing & Computer Vision',
    creditHours: 3,
    department: 'Artificial Intelligence & Computer Engineering',
    yearId: 3,
    semester: 2,
    levelName: 'Level 3',
    colorHex: '#84cc16',
    prerequisiteCodes: ['CCE 242'],
  },
  {
    code: 'CCE 333',
    name: 'GPU Architecture & Programming',
    creditHours: 3,
    department: 'Artificial Intelligence & Computer Engineering',
    yearId: 3,
    semester: 2,
    levelName: 'Level 3',
    colorHex: '#6366f1',
    prerequisiteCodes: ['CCE 312'],
  },
  {
    code: 'CCE 3EX',
    name: 'Elective Course (2)',
    creditHours: 2,
    department: 'Artificial Intelligence & Computer Engineering',
    yearId: 3,
    semester: 2,
    levelName: 'Level 3',
    colorHex: '#64748b',
    prerequisiteCodes: [],
  },
  {
    code: 'GFR 3EX',
    name: 'Elective Faculty (2)',
    creditHours: 2,
    department: 'General University Requirements',
    yearId: 3,
    semester: 2,
    levelName: 'Level 3',
    colorHex: '#64748b',
    prerequisiteCodes: [],
  },

  // -------------------------------------------------------------
  // LEVEL 4 (Senior) - Semester 1 (YEAR_4 / id: 4)
  // -------------------------------------------------------------
  {
    code: 'CCE 431',
    name: 'Robotics Design',
    creditHours: 3,
    department: 'Artificial Intelligence & Computer Engineering',
    yearId: 4,
    semester: 1,
    levelName: 'Level 4',
    colorHex: '#ef4444',
    prerequisiteCodes: ['CCE 222'],
  },
  {
    code: 'CCE 432',
    name: 'Meta-Heuristic Algorithms',
    creditHours: 3,
    department: 'Artificial Intelligence & Computer Engineering',
    yearId: 4,
    semester: 1,
    levelName: 'Level 4',
    colorHex: '#84cc16',
    prerequisiteCodes: [],
  },
  {
    code: 'CCE 433',
    name: 'Graduation Project 1',
    creditHours: 4,
    department: 'Artificial Intelligence & Computer Engineering',
    yearId: 4,
    semester: 1,
    levelName: 'Level 4',
    colorHex: '#ec4899',
    prerequisiteCodes: [],
  },
  {
    code: 'CCE 4EX-3',
    name: 'Elective Course (3)',
    creditHours: 3,
    department: 'Artificial Intelligence & Computer Engineering',
    yearId: 4,
    semester: 1,
    levelName: 'Level 4',
    colorHex: '#64748b',
    prerequisiteCodes: [],
  },
  {
    code: 'CCE 4EX-4',
    name: 'Elective Course (4)',
    creditHours: 3,
    department: 'Artificial Intelligence & Computer Engineering',
    yearId: 4,
    semester: 1,
    levelName: 'Level 4',
    colorHex: '#64748b',
    prerequisiteCodes: [],
  },

  // -------------------------------------------------------------
  // LEVEL 4 (Senior) - Semester 2 (YEAR_4 / id: 4)
  // -------------------------------------------------------------
  {
    code: 'CCE 434',
    name: 'Modeling & Simulation',
    creditHours: 3,
    department: 'Artificial Intelligence & Computer Engineering',
    yearId: 4,
    semester: 2,
    levelName: 'Level 4',
    colorHex: '#6366f1',
    prerequisiteCodes: [],
  },
  {
    code: 'CCE 435',
    name: 'Data Mining',
    creditHours: 3,
    department: 'Artificial Intelligence & Computer Engineering',
    yearId: 4,
    semester: 2,
    levelName: 'Level 4',
    colorHex: '#84cc16',
    prerequisiteCodes: ['CCE 232'],
  },
  {
    code: 'CCE 436',
    name: 'Graduation Project 2',
    creditHours: 4,
    department: 'Artificial Intelligence & Computer Engineering',
    yearId: 4,
    semester: 2,
    levelName: 'Level 4',
    colorHex: '#ec4899',
    prerequisiteCodes: [],
  },
  {
    code: 'CCE 4EX-5',
    name: 'Elective Course (5)',
    creditHours: 3,
    department: 'Artificial Intelligence & Computer Engineering',
    yearId: 4,
    semester: 2,
    levelName: 'Level 4',
    colorHex: '#64748b',
    prerequisiteCodes: [],
  },
  {
    code: 'CCE 4EX-6',
    name: 'Elective Course (6)',
    creditHours: 3,
    department: 'Artificial Intelligence & Computer Engineering',
    yearId: 4,
    semester: 2,
    levelName: 'Level 4',
    colorHex: '#64748b',
    prerequisiteCodes: [],
  },
];

/**
 * Seeds or synchronizes the AI curriculum into the provided SQLite database.
 * Ensures the 'AI' degree program exists, inserts all 58 courses,
 * and sets up all 26 prerequisite dependency linkages in `courses.prerequisite_ids`
 * and `course_dependencies`.
 */
export function seedAiCurriculum(db: Database): {
  insertedCount: number;
  updatedCount: number;
  prereqsLinked: number;
} {
  // 1. Ensure the AI program exists in the programs table
  let aiProgramId: number | null = null;
  const progRes = db.exec("SELECT id FROM programs WHERE code = 'AI' OR code LIKE '%AI%' LIMIT 1;");
  if (progRes.length > 0 && progRes[0].values.length > 0) {
    aiProgramId = Number(progRes[0].values[0][0]);
  } else {
    db.run(`
      INSERT INTO programs (code, name, department)
      VALUES ('AI', 'Artificial Intelligence & Data Science', 'Department of Computer & Control Engineering');
    `);
    const newProgRes = db.exec('SELECT last_insert_rowid() AS id;');
    if (newProgRes.length > 0 && newProgRes[0].values.length > 0) {
      aiProgramId = Number(newProgRes[0].values[0][0]);
    }
  }

  let insertedCount = 0;
  let updatedCount = 0;

  // 2. Insert or update all 58 courses
  for (const c of AI_CURRICULUM_COURSES) {
    // Level 0 (Prep Year) courses are common foundation courses, so program_id can be null or aiProgramId.
    // For specialized years (Level 1..4), assign to the AI program.
    const progId = c.yearId === 5 ? null : aiProgramId;

    const targetGroup = c.targetGroup || 'ALL';

    const existingRes = db.exec(`SELECT id FROM courses WHERE code = '${c.code}';`);
    if (existingRes.length === 0 || existingRes[0].values.length === 0) {
      // Insert new course
      const stmt = db.prepare(`
        INSERT INTO courses (code, name, credit_hours, department, year_id, program_id, color_hex, prerequisite_ids, semester, target_group)
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?);
      `);
      stmt.run([c.code, c.name, c.creditHours, c.department, c.yearId, progId, c.colorHex, c.semester, targetGroup]);
      stmt.free();
      insertedCount++;
    } else {
      // Update existing course to match official template details
      const courseId = Number(existingRes[0].values[0][0]);
      const stmt = db.prepare(`
        UPDATE courses SET
          name = ?,
          credit_hours = ?,
          department = ?,
          year_id = ?,
          program_id = COALESCE(program_id, ?),
          color_hex = ?,
          semester = ?,
          target_group = ?
        WHERE id = ?;
      `);
      stmt.run([c.name, c.creditHours, c.department, c.yearId, progId, c.colorHex, c.semester, targetGroup, courseId]);
      stmt.free();
      updatedCount++;
    }
  }

  // 3. Build a fast lookup map: course code -> database course ID
  const allCoursesRes = db.exec('SELECT id, code FROM courses;');
  const codeToIdMap = new Map<string, number>();
  if (allCoursesRes.length > 0 && allCoursesRes[0].values) {
    for (const row of allCoursesRes[0].values) {
      const id = Number(row[0]);
      const code = String(row[1]);
      codeToIdMap.set(code, id);
    }
  }

  // 4. Link all 26 prerequisite dependencies
  let prereqsLinked = 0;
  for (const c of AI_CURRICULUM_COURSES) {
    if (!c.prerequisiteCodes || c.prerequisiteCodes.length === 0) continue;

    const courseId = codeToIdMap.get(c.code);
    if (!courseId) continue;

    const prereqIds: number[] = [];
    for (const pCode of c.prerequisiteCodes) {
      const pid = codeToIdMap.get(pCode);
      if (pid !== undefined) {
        prereqIds.push(pid);
        // Insert into course_dependencies table
        db.run(`INSERT OR IGNORE INTO course_dependencies (course_id, prerequisite_id) VALUES (${courseId}, ${pid});`);
        prereqsLinked++;
      }
    }

    if (prereqIds.length > 0) {
      const prereqsJson = JSON.stringify(prereqIds);
      const stmt = db.prepare('UPDATE courses SET prerequisite_ids = ? WHERE id = ?;');
      stmt.run([prereqsJson, courseId]);
      stmt.free();
    }
  }

  console.log(`AI Curriculum sync completed: ${insertedCount} inserted, ${updatedCount} updated, ${prereqsLinked} prerequisites linked.`);
  return { insertedCount, updatedCount, prereqsLinked };
}
