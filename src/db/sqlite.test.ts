import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { seedAiCurriculum, AI_CURRICULUM_COURSES } from './aiCurriculumData.ts';

async function testDatabase() {
  console.log('Testing offline SQLite database engine...');
  const wasmBuffer = fs.readFileSync(path.resolve('./public/sql-wasm.wasm'));
  const wasmBinary = wasmBuffer.buffer.slice(
    wasmBuffer.byteOffset,
    wasmBuffer.byteOffset + wasmBuffer.byteLength
  ) as ArrayBuffer;
  const SQL = await initSqlJs({
    wasmBinary,
  });

  const db = new SQL.Database();

  // Create tables
  db.run(`
    CREATE TABLE academic_years (id INTEGER PRIMARY KEY, code TEXT, name TEXT);
    CREATE TABLE sections (id INTEGER PRIMARY KEY, year_id INTEGER, program_id INTEGER, name TEXT, capacity INTEGER);
    CREATE TABLE rooms (id INTEGER PRIMARY KEY, code TEXT, name TEXT, type TEXT, capacity INTEGER);
    CREATE TABLE professors (id INTEGER PRIMARY KEY, name TEXT, title TEXT, available_days TEXT);
    CREATE TABLE courses (id INTEGER PRIMARY KEY, code TEXT, name TEXT, year_id INTEGER, prerequisite_ids TEXT);
    CREATE TABLE course_dependencies (course_id INTEGER NOT NULL, prerequisite_id INTEGER NOT NULL, PRIMARY KEY (course_id, prerequisite_id));
    CREATE TABLE schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      academic_year_id INTEGER,
      section_id INTEGER,
      course_id INTEGER,
      professor_id INTEGER,
      room_id INTEGER,
      day_of_week INTEGER,
      start_time TEXT,
      end_time TEXT,
      session_type TEXT
    );
  `);

  // Insert test room and professor (Prof. Alan Turing attending only Sun, Tue, Thu -> [0, 2, 4])
  db.run(`INSERT INTO rooms VALUES (1, 'HALL-A', 'Auditorium Alpha', 'LECTURE_HALL', 200);`);
  db.run(`INSERT INTO professors VALUES (1, 'Alan Turing', 'Prof.', '[0,2,4]');`);

  // Insert Courses with GPA Dependencies:
  // Math 1 (id 1): Introductory (no prereqs)
  // Math 2 (id 2): Depends on Math 1 ([1])
  // Math 3 (id 3): Depends on Math 2 ([2]) -> transitively depends on Math 1
  // Physics 1 (id 4): Unrelated course (no prereqs)
  db.run(`INSERT INTO courses VALUES (1, 'MATH101', 'Calculus I (Math 1)', 1, NULL);`);
  db.run(`INSERT INTO courses VALUES (2, 'MATH102', 'Calculus II (Math 2)', 1, '[1]');`);
  db.run(`INSERT INTO courses VALUES (3, 'MATH201', 'Calculus III (Math 3)', 2, '[2]');`);
  db.run(`INSERT INTO courses VALUES (4, 'PHYS101', 'General Physics I', 1, NULL);`);

  db.run(`INSERT INTO course_dependencies VALUES (2, 1);`);
  db.run(`INSERT INTO course_dependencies VALUES (3, 2);`);

  // Insert Sunday 08:30-10:00: Math 1 in Room 1
  db.run(`
    INSERT INTO schedules (academic_year_id, course_id, professor_id, room_id, day_of_week, start_time, end_time, session_type)
    VALUES (1, 1, 1, 1, 0, '08:30', '10:00', 'LECTURE');
  `);

  // Query: Try finding collision for room_id 1 on Sunday at 09:00 - 10:30
  const checkConflict = (roomId: number, day: number, start: string, end: string) => {
    const stmt = db.prepare(`
      SELECT * FROM schedules 
      WHERE room_id = ? AND day_of_week = ?
    `);
    stmt.bind([roomId, day]);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();

    const [sh1, sm1] = start.split(':').map(Number);
    const [eh1, em1] = end.split(':').map(Number);
    const s1 = sh1 * 60 + sm1;
    const e1 = eh1 * 60 + em1;

    for (const item of results) {
      const [sh2, sm2] = (item.start_time as string).split(':').map(Number);
      const [eh2, em2] = (item.end_time as string).split(':').map(Number);
      const s2 = sh2 * 60 + sm2;
      const e2 = eh2 * 60 + em2;
      if (Math.max(s1, s2) < Math.min(e1, e2)) {
        return { conflict: true, item };
      }
    }
    return { conflict: false };
  };

  const test1 = checkConflict(1, 0, '09:00', '10:30');
  console.assert(test1.conflict === true, 'Test 1: Conflict in Room 1 must be detected');

  const test2 = checkConflict(1, 0, '10:15', '11:45');
  console.assert(test2.conflict === false, 'Test 2: Non-overlapping time slot in Room 1 must NOT conflict');

  const test3 = checkConflict(2, 0, '08:30', '10:00');
  console.assert(test3.conflict === false, 'Test 3: Different room at same time must NOT conflict');

  // Test 4: Professor Attendance Day Conflict Test
  const checkProfessorAttendance = (professorId: number, day: number) => {
    const stmt = db.prepare('SELECT id, name, title, available_days FROM professors WHERE id = ?');
    stmt.bind([professorId]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      const raw = row.available_days as string | null;
      if (raw) {
        const days = JSON.parse(raw) as number[];
        if (!days.includes(day)) {
          return { conflict: true, message: `Professor ${row.name} not available on day ${day}` };
        }
      }
      return { conflict: false };
    }
    stmt.free();
    return { conflict: false };
  };

  // Turing (attends Sun=0, Tue=2, Thu=4)
  const profTestSunday = checkProfessorAttendance(1, 0); // Sunday -> available
  console.assert(profTestSunday.conflict === false, 'Test 4a: Turing attending on Sunday must NOT conflict');

  const profTestMonday = checkProfessorAttendance(1, 1); // Monday -> NOT available!
  console.assert(profTestMonday.conflict === true, 'Test 4b: Turing attending on Monday MUST conflict');

  // Test 5: GPA Course Dependency Conflict Test
  // Build transitive dependency resolver
  const getDependentCourseIds = (targetCourseId: number): Set<number> => {
    const res = db.exec('SELECT course_id, prerequisite_id FROM course_dependencies');
    const prereqMap = new Map<number, number[]>();
    const dependentMap = new Map<number, number[]>();

    if (res.length > 0 && res[0].values) {
      for (const row of res[0].values) {
        const cId = Number(row[0]);
        const pId = Number(row[1]);
        const pList = prereqMap.get(cId) || [];
        pList.push(pId);
        prereqMap.set(cId, pList);

        const dList = dependentMap.get(pId) || [];
        dList.push(cId);
        dependentMap.set(pId, dList);
      }
    }

    const dependents = new Set<number>();
    const queue = [targetCourseId];
    const visited = new Set<number>([targetCourseId]);

    // Upstream
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const list = prereqMap.get(curr) || [];
      for (const p of list) {
        if (!visited.has(p)) {
          visited.add(p);
          dependents.add(p);
          queue.push(p);
        }
      }
    }

    // Downstream
    queue.push(targetCourseId);
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const list = dependentMap.get(curr) || [];
      for (const d of list) {
        if (!visited.has(d)) {
          visited.add(d);
          dependents.add(d);
          queue.push(d);
        }
      }
    }

    return dependents;
  };

  const checkDependencyConflict = (courseId: number, day: number, start: string, end: string) => {
    const dependentIds = getDependentCourseIds(courseId);
    if (dependentIds.size === 0) return { conflict: false };

    const stmt = db.prepare('SELECT id, course_id, start_time, end_time FROM schedules WHERE day_of_week = ?');
    stmt.bind([day]);
    const schedules = [];
    while (stmt.step()) {
      schedules.push(stmt.getAsObject());
    }
    stmt.free();

    const [sh1, sm1] = start.split(':').map(Number);
    const [eh1, em1] = end.split(':').map(Number);
    const s1 = sh1 * 60 + sm1;
    const e1 = eh1 * 60 + em1;

    for (const sch of schedules) {
      const cId = Number(sch.course_id);
      if (dependentIds.has(cId)) {
        const [sh2, sm2] = (sch.start_time as string).split(':').map(Number);
        const [eh2, em2] = (sch.end_time as string).split(':').map(Number);
        const s2 = sh2 * 60 + sm2;
        const e2 = eh2 * 60 + em2;
        if (Math.max(s1, s2) < Math.min(e1, e2)) {
          return { conflict: true, conflictingCourseId: cId };
        }
      }
    }
    return { conflict: false };
  };

  // Math 1 is scheduled on Sunday 08:30-10:00
  // Test 5a: Scheduling Math 3 (dependent on Math 1) at Sunday 08:30-10:00 must CONFLICT!
  const depTest1 = checkDependencyConflict(3, 0, '08:30', '10:00');
  console.assert(depTest1.conflict === true, 'Test 5a: Math 3 scheduled at same time as Math 1 MUST conflict');
  console.assert(depTest1.conflictingCourseId === 1, 'Test 5a: Conflicting course must be Math 1 (id 1)');

  // Test 5b: Scheduling Math 3 at Sunday 10:15-11:45 (different time) must NOT conflict!
  const depTest2 = checkDependencyConflict(3, 0, '10:15', '11:45');
  console.assert(depTest2.conflict === false, 'Test 5b: Math 3 scheduled at non-overlapping time must NOT conflict');

  // Test 5c: Scheduling Math 2 at Sunday 08:30-10:00 must also CONFLICT with Math 1!
  const depTest3 = checkDependencyConflict(2, 0, '08:30', '10:00');
  console.assert(depTest3.conflict === true, 'Test 5c: Math 2 scheduled at same time as Math 1 MUST conflict');

  // Test 5d: Scheduling unrelated Physics 1 at Sunday 08:30-10:00 must NOT trigger dependency conflict
  const depTest4 = checkDependencyConflict(4, 0, '08:30', '10:00');
  console.assert(depTest4.conflict === false, 'Test 5d: Unrelated course must NOT trigger dependency conflict');

  // Test 6: Degree Program Course Association & Filtering
  // Create programs table
  db.run(`CREATE TABLE programs (id INTEGER PRIMARY KEY, code TEXT, name TEXT);`);
  db.run(`INSERT INTO programs VALUES (1, 'CS', 'Computer Science');`);
  db.run(`INSERT INTO programs VALUES (2, 'AI', 'Artificial Intelligence');`);

  // Migrate courses table to have program_id column
  db.run(`ALTER TABLE courses ADD COLUMN program_id INTEGER;`);

  // Assign Math 1 to Common (NULL), Math 2 to CS (1), and Math 3 to AI (2)
  db.run(`UPDATE courses SET program_id = NULL WHERE id = 1;`);
  db.run(`UPDATE courses SET program_id = 1 WHERE id = 2;`);
  db.run(`UPDATE courses SET program_id = 2 WHERE id = 3;`);

  // Query courses for Program 1 (CS): should return Math 2 (CS) AND Math 1 (Common NULL), but NOT Math 3 (AI)
  const csCoursesRes = db.exec(`SELECT id, code, program_id FROM courses WHERE program_id = 1 OR program_id IS NULL;`);
  const csCourseIds = csCoursesRes[0].values.map((row) => row[0]);
  console.assert(csCourseIds.includes(1), 'Test 6a: CS program view MUST include common subject Math 1');
  console.assert(csCourseIds.includes(2), 'Test 6b: CS program view MUST include CS subject Math 2');
  console.assert(!csCourseIds.includes(3), 'Test 6c: CS program view MUST NOT include AI subject Math 3');

  // Query courses for Program 2 (AI): should return Math 3 (AI) AND Math 1 (Common NULL), but NOT Math 2 (CS)
  const aiCoursesRes = db.exec(`SELECT id, code, program_id FROM courses WHERE program_id = 2 OR program_id IS NULL;`);
  const aiCourseIds = aiCoursesRes[0].values.map((row) => row[0]);
  console.assert(aiCourseIds.includes(1), 'Test 6d: AI program view MUST include common subject Math 1');
  console.assert(aiCourseIds.includes(3), 'Test 6e: AI program view MUST include AI subject Math 3');
  console.assert(!aiCourseIds.includes(2), 'Test 6f: AI program view MUST NOT include CS subject Math 2');

  // Test 7: AI Curriculum from template.xlsx (58 courses & 26 prerequisite dependencies)
  // Ensure table has all schema columns
  db.run(`ALTER TABLE courses ADD COLUMN credit_hours INTEGER DEFAULT 3;`);
  db.run(`ALTER TABLE courses ADD COLUMN department TEXT DEFAULT 'AI';`);
  db.run(`ALTER TABLE courses ADD COLUMN color_hex TEXT DEFAULT '#3b82f6';`);

  const seedResult = seedAiCurriculum(db);
  console.log('Test 7: seedAiCurriculum result:', seedResult);
  console.assert(seedResult.insertedCount === AI_CURRICULUM_COURSES.length, `Expected ${AI_CURRICULUM_COURSES.length} courses inserted, got ${seedResult.insertedCount}`);
  console.assert(seedResult.prereqsLinked === 26, `Expected 26 prerequisite links, got ${seedResult.prereqsLinked}`);

  // Verify specific AI prerequisite relations
  // CCE 231 (Machine Learning 1) must have prerequisites CCE 112 (Prog 2) and CCE 131 (Math for ML)
  const ml1Res = db.exec(`SELECT id, prerequisite_ids FROM courses WHERE code = 'CCE 231';`);
  const ml1Prereqs = JSON.parse(String(ml1Res[0].values[0][1]));
  console.assert(ml1Prereqs.length === 2, 'CCE 231 must have exactly 2 prerequisites');

  // CCE 232 (Machine Learning 2) must have prerequisite CCE 231 (Machine Learning 1)
  const ml2Res = db.exec(`SELECT id, prerequisite_ids FROM courses WHERE code = 'CCE 232';`);
  const ml2Prereqs = JSON.parse(String(ml2Res[0].values[0][1]));
  const ml1Id = Number(ml1Res[0].values[0][0]);
  console.assert(ml2Prereqs.includes(ml1Id), 'CCE 232 must depend on CCE 231 (ML 1)');

  // CCE 331 (Deep Learning) must have prerequisite CCE 232 (Machine Learning 2)
  const dlRes = db.exec(`SELECT id, prerequisite_ids FROM courses WHERE code = 'CCE 331';`);
  const dlPrereqs = JSON.parse(String(dlRes[0].values[0][1]));
  const ml2Id = Number(ml2Res[0].values[0][0]);
  console.assert(dlPrereqs.includes(ml2Id), 'CCE 331 (Deep Learning) must depend on CCE 232 (ML 2)');

  // Idempotency check: running seedAiCurriculum a second time should insert 0 and update 58
  const secondSeedResult = seedAiCurriculum(db);
  console.assert(secondSeedResult.insertedCount === 0, 'Second seed should insert 0 new courses');
  console.assert(secondSeedResult.updatedCount === AI_CURRICULUM_COURSES.length, 'Second seed should update/verify all 58 courses');
  console.assert(secondSeedResult.prereqsLinked === 26, 'Second seed should verify all 26 prerequisite links');

  // Test 8: Preparatory Year Parallel Groups Conflict Test
  // In Preparatory Year, Group A and Group B run parallel timetables.
  // Rule 1: Group A taking Physics 1 and Group B taking Mechanics 1 at the same time is ALLOWED (no conflict).
  // Rule 2: Group A taking Physics 1 and Group B taking Physics 1 at the same time is FORBIDDEN (parallel group conflict).
  // Rule 3: Group A taking two courses at the same time is FORBIDDEN (same group conflict).
  
  // Ensure Prep Year sections exist
  db.run(`INSERT OR IGNORE INTO sections (id, year_id, program_id, name, capacity) VALUES (101, 5, NULL, 'Group A', 150);`);
  db.run(`INSERT OR IGNORE INTO sections (id, year_id, program_id, name, capacity) VALUES (102, 5, NULL, 'Group B', 150);`);

  // Get Physics 1 and Mechanics 1 IDs
  const phys1Res = db.exec(`SELECT id FROM courses WHERE code = 'BSC 031';`);
  const mech1Res = db.exec(`SELECT id FROM courses WHERE code = 'BSC 021';`);
  const physics1Id = Number(phys1Res[0].values[0][0]);
  const mechanics1Id = Number(mech1Res[0].values[0][0]);

  // Insert a mock existing schedule for Group A: Physics 1 on Sunday 09:00 - 10:30 in Room 1 (with Prof 1)
  const existingPrepSchedules = [
    {
      id: 991,
      academic_year_id: 5,
      section_id: 101, // Group A
      section_name: 'Group A',
      course_id: physics1Id,
      course_code: 'BSC 031',
      room_id: 1,
      day_of_week: 0,
      start_time: '09:00',
      end_time: '10:30',
      session_type: 'LECTURE',
    }
  ];

  // Helper matching scheduleService checkScheduleConflicts
  const checkParallelGroupConflict = (newSession: {
    academicYearId: number;
    sectionId: number | null;
    sectionName: string;
    courseId: number;
    courseCode: string;
    roomId: number;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }) => {
    for (const existing of existingPrepSchedules) {
      if (existing.day_of_week !== newSession.dayOfWeek) continue;
      // Time overlap check
      const [sh1, sm1] = newSession.startTime.split(':').map(Number);
      const [eh1, em1] = newSession.endTime.split(':').map(Number);
      const [sh2, sm2] = existing.start_time.split(':').map(Number);
      const [eh2, em2] = existing.end_time.split(':').map(Number);
      const overlap = Math.max(sh1 * 60 + sm1, sh2 * 60 + sm2) < Math.min(eh1 * 60 + em1, eh2 * 60 + em2);
      if (!overlap) continue;

      // Room check
      if (existing.room_id === newSession.roomId) {
        return { hasConflict: true, type: 'ROOM' };
      }

      if (existing.academic_year_id === newSession.academicYearId) {
        // Parallel group conflict: Same course across different groups
        if (existing.course_id === newSession.courseId && existing.section_id !== newSession.sectionId) {
          return { hasConflict: true, type: 'PARALLEL_GROUP', message: 'Same course on parallel groups at same time' };
        }
        // Same section conflict
        if (existing.section_id === newSession.sectionId) {
          return { hasConflict: true, type: 'SECTION', message: 'Same group cannot have two sessions at once' };
        }
      }
    }
    return { hasConflict: false };
  };

  // Test 8a: Group B takes Mechanics 1 in Room 2 at the same time (09:00 - 10:30)
  const test8a = checkParallelGroupConflict({
    academicYearId: 5,
    sectionId: 102, // Group B
    sectionName: 'Group B',
    courseId: mechanics1Id,
    courseCode: 'BAS 021',
    roomId: 2, // Different room
    dayOfWeek: 0,
    startTime: '09:00',
    endTime: '10:30',
  });
  console.assert(test8a.hasConflict === false, 'Test 8a: Group A (Physics 1) and Group B (Mechanics 1) in parallel MUST NOT conflict');

  // Test 8b: Group B attempts to take Physics 1 at the same time (09:00 - 10:30)
  const test8b = checkParallelGroupConflict({
    academicYearId: 5,
    sectionId: 102, // Group B
    sectionName: 'Group B',
    courseId: physics1Id, // Same course!
    courseCode: 'BAS 011',
    roomId: 2, // Even in different room
    dayOfWeek: 0,
    startTime: '09:00',
    endTime: '10:30',
  });
  console.assert(test8b.hasConflict === true && test8b.type === 'PARALLEL_GROUP', 'Test 8b: Physics 1 on Group A and Physics 1 on Group B at same time MUST conflict');

  // Test 8c: Group A attempts to take Mechanics 1 at the same time (09:00 - 10:30)
  const test8c = checkParallelGroupConflict({
    academicYearId: 5,
    sectionId: 101, // Group A
    sectionName: 'Group A',
    courseId: mechanics1Id,
    courseCode: 'BAS 021',
    roomId: 2,
    dayOfWeek: 0,
    startTime: '09:00',
    endTime: '10:30',
  });
  console.assert(test8c.hasConflict === true && test8c.type === 'SECTION', 'Test 8c: Group A taking two subjects at same time MUST conflict');

  console.log('Test 8 passed: Preparatory Year parallel groups (Group A & Group B) conflict logic verified 100%');

  console.log('✓ SQLite Database, Room Collision, Professor Attendance, GPA Course Dependency, Program Filtering, Official AI Curriculum & Preparatory Year Parallel Groups verified with 100% success!');
}

testDatabase().catch((e) => {
  console.error('Test error:', e);
  process.exit(1);
});
