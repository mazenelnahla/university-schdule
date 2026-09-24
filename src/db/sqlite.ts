import initSqlJs, { type Database } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { seedAiCurriculum } from './aiCurriculumData';

let dbInstance: Database | null = null;
let initPromise: Promise<Database> | null = null;
let sqlStaticPromise: Promise<any> | null = null;
let cachedWasmBinary: ArrayBuffer | null = null;

async function loadWasmBinary(): Promise<ArrayBuffer> {
  if (cachedWasmBinary) return cachedWasmBinary;

  const candidateUrls = [wasmUrl, '/sql-wasm.wasm'];
  for (const url of candidateUrls) {
    try {
      console.log(`Attempting to load SQLite WASM from: ${url}`);
      const res = await fetch(url);
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        // Check WebAssembly magic bytes (0x00, 0x61, 0x73, 0x6d -> \0asm)
        if (bytes.length > 4 && bytes[0] === 0x00 && bytes[1] === 0x61 && bytes[2] === 0x73 && bytes[3] === 0x6d) {
          console.log(`Successfully verified SQLite WebAssembly binary (${bytes.length} bytes) from ${url}`);
          cachedWasmBinary = buffer;
          return buffer;
        } else {
          console.warn(`URL ${url} returned invalid magic bytes (${bytes.slice(0, 4).join(', ')}), likely HTML fallback.`);
        }
      }
    } catch (err) {
      console.warn(`Failed to fetch wasm from ${url}:`, err);
    }
  }

  throw new Error('Failed to load valid SQLite WASM binary from all candidate URLs.');
}

async function getSqlJsStatic() {
  if (sqlStaticPromise) return sqlStaticPromise;

  sqlStaticPromise = (async () => {
    const wasmBinary = await loadWasmBinary();
    return await initSqlJs({
      wasmBinary,
    });
  })();

  return sqlStaticPromise;
}

export async function saveToLocalFile(db: Database): Promise<void> {
  const binary = db.export();
  const body = binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength) as ArrayBuffer;
  const response = await fetch('/api/database', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/x-sqlite3' },
    body,
  });
  if (!response.ok) {
    throw new Error(`Failed to save project database (${response.status})`);
  }
}

export async function openLocalDatabaseFile(): Promise<Database> {
  return getSqliteDb();
}

// Kept as a compatibility alias for database service modules.
// SQL Schema definition
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS academic_years (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  semester TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  department TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year_id INTEGER NOT NULL,
  program_id INTEGER,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 35,
  FOREIGN KEY (year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
  FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS professors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  department TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  office TEXT,
  available_days TEXT
);

CREATE TABLE IF NOT EXISTS teaching_assistants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  office TEXT,
  available_days TEXT
);

CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'LECTURE_HALL', 'COMPUTER_LAB', 'TUTORIAL_ROOM', 'WORKSHOP'
  capacity INTEGER NOT NULL,
  building TEXT NOT NULL,
  floor INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  credit_hours INTEGER NOT NULL,
  department TEXT NOT NULL,
  year_id INTEGER NOT NULL,
  program_id INTEGER, -- NULL = Common Core / All Programs in this Year
  color_hex TEXT NOT NULL DEFAULT '#3b82f6',
  prerequisite_ids TEXT, -- JSON array of dependent course IDs, e.g. '[1, 2]'
  semester INTEGER NOT NULL DEFAULT 1,
  target_group TEXT NOT NULL DEFAULT 'ALL', -- 'ALL', 'GROUP_A', 'GROUP_B'
  has_sections INTEGER NOT NULL DEFAULT 1, -- 1 = has sections/labs, 0 = lecture only
  FOREIGN KEY (year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
  FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS teaching_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  professor_id INTEGER,
  teaching_assistant_id INTEGER,
  UNIQUE (course_id, professor_id, teaching_assistant_id),
  CHECK (
    (professor_id IS NOT NULL AND teaching_assistant_id IS NULL) OR
    (professor_id IS NULL AND teaching_assistant_id IS NOT NULL)
  ),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (professor_id) REFERENCES professors(id) ON DELETE CASCADE,
  FOREIGN KEY (teaching_assistant_id) REFERENCES teaching_assistants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS course_dependencies (
  course_id INTEGER NOT NULL,
  prerequisite_id INTEGER NOT NULL,
  PRIMARY KEY (course_id, prerequisite_id),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (prerequisite_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS course_programs (
  course_id INTEGER NOT NULL,
  program_id INTEGER NOT NULL,
  PRIMARY KEY (course_id, program_id),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS standard_periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_number INTEGER UNIQUE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academic_year_id INTEGER NOT NULL,
  section_id INTEGER, -- NULL means for all sections of this year (whole batch lecture)
  course_id INTEGER NOT NULL,
  professor_id INTEGER NOT NULL,
  room_id INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL, -- 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  period_id INTEGER,
  start_time TEXT NOT NULL, -- 'HH:MM'
  end_time TEXT NOT NULL,   -- 'HH:MM'
  session_type TEXT NOT NULL, -- 'LECTURE' or 'SECTION'
  notes TEXT,
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE SET NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (professor_id) REFERENCES professors(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE RESTRICT,
  FOREIGN KEY (period_id) REFERENCES standard_periods(id)
);
`;

const SYSTEM_BOOTSTRAP_SQL = `
-- Default Admin: admin / admin123
INSERT INTO admin_users (username, password_hash, display_name)
VALUES ('admin', 'admin123', 'System Administrator');

-- Academic Years
INSERT INTO academic_years (id, code, name, semester) VALUES
(1, 'YEAR_1', 'Year 1 - Freshman', 'Fall Semester 2026'),
(2, 'YEAR_2', 'Year 2 - Sophomore', 'Fall Semester 2026'),
(3, 'YEAR_3', 'Year 3 - Junior', 'Fall Semester 2026'),
(4, 'YEAR_4', 'Year 4 - Senior', 'Fall Semester 2026'),
(5, 'YEAR_PREP', 'Preparatory Year', 'Fall Semester 2026');

-- Standard Periods (10:00 AM to 03:45 PM)
INSERT INTO standard_periods (period_number, start_time, end_time, label) VALUES
(1, '10:00', '11:15', 'Period 1 (10:00 - 11:15)'),
(2, '11:30', '12:45', 'Period 2 (11:30 - 12:45)'),
(3, '13:00', '14:15', 'Period 3 (01:00 - 02:15)'),
(4, '14:30', '15:45', 'Period 4 (02:30 - 03:45)');
`;


const PROGRAMS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  department TEXT NOT NULL
);
`;

const COURSE_PROGRAMS_TABLE_SQL = `
  CREATE TABLE course_programs (
    course_id INTEGER NOT NULL,
    program_id INTEGER NOT NULL,
    PRIMARY KEY (course_id, program_id),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE
  );
`;

function ensureCourseProgramsTable(db: Database): void {
  try {
    db.exec('SELECT course_id, program_id FROM course_programs LIMIT 1;');
    return;
  } catch (error) {
    console.warn('Repairing malformed course_programs schema:', error);
  }

  try {
    db.run('DROP TABLE IF EXISTS course_programs;');
  } catch {
    db.run(`
      PRAGMA writable_schema = ON;
      DELETE FROM sqlite_master
      WHERE type IN ('table', 'index', 'trigger', 'view')
        AND (name = 'course_programs' OR tbl_name = 'course_programs');
      PRAGMA writable_schema = OFF;
    `);
    db.run('VACUUM;');
  }

  db.run(COURSE_PROGRAMS_TABLE_SQL);
}

// Helper: migrate existing DB schemas if new columns or tables are introduced
export function migrateExistingDatabase(db: Database) {
  try {
    // 1. Ensure programs table exists
    db.run(PROGRAMS_TABLE_SQL);

    // 2. Check if program_id column exists in sections
    const secPragma = db.exec('PRAGMA table_info(sections);');
    const cols = (secPragma[0]?.values || []).map((row) => String(row[1]));
    if (!cols.includes('program_id')) {
      db.run('ALTER TABLE sections ADD COLUMN program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL;');
    }

    // 3. Ensure standard_periods table exists and has 10:00 to 15:45 periods (10.00:11.15, 11.30:12.45, 13.00:14.15, 14.30:15.45)
    db.run(`
      CREATE TABLE IF NOT EXISTS standard_periods (
        id INTEGER PRIMARY KEY,
        period_number INTEGER,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        label TEXT NOT NULL
      );
    `);

    // 4. Ensure YEAR_PREP academic year level exists
    const prepCheck = db.exec("SELECT id FROM academic_years WHERE code = 'YEAR_PREP' OR name LIKE '%Prep%';");
    if (!prepCheck || prepCheck.length === 0 || !prepCheck[0].values.length) {
      db.run(`
        INSERT INTO academic_years (code, name, semester) VALUES
        ('YEAR_PREP', 'Preparatory Year', 'Fall Semester 2026');
      `);
    }

    // 5. Check if available_days column exists in professors table
    const profPragma = db.exec('PRAGMA table_info(professors);');
    const profCols = (profPragma[0]?.values || []).map((row) => String(row[1]));
    if (!profCols.includes('available_days')) {
      db.run('ALTER TABLE professors ADD COLUMN available_days TEXT;');
    }

    db.run(`
      CREATE TABLE IF NOT EXISTS teaching_assistants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        department TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        office TEXT,
        available_days TEXT
      );
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS teaching_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id INTEGER NOT NULL,
        professor_id INTEGER,
        teaching_assistant_id INTEGER,
        UNIQUE (course_id, professor_id, teaching_assistant_id),
        CHECK (
          (professor_id IS NOT NULL AND teaching_assistant_id IS NULL) OR
          (professor_id IS NULL AND teaching_assistant_id IS NOT NULL)
        ),
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
        FOREIGN KEY (professor_id) REFERENCES professors(id) ON DELETE CASCADE,
        FOREIGN KEY (teaching_assistant_id) REFERENCES teaching_assistants(id) ON DELETE CASCADE
      );
    `);
    ensureCourseProgramsTable(db);

    // 6. Check if prerequisite_ids column exists in courses table
    const coursePragma = db.exec('PRAGMA table_info(courses);');
    const courseCols = (coursePragma[0]?.values || []).map((row) => String(row[1]));
    if (!courseCols.includes('prerequisite_ids')) {
      db.run('ALTER TABLE courses ADD COLUMN prerequisite_ids TEXT;');
    }

    // Ensure course_dependencies table exists
    db.run(`
      CREATE TABLE IF NOT EXISTS course_dependencies (
        course_id INTEGER NOT NULL,
        prerequisite_id INTEGER NOT NULL,
        PRIMARY KEY (course_id, prerequisite_id),
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
        FOREIGN KEY (prerequisite_id) REFERENCES courses(id) ON DELETE CASCADE
      );
    `);

    // 7. Check if program_id column exists in courses table
    if (!courseCols.includes('program_id')) {
      db.run('ALTER TABLE courses ADD COLUMN program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL;');
    }
    db.run(`
      INSERT OR IGNORE INTO course_programs (course_id, program_id)
      SELECT id, program_id FROM courses WHERE program_id IS NOT NULL;
    `);

    // 8. Check if semester column exists in courses table
    if (!courseCols.includes('semester')) {
      db.run('ALTER TABLE courses ADD COLUMN semester INTEGER NOT NULL DEFAULT 1;');
    }

    // 9. Check if target_group column exists in courses table
    if (!courseCols.includes('target_group')) {
      db.run("ALTER TABLE courses ADD COLUMN target_group TEXT NOT NULL DEFAULT 'ALL';");
    }

    // 10. Check if has_sections column exists in courses table
    if (!courseCols.includes('has_sections')) {
      db.run("ALTER TABLE courses ADD COLUMN has_sections INTEGER NOT NULL DEFAULT 1;");
    }
    db.run("UPDATE courses SET target_group = 'ALL' WHERE year_id != 5 AND target_group IN ('GROUP_A', 'GROUP_B');");

    // 11. Ensure AI curriculum subjects & prerequisite dependency links from template.xlsx exist
    seedAiCurriculum(db);

    // 9. Ensure Preparatory Year (YEAR_PREP / id: 5) has Group A and Group B
    const prepYearCheck = db.exec("SELECT id FROM academic_years WHERE code = 'YEAR_PREP' OR name LIKE '%Prep%';");
    if (prepYearCheck.length > 0 && prepYearCheck[0].values.length > 0) {
      const prepYearId = Number(prepYearCheck[0].values[0][0]);
      const prepSecRes = db.exec(`SELECT name FROM sections WHERE year_id = ${prepYearId};`);
      const existingNames = (prepSecRes[0]?.values || []).map((r) => String(r[0]));
      if (!existingNames.some((n) => /group\s*a\b/i.test(n))) {
        db.run(`INSERT INTO sections (year_id, program_id, name, capacity) VALUES (${prepYearId}, NULL, 'Group A', 150);`);
      }
      if (!existingNames.some((n) => /group\s*b\b/i.test(n))) {
        db.run(`INSERT INTO sections (year_id, program_id, name, capacity) VALUES (${prepYearId}, NULL, 'Group B', 150);`);
      }
    }
  } catch (err) {
    console.warn('Database migration note:', err);
  }
}

export async function getSqliteDb(): Promise<Database> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const SQL = await getSqlJsStatic();

    const response = await fetch('/api/database');
    if (response.ok) {
      const loadedDb = new SQL.Database(new Uint8Array(await response.arrayBuffer())) as Database;
      migrateExistingDatabase(loadedDb);
      dbInstance = loadedDb;
      await saveToLocalFile(loadedDb);
      return loadedDb;
    }

    console.log('Initializing project SQLite database with clean schema and AI curriculum...');
    const freshDb = new SQL.Database() as Database;
    freshDb.run(SCHEMA_SQL);
    freshDb.run(SYSTEM_BOOTSTRAP_SQL);
    seedAiCurriculum(freshDb);
    dbInstance = freshDb;
    await saveToLocalFile(freshDb);
    return freshDb;
  })();

  return initPromise;
}

/**
 * Resets and completely empties the database:
 * Deletes all schedules, courses, sections, rooms, professors, and programs.
 * Retains system essentials (admin login, academic year levels, standard periods).
 */
export async function resetDatabaseToEmpty(): Promise<Database> {
  const SQL = await getSqlJsStatic();

  const emptyDb = new SQL.Database() as Database;
  emptyDb.run(SCHEMA_SQL);
  emptyDb.run(SYSTEM_BOOTSTRAP_SQL);
  dbInstance = emptyDb;
  await saveToLocalFile(emptyDb);
  console.log('Database reset to empty state (sample data removed).');
  return emptyDb;
}

export async function loadSampleUniversityData(): Promise<Database> {
  const SQL = await getSqlJsStatic();
  const sampleDb = new SQL.Database() as Database;
  sampleDb.run(SCHEMA_SQL);
  sampleDb.run(SYSTEM_BOOTSTRAP_SQL);
  sampleDb.run(`
    INSERT INTO programs (id, code, name, department) VALUES
      (1, 'CS', 'Computer Science', 'Department of Computer Science'),
      (2, 'SE', 'Software Engineering', 'Department of Software Engineering');
    INSERT INTO sections (year_id, program_id, name, capacity) VALUES
      (1, 1, 'CS Section 1', 35), (1, 2, 'SE Section 1', 35);
    INSERT INTO professors (name, title, department, email, phone, office)
      VALUES ('Dr. Alan Turing', 'Prof.', 'Computer Science', 'a.turing@univ.edu', '+1-555-0101', 'Hall 301');
    INSERT INTO rooms (code, name, type, capacity, building, floor)
      VALUES ('HALL-A', 'Auditorium Alpha', 'LECTURE_HALL', 220, 'Engineering', 1);
    INSERT INTO courses (id, code, name, credit_hours, department, year_id, program_id, color_hex)
      VALUES (1, 'CS101', 'Introduction to Programming', 3, 'Computer Science', 1, 1, '#3b82f6');
    INSERT INTO schedules
      (academic_year_id, course_id, professor_id, room_id, day_of_week, period_id, start_time, end_time, session_type, notes)
      VALUES (1, 1, 1, 1, 0, 1, '10:00', '11:15', 'LECTURE', 'Sample lecture');
  `);
  seedAiCurriculum(sampleDb);
  dbInstance = sampleDb;
  await saveToLocalFile(sampleDb);
  return sampleDb;
}


/**
 * Clears ONLY the scheduled timetable sessions.
 * Preserves faculty members, degree programs, courses, sections, halls/rooms, and admin credentials.
 */
export async function clearTimetableOnly(): Promise<Database> {
  const db = await getSqliteDb();
  db.run('DELETE FROM schedules;');
  await saveToLocalFile(db);
  console.log('Cleared timetable sessions only (preserved faculty, rooms, courses & programs).');
  return db;
}

export async function syncAiCurriculumFromTemplate(): Promise<{
  insertedCount: number;
  updatedCount: number;
  prereqsLinked: number;
}> {
  const db = await getSqliteDb();
  const res = seedAiCurriculum(db);
  await saveToLocalFile(db);
  return res;
}

export async function exportDatabaseFile(): Promise<void> {
  const db = await getSqliteDb();
  await saveToLocalFile(db);
}

export async function importDatabaseFile(file: File): Promise<Database> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);
  const SQL = await getSqlJsStatic();
  const newDb = new SQL.Database(uint8) as Database;
  // Verify it contains basic tables
  const check = newDb.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='schedules'");
  if (check.length === 0 || !check[0].values.length) {
    throw new Error('Invalid SQLite database file: Missing schedules table');
  }
  dbInstance = newDb;
  await saveToLocalFile(newDb);
  return newDb;
}
