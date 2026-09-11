export type SessionType = 'LECTURE' | 'SECTION';

export interface AdminUser {
  id: number;
  username: string;
  displayName: string;
}

export interface AcademicYear {
  id: number;
  code: string; // e.g., 'YEAR_1', 'YEAR_2'
  name: string; // e.g., 'Year 1 - Freshman'
  semester: string; // e.g., 'Fall 2026'
}

export interface Program {
  id: number;
  code: string; // e.g., 'CS', 'SE', 'AI', 'CYBER'
  name: string; // e.g., 'Computer Science', 'Software Engineering'
  department: string;
}

export interface Section {
  id: number;
  yearId: number;
  programId: number | null;
  name: string; // e.g., 'Section 1', 'Section 2', 'Lab A'
  capacity: number;
  programName?: string;
  programCode?: string;
}

export interface Professor {
  id: number;
  name: string;
  title: string; // e.g., 'Prof.', 'Dr.', 'Eng.', 'TA'
  department: string;
  email: string;
  phone?: string;
  office?: string;
}

export type RoomType = 'LECTURE_HALL' | 'COMPUTER_LAB' | 'TUTORIAL_ROOM' | 'WORKSHOP';

export interface Room {
  id: number;
  code: string; // e.g., 'Hall A', 'Lab 204', 'Room 102'
  name: string;
  type: RoomType;
  capacity: number;
  building: string;
  floor: number;
}

export interface Course {
  id: number;
  code: string; // e.g., 'CS101'
  name: string; // e.g., 'Introduction to Computer Science'
  creditHours: number;
  department: string;
  yearId: number;
  colorHex?: string;
}

export interface StandardPeriod {
  id: number;
  periodNumber: number;
  startTime: string; // '08:30'
  endTime: string; // '10:00'
  label: string; // 'Period 1 (08:30 - 10:00)'
}

export interface ScheduleItem {
  id: number;
  academicYearId: number;
  sectionId: number | null; // null = entire year (e.g. for Lectures)
  courseId: number;
  professorId: number;
  roomId: number;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday
  periodId: number | null; // optional reference to standard period
  startTime: string; // '08:30'
  endTime: string; // '10:00'
  sessionType: SessionType;
  notes?: string;
}

export interface ScheduleWithDetails extends ScheduleItem {
  yearName: string;
  yearCode: string;
  sectionName?: string;
  programId?: number | null;
  programName?: string;
  programCode?: string;
  courseCode: string;
  courseName: string;
  courseColor?: string;
  professorName: string;
  professorTitle: string;
  roomCode: string;
  roomName: string;
  roomType: RoomType;
  roomCapacity: number;
  building: string;
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflictType?: 'ROOM' | 'PROFESSOR' | 'SECTION';
  message?: string;
  conflictingSchedule?: ScheduleWithDetails;
}
