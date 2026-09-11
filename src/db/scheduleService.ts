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

export async function getProfessors(): Promise<Professor[]> {
  const db = await getSqliteDb();
  const res = db.exec('SELECT id, name, title, department, email, phone, office FROM professors ORDER BY name ASC');
  return rowsToObjects<Professor>(res);
}

export async function getRooms(): Promise<Room[]> {
  const db = await getSqliteDb();
  const res = db.exec('SELECT id, code, name, type, capacity, building, floor FROM rooms ORDER BY code ASC');
  return rowsToObjects<Room>(res);
}

export async function getCourses(yearId?: number): Promise<Course[]> {
  const db = await getSqliteDb();
  const sql = yearId
    ? `SELECT id, code, name, credit_hours, department, year_id, color_hex FROM courses WHERE year_id = ${yearId} ORDER BY code ASC`
    : 'SELECT id, code, name, credit_hours, department, year_id, color_hex FROM courses ORDER BY code ASC';
  const res = db.exec(sql);
  return rowsToObjects<Course>(res);
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
    whereClauses.push(`(sec.program_id = ${filter.programId} OR s.section_id IS NULL)`);
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
      c.code AS course_code,
      c.name AS course_name,
      c.color_hex AS course_color,
      p.name AS professor_name,
      p.title AS professor_title,
      r.code AS room_code,
      r.name AS room_name,
      r.type AS room_type,
      r.capacity AS room_capacity,
      r.building
    FROM schedules s
    JOIN academic_years ay ON s.academic_year_id = ay.id
    LEFT JOIN sections sec ON s.section_id = sec.id
    LEFT JOIN programs prog ON sec.program_id = prog.id
    JOIN courses c ON s.course_id = c.id
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

      // 3. COHORT CONFLICT: Same year/section
      if (item.academicYearId === input.academicYearId) {
        // If either the new one or existing one is a whole-year LECTURE (sectionId is null), it affects everyone in that year!
        if (input.sectionId === null || item.sectionId === null) {
          const who = input.sectionId === null ? 'All students in this year' : `${item.sectionName || 'All students'}`;
          return {
            hasConflict: true,
            conflictType: 'SECTION',
            message: `Cohort Schedule Conflict: ${who} already have "${item.courseCode} (${item.sessionType})" from ${item.startTime} to ${item.endTime}.`,
            conflictingSchedule: item,
          };
        }
        // Both are sections: conflict if they are the exact same section
        if (input.sectionId === item.sectionId) {
          return {
            hasConflict: true,
            conflictType: 'SECTION',
            message: `Section Conflict: ${item.sectionName} is already scheduled for "${item.courseCode} (${item.sessionType})" from ${item.startTime} to ${item.endTime}.`,
            conflictingSchedule: item,
          };
        }
      }
    }
  }

  return { hasConflict: false };
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
    INSERT INTO professors (name, title, department, email, phone, office)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run([prof.name, prof.title, prof.department, prof.email, prof.phone || null, prof.office || null]);
  stmt.free();
  await saveToIndexedDB(db);
  const idRes = db.exec('SELECT last_insert_rowid() AS id');
  return Number(idRes[0].values[0][0]);
}

export async function updateProfessor(id: number, prof: Omit<Professor, 'id'>): Promise<void> {
  const db = await getSqliteDb();
  const stmt = db.prepare(`
    UPDATE professors SET
      name = ?, title = ?, department = ?, email = ?, phone = ?, office = ?
    WHERE id = ?
  `);
  stmt.run([prof.name, prof.title, prof.department, prof.email, prof.phone || null, prof.office || null, id]);
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
    INSERT INTO courses (code, name, credit_hours, department, year_id, color_hex)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run([course.code, course.name, course.creditHours, course.department, course.yearId, course.colorHex || '#3b82f6']);
  stmt.free();
  await saveToIndexedDB(db);
  const idRes = db.exec('SELECT last_insert_rowid() AS id');
  return Number(idRes[0].values[0][0]);
}

export async function updateCourse(id: number, course: Omit<Course, 'id'>): Promise<void> {
  const db = await getSqliteDb();
  const stmt = db.prepare(`
    UPDATE courses SET
      code = ?, name = ?, credit_hours = ?, department = ?, year_id = ?, color_hex = ?
    WHERE id = ?
  `);
  stmt.run([course.code, course.name, course.creditHours, course.department, course.yearId, course.colorHex || '#3b82f6', id]);
  stmt.free();
  await saveToIndexedDB(db);
}

export async function deleteCourse(id: number): Promise<void> {
  const db = await getSqliteDb();
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
