import initSqlJs, { type Database } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { seedAiCurriculum } from './aiCurriculumData';

const DB_INDEXED_DB_NAME = 'UniversityScheduleDB';
const DB_STORE_NAME = 'sqlite_binary';
const DB_KEY = 'university_timetable_db';

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

// IndexedDB Helper to persist raw SQLite Uint8Array
function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_INDEXED_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE_NAME)) {
        db.createObjectStore(DB_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadFromIndexedDB(): Promise<Uint8Array | null> {
  try {
    const idb = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(DB_STORE_NAME, 'readonly');
      const store = tx.objectStore(DB_STORE_NAME);
      const req = store.get(DB_KEY);
      req.onsuccess = () => {
        if (req.result instanceof Uint8Array) {
          resolve(req.result);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to load SQLite from IndexedDB:', err);
    return null;
  }
}

export async function saveToIndexedDB(db: Database): Promise<void> {
  try {
    const data = db.export();
    const idb = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(DB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(DB_STORE_NAME);
      const req = store.put(data, DB_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to save SQLite to IndexedDB:', err);
  }
}

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

CREATE TABLE IF NOT EXISTS course_dependencies (
  course_id INTEGER NOT NULL,
  prerequisite_id INTEGER NOT NULL,
  PRIMARY KEY (course_id, prerequisite_id),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (prerequisite_id) REFERENCES courses(id) ON DELETE CASCADE
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

// Essential foundation required for the system to operate (Admin account, Academic Years, Standard Periods)
// NO sample courses, NO sample sections, NO sample schedules, NO sample rooms, NO sample professors.
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

// Optional demo/sample university dataset (can be loaded on demand)
const SAMPLE_DATA_SQL = `
-- Academic Programs
INSERT INTO programs (id, code, name, department) VALUES
(1, 'CS', 'Computer Science', 'Department of Computer Science'),
(2, 'SE', 'Software Engineering', 'Department of Software Engineering'),
(3, 'AI', 'Artificial Intelligence & Data Science', 'Department of Computer Science'),
(4, 'CYBER', 'Cybersecurity & Computer Networks', 'Department of Networks');

-- Sections for Year 1
INSERT INTO sections (year_id, program_id, name, capacity) VALUES
(1, 1, 'CS Section 1 (Group A)', 35),
(1, 1, 'CS Section 2 (Group B)', 35),
(1, 2, 'SE Section 1 (Group A)', 35),
(1, 3, 'AI Section 1 (Group A)', 35);

-- Sections for Year 2
INSERT INTO sections (year_id, program_id, name, capacity) VALUES
(2, 1, 'CS Section 1 (Algorithms)', 30),
(2, 2, 'SE Section 1 (OOP & Design)', 30),
(2, 4, 'CYBER Section 1 (Network Security)', 30);

-- Sections for Year 3
INSERT INTO sections (year_id, program_id, name, capacity) VALUES
(3, 1, 'CS Section 1 (Databases)', 28),
(3, 3, 'AI Section 1 (Machine Learning)', 28),
(3, 4, 'CYBER Section 1 (Protocols & Defense)', 28);

-- Sections for Year 4
INSERT INTO sections (year_id, program_id, name, capacity) VALUES
(4, 1, 'CS Section 1 (Graduation Projects)', 25),
(4, 2, 'SE Section 1 (Enterprise Capstone)', 25),
(4, 3, 'AI Section 1 (Deep Learning Capstone)', 25);

-- Sections for Preparatory Year (Two Parallel Groups with Independent Timetables: Group A & Group B)
INSERT INTO sections (year_id, program_id, name, capacity) VALUES
(5, NULL, 'Group A', 150),
(5, NULL, 'Group B', 150);

-- Professors & Teaching Assistants
INSERT INTO professors (name, title, department, email, phone, office, available_days) VALUES
('Dr. Alan Turing', 'Prof.', 'Computer Science', 'a.turing@univ.edu', '+1-555-0101', 'Hall 301', '[0,2,4]'),
('Dr. Grace Hopper', 'Prof.', 'Software Engineering', 'g.hopper@univ.edu', '+1-555-0102', 'Hall 304', '[1,3]'),
('Dr. Donald Knuth', 'Prof.', 'Algorithms & Mathematics', 'd.knuth@univ.edu', '+1-555-0103', 'Hall 205', '[0,1,2]'),
('Dr. Barbara Liskov', 'Prof.', 'Computer Systems', 'b.liskov@univ.edu', '+1-555-0104', 'Hall 310', NULL),
('Eng. David Patterson', 'TA', 'Computer Science', 'd.patterson@univ.edu', '+1-555-0201', 'Lab Tech 1', '[0,1,2,3,4]'),
('Eng. Margaret Hamilton', 'TA', 'Software Engineering', 'm.hamilton@univ.edu', '+1-555-0202', 'Lab Tech 2', '[0,2,3]'),
('Eng. Linus Torvalds', 'TA', 'Operating Systems', 'l.torvalds@univ.edu', '+1-555-0203', 'Lab Tech 3', '[1,2,4]');

-- Rooms
INSERT INTO rooms (code, name, type, capacity, building, floor) VALUES
('HALL-A', 'Auditorium Alpha (Main Hall)', 'LECTURE_HALL', 220, 'Building A - Engineering', 1),
('HALL-B', 'Auditorium Beta', 'LECTURE_HALL', 150, 'Building A - Engineering', 2),
('HALL-C', 'Hall Gamma (Science)', 'LECTURE_HALL', 100, 'Building B - Science', 1),
('LAB-101', 'High-Performance Computing Lab', 'COMPUTER_LAB', 40, 'Building C - IT', 1),
('LAB-102', 'Software & AI Development Lab', 'COMPUTER_LAB', 38, 'Building C - IT', 1),
('LAB-201', 'Cybersecurity & Networks Lab', 'COMPUTER_LAB', 35, 'Building C - IT', 2),
('ROOM-301', 'Tutorial Classroom 301', 'TUTORIAL_ROOM', 45, 'Building B - Science', 3),
('ROOM-302', 'Tutorial Classroom 302', 'TUTORIAL_ROOM', 45, 'Building B - Science', 3);

-- Courses
INSERT INTO courses (id, code, name, credit_hours, department, year_id, program_id, color_hex, prerequisite_ids) VALUES
(1, 'CS101', 'Introduction to Programming & Logic', 3, 'Computer Science', 1, 1, '#3b82f6', NULL),
(2, 'MATH101', 'Calculus & Analytical Geometry', 3, 'Mathematics', 1, NULL, '#8b5cf6', NULL),
(3, 'PHYS101', 'General Physics for Engineers', 3, 'Physics', 1, NULL, '#06b6d4', NULL),
(4, 'CS201', 'Data Structures & Algorithms', 3, 'Computer Science', 2, 1, '#10b981', '[1]'),
(5, 'CS202', 'Object-Oriented Programming (Java)', 3, 'Software Engineering', 2, 2, '#f59e0b', '[1]'),
(6, 'CS203', 'Computer Architecture & Assembly', 3, 'Computer Science', 2, 1, '#ef4444', '[1]'),
(7, 'CS301', 'Database Systems & SQL Design', 3, 'Computer Science', 3, 1, '#ec4899', '[4]'),
(8, 'CS302', 'Operating Systems & Concurrency', 3, 'Computer Science', 3, 1, '#6366f1', '[6]'),
(9, 'CS303', 'Computer Networks & Protocols', 3, 'Networks', 3, 4, '#14b8a6', '[6]'),
(10, 'CS401', 'Artificial Intelligence & ML', 3, 'Computer Science', 4, 3, '#84cc16', '[2,4]'),
(11, 'CS499', 'Senior Capstone Graduation Project', 4, 'Software Engineering', 4, 2, '#a855f7', '[5,7]'),
(12, 'MATH001', 'Engineering Mathematics I (Calculus & Algebra)', 3, 'Basic Sciences', 5, NULL, '#3b82f6', NULL),
(13, 'PHYS001', 'Engineering Physics (Mechanics & Waves)', 3, 'Basic Sciences', 5, NULL, '#06b6d4', NULL),
(14, 'ENG001', 'Engineering Graphics & Descriptive Geometry', 3, 'General Engineering', 5, NULL, '#f59e0b', NULL),
(15, 'CHEM001', 'General Chemistry for Engineers', 3, 'Basic Sciences', 5, NULL, '#10b981', NULL);

-- Course Dependencies (GPA System)
INSERT INTO course_dependencies (course_id, prerequisite_id) VALUES
(4, 1),
(5, 1),
(6, 1),
(7, 4),
(8, 6),
(9, 6),
(10, 2),
(10, 4),
(11, 5),
(11, 7);

-- Schedules
INSERT INTO schedules (academic_year_id, section_id, course_id, professor_id, room_id, day_of_week, period_id, start_time, end_time, session_type, notes)
VALUES (1, NULL, 1, 1, 1, 0, 1, '10:00', '11:15', 'LECTURE', 'Mandatory attendance for all Year 1');
INSERT INTO schedules (academic_year_id, section_id, course_id, professor_id, room_id, day_of_week, period_id, start_time, end_time, session_type, notes)
VALUES (1, 1, 1, 5, 4, 0, 2, '11:30', '12:45', 'SECTION', 'CS Section 1 Practical Lab');
INSERT INTO schedules (academic_year_id, section_id, course_id, professor_id, room_id, day_of_week, period_id, start_time, end_time, session_type, notes)
VALUES (1, 2, 1, 6, 5, 0, 2, '11:30', '12:45', 'SECTION', 'CS Section 2 Practical Lab');
INSERT INTO schedules (academic_year_id, section_id, course_id, professor_id, room_id, day_of_week, period_id, start_time, end_time, session_type, notes)
VALUES (2, 3, 4, 7, 4, 1, 2, '11:30', '12:45', 'SECTION', 'Algorithms & Data Structures Practical Section');
INSERT INTO schedules (academic_year_id, section_id, course_id, professor_id, room_id, day_of_week, period_id, start_time, end_time, session_type, notes)
VALUES (2, NULL, 4, 2, 2, 0, 3, '13:00', '14:15', 'LECTURE', 'Year 2 Algorithms Lecture (Moved to P3 to avoid GPA conflict with CS101)');
INSERT INTO schedules (academic_year_id, section_id, course_id, professor_id, room_id, day_of_week, period_id, start_time, end_time, session_type, notes)
VALUES (3, NULL, 7, 3, 3, 1, 1, '10:00', '11:15', 'LECTURE', 'Year 3 Database Theory');
INSERT INTO schedules (academic_year_id, section_id, course_id, professor_id, room_id, day_of_week, period_id, start_time, end_time, session_type, notes)
VALUES (4, NULL, 10, 1, 1, 2, 1, '10:00', '11:15', 'LECTURE', 'Year 4 AI & Neural Networks');
INSERT INTO schedules (academic_year_id, section_id, course_id, professor_id, room_id, day_of_week, period_id, start_time, end_time, session_type, notes)
VALUES (5, NULL, 12, 1, 1, 0, 1, '10:00', '11:15', 'LECTURE', 'Preparatory Calculus Lecture');
`;

const PROGRAMS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  department TEXT NOT NULL
);
`;

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
    const periodsCheck = db.exec("SELECT end_time FROM standard_periods WHERE id = 1 OR period_number = 1;");
    const firstPeriodEnd = periodsCheck?.[0]?.values?.[0]?.[0];
    if (firstPeriodEnd !== '11:15') {
      db.run(`
        DELETE FROM standard_periods;
        INSERT INTO standard_periods (id, period_number, start_time, end_time, label) VALUES
        (1, 1, '10:00', '11:15', 'Period 1 (10:00 - 11:15)'),
        (2, 2, '11:30', '12:45', 'Period 2 (11:30 - 12:45)'),
        (3, 3, '13:00', '14:15', 'Period 3 (01:00 - 02:15)'),
        (4, 4, '14:30', '15:45', 'Period 4 (02:30 - 03:45)');
      `);
      // Update any existing schedules referencing old period timings
      db.run(`
        UPDATE schedules SET start_time = '10:00', end_time = '11:15' WHERE period_id = 1;
        UPDATE schedules SET start_time = '11:30', end_time = '12:45' WHERE period_id = 2;
        UPDATE schedules SET start_time = '13:00', end_time = '14:15' WHERE period_id = 3;
        UPDATE schedules SET start_time = '14:30', end_time = '15:45' WHERE period_id = 4;
        UPDATE schedules SET period_id = 4, start_time = '14:30', end_time = '15:45' WHERE period_id >= 5;
      `);
    }

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

    const savedBinary = await loadFromIndexedDB();
    if (savedBinary && savedBinary.length > 0) {
      try {
        const loadedDb = new SQL.Database(savedBinary) as Database;
        migrateExistingDatabase(loadedDb);
        dbInstance = loadedDb;
        console.log('Loaded existing SQLite database from IndexedDB.');
        await saveToIndexedDB(loadedDb);
        return loadedDb;
      } catch (e) {
        console.error('Error opening saved SQLite DB, creating new:', e);
      }
    }

    // Initialize fresh DB with empty schema, bootstrap structure, and official AI curriculum
    console.log('Initializing fresh SQLite database with clean schema and AI curriculum...');
    const freshDb = new SQL.Database() as Database;
    freshDb.run(SCHEMA_SQL);
    freshDb.run(SYSTEM_BOOTSTRAP_SQL);
    seedAiCurriculum(freshDb);
    dbInstance = freshDb;
    await saveToIndexedDB(freshDb);

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
  await saveToIndexedDB(emptyDb);
  console.log('Database reset to empty state (sample data removed).');
  return emptyDb;
}

/**
 * Reset action: alias to resetDatabaseToEmpty() to ensure sample data is never restored by default.
 */
export async function resetDatabaseToDefault(): Promise<Database> {
  return resetDatabaseToEmpty();
}

/**
 * Clears ONLY the scheduled timetable sessions.
 * Preserves faculty members, degree programs, courses, sections, halls/rooms, and admin credentials.
 */
export async function clearTimetableOnly(): Promise<Database> {
  const db = await getSqliteDb();
  db.run('DELETE FROM schedules;');
  await saveToIndexedDB(db);
  console.log('Cleared timetable sessions only (preserved faculty, rooms, courses & programs).');
  return db;
}

/**
 * Populates sample demo university data (courses, sections, rooms, professors, and schedules)
 */
export async function loadSampleUniversityData(): Promise<Database> {
  const SQL = await getSqlJsStatic();

  const sampleDb = new SQL.Database() as Database;
  sampleDb.run(SCHEMA_SQL);
  sampleDb.run(SYSTEM_BOOTSTRAP_SQL);
  sampleDb.run(SAMPLE_DATA_SQL);
  seedAiCurriculum(sampleDb);
  dbInstance = sampleDb;
  await saveToIndexedDB(sampleDb);
  console.log('Sample university dataset loaded successfully with AI curriculum.');
  return sampleDb;
}

/**
 * Manually synchronize or re-seed the AI curriculum and its 26 prerequisite dependencies
 * extracted from template.xlsx into the currently active database.
 */
export async function syncAiCurriculumFromTemplate(): Promise<{
  insertedCount: number;
  updatedCount: number;
  prereqsLinked: number;
}> {
  const db = await getSqliteDb();
  const res = seedAiCurriculum(db);
  await saveToIndexedDB(db);
  return res;
}

export async function exportDatabaseFile(): Promise<void> {
  const db = await getSqliteDb();
  const binary = db.export();
  const blob = new Blob([binary.buffer as ArrayBuffer], { type: 'application/x-sqlite3' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `university_schedule_${new Date().toISOString().slice(0, 10)}.sqlite`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
  await saveToIndexedDB(newDb);
  return newDb;
}
