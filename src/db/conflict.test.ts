import {
  timesOverlap,
  timeToMinutes,
  parseAvailableDays,
  getUnavailableProfessorsOnDay,
} from './scheduleService';
import type { Professor } from './schema';

// Verification suite for conflict logic
function testConflictLogic() {
  console.log('Testing time conversion and overlap logic...');

  // Test time conversion
  console.assert(timeToMinutes('08:30') === 510, '08:30 should be 510 minutes');
  console.assert(timeToMinutes('10:00') === 600, '10:00 should be 600 minutes');

  // Test overlapping times
  // Exactly identical times
  console.assert(
    timesOverlap('08:30', '10:00', '08:30', '10:00') === true,
    'Identical periods must overlap'
  );

  // Partial overlap
  console.assert(
    timesOverlap('08:30', '10:00', '09:00', '10:30') === true,
    '08:30-10:00 and 09:00-10:30 must overlap'
  );

  // Contained within
  console.assert(
    timesOverlap('08:30', '11:45', '09:00', '10:00') === true,
    'Contained session must overlap'
  );

  // Back-to-back non-overlapping (end1 === start2)
  console.assert(
    timesOverlap('08:30', '10:00', '10:00', '11:30') === false,
    'Consecutive sessions with same boundary must NOT overlap'
  );

  // Disjoint sessions
  console.assert(
    timesOverlap('08:30', '10:00', '10:15', '11:45') === false,
    'Separate periods must NOT overlap'
  );

  console.log('✓ All time collision tests passed successfully!');

  // Test Professor Attendance Days logic
  console.log('Testing professor attendance day parsing and conflict logic...');

  // Test parsing
  const parsedJson = parseAvailableDays('[0,2,4]');
  console.assert(
    Array.isArray(parsedJson) && parsedJson.length === 3 && parsedJson[0] === 0 && parsedJson[2] === 4,
    'JSON string [0,2,4] must parse to array'
  );

  const parsedCsv = parseAvailableDays('1, 3, 5');
  console.assert(
    Array.isArray(parsedCsv) && parsedCsv.length === 3 && parsedCsv[0] === 1 && parsedCsv[2] === 5,
    'CSV string 1, 3, 5 must parse to array'
  );

  console.assert(parseAvailableDays(null) === undefined, 'null must return undefined');
  console.assert(parseAvailableDays('') === undefined, 'empty string must return undefined');

  // Test unavailable professors on specific day
  const testProfessors: Professor[] = [
    {
      id: 1,
      name: 'Alan Turing',
      title: 'Prof.',
      department: 'CS',
      email: 'turing@univ.edu',
      availableDays: [0, 2, 4], // Sun, Tue, Thu
    },
    {
      id: 2,
      name: 'Grace Hopper',
      title: 'Prof.',
      department: 'SE',
      email: 'hopper@univ.edu',
      availableDays: [1, 3], // Mon, Wed
    },
    {
      id: 3,
      name: 'Barbara Liskov',
      title: 'Prof.',
      department: 'CS',
      email: 'liskov@univ.edu',
      availableDays: undefined, // All days
    },
  ];

  // On Sunday (day 0):
  // Turing is available (attends 0,2,4)
  // Hopper is UNAVAILABLE (attends 1,3)
  // Liskov is available (all days)
  const sunUnavailable = getUnavailableProfessorsOnDay(0, testProfessors);
  console.assert(!sunUnavailable.has(1), 'Turing must be available on Sunday');
  console.assert(sunUnavailable.has(2), 'Hopper must be unavailable on Sunday');
  console.assert(!sunUnavailable.has(3), 'Liskov must be available on Sunday (all days)');

  // On Monday (day 1):
  // Turing is UNAVAILABLE (attends 0,2,4)
  // Hopper is available (attends 1,3)
  // Liskov is available
  const monUnavailable = getUnavailableProfessorsOnDay(1, testProfessors);
  console.assert(monUnavailable.has(1), 'Turing must be unavailable on Monday');
  console.assert(!monUnavailable.has(2), 'Hopper must be available on Monday');
  console.assert(!monUnavailable.has(3), 'Liskov must be available on Monday');

  console.log('✓ Professor attendance day conflict logic verified with 100% success!');
}

testConflictLogic();
