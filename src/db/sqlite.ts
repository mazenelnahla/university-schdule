import initSqlJs, { type Database } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

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
  office TEXT
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
  color_hex TEXT NOT NULL DEFAULT '#3b82f6',
  FOREIGN KEY (year_id) REFERENCES academic_years(id) ON DELETE CASCADE
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

const SEED_DATA_SQL = `
-- Default Admin: admin / admin123
INSERT INTO admin_users (username, password_hash, display_name)
VALUES ('admin', 'admin123', 'System Administrator');

-- Academic Years
INSERT INTO academic_years (code, name, semester) VALUES
('YEAR_1', 'Year 1 - Freshman', 'Fall Semester 2026'),
('YEAR_2', 'Year 2 - Sophomore', 'Fall Semester 2026'),
('YEAR_3', 'Year 3 - Junior', 'Fall Semester 2026'),
('YEAR_4', 'Year 4 - Senior', 'Fall Semester 2026');

-- Academic Programs (Each program has its own sections & specialization)
INSERT INTO programs (id, code, name, department) VALUES
(1, 'CS', 'Computer Science', 'Department of Computer Science'),
(2, 'SE', 'Software Engineering', 'Department of Software Engineering'),
(3, 'AI', 'Artificial Intelligence & Data Science', 'Department of Computer Science'),
(4, 'CYBER', 'Cybersecurity & Computer Networks', 'Department of Networks');

-- Sections for Year 1 (Grouped by Program)
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

-- Standard Periods
INSERT INTO standard_periods (period_number, start_time, end_time, label) VALUES
(1, '08:30', '10:00', 'Period 1 (08:30 - 10:00)'),
(2, '10:15', '11:45', 'Period 2 (10:15 - 11:45)'),
(3, '12:00', '13:30', 'Period 3 (12:00 - 13:30)'),
(4, '13:45', '15:15', 'Period 4 (13:45 - 15:15)'),
(5, '15:30', '17:00', 'Period 5 (15:30 - 17:00)');

-- Professors & Teaching Assistants
INSERT INTO professors (name, title, department, email, phone, office) VALUES
('Dr. Alan Turing', 'Prof.', 'Computer Science', 'a.turing@univ.edu', '+1-555-0101', 'Hall 301'),
('Dr. Grace Hopper', 'Prof.', 'Software Engineering', 'g.hopper@univ.edu', '+1-555-0102', 'Hall 304'),
('Dr. Donald Knuth', 'Prof.', 'Algorithms & Mathematics', 'd.knuth@univ.edu', '+1-555-0103', 'Hall 205'),
('Dr. Barbara Liskov', 'Prof.', 'Computer Systems', 'b.liskov@univ.edu', '+1-555-0104', 'Hall 310'),
('Eng. David Patterson', 'TA', 'Computer Science', 'd.patterson@univ.edu', '+1-555-0201', 'Lab Tech 1'),
('Eng. Margaret Hamilton', 'TA', 'Software Engineering', 'm.hamilton@univ.edu', '+1-555-0202', 'Lab Tech 2'),
('Eng. Linus Torvalds', 'TA', 'Operating Systems', 'l.torvalds@univ.edu', '+1-555-0203', 'Lab Tech 3');

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
INSERT INTO courses (code, name, credit_hours, department, year_id, color_hex) VALUES
-- Year 1 Courses
('CS101', 'Introduction to Programming & Logic', 3, 'Computer Science', 1, '#3b82f6'),
('MATH101', 'Calculus & Analytical Geometry', 3, 'Mathematics', 1, '#8b5cf6'),
('PHYS101', 'General Physics for Engineers', 3, 'Physics', 1, '#06b6d4'),
-- Year 2 Courses
('CS201', 'Data Structures & Algorithms', 3, 'Computer Science', 2, '#10b981'),
('CS202', 'Object-Oriented Programming (Java)', 3, 'Software Engineering', 2, '#f59e0b'),
('CS203', 'Computer Architecture & Assembly', 3, 'Computer Science', 2, '#ef4444'),
-- Year 3 Courses
('CS301', 'Database Systems & SQL Design', 3, 'Computer Science', 3, '#ec4899'),
('CS302', 'Operating Systems & Concurrency', 3, 'Computer Science', 3, '#6366f1'),
('CS303', 'Computer Networks & Protocols', 3, 'Networks', 3, '#14b8a6'),
-- Year 4 Courses
('CS401', 'Artificial Intelligence & ML', 3, 'Computer Science', 4, '#84cc16'),
('CS499', 'Senior Capstone Graduation Project', 4, 'Software Engineering', 4, '#a855f7');

-- Initial schedules:
-- Sunday (day 0)
-- Year 1: CS101 Lecture in HALL-A, Period 1 (08:30-10:00) with Dr. Turing
INSERT INTO schedules (academic_year_id, section_id, course_id, professor_id, room_id, day_of_week, period_id, start_time, end_time, session_type, notes)
VALUES (1, NULL, 1, 1, 1, 0, 1, '08:30', '10:00', 'LECTURE', 'Mandatory attendance for all Year 1');

-- Sunday: Year 1 CS101 Section 1 Lab in LAB-101, Period 2 (10:15-11:45) with Eng. Patterson
INSERT INTO schedules (academic_year_id, section_id, course_id, professor_id, room_id, day_of_week, period_id, start_time, end_time, session_type, notes)
VALUES (1, 1, 1, 5, 4, 0, 2, '10:15', '11:45', 'SECTION', 'Practical coding exercises in C++');

-- Sunday: Year 2: CS201 Lecture in HALL-B, Period 1 (08:30-10:00) with Dr. Knuth
INSERT INTO schedules (academic_year_id, section_id, course_id, professor_id, room_id, day_of_week, period_id, start_time, end_time, session_type, notes)
VALUES (2, NULL, 4, 3, 2, 0, 1, '08:30', '10:00', 'LECTURE', 'Algorithm complexity analysis');

-- Monday (day 1)
-- Year 2: CS202 Lecture in HALL-A, Period 2 (10:15-11:45) with Dr. Grace Hopper
INSERT INTO schedules (academic_year_id, section_id, course_id, professor_id, room_id, day_of_week, period_id, start_time, end_time, session_type, notes)
VALUES (2, NULL, 5, 2, 1, 1, 2, '10:15', '11:45', 'LECTURE', 'OOP Principles and Design Patterns');

-- Monday: Year 3 CS301 Lecture in HALL-B, Period 3 (12:00-13:30) with Dr. Barbara Liskov
INSERT INTO schedules (academic_year_id, section_id, course_id, professor_id, room_id, day_of_week, period_id, start_time, end_time, session_type, notes)
VALUES (3, NULL, 7, 4, 2, 1, 3, '12:00', '13:30', 'LECTURE', 'Relational Algebra & Normalization');

-- Tuesday (day 2)
-- Year 3 CS302 Operating Systems Lecture in HALL-A, Period 1 (08:30-10:00) with Dr. Liskov
INSERT INTO schedules (academic_year_id, section_id, course_id, professor_id, room_id, day_of_week, period_id, start_time, end_time, session_type, notes)
VALUES (3, NULL, 8, 4, 1, 2, 1, '08:30', '10:00', 'LECTURE', 'Processes and Threads');

-- Tuesday: Year 4 CS401 AI Lecture in HALL-C, Period 2 (10:15-11:45) with Dr. Turing
INSERT INTO schedules (academic_year_id, section_id, course_id, professor_id, room_id, day_of_week, period_id, start_time, end_time, session_type, notes)
VALUES (4, NULL, 10, 1, 3, 2, 2, '10:15', '11:45', 'LECTURE', 'Heuristic Search & Neural Nets');
`;

function migrateExistingDatabase(db: Database) {
  try {
    // 1. Create programs table if missing
    db.run(`
      CREATE TABLE IF NOT EXISTS programs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        department TEXT NOT NULL
      );
    `);

    // 2. Check if program_id column exists in sections
    const pragmaRes = db.exec('PRAGMA table_info(sections);');
    const cols = (pragmaRes[0]?.values || []).map((row) => String(row[1]));
    if (!cols.includes('program_id')) {
      db.run('ALTER TABLE sections ADD COLUMN program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL;');
    }

    // 3. Seed programs if table is empty
    const progCheck = db.exec('SELECT COUNT(*) FROM programs;');
    const count = Number(progCheck[0]?.values[0]?.[0] || 0);
    if (count === 0) {
      db.run(`
        INSERT INTO programs (id, code, name, department) VALUES
        (1, 'CS', 'Computer Science', 'Department of Computer Science'),
        (2, 'SE', 'Software Engineering', 'Department of Software Engineering'),
        (3, 'AI', 'Artificial Intelligence & Data Science', 'Department of Computer Science'),
        (4, 'CYBER', 'Cybersecurity & Computer Networks', 'Department of Networks');
      `);
    }

    // 4. Update any sections where program_id is null to sensible default
    db.run(`
      UPDATE sections SET program_id = 1 WHERE program_id IS NULL AND (name LIKE '%CS%' OR name LIKE '%Group A%' OR name LIKE '%Group B%');
      UPDATE sections SET program_id = 2 WHERE program_id IS NULL AND (name LIKE '%SE%' OR name LIKE '%Software%');
      UPDATE sections SET program_id = 3 WHERE program_id IS NULL AND (name LIKE '%AI%' OR name LIKE '%Data%');
      UPDATE sections SET program_id = 4 WHERE program_id IS NULL AND (name LIKE '%CYBER%' OR name LIKE '%Cyber%' OR name LIKE '%Network%');
      UPDATE sections SET program_id = 1 WHERE program_id IS NULL;
    `);
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
        console.log('Loaded existing SQLite database from IndexedDB and migrated.');
        await saveToIndexedDB(loadedDb);
        return loadedDb;
      } catch (e) {
        console.error('Error opening saved SQLite DB, creating new:', e);
      }
    }

    // Initialize fresh DB with schema and seed data
    console.log('Initializing fresh SQLite database with university schema and seed data...');
    const freshDb = new SQL.Database() as Database;
    freshDb.run(SCHEMA_SQL);
    freshDb.run(SEED_DATA_SQL);
    dbInstance = freshDb;
    await saveToIndexedDB(freshDb);

    return freshDb;
  })();

  return initPromise;
}

export async function resetDatabaseToDefault(): Promise<Database> {
  const SQL = await getSqlJsStatic();

  const resetDb = new SQL.Database() as Database;
  resetDb.run(SCHEMA_SQL);
  resetDb.run(SEED_DATA_SQL);
  dbInstance = resetDb;
  await saveToIndexedDB(resetDb);
  return resetDb;
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
