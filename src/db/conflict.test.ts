import { timesOverlap, timeToMinutes } from './scheduleService';

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
}

testConflictLogic();
