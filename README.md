# 🎓 University Timetable & Academic Scheduling System

A modern, high-performance, and conflict-free academic scheduling platform engineered for universities and engineering faculties. Powered by **React 19**, **TypeScript**, and an in-browser **WebAssembly SQLite** engine with **IndexedDB persistence**.

---

## 🌟 Key Highlights

- **⚡ Zero-Latency Client-Side SQLite Engine**: Runs a complete SQLite database directly in the browser via WebAssembly (`sql.js`), persisted seamlessly to `IndexedDB` with zero external backend dependencies.
- **🛡️ Real-Time Conflict Detection**: Detects room double-booking, professor schedule clashes, and section time overlaps instantly with live feedback.
- **📄 Accredited Print Timetable Suite**: Generates official university timetables ready for single-page landscape print/PDF export, featuring official crests, degree cohort badges, and formal academic endorsement signatures.
- **🏫 Comprehensive Hierarchy**: Full support for academic tiers—including **Preparatory Year (General Cohort)** and specialized degree tracks (**CS**, **SE**, **AI**, **Cybersecurity**).
- **🎛️ Administrator Management Hub**: Administrative dashboard for managing courses, lecture halls, computer labs, faculty members, sections, standard time periods, and SQLite database backup/restoration.

---

## 🚀 Core Features

### 1. Interactive Timetable Calendar
- **Multiple Operational Views**:
  - **By Academic Year**: View entire cohorts (Preparatory Year through Year 4 Senior).
  - **By Degree Program**: Filter specifically by program specialization (CS, SE, AI, CYBER).
  - **By Room Occupancy**: Inspect physical room allocation across Lecture Halls, Labs, and Tutorial Classrooms.
  - **By Professor**: Inspect individual faculty member teaching workloads and schedules.
- **Day & Full-Week Modes**: Toggle between focused single-day timelines and 5-day / 6-day (Saturday inclusion) week views.
- **Live Metrics**: Real-time counters showing scheduled sessions, active professors, and room utilization percentages.

### 2. Academic Cohort Structure
- **Preparatory Year (`YEAR_PREP`)**:
  - General foundation year for incoming engineering and computing students.
  - Non-specialized general cohort without program-specific restrictions.
  - General sections (`Prep Section 1`, `Prep Section 2`, etc.) and foundational curriculum (`Engineering Mathematics`, `Physics`, `Graphics & Drawing`, `Chemistry`).
- **Degree Programs (Years 1 to 4)**:
  - **Computer Science (`CS`)**
  - **Software Engineering (`SE`)**
  - **Artificial Intelligence & Data Science (`AI`)**
  - **Cybersecurity & Networks (`CYBER`)**
  - Program-specific section tracks (`Group A`, `Group B`, etc.) alongside whole-cohort lectures.

### 3. Accredited Print & Export Suite
- **3 Printing Layout Engines**:
  1. **Master 5-Day Grid**: Unified master timetable sheet consolidating lectures and multi-section lab slots.
  2. **Program Dedicated Sheets**: Individual page-break-separated timetable sheets per degree program.
  3. **Section Breakdown Rows**: High-granularity row breakdown by day and section group.
- **Print Aesthetics & Page Fit**:
  - Landscape A4 and US Letter page optimization (`@page { size: landscape; }`).
  - Automatic bottom pinning for formal signature endorsements (`Timetable Committee Coordinator`, `Department Head`, `Vice Dean of Education`).
  - Zero-drop text wrapping for long subject titles (`white-space: normal; overflow-wrap: break-word`).
  - Dual density modes: **Standard** and **Compact** (guaranteed 1-page fit).

### 4. Administrator Hub & Data Mobility
- **Secure Authentication**: Administrator session authorization.
- **Entity Management**: Create, edit, and delete academic years, departments, courses, faculty, rooms, and sections.
- **Backup & Portability**:
  - **Export SQLite**: Downloads the full active SQLite database file (`.sqlite`).
  - **Import SQLite**: Upload and restore any timetable database instantly.
  - **Reset to Defaults**: One-click rollback to official default seed datasets.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | [React 19](https://react.dev/) + [React Compiler](https://react.dev/learn/react-compiler) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) (Strict Mode) |
| **Build & Dev Tooling** | [Vite](https://vitejs.dev/) |
| **Database** | [SQL.js](https://sql.js.org/) (SQLite compiled to WebAssembly) |
| **Client Storage** | Browser [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) |
| **Icons** | [Lucide React](https://lucide.dev/) |
| **Styling** | Custom Vanilla CSS (Design Tokens, Glassmorphism, Print Media Queries) |
| **Linting** | [Oxlint](https://oxc.rs/) |

---

## 📁 Project Directory Structure

```plaintext
university-schdule/
├── index.html                   # HTML entry point
├── package.json                 # Project dependencies and npm scripts
├── tsconfig.json                # TypeScript compiler configuration
├── vite.config.ts               # Vite configuration with React Compiler plugin
└── src/
    ├── App.tsx                  # Root application coordinator and view state
    ├── index.css                # Global design system tokens and resets
    ├── components/
    │   ├── Navbar.tsx           # Global header, academic year navigation tabs, search
    │   ├── TimetableCalendar.tsx# Interactive timetable grid, metrics, and room view
    │   ├── ScheduleDialog.tsx   # Conflict-checked modal to create/edit class slots
    │   ├── AdminHubPage.tsx     # Admin dashboard for managing all database entities
    │   ├── LoginModal.tsx       # Administrator credentials dialog
    │   └── PrintTimetable/
    │       ├── index.ts         # Module entry exports
    │       ├── PrintTimetableModal.tsx # Print settings, paper density, layout selector
    │       ├── PrintTimetableSheet.tsx # Reusable official printable timetable sheets
    │       └── PrintTimetable.css      # Screen preview & @media print styles
    └── db/
        ├── schema.ts            # TypeScript interfaces (Course, Room, Section, etc.)
        ├── sqlite.ts            # WASM SQLite lifecycle, migrations, and IndexedDB sync
        └── scheduleService.ts   # Database CRUD operations, SQL queries, conflict detection
```

---

## ⚡ Getting Started

### Prerequisites
- **Node.js**: v18.0 or newer
- **npm** (or **pnpm** / **yarn**)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/university-schedule.git
   cd university-schdule
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

4. **Default Administrator Credentials**:
   - **Username**: `admin`
   - **Password**: `admin123`

---

## 📜 Available NPM Scripts

- `npm run dev`: Starts the Vite local development server with Hot Module Replacement (HMR).
- `npm run build`: Type-checks with `tsc` and compiles the optimized production bundle.
- `npm run preview`: Previews the production build locally.
- `npm run lint`: Runs fast static code analysis using `oxlint`.

---

## 🖨️ Printing Instructions

To export or print timetables:
1. Click the **Print Timetable** button in the navigation bar.
2. Select your target **Academic Year** (e.g. *Preparatory Year* or *Year 1 - Freshman*) and **Layout Mode**.
3. Click **Print Timetable** or press `Ctrl + P` / `Cmd + P`.
4. In the browser print dialog:
   - **Orientation**: Landscape
   - **Paper Size**: A4 or Letter
   - **Margins**: Minimum or Default
   - **Options**: Enable **Background Graphics**

---

## 📄 License

This project is licensed under the MIT License.
