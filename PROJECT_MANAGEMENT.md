# Project Management App

A full-featured project management application built with Refine.dev v5, Material-UI, and Taruvi backend.

## Features

### 📊 Dashboard
- Overview of all projects and tasks
- Statistics cards showing:
  - Total projects
  - Active projects
  - Total tasks
  - Completed tasks
- Quick access to recent projects

### 📁 Projects
- Create, edit, and delete projects
- Project details include:
  - Name and description
  - Status (Planning, Active, On Hold, Completed, Cancelled)
  - Start and end dates
- List view with filtering and sorting

### ✅ Tasks
Three different views for managing tasks:

#### 1. Board View (Kanban)
- Drag-and-drop tasks between columns
- Four status columns: To Do, In Progress, Review, Done
- Visual cards showing task details, priority, and progress
- Built with @dnd-kit for smooth drag-and-drop

#### 2. Gantt Chart
- Timeline visualization of all tasks
- Color-coded by priority (Low, Medium, High, Urgent)
- Shows task duration and progress
- Week-based timeline view

#### 3. Task List (Hierarchical)
- Tree view with parent-child task relationships
- Expandable/collapsible subtasks
- Inline task creation and editing
- Full CRUD operations
- Task details include:
  - Title and description
  - Status and priority
  - Start and end dates
  - Progress percentage
  - Assigned team member

### 🔗 Task Hierarchy
- Support for parent-child task relationships
- Unlimited nesting levels
- Visual indentation in list view
- Automatic hierarchy management via Taruvi's graph feature

## Database Schema

### Projects Table
- `id` - Primary key
- `name` - Project name (required)
- `description` - Project description
- `status` - Enum: planning, active, on_hold, completed, cancelled
- `start_date` - Project start date
- `end_date` - Project end date
- `created_at` - Timestamp
- `updated_at` - Timestamp

### Tasks Table
- `id` - Primary key
- `project_id` - Foreign key to projects (required)
- `parent_task_id` - Foreign key to tasks (for hierarchy)
- `title` - Task title (required)
- `description` - Task description
- `status` - Enum: todo, in_progress, review, done
- `priority` - Enum: low, medium, high, urgent
- `start_date` - Task start date
- `end_date` - Task end date
- `progress` - Progress percentage (0-100)
- `assigned_to` - Team member name
- `order_index` - For custom ordering
- `created_at` - Timestamp
- `updated_at` - Timestamp
- **Hierarchy enabled** - Supports parent-child relationships

## Tech Stack

- **Frontend Framework**: React 19 with TypeScript
- **UI Framework**: Material-UI v7
- **Admin Framework**: Refine.dev v5
- **Backend**: Taruvi Platform
- **Drag & Drop**: @dnd-kit
- **Form Management**: React Hook Form
- **State Management**: TanStack Query (via Refine)

## File Structure

```
src/
├── pages/
│   ├── home/
│   │   └── index.tsx          # Dashboard with stats
│   └── projects/
│       ├── list.tsx            # Projects list with DataGrid
│       ├── create.tsx          # Create project form
│       ├── edit.tsx            # Edit project form
│       ├── show.tsx            # Project details with task views
│       └── index.ts            # Barrel export
├── components/
│   └── tasks/
│       ├── TaskBoard.tsx       # Kanban board view
│       ├── TaskGantt.tsx       # Gantt chart view
│       └── TaskList.tsx        # Hierarchical list view
└── App.tsx                     # Main app with routing
```

## Usage

### Creating a Project
1. Navigate to Projects
2. Click "Create" button
3. Fill in project details
4. Click "Save"

### Managing Tasks
1. Open a project from the list or dashboard
2. Choose your preferred view:
   - **Board View**: Drag tasks between status columns
   - **Gantt Chart**: View timeline and dependencies
   - **Task List**: Create hierarchical tasks with subtasks

### Creating Subtasks
1. In Task List view, click "Add Task"
2. Fill in task details
3. To create a subtask, edit an existing task and set its parent

### Drag & Drop (Board View)
- Simply drag a task card to a different status column
- The task status updates automatically

## Sample Data

The app comes with sample data including:
- 3 projects (Website Redesign, Mobile App, Marketing Campaign)
- 10 tasks with various statuses and priorities
- Hierarchical tasks (e.g., Frontend Components with Header and Footer subtasks)

## Future Enhancements

Potential features to add:
- Task dependencies in Gantt chart
- Time tracking
- Comments and attachments
- Team member management
- Notifications
- Calendar view
- Reports and analytics
- Export to PDF/Excel
- Real-time collaboration
