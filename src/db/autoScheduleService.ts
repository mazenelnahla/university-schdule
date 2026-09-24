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
import type { Professor, AcademicYear } from './schema';

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

// Ensure section groups exist for each level
async function ensureLevelSections(years: AcademicYear[]): Promise<void> {
  const db = await getSqliteDb();
  for (const y of years) {
    const isPrep = y.code === 'YEAR_PREP' || /prep/i.test(y.name);
    if (!isPrep) continue;

    for (const group of ['A', 'B']) {
      const groupName = `Group ${group}`;
      const escapedGroupName = groupName.replace(/'/g, "''");
      db.run(`
        UPDATE sections
        SET name = '${escapedGroupName}'
        WHERE year_id = ${y.id}
          AND lower(name) = lower('Group ${group} - Section 1')
          AND NOT EXISTS (
            SELECT 1 FROM sections
            WHERE year_id = ${y.id} AND lower(name) = lower('${escapedGroupName}')
          );
      `);
      db.run(`
        INSERT INTO sections (year_id, program_id, name, capacity)
        SELECT ${y.id}, NULL, '${escapedGroupName}', 150
        WHERE NOT EXISTS (
          SELECT 1 FROM sections
          WHERE year_id = ${y.id} AND lower(name) = lower('${escapedGroupName}')
        );
      `);
      db.run(`
        DELETE FROM schedules
        WHERE section_id IN (
          SELECT id FROM sections
          WHERE year_id = ${y.id} AND lower(name) LIKE lower('Group ${group} - Section %')
        );
      `);
      db.run(`
        DELETE FROM sections
        WHERE year_id = ${y.id} AND lower(name) LIKE lower('Group ${group} - Section %');
      `);
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
  if (!fallbackLectureHall || !fallbackFaculty) {
    throw new Error('Auto-generation requires at least one room and one professor. Add them in Admin Hub before generating a timetable.');
  }

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
            if (!lectureScheduled) {
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
                for (const day of DAYS) {
                  if (lectureScheduled) break;
                  for (const period of STANDARD_PERIODS) {
                    if (lectureScheduled) break;
                    for (const hall of lectureHalls.concat([fallbackLectureHall])) {
                      for (const prof of professorsPool) {
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
                          notes: 'Full Cohort Lecture',
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
          const targetSections = isPrep ? prepTargetGroups : [];

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
              }
              if (secScheduled) break;
            }
          }
          if (!secScheduled) {
            const sectionFacultyPool = taPool.length > 0 ? taPool : [fallbackFaculty];
            for (const day of DAYS) {
              if (secScheduled) break;
              for (const period of STANDARD_PERIODS) {
                if (secScheduled) break;
                for (const room of sectionRoomPool.concat([defaultSectionRoom])) {
                  for (const ta of sectionFacultyPool) {
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
                    if (!hasSlotConflict(candidate, [...committedSessions, ...generatedSessions])) {
                      generatedSessions.push(candidate);
                      yearDayLoad[day]++;
                      secScheduled = true;
                      break;
                    }
                  }
                  if (secScheduled) break;
                }
              }
            }
          }
          if (!secScheduled) {
            conflicts.push(`${course.code} - ${course.name}: could not schedule ${sec.name} practical/section without a conflict.`);
          }
        }
      }
      if (generatedSessions.some((session) => session.courseId === course.id)) {
        scheduledCourseCodes.push(course.code);
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
  const prepSessions = generatedSessions.filter((s) => s.academicYearId === 5);
  const groupACounts = {
    lectures: prepSessions.filter((s) => s.sectionName && /group\s*a\b/i.test(s.sectionName) && s.sessionType === 'LECTURE').length,
    sections: prepSessions.filter((s) => s.sectionName && /group\s*a\b/i.test(s.sectionName) && s.sessionType === 'SECTION').length,
  };
  const groupBCounts = {
    lectures: prepSessions.filter((s) => s.sectionName && /group\s*b\b/i.test(s.sectionName) && s.sessionType === 'LECTURE').length,
    sections: prepSessions.filter((s) => s.sectionName && /group\s*b\b/i.test(s.sectionName) && s.sessionType === 'SECTION').length,
  };
  if (groupACounts.lectures !== groupBCounts.lectures || groupACounts.sections !== groupBCounts.sections) {
    conflicts.push(
      `Preparatory Year is unbalanced: Group A has ${groupACounts.lectures} lectures and ${groupACounts.sections} sections, while Group B has ${groupBCounts.lectures} lectures and ${groupBCounts.sections} sections.`
    );
  }
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
