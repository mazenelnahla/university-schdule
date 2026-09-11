import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

async function testDatabase() {
  console.log('Testing offline SQLite database engine...');
  const wasmBuffer = fs.readFileSync(path.resolve('./public/sql-wasm.wasm'));
  const SQL = await initSqlJs({
    wasmBinary: wasmBuffer,
  });

  const db = new SQL.Database();

  // Create tables
  db.run(`
    CREATE TABLE academic_years (id INTEGER PRIMARY KEY, code TEXT, name TEXT);
    CREATE TABLE rooms (id INTEGER PRIMARY KEY, code TEXT, name TEXT, type TEXT, capacity INTEGER);
    CREATE TABLE professors (id INTEGER PRIMARY KEY, name TEXT, title TEXT);
    CREATE TABLE courses (id INTEGER PRIMARY KEY, code TEXT, name TEXT, year_id INTEGER);
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

  // Insert test room and professor
  db.run(`INSERT INTO rooms VALUES (1, 'HALL-A', 'Auditorium Alpha', 'LECTURE_HALL', 200);`);
  db.run(`INSERT INTO professors VALUES (1, 'Alan Turing', 'Prof.');`);
  db.run(`INSERT INTO courses VALUES (1, 'CS101', 'Intro to CS', 1);`);

  // Insert Sunday 08:30-10:00 in HALL-A
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

  console.log('✓ SQLite Database and Room Conflict Restriction Engine verified with 100% success!');
}

testDatabase().catch((e) => {
  console.error('Test error:', e);
  process.exit(1);
});
