import { getSqliteDb, saveToLocalFile } from './sqlite';
import {
  getCourses,
  getAcademicYears,
  getSections,
  getProfessors,
  getRooms,
  getStandardPeriods,
  timesOverlap,
  getAllDependentCourseIds,
} from './scheduleService';
import type { Professor, Section, AcademicYear } from './schema';

export interface AutoScheduleOptions {
  semester: number; // 1 (Fall) or 2 (Spring)
  academicYearId?: number | 'ALL';
  clearExisting?: boolean; // Default true
}

export interface AutoScheduleResult {
  success: boolean;
  semester: number;
  semesterLabel: string;
  totalSessions: number;
  lectureCount: number;
  sectionCount: number;
  yearsScheduled: number;
  roomsUtilized: number;
  professorsAssigned: number;
  message: string;
  coursesScheduled: string[];
  conflicts: string[];
}

interface ScheduledSession {
  academicYearId: number;
  sectionId: number | null;
  sectionName?: string;
  courseId: number;
  courseCode: string;
  professorId: number;
  roomId: number;
  dayOfWeek: number;
  periodId: number;
  startTime: string;
  endTime: string;
  sessionType: 'LECTURE' | 'SECTION';
  notes?: string;
}

// Ensure campus facilities exist (default lecture halls, computer labs, and tutorial rooms)
async function ensureCampusFacilities(): Promise<void> {
  const db = await getSqliteDb();
  const roomCountRes = db.exec('SELECT COUNT(*) FROM rooms;');
  const roomCount = Number(roomCountRes[0]?.values[0]?.[0] || 0);

  if (roomCount === 0) {
    db.run(`
      INSERT INTO rooms (code, name, type, capacity, building, floor) VALUES
      ('HALL-A', 'Auditorium Alpha (Main Hall)', 'LECTURE_HALL', 220, 'Building A - Engineering', 1),
      ('HALL-B', 'Auditorium Beta', 'LECTURE_HALL', 150, 'Building A - Engineering', 2),
      ('HALL-C', 'Hall Gamma (Science)', 'LECTURE_HALL', 120, 'Building B - Science', 1),
      ('LAB-101', 'High-Performance Computing Lab', 'COMPUTER_LAB', 45, 'Building C - IT', 1),
      ('LAB-102', 'Software & AI Development Lab', 'COMPUTER_LAB', 40, 'Building C - IT', 1),
      ('LAB-201', 'Cybersecurity & Networks Lab', 'COMPUTER_LAB', 38, 'Building C - IT', 2),
      ('ROOM-301', 'Tutorial Classroom 301', 'TUTORIAL_ROOM', 50, 'Building B - Science', 3),
      ('ROOM-302', 'Tutorial Classroom 302', 'TUTORIAL_ROOM', 50, 'Building B - Science', 3);
    `);
    await saveToLocalFile(db);
  }
}

// Ensure faculty members and TAs exist for all curriculum departments
async function ensureFacultyMembers(): Promise<void> {
  const db = await getSqliteDb();
  const profCountRes = db.exec('SELECT COUNT(*) FROM professors;');
  const profCount = Number(profCountRes[0]?.values[0]?.[0] || 0);

  if (profCount < 6) {
    db.run(`
      INSERT OR IGNORE INTO professors (name, title, department, email, phone, office, available_days) VALUES
      ('Dr. Alan Turing', 'Prof.', 'Computer Science', 'a.turing@univ.edu', '+1-555-0101', 'Hall 301', '[0,2,4]'),
      ('Dr. Grace Hopper', 'Prof.', 'Software Engineering', 'g.hopper@univ.edu', '+1-555-0102', 'Hall 304', '[1,3]'),
      ('Dr. Donald Knuth', 'Prof.', 'Basic Sciences', 'd.knuth@univ.edu', '+1-555-0103', 'Hall 205', '[0,1,2]'),
      ('Dr. Barbara Liskov', 'Prof.', 'Computer Science', 'b.liskov@univ.edu', '+1-555-0104', 'Hall 310', NULL),
      ('Dr. Claude Shannon', 'Prof.', 'Networks', 'c.shannon@univ.edu', '+1-555-0105', 'Hall 208', '[0,1,3]'),
      ('Dr. Ada Lovelace', 'Prof.', 'Artificial Intelligence', 'a.lovelace@univ.edu', '+1-555-0106', 'Hall 315', '[1,2,4]'),
      ('Dr. Richard Feynman', 'Prof.', 'Basic Sciences', 'r.feynman@univ.edu', '+1-555-0107', 'Hall 102', '[0,2,3]'),
      ('Eng. David Patterson', 'TA', 'Computer Science', 'd.patterson@univ.edu', '+1-555-0201', 'Lab Tech 1', '[0,1,2,3,4]'),
      ('Eng. Margaret Hamilton', 'TA', 'Software Engineering', 'm.hamilton@univ.edu', '+1-555-0202', 'Lab Tech 2', '[0,2,3]'),
      ('Eng. Linus Torvalds', 'TA', 'Computer Science', 'l.torvalds@univ.edu', '+1-555-0203', 'Lab Tech 3', '[1,2,4]'),
      ('Eng. Dennis Ritchie', 'TA', 'Basic Sciences', 'd.ritchie@univ.edu', '+1-555-0204', 'Lab Tech 4', '[0,1,4]'),
      ('Eng. Ken Thompson', 'TA', 'Artificial Intelligence', 'k.thompson@univ.edu', '+1-555-0205', 'Lab Tech 5', '[0,2,4]');
    `);
    await saveToLocalFile(db);
  }
}

// Ensure section groups exist for each level
async function ensureLevelSections(years: AcademicYear[]): Promise<void> {
  const db = await getSqliteDb();
  for (const y of years) {
    const isPrep = y.code === 'YEAR_PREP' || /prep/i.test(y.name);
    const secRes = db.exec(`SELECT COUNT(*) FROM sections WHERE year_id = ${y.id};`);
    const count = Number(secRes[0]?.values[0]?.[0] || 0);

    if (count === 0) {
      if (isPrep) {
        db.run(`
          INSERT INTO sections (year_id, program_id, name, capacity) VALUES
          (${y.id}, NULL, 'Group A', 150),
          (${y.id}, NULL, 'Group B', 150);
        `);
      } else {
        db.run(`
          INSERT INTO sections (year_id, program_id, name, capacity) VALUES
          (${y.id}, NULL, 'Section 1', 35),
          (${y.id}, NULL, 'Section 2', 35);
        `);
      }
    }
  }
  await saveToLocalFile(db);
}

/**
 * Intelligent Constraint-Satisfaction Auto-Scheduling Engine
 * Generates timetables for Semester 1 (Fall) or Semester 2 (Spring)
 */
export async function autoGenerateTimetableBySemester(options: AutoScheduleOptions): Promise<AutoScheduleResult> {
  const semesterNum = options.semester === 2 ? 2 : 1;
  const semesterLabel = semesterNum === 1 ? 'Fall Semester 2026' : 'Spring Semester 2027';
  const clearExisting = options.clearExisting !== false;

  // 1. Provision foundation assets if missing
  await ensureCampusFacilities();
  await ensureFacultyMembers();

  const db = await getSqliteDb();
  const allYears = await getAcademicYears();
  await ensureLevelSections(allYears);

  // 2. Filter target academic years
  let targetYears = allYears;
  if (options.academicYearId && options.academicYearId !== 'ALL') {
    targetYears = allYears.filter((y) => y.id === options.academicYearId);
  }
  if (targetYears.length === 0) {
    targetYears = allYears;
  }

  // 3. Update academic year semester labels in the database
  for (const y of targetYears) {
    db.run(`UPDATE academic_years SET semester = '${semesterLabel}' WHERE id = ${y.id};`);
  }

  // 4. Handle clearing existing schedules if requested
  if (clearExisting) {
    if (!options.academicYearId || options.academicYearId === 'ALL') {
      db.run('DELETE FROM schedules;');
    } else {
      db.run(`DELETE FROM schedules WHERE academic_year_id = ${options.academicYearId};`);
    }
    await saveToLocalFile(db);
  }

  // 5. Fetch fresh data from DB
  const [allCourses, allSections, allProfessors, allRooms, periods] = await Promise.all([
    getCourses(),
    getSections(),
    getProfessors(),
    getRooms(),
    getStandardPeriods(),
  ]);

  // Standard working days: Sunday (0) through Thursday (4)
  const DAYS = [0, 1, 2, 3, 4];
  const STANDARD_PERIODS = periods.length > 0 ? periods : [
    { id: 1, periodNumber: 1, startTime: '10:00', endTime: '11:15', label: 'Period 1 (10:00 - 11:15)' },
    { id: 2, periodNumber: 2, startTime: '11:30', endTime: '12:45', label: 'Period 2 (11:30 - 12:45)' },
    { id: 3, periodNumber: 3, startTime: '13:00', endTime: '14:15', label: 'Period 3 (01:00 - 02:15)' },
    { id: 4, periodNumber: 4, startTime: '14:30', endTime: '15:45', label: 'Period 4 (02:30 - 03:45)' },
  ];

  // Lecture halls, computer labs, tutorial rooms
  const lectureHalls = allRooms.filter((r) => r.type === 'LECTURE_HALL');
  const computerLabs = allRooms.filter((r) => r.type === 'COMPUTER_LAB');
  const tutorialRooms = allRooms.filter((r) => r.type === 'TUTORIAL_ROOM' || r.type === 'WORKSHOP');

  const fallbackLectureHall = lectureHalls[0] || allRooms[0];
  const fallbackLab = computerLabs[0] || allRooms[1] || allRooms[0];
  const fallbackTutorial = tutorialRooms[0] || allRooms[2] || allRooms[0];

  // Faculty pools
  const professorsPool = allProfessors.filter((p) => p.title === 'Prof.' || p.title === 'Dr.');
  const taPool = allProfessors.filter((p) => p.title === 'TA' || p.title === 'Eng.');
  const fallbackFaculty = allProfessors[0];

  // Track existing scheduled sessions to prevent clashes with preserved schedules
  const existingRes = db.exec(`
    SELECT academic_year_id, section_id, course_id, professor_id, room_id, day_of_week, period_id, start_time, end_time, session_type
    FROM schedules;
  `);

  const committedSessions: ScheduledSession[] = [];
  if (existingRes.length > 0 && existingRes[0].values) {
    for (const r of existingRes[0].values) {
      committedSessions.push({
        academicYearId: Number(r[0]),
        sectionId: r[1] !== null ? Number(r[1]) : null,
        courseId: Number(r[2]),
        courseCode: '',
        professorId: Number(r[3]),
        roomId: Number(r[4]),
        dayOfWeek: Number(r[5]),
        periodId: Number(r[6]),
        startTime: String(r[7]),
        endTime: String(r[8]),
        sessionType: r[9] as any,
      });
    }
  }

  const generatedSessions: ScheduledSession[] = [];
  const conflicts: string[] = [];
  const scheduledCourseCodes: string[] = [];

  // Helper: Find matching professor/TA for a course department
  function selectFaculty(
    dept: string,
    isLecture: boolean,
    dayOfWeek: number
  ): Professor {
    const pool = isLecture ? professorsPool : taPool;
    const deptMatches = pool.filter((p) => {
      const match = p.department.toLowerCase().includes(dept.toLowerCase()) ||
                    dept.toLowerCase().includes(p.department.toLowerCase());
      if (!match) return false;
      const av = p.availableDays;
      return !av || av.length === 0 || av.includes(dayOfWeek);
    });

    if (deptMatches.length > 0) {
      return deptMatches[Math.floor(Math.random() * deptMatches.length)];
    }

    const availableAny = pool.filter((p) => {
      const av = p.availableDays;
      return !av || av.length === 0 || av.includes(dayOfWeek);
    });

    if (availableAny.length > 0) {
      return availableAny[Math.floor(Math.random() * availableAny.length)];
    }

    return fallbackFaculty;
  }

  // Helper: Check if slot violates any constraint
  function hasSlotConflict(
    candidate: {
      academicYearId: number;
      sectionId: number | null;
      sectionName?: string;
      courseId: number;
      professorId: number;
      roomId: number;
      dayOfWeek: number;
      periodId: number;
      startTime: string;
      endTime: string;
      sessionType: 'LECTURE' | 'SECTION';
    },
    sessions: ScheduledSession[]
  ): boolean {
    const dependentCourseIds = getAllDependentCourseIds(candidate.courseId, allCourses);

    for (const item of sessions) {
      if (item.dayOfWeek !== candidate.dayOfWeek) continue;
      if (!timesOverlap(candidate.startTime, candidate.endTime, item.startTime, item.endTime)) continue;

      // 1. Room Conflict
      if (item.roomId === candidate.roomId) return true;

      // 2. Professor Conflict
      if (item.professorId === candidate.professorId) return true;

      // 3. GPA Prerequisite Conflict
      if (dependentCourseIds.has(item.courseId)) return true;

      // 4. Cohort / Section Conflict
      if (item.academicYearId === candidate.academicYearId) {
        // Parallel group subject conflict: in same year, different groups cannot take the same course at the same time
        if (item.courseId === candidate.courseId && candidate.sectionId !== item.sectionId) {
          return true;
        }

        // Whole cohort lecture conflict
        if (candidate.sectionId === null || item.sectionId === null) {
          return true;
        }

        // Same section conflict
        if (candidate.sectionId === item.sectionId) {
          return true;
        }

        // Parallel group matching
        const s1 = candidate.sectionName || '';
        const s2 = item.sectionName || '';
        const isA1 = /group\s*a\b/i.test(s1);
        const isA2 = /group\s*a\b/i.test(s2);
        if (isA1 && isA2) return true;
        const isB1 = /group\s*b\b/i.test(s1);
        const isB2 = /group\s*b\b/i.test(s2);
        if (isB1 && isB2) return true;
      }
    }

    return false;
  }

  // 6. Process each target academic year
  for (const year of targetYears) {
    // Select courses for this year & semester
    const yearCourses = allCourses.filter(
      (c) => c.yearId === year.id && (c.semester === semesterNum || !c.semester)
    );

    if (yearCourses.length === 0) continue;

    const yearSections = allSections.filter((s) => s.yearId === year.id);
    const isPrep = year.code === 'YEAR_PREP' || /prep/i.test(year.name);

    // Preparatory Year has Group A and Group B
    const prepGroupA = yearSections.find((s) => /group\s*a\b/i.test(s.name)) || yearSections[0];
    const prepGroupB = yearSections.find((s) => /group\s*b\b/i.test(s.name)) || yearSections[1] || yearSections[0];

    // Track sessions per day for this year cohort to balance workload
    const yearDayLoad: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };

    for (const course of yearCourses) {
      scheduledCourseCodes.push(course.code);

      // Determine required room types
      const isLabCourse =
        /programming|code|lab|software|data|database|networks|ai|learning|vision|graphics/i.test(course.name) ||
        course.department.toLowerCase().includes('computer');
      const sectionRoomPool = isLabCourse ? computerLabs : tutorialRooms;
      const defaultSectionRoom = sectionRoomPool[0] || (isLabCourse ? fallbackLab : fallbackTutorial);

      // -------------------------------------------------------------
      // PART A: SCHEDULE LECTURE
      // -------------------------------------------------------------
      // For Prep Year, respect course target group (Group A only, Group B only, or Both)
      const prepTargetGroups = prepGroupA && prepGroupB
        ? course.targetGroup === 'GROUP_A'
          ? [prepGroupA]
          : course.targetGroup === 'GROUP_B'
          ? [prepGroupB]
          : [prepGroupA, prepGroupB]
        : yearSections;

      if (isPrep && prepGroupA && prepGroupB) {
        // Prep Year: Schedule lecture for assigned group(s)
        for (const grp of prepTargetGroups) {
          let lectureScheduled = false;

          // Prefer days sorted by lowest load
          const sortedDays = [...DAYS].sort((a, b) => yearDayLoad[a] - yearDayLoad[b]);

          for (const day of sortedDays) {
            if (lectureScheduled) break;

            for (const period of STANDARD_PERIODS) {
              // Priority for Lectures in Periods 1-3
              for (const hall of lectureHalls.concat([fallbackLectureHall])) {
                const prof = selectFaculty(course.department, true, day);
                const av = prof.availableDays;
                if (av && av.length > 0 && !av.includes(day)) continue;

                const candidate: ScheduledSession = {
                  academicYearId: year.id,
                  sectionId: grp.id,
                  sectionName: grp.name,
                  courseId: course.id,
                  courseCode: course.code,
                  professorId: prof.id,
                  roomId: hall.id,
                  dayOfWeek: day,
                  periodId: period.id,
                  startTime: period.startTime,
                  endTime: period.endTime,
                  sessionType: 'LECTURE',
                  notes: `${grp.name} Theory Lecture`,
                };

                const allCurrent = [...committedSessions, ...generatedSessions];
                if (!hasSlotConflict(candidate, allCurrent)) {
                  generatedSessions.push(candidate);
                  yearDayLoad[day]++;
                  lectureScheduled = true;
                  break;
                }
              }
              if (lectureScheduled) break;
            }

            // Shared Prep lectures must be created for both groups. If faculty
            // attendance was the only blocker, retry with any conflict-free
            // faculty member so the second group is not silently omitted.
            if (!lectureScheduled && course.targetGroup === 'ALL') {
              for (const day of DAYS) {
                if (lectureScheduled) break;
                for (const period of STANDARD_PERIODS) {
                  if (lectureScheduled) break;
                  for (const hall of lectureHalls.concat([fallbackLectureHall])) {
                    for (const prof of professorsPool) {
                      const candidate: ScheduledSession = {
                        academicYearId: year.id,
                        sectionId: grp.id,
                        sectionName: grp.name,
                        courseId: course.id,
                        courseCode: course.code,
                        professorId: prof.id,
                        roomId: hall.id,
                        dayOfWeek: day,
                        periodId: period.id,
                        startTime: period.startTime,
                        endTime: period.endTime,
                        sessionType: 'LECTURE',
                        notes: `${grp.name} Theory Lecture`,
                      };
                      if (!hasSlotConflict(candidate, [...committedSessions, ...generatedSessions])) {
                        generatedSessions.push(candidate);
                        yearDayLoad[day]++;
                        lectureScheduled = true;
                        break;
                      }
                    }
                    if (lectureScheduled) break;
                  }
                }
              }
            }
          }
          if (!lectureScheduled) {
            conflicts.push(`${course.code} - ${course.name}: could not schedule the ${grp.name} lecture without a room, professor, or cohort conflict.`);
          }
        }
      } else {
        // Years 1-4: Whole Cohort Lecture (sectionId: null)
        let lectureScheduled = false;
        const sortedDays = [...DAYS].sort((a, b) => yearDayLoad[a] - yearDayLoad[b]);

        for (const day of sortedDays) {
          if (lectureScheduled) break;

          for (const period of STANDARD_PERIODS) {
            for (const hall of lectureHalls.concat([fallbackLectureHall])) {
              const prof = selectFaculty(course.department, true, day);
              const av = prof.availableDays;
              if (av && av.length > 0 && !av.includes(day)) continue;

              const candidate: ScheduledSession = {
                academicYearId: year.id,
                sectionId: null,
                courseId: course.id,
                courseCode: course.code,
                professorId: prof.id,
                roomId: hall.id,
                dayOfWeek: day,
                periodId: period.id,
                startTime: period.startTime,
                endTime: period.endTime,
                sessionType: 'LECTURE',
                notes: `Full Cohort Lecture`,
              };

              const allCurrent = [...committedSessions, ...generatedSessions];
              if (!hasSlotConflict(candidate, allCurrent)) {
                generatedSessions.push(candidate);
                yearDayLoad[day]++;
                lectureScheduled = true;
                break;
              }
              if (!lectureScheduled) {
                conflicts.push(`${course.code} - ${course.name}: could not schedule the whole-cohort lecture without a conflict.`);
              }
            }
            if (lectureScheduled) break;
          }
        }
      }

      // -------------------------------------------------------------
      // PART B: SCHEDULE SECTIONS / PRACTICAL LABS
      // -------------------------------------------------------------
      if (course.hasSections !== false) {
        const targetSections = isPrep
          ? prepTargetGroups
          : yearSections.length > 0
          ? yearSections
          : [{ id: 0, name: 'Main Section' } as Section];

        for (const sec of targetSections) {
          let secScheduled = false;
          const sortedDays = [...DAYS].sort((a, b) => yearDayLoad[a] - yearDayLoad[b]);

          for (const day of sortedDays) {
            if (secScheduled) break;

            // Sections typically in periods 2 to 5
            for (const period of STANDARD_PERIODS) {
              for (const room of sectionRoomPool.concat([defaultSectionRoom])) {
                const ta = selectFaculty(course.department, false, day);
                const av = ta.availableDays;
                if (av && av.length > 0 && !av.includes(day)) continue;

                const candidate: ScheduledSession = {
                  academicYearId: year.id,
                  sectionId: sec.id > 0 ? sec.id : null,
                  sectionName: sec.name,
                  courseId: course.id,
                  courseCode: course.code,
                  professorId: ta.id,
                  roomId: room.id,
                  dayOfWeek: day,
                  periodId: period.id,
                  startTime: period.startTime,
                  endTime: period.endTime,
                  sessionType: 'SECTION',
                  notes: `${sec.name} Practical / Lab`,
                };

                const allCurrent = [...committedSessions, ...generatedSessions];
                if (!hasSlotConflict(candidate, allCurrent)) {
                  generatedSessions.push(candidate);
                  yearDayLoad[day]++;
                  secScheduled = true;
                  break;
                }
                if (!secScheduled) {
                  conflicts.push(`${course.code} - ${course.name}: could not schedule ${sec.name} practical/section without a conflict.`);
                }
              }
              if (secScheduled) break;
            }
          }
        }
      }
    }
  }

  // 7. Commit generated sessions to SQLite database
  const insertStmt = db.prepare(`
    INSERT INTO schedules (
      academic_year_id, section_id, course_id, professor_id, room_id,
      day_of_week, period_id, start_time, end_time, session_type, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);

  for (const s of generatedSessions) {
    insertStmt.run([
      s.academicYearId,
      s.sectionId,
      s.courseId,
      s.professorId,
      s.roomId,
      s.dayOfWeek,
      s.periodId,
      s.startTime,
      s.endTime,
      s.sessionType,
      s.notes || null,
    ]);
  }
  insertStmt.free();

  await saveToLocalFile(db);

  // 8. Calculate summary statistics
  const lectureCount = generatedSessions.filter((s) => s.sessionType === 'LECTURE').length;
  const sectionCount = generatedSessions.filter((s) => s.sessionType === 'SECTION').length;
  const uniqueRooms = new Set(generatedSessions.map((s) => s.roomId)).size;
  const uniqueProfs = new Set(generatedSessions.map((s) => s.professorId)).size;
  const uniqueYears = new Set(generatedSessions.map((s) => s.academicYearId)).size;

  return {
    success: true,
    semester: semesterNum,
    semesterLabel,
    totalSessions: generatedSessions.length,
    lectureCount,
    sectionCount,
    yearsScheduled: uniqueYears,
    roomsUtilized: uniqueRooms,
    professorsAssigned: uniqueProfs,
    coursesScheduled: Array.from(new Set(scheduledCourseCodes)),
    message: conflicts.length > 0
      ? `Generated ${generatedSessions.length} sessions for ${semesterLabel}, but ${conflicts.length} placement conflict${conflicts.length === 1 ? '' : 's'} need attention.`
      : `Successfully generated ${generatedSessions.length} sessions for ${semesterLabel} across ${uniqueYears} academic year levels with 0 conflicts!`,
    conflicts,
  };
}
