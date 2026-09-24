import { getSqliteDb, saveToIndexedDB } from './sqlite';
import type {
  AcademicYear,
  Program,
  Section,
  Professor,
  Room,
  Course,
  StandardPeriod,
  ScheduleItem,
  ScheduleWithDetails,
  ConflictCheckResult,
  AdminUser,
  TargetGroup,
} from './schema';

// Helper to convert time "HH:MM" to minutes from midnight
export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function timesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  return Math.max(s1, s2) < Math.min(e1, e2);
}

// Convert sql.js result to array of objects
function rowsToObjects<T>(result: { columns: string[]; values: any[][] }[]): T[] {
  if (!result || result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map((row) => {
    const obj: any = {};
    columns.forEach((col, idx) => {
      // Convert snake_case to camelCase
      const camel = col.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      obj[camel] = row[idx];
    });
    return obj as T;
  });
}

// ---------------------- ADMIN AUTH ----------------------
export async function authenticateAdmin(username: string, password: string): Promise<AdminUser | null> {
  const db = await getSqliteDb();
  const stmt = db.prepare('SELECT id, username, display_name FROM admin_users WHERE username = :u AND password_hash = :p');
  stmt.bind({ ':u': username.trim(), ':p': password.trim() });
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return {
      id: Number(row.id),
      username: String(row.username),
      displayName: String(row.display_name),
    };
  }
  stmt.free();
  return null;
}

// ---------------------- GETTERS ----------------------
export async function getAcademicYears(): Promise<AcademicYear[]> {
  const db = await getSqliteDb();
  const res = db.exec(`
    SELECT id, code, name, semester FROM academic_years 
    ORDER BY 
      CASE 
        WHEN code = 'YEAR_PREP' OR name LIKE '%Prep%' THEN 0 
        WHEN code = 'YEAR_1' OR name LIKE '%Year 1%' OR name LIKE '%Freshman%' THEN 1
        WHEN code = 'YEAR_2' OR name LIKE '%Year 2%' OR name LIKE '%Sophomore%' THEN 2
        WHEN code = 'YEAR_3' OR name LIKE '%Year 3%' OR name LIKE '%Junior%' THEN 3
        WHEN code = 'YEAR_4' OR name LIKE '%Year 4%' OR name LIKE '%Senior%' THEN 4
        ELSE id + 10 
      END ASC
  `);
  return rowsToObjects<AcademicYear>(res);
}

export async function getPrograms(): Promise<Program[]> {
  const db = await getSqliteDb();
  const res = db.exec('SELECT id, code, name, department FROM programs ORDER BY id ASC');
  return rowsToObjects<Program>(res);
}

export async function getSections(yearId?: number, programId?: number): Promise<Section[]> {
  const db = await getSqliteDb();
  const whereClauses: string[] = [];
  if (yearId !== undefined && yearId !== null) {
    whereClauses.push(`s.year_id = ${yearId}`);
  }
  if (programId !== undefined && programId !== null) {
    whereClauses.push(`s.program_id = ${programId}`);
  }
  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
    SELECT 
      s.id, 
      s.year_id, 
      s.program_id, 
      s.name, 
      s.capacity,
      p.name AS program_name,
      p.code AS program_code
    FROM sections s
    LEFT JOIN programs p ON s.program_id = p.id
    ${whereSql}
    ORDER BY s.year_id, s.program_id, s.id ASC
  `;
  const res = db.exec(sql);
  return rowsToObjects<Section>(res);
}

export function parseAvailableDays(val: any): number[] | undefined {
  if (!val) return undefined;
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return undefined;
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(Number);
    } catch {
      return trimmed
        .split(',')
        .map((x) => Number(x.trim()))
        .filter((x) => !isNaN(x));
    }
  }
  return undefined;
}

export async function getProfessors(): Promise<Professor[]> {
  const db = await getSqliteDb();
  const res = db.exec('SELECT id, name, title, department, email, phone, office, available_days FROM professors ORDER BY name ASC');
  const rows = rowsToObjects<any>(res);
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    title: p.title,
    department: p.department,
    email: p.email,
    phone: p.phone,
    office: p.office,
    availableDays: parseAvailableDays(p.availableDays),
  }));
}

export async function getRooms(): Promise<Room[]> {
  const db = await getSqliteDb();
  const res = db.exec('SELECT id, code, name, type, capacity, building, floor FROM rooms ORDER BY code ASC');
  return rowsToObjects<Room>(res);
}

export function parsePrerequisiteIds(val: any): number[] | undefined {
  if (!val) return undefined;
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return undefined;
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(Number);
    } catch {
      return trimmed
        .split(',')
        .map((x) => Number(x.trim()))
        .filter((x) => !isNaN(x));
    }
  }
  return undefined;
}

export async function getCourses(yearId?: number, programId?: number | null): Promise<Course[]> {
  const db = await getSqliteDb();
  const whereClauses: string[] = [];
  if (yearId !== undefined && yearId !== null) {
    whereClauses.push(`c.year_id = ${yearId}`);
  }
  if (programId !== undefined && programId !== null) {
    whereClauses.push(`(c.program_id = ${programId} OR c.program_id IS NULL)`);
  }
  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const sql = `
    SELECT 
      c.id, 
      c.code, 
      c.name, 
      c.credit_hours, 
      c.department, 
      c.year_id, 
      c.program_id,
      p.code AS program_code,
      p.name AS program_name,
      c.color_hex, 
      c.prerequisite_ids,
      c.semester,
      c.target_group,
      c.has_sections
    FROM courses c
    LEFT JOIN programs p ON c.program_id = p.id
    ${whereSql}
    ORDER BY c.code ASC
  `;
  const res = db.exec(sql);
  const rows = rowsToObjects<any>(res);
  return rows.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    creditHours: c.creditHours,
    department: c.department,
    yearId: c.yearId,
    programId: c.programId ?? null,
    programCode: c.programCode ?? undefined,
    programName: c.programName ?? undefined,
    colorHex: c.colorHex,
    prerequisiteIds: parsePrerequisiteIds(c.prerequisiteIds),
    semester: c.semester !== undefined && c.semester !== null ? Number(c.semester) : 1,
    targetGroup: (c.targetGroup || c.target_group || 'ALL') as TargetGroup,
    hasSections: c.hasSections !== undefined ? Boolean(Number(c.hasSections)) : (c.has_sections !== undefined ? Boolean(Number(c.has_sections)) : true),
  }));
}

/**
 * Resolves the full bidirectional dependency graph (both direct & transitive) for a course.
 * If Course B depends on Course A (prerequisite), then Course A and Course B cannot overlap.
 * If Course C depends on Course B (which depends on Course A), then Course C cannot overlap with A or B either.
 * Returns a Set of course IDs that are in the dependency chain with targetCourseId.
 */
export function getAllDependentCourseIds(targetCourseId: number, courses: Course[]): Set<number> {
  const prereqGraph = new Map<number, number[]>(); // courseId -> its prerequisites
  const dependentGraph = new Map<number, number[]>(); // courseId -> courses that depend on it

  for (const c of courses) {
    const prereqs = c.prerequisiteIds || [];
    prereqGraph.set(c.id, prereqs);
    for (const pid of prereqs) {
      const list = dependentGraph.get(pid) || [];
      list.push(c.id);
      dependentGraph.set(pid, list);
    }
  }

  const result = new Set<number>();
  const queue: number[] = [targetCourseId];
  const visited = new Set<number>([targetCourseId]);

  // 1. Traverse upstream (all prerequisites and their prerequisites)
  while (queue.length > 0) {
    const current = queue.shift()!;
    const prereqs = prereqGraph.get(current) || [];
    for (const p of prereqs) {
      if (!visited.has(p)) {
        visited.add(p);
        result.add(p);
        queue.push(p);
      }
    }
  }

  // 2. Traverse downstream (all courses that depend on this course, and their dependents)
  queue.push(targetCourseId);
  while (queue.length > 0) {
    const current = queue.shift()!;
    const dependents = dependentGraph.get(current) || [];
    for (const d of dependents) {
      if (!visited.has(d)) {
        visited.add(d);
        result.add(d);
        queue.push(d);
      }
    }
  }

  return result;
}

export async function getStandardPeriods(): Promise<StandardPeriod[]> {
  const db = await getSqliteDb();
  const res = db.exec('SELECT id, period_number, start_time, end_time, label FROM standard_periods ORDER BY period_number ASC');
  return rowsToObjects<StandardPeriod>(res);
}

export async function getAllSchedulesWithDetails(filter?: {
  academicYearId?: number;
  dayOfWeek?: number;
  roomId?: number;
  professorId?: number;
  sectionId?: number;
  programId?: number;
}): Promise<ScheduleWithDetails[]> {
  const db = await getSqliteDb();
  let whereClauses: string[] = [];
  if (filter?.academicYearId !== undefined && filter.academicYearId !== null) {
    whereClauses.push(`s.academic_year_id = ${filter.academicYearId}`);
  }
  if (filter?.dayOfWeek !== undefined && filter.dayOfWeek !== null) {
    whereClauses.push(`s.day_of_week = ${filter.dayOfWeek}`);
  }
  if (filter?.roomId !== undefined && filter.roomId !== null) {
    whereClauses.push(`s.room_id = ${filter.roomId}`);
  }
  if (filter?.professorId !== undefined && filter.professorId !== null) {
    whereClauses.push(`s.professor_id = ${filter.professorId}`);
  }
  if (filter?.sectionId !== undefined && filter.sectionId !== null) {
    whereClauses.push(`(s.section_id = ${filter.sectionId} OR s.section_id IS NULL)`);
  }
  if (filter?.programId !== undefined && filter.programId !== null) {
    whereClauses.push(`(sec.program_id = ${filter.programId} OR (s.section_id IS NULL AND (c.program_id = ${filter.programId} OR c.program_id IS NULL)))`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
    SELECT 
      s.id,
      s.academic_year_id,
      s.section_id,
      s.course_id,
      s.professor_id,
      s.room_id,
      s.day_of_week,
      s.period_id,
      s.start_time,
      s.end_time,
      s.session_type,
      s.notes,
      ay.name AS year_name,
      ay.code AS year_code,
      sec.name AS section_name,
      sec.program_id AS program_id,
      prog.name AS program_name,
      prog.code AS program_code,
      c.program_id AS course_program_id,
      cprog.code AS course_program_code,
      cprog.name AS course_program_name,
      c.code AS course_code,
      c.name AS course_name,
      c.color_hex AS course_color,
      p.name AS professor_name,
      p.title AS professor_title,
      r.code AS room_code,
      r.name AS room_name,
      r.type AS room_type,
      r.capacity AS room_capacity,
      r.building,
      r.floor AS room_floor,
      r.floor
    FROM schedules s
    JOIN academic_years ay ON s.academic_year_id = ay.id
    LEFT JOIN sections sec ON s.section_id = sec.id
    LEFT JOIN programs prog ON sec.program_id = prog.id
    JOIN courses c ON s.course_id = c.id
    LEFT JOIN programs cprog ON c.program_id = cprog.id
    JOIN professors p ON s.professor_id = p.id
    JOIN rooms r ON s.room_id = r.id
    ${whereSql}
    ORDER BY s.day_of_week ASC, s.start_time ASC
  `;

  const res = db.exec(sql);
  return rowsToObjects<ScheduleWithDetails>(res);
}

// ---------------------- CONFLICT ENGINE ----------------------
/**
 * Strict conflict check:
 * 1. Room collision: The same room CANNOT be scheduled at the same time/period for any other lecture or section.
 * 2. Professor collision: Same professor cannot be in two places at once.
 * 3. Cohort collision: The same academic year batch or specific section cannot have two sessions at once.
 */
export async function checkScheduleConflicts(input: {
  scheduleId?: number; // Exclude current schedule when editing
  academicYearId: number;
  sectionId: number | null;
  courseId: number;
  professorId: number;
  roomId: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  sessionType: 'LECTURE' | 'SECTION';
}): Promise<ConflictCheckResult> {
  const db = await getSqliteDb();

  // 0. PROFESSOR ATTENDANCE RESTRICTION: Check if professor attends on this day of week
  const profStmt = db.prepare('SELECT id, name, title, available_days FROM professors WHERE id = ?');
  profStmt.bind([input.professorId]);
  if (profStmt.step()) {
    const profRow = profStmt.getAsObject();
    const availableDays = parseAvailableDays(profRow.available_days);
    if (availableDays && availableDays.length > 0 && !availableDays.includes(input.dayOfWeek)) {
      profStmt.free();
      const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const targetDayName = DAY_NAMES[input.dayOfWeek] || `Day ${input.dayOfWeek}`;
      const allowedDaysStr = availableDays.map((d) => DAY_NAMES[d] || `Day ${d}`).join(', ');
      return {
        hasConflict: true,
        conflictType: 'PROFESSOR_AVAILABILITY',
        message: `Professor Attendance Restriction: ${profRow.title} ${profRow.name} only attends on [${allowedDaysStr}]. They cannot be scheduled on ${targetDayName}.`,
      };
    }
  }
  const allCourses = await getCourses();
  const currentCourse = allCourses.find((c) => c.id === input.courseId);
  const dependentCourseIds = getAllDependentCourseIds(input.courseId, allCourses);

  const allSchedules = await getAllSchedulesWithDetails({ dayOfWeek: input.dayOfWeek });

  for (const item of allSchedules) {
    // Skip checking against itself when updating
    if (input.scheduleId && item.id === input.scheduleId) {
      continue;
    }

    // Check if times overlap
    if (timesOverlap(input.startTime, input.endTime, item.startTime, item.endTime)) {
      // 1. HARD ROOM CONFLICT: Same room at the same time
      if (item.roomId === input.roomId) {
        return {
          hasConflict: true,
          conflictType: 'ROOM',
          message: `Room Conflict: ${item.roomCode} (${item.roomName}) is already booked on this day from ${item.startTime} to ${item.endTime} for "${item.courseCode} - ${item.courseName}" (${item.sessionType}) by ${item.professorTitle} ${item.professorName}.`,
          conflictingSchedule: item,
        };
      }

      // 2. PROFESSOR CONFLICT: Same professor in two places at once
      if (item.professorId === input.professorId) {
        return {
          hasConflict: true,
          conflictType: 'PROFESSOR',
          message: `Professor Conflict: ${item.professorTitle} ${item.professorName} is already scheduled to teach "${item.courseCode}" in room ${item.roomCode} from ${item.startTime} to ${item.endTime}.`,
          conflictingSchedule: item,
        };
      }

      // 3. COURSE DEPENDENCY CONFLICT (GPA System): Dependent courses cannot overlap on the same day
      if (dependentCourseIds.has(item.courseId)) {
        return {
          hasConflict: true,
          conflictType: 'COURSE_DEPENDENCY',
          message: `Subject Dependency Conflict (GPA System): "${currentCourse?.code || 'Selected subject'} - ${currentCourse?.name || ''}" and "${item.courseCode} - ${item.courseName}" depend on each other. In a GPA credit-hour system, dependent subjects cannot be scheduled at overlapping times (${item.startTime} - ${item.endTime}) so students repeating or carrying over prerequisites (e.g., summer courses) can attend both without timetable clashes.`,
          conflictingSchedule: item,
        };
      }

      // 4. COHORT & PARALLEL GROUP CONFLICTS
      if (item.academicYearId === input.academicYearId) {
        // A. Same Subject Across Parallel Groups:
        // In the same year (e.g., Preparatory Year Group A vs Group B), the same course cannot be scheduled at the same time for different groups.
        // For example: Physics 1 on Group A cannot be on Group B at the same time (groups must alternate subjects).
        if (item.courseId === input.courseId && input.sectionId !== item.sectionId) {
          const allYearSecs = await getSections(input.academicYearId);
          const curSec = allYearSecs.find((s) => s.id === input.sectionId);
          const curSecName = curSec?.name || (input.sectionId ? 'Selected Group' : 'Whole Cohort');
          const otherSecName = item.sectionName || 'Another Group';
          return {
            hasConflict: true,
            conflictType: 'SECTION',
            message: `Parallel Group Conflict: "${item.courseCode} - ${item.courseName}" cannot be scheduled for ${curSecName} at the same time (${item.startTime} - ${item.endTime}) as ${otherSecName}. Parallel groups must alternate subjects (e.g., one group takes ${item.courseCode} while the other group takes a different subject).`,
            conflictingSchedule: item,
          };
        }

        // B. Whole-batch Lecture Conflict:
        // If either session is explicitly for the whole batch (sectionId is null), it affects all groups in that year.
        if (input.sectionId === null || item.sectionId === null) {
          const who = input.sectionId === null ? 'All students in this year (Whole Cohort)' : `${item.sectionName || 'All students'}`;
          return {
            hasConflict: true,
            conflictType: 'SECTION',
            message: `Cohort Schedule Conflict: ${who} already have "${item.courseCode} (${item.sessionType})" from ${item.startTime} to ${item.endTime}.`,
            conflictingSchedule: item,
          };
        }

        // C. Same Section or Sub-group Conflict:
        const allYearSecs = await getSections(input.academicYearId);
        const curSec = allYearSecs.find((s) => s.id === input.sectionId);
        const isSameGroupOrSection =
          input.sectionId === item.sectionId ||
          (curSec && item.sectionName && areSectionsInSameGroup(curSec.name, item.sectionName));

        if (isSameGroupOrSection) {
          const targetName =
            input.sectionId === item.sectionId
              ? (item.sectionName || 'This section')
              : `${curSec?.name || 'Group'} / ${item.sectionName || 'Group'}`;
          return {
            hasConflict: true,
            conflictType: 'SECTION',
            message: `Section Conflict: ${targetName} is already scheduled for "${item.courseCode} (${item.sessionType})" from ${item.startTime} to ${item.endTime}.`,
            conflictingSchedule: item,
          };
        }
      }
    }
  }

  return { hasConflict: false };
}

export function areSectionsInSameGroup(secName1?: string, secName2?: string): boolean {
  if (!secName1 || !secName2) return false;
  const s1 = secName1.trim().toLowerCase();
  const s2 = secName2.trim().toLowerCase();
  if (s1 === s2) return true;

  // Check Group A matching
  const isGroupA1 = /\bgroup\s*a\b/i.test(s1);
  const isGroupA2 = /\bgroup\s*a\b/i.test(s2);
  if (isGroupA1 && isGroupA2) return true;

  // Check Group B matching
  const isGroupB1 = /\bgroup\s*b\b/i.test(s1);
  const isGroupB2 = /\bgroup\s*b\b/i.test(s2);
  if (isGroupB1 && isGroupB2) return true;

  return false;
}

/**
 * Returns a mapping of roomId -> ScheduleWithDetails for all rooms that are occupied
 * on the given day and overlapping time range.
 */
export async function getOccupiedRooms(
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  excludeScheduleId?: number
): Promise<Map<number, ScheduleWithDetails>> {
  const allSchedules = await getAllSchedulesWithDetails({ dayOfWeek });
  const occupied = new Map<number, ScheduleWithDetails>();

  for (const item of allSchedules) {
    if (excludeScheduleId && item.id === excludeScheduleId) continue;
    if (timesOverlap(startTime, endTime, item.startTime, item.endTime)) {
      occupied.set(item.roomId, item);
    }
  }

  return occupied;
}

/**
 * Returns a mapping of professorId -> ScheduleWithDetails for all professors that are busy
 * on the given day and overlapping time range.
 */
export async function getBusyProfessors(
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  excludeScheduleId?: number
): Promise<Map<number, ScheduleWithDetails>> {
  const allSchedules = await getAllSchedulesWithDetails({ dayOfWeek });
  const busy = new Map<number, ScheduleWithDetails>();

  for (const item of allSchedules) {
    if (excludeScheduleId && item.id === excludeScheduleId) continue;
    if (timesOverlap(startTime, endTime, item.startTime, item.endTime)) {
      busy.set(item.professorId, item);
    }
  }

  return busy;
}

/**
 * Returns a mapping of professorId -> details for professors who do NOT attend on this day of the week.
 */
export function getUnavailableProfessorsOnDay(
  dayOfWeek: number,
  professors: Professor[]
): Map<number, { professor: Professor; availableDays: number[] }> {
  const map = new Map<number, { professor: Professor; availableDays: number[] }>();
  for (const p of professors) {
    if (p.availableDays && p.availableDays.length > 0 && !p.availableDays.includes(dayOfWeek)) {
      map.set(p.id, { professor: p, availableDays: p.availableDays });
    }
  }
  return map;
}

// ---------------------- SCHEDULE MUTATIONS ----------------------
export async function addSchedule(schedule: Omit<ScheduleItem, 'id'>): Promise<{ success: boolean; id?: number; conflict?: ConflictCheckResult }> {
  const conflict = await checkScheduleConflicts({
    academicYearId: schedule.academicYearId,
    sectionId: schedule.sectionId,
    courseId: schedule.courseId,
    professorId: schedule.professorId,
    roomId: schedule.roomId,
    dayOfWeek: schedule.dayOfWeek,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    sessionType: schedule.sessionType,
  });

  if (conflict.hasConflict) {
    return { success: false, conflict };
  }

  const db = await getSqliteDb();
  const stmt = db.prepare(`
    INSERT INTO schedules (
      academic_year_id, section_id, course_id, professor_id, room_id,
      day_of_week, period_id, start_time, end_time, session_type, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run([
    schedule.academicYearId,
    schedule.sectionId,
    schedule.courseId,
    schedule.professorId,
    schedule.roomId,
    schedule.dayOfWeek,
    schedule.periodId,
    schedule.startTime,
    schedule.endTime,
    schedule.sessionType,
    schedule.notes || null,
  ]);
  stmt.free();

  const idRes = db.exec('SELECT last_insert_rowid() AS id');
  const newId = Number(idRes[0].values[0][0]);

  await saveToIndexedDB(db);
  return { success: true, id: newId };
}

export async function updateSchedule(
  id: number,
  schedule: Omit<ScheduleItem, 'id'>
): Promise<{ success: boolean; conflict?: ConflictCheckResult }> {
  const conflict = await checkScheduleConflicts({
    scheduleId: id,
    academicYearId: schedule.academicYearId,
    sectionId: schedule.sectionId,
    courseId: schedule.courseId,
    professorId: schedule.professorId,
    roomId: schedule.roomId,
    dayOfWeek: schedule.dayOfWeek,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    sessionType: schedule.sessionType,
  });

  if (conflict.hasConflict) {
    return { success: false, conflict };
  }

  const db = await getSqliteDb();
  const stmt = db.prepare(`
    UPDATE schedules SET
      academic_year_id = ?,
      section_id = ?,
      course_id = ?,
      professor_id = ?,
      room_id = ?,
      day_of_week = ?,
      period_id = ?,
      start_time = ?,
      end_time = ?,
      session_type = ?,
      notes = ?
    WHERE id = ?
  `);

  stmt.run([
    schedule.academicYearId,
    schedule.sectionId,
    schedule.courseId,
    schedule.professorId,
    schedule.roomId,
    schedule.dayOfWeek,
    schedule.periodId,
    schedule.startTime,
    schedule.endTime,
    schedule.sessionType,
    schedule.notes || null,
    id,
  ]);
  stmt.free();

  await saveToIndexedDB(db);
  return { success: true };
}

export async function deleteSchedule(id: number): Promise<boolean> {
  const db = await getSqliteDb();
  db.run(`DELETE FROM schedules WHERE id = ${id}`);
  await saveToIndexedDB(db);
  return true;
}

export async function clearAllSchedules(): Promise<boolean> {
  const db = await getSqliteDb();
  db.run('DELETE FROM schedules;');
  await saveToIndexedDB(db);
  return true;
}

// ---------------------- ENTITY CRUD ----------------------
// PROFESSORS
export async function addProfessor(prof: Omit<Professor, 'id'>): Promise<number> {
  const db = await getSqliteDb();
  const stmt = db.prepare(`
    INSERT INTO professors (name, title, department, email, phone, office, available_days)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const availDaysJson = prof.availableDays && prof.availableDays.length > 0 ? JSON.stringify(prof.availableDays) : null;
  stmt.run([prof.name, prof.title, prof.department, prof.email, prof.phone || null, prof.office || null, availDaysJson]);
  stmt.free();
  await saveToIndexedDB(db);
  const idRes = db.exec('SELECT last_insert_rowid() AS id');
  return Number(idRes[0].values[0][0]);
}

export async function updateProfessor(id: number, prof: Omit<Professor, 'id'>): Promise<void> {
  const db = await getSqliteDb();
  const stmt = db.prepare(`
    UPDATE professors SET
      name = ?, title = ?, department = ?, email = ?, phone = ?, office = ?, available_days = ?
    WHERE id = ?
  `);
  const availDaysJson = prof.availableDays && prof.availableDays.length > 0 ? JSON.stringify(prof.availableDays) : null;
  stmt.run([prof.name, prof.title, prof.department, prof.email, prof.phone || null, prof.office || null, availDaysJson, id]);
  stmt.free();
  await saveToIndexedDB(db);
}

export async function deleteProfessor(id: number): Promise<void> {
  const db = await getSqliteDb();
  db.run(`DELETE FROM professors WHERE id = ${id}`);
  await saveToIndexedDB(db);
}

// ROOMS
export async function addRoom(room: Omit<Room, 'id'>): Promise<number> {
  const db = await getSqliteDb();
  const stmt = db.prepare(`
    INSERT INTO rooms (code, name, type, capacity, building, floor)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run([room.code, room.name, room.type, room.capacity, room.building, room.floor]);
  stmt.free();
  await saveToIndexedDB(db);
  const idRes = db.exec('SELECT last_insert_rowid() AS id');
  return Number(idRes[0].values[0][0]);
}

export async function updateRoom(id: number, room: Omit<Room, 'id'>): Promise<void> {
  const db = await getSqliteDb();
  const stmt = db.prepare(`
    UPDATE rooms SET
      code = ?, name = ?, type = ?, capacity = ?, building = ?, floor = ?
    WHERE id = ?
  `);
  stmt.run([room.code, room.name, room.type, room.capacity, room.building, room.floor, id]);
  stmt.free();
  await saveToIndexedDB(db);
}

export async function deleteRoom(id: number): Promise<void> {
  const db = await getSqliteDb();
  db.run(`DELETE FROM rooms WHERE id = ${id}`);
  await saveToIndexedDB(db);
}

// COURSES
export async function addCourse(course: Omit<Course, 'id'>): Promise<number> {
  const db = await getSqliteDb();
  const stmt = db.prepare(`
    INSERT INTO courses (code, name, credit_hours, department, year_id, program_id, color_hex, prerequisite_ids, semester, target_group, has_sections)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const prereqsJson = course.prerequisiteIds && course.prerequisiteIds.length > 0 ? JSON.stringify(course.prerequisiteIds) : null;
  stmt.run([
    course.code,
    course.name,
    course.creditHours,
    course.department,
    course.yearId,
    course.programId ?? null,
    course.colorHex || '#3b82f6',
    prereqsJson,
    course.semester ?? 1,
    course.targetGroup || 'ALL',
    course.hasSections !== false ? 1 : 0,
  ]);
  stmt.free();

  const idRes = db.exec('SELECT last_insert_rowid() AS id');
  const newId = Number(idRes[0].values[0][0]);

  if (course.prerequisiteIds && course.prerequisiteIds.length > 0) {
    for (const pid of course.prerequisiteIds) {
      db.run(`INSERT OR IGNORE INTO course_dependencies (course_id, prerequisite_id) VALUES (${newId}, ${pid})`);
    }
  }

  await saveToIndexedDB(db);
  return newId;
}

export async function updateCourse(id: number, course: Omit<Course, 'id'>): Promise<void> {
  const db = await getSqliteDb();
  const stmt = db.prepare(`
    UPDATE courses SET
      code = ?, name = ?, credit_hours = ?, department = ?, year_id = ?, program_id = ?, color_hex = ?, prerequisite_ids = ?, semester = ?, target_group = ?, has_sections = ?
    WHERE id = ?
  `);
  const prereqsJson = course.prerequisiteIds && course.prerequisiteIds.length > 0 ? JSON.stringify(course.prerequisiteIds) : null;
  stmt.run([
    course.code,
    course.name,
    course.creditHours,
    course.department,
    course.yearId,
    course.programId ?? null,
    course.colorHex || '#3b82f6',
    prereqsJson,
    course.semester ?? 1,
    course.targetGroup || 'ALL',
    course.hasSections !== false ? 1 : 0,
    id,
  ]);
  stmt.free();

  db.run(`DELETE FROM course_dependencies WHERE course_id = ${id}`);
  if (course.prerequisiteIds && course.prerequisiteIds.length > 0) {
    for (const pid of course.prerequisiteIds) {
      db.run(`INSERT OR IGNORE INTO course_dependencies (course_id, prerequisite_id) VALUES (${id}, ${pid})`);
    }
  }

  await saveToIndexedDB(db);
}

export async function updateCourseTargetGroup(id: number, targetGroup: TargetGroup): Promise<void> {
  const db = await getSqliteDb();
  const stmt = db.prepare('UPDATE courses SET target_group = ? WHERE id = ?;');
  stmt.run([targetGroup, id]);
  stmt.free();
  await saveToIndexedDB(db);
}

export async function updateCourseHasSections(id: number, hasSections: boolean): Promise<void> {
  const db = await getSqliteDb();
  const stmt = db.prepare('UPDATE courses SET has_sections = ? WHERE id = ?;');
  stmt.run([hasSections ? 1 : 0, id]);
  stmt.free();
  await saveToIndexedDB(db);
}

export async function deleteCourse(id: number): Promise<void> {
  const db = await getSqliteDb();
  db.run(`DELETE FROM course_dependencies WHERE course_id = ${id} OR prerequisite_id = ${id}`);
  db.run(`DELETE FROM courses WHERE id = ${id}`);
  await saveToIndexedDB(db);
}

// PROGRAMS
export async function addProgram(prog: Omit<Program, 'id'>): Promise<number> {
  const db = await getSqliteDb();
  const stmt = db.prepare(`
    INSERT INTO programs (code, name, department)
    VALUES (?, ?, ?)
  `);
  stmt.run([prog.code.trim().toUpperCase(), prog.name.trim(), prog.department.trim()]);
  stmt.free();
  await saveToIndexedDB(db);
  const idRes = db.exec('SELECT last_insert_rowid() AS id');
  return Number(idRes[0].values[0][0]);
}

export async function updateProgram(id: number, prog: Omit<Program, 'id'>): Promise<void> {
  const db = await getSqliteDb();
  const stmt = db.prepare(`
    UPDATE programs SET
      code = ?, name = ?, department = ?
    WHERE id = ?
  `);
  stmt.run([prog.code.trim().toUpperCase(), prog.name.trim(), prog.department.trim(), id]);
  stmt.free();
  await saveToIndexedDB(db);
}

export async function deleteProgram(id: number): Promise<void> {
  const db = await getSqliteDb();
  db.run(`DELETE FROM programs WHERE id = ${id}`);
  await saveToIndexedDB(db);
}

// SECTIONS
export async function addSection(sec: Omit<Section, 'id'>): Promise<number> {
  const db = await getSqliteDb();
  const stmt = db.prepare(`
    INSERT INTO sections (year_id, program_id, name, capacity)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run([sec.yearId, sec.programId ?? null, sec.name, sec.capacity]);
  stmt.free();
  await saveToIndexedDB(db);
  const idRes = db.exec('SELECT last_insert_rowid() AS id');
  return Number(idRes[0].values[0][0]);
}

export async function updateSection(id: number, sec: Omit<Section, 'id'>): Promise<void> {
  const db = await getSqliteDb();
  const stmt = db.prepare(`
    UPDATE sections SET
      year_id = ?, program_id = ?, name = ?, capacity = ?
    WHERE id = ?
  `);
  stmt.run([sec.yearId, sec.programId ?? null, sec.name, sec.capacity, id]);
  stmt.free();
  await saveToIndexedDB(db);
}

export async function deleteSection(id: number): Promise<void> {
  const db = await getSqliteDb();
  db.run(`DELETE FROM sections WHERE id = ${id}`);
  await saveToIndexedDB(db);
}

// AI CURRICULUM SYNC
export { syncAiCurriculumFromTemplate } from './sqlite';
