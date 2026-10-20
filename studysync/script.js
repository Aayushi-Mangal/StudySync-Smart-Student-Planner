/**
 * StudySync - Smart Student Planner
 * script.js
 * 
 * Beginner-friendly Vanilla JavaScript implementation for Computer Science & Data Science students.
 * Demonstrates:
 * 1. State Management (in-memory array + localStorage persistence)
 * 2. DOM Manipulation (creating elements, class toggling, event handling)
 * 3. Array operations (filter, sort, map, findIndex)
 * 4. Date calculations (overdue detection, relative date formatting)
 * 5. Input validation and clean error handling
 */

// ============================================================================
// 1. DATA STRUCTURES & CONSTANTS
// ============================================================================

/**
 * Key name used to store tasks in the browser's localStorage.
 * LocalStorage stores strings, so we serialize/deserialize using JSON.
 */
const STORAGE_KEY = 'studysync_tasks_v1';

/**
 * Priority ranking weight used for sorting tasks by priority (High > Medium > Low).
 */
const PRIORITY_WEIGHTS = {
  high: 3,
  medium: 2,
  low: 1
};

/**
 * Global in-memory state:
 * - tasks: Array of Task objects (the Single Source of Truth)
 * - currentFilter: 'all' | 'pending' | 'completed'
 * - searchQuery: user text filter
 * - currentSort: 'due-asc' | 'due-desc' | 'priority-desc' | 'title-asc'
 * - taskToDeleteId: tracks task ID awaiting confirmation in the modal
 */
let tasks = [];
let currentFilter = 'all';
let searchQuery = '';
let currentSort = 'due-asc';
let taskToDeleteId = null;

// ============================================================================
// 2. DOM ELEMENT REFERENCES
// ============================================================================

// Form & Inputs
const taskForm = document.getElementById('taskForm');
const taskTitleInput = document.getElementById('taskTitle');
const taskSubjectInput = document.getElementById('taskSubject');
const taskDueDateInput = document.getElementById('taskDueDate');
const taskPriorityInput = document.getElementById('taskPriority');

// Error message displays
const titleError = document.getElementById('titleError');
const subjectError = document.getElementById('subjectError');
const dateError = document.getElementById('dateError');

// Task List & Empty State
const taskList = document.getElementById('taskList');
const emptyState = document.getElementById('emptyState');
const emptyStateTitle = document.getElementById('emptyStateTitle');
const emptyStateText = document.getElementById('emptyStateText');
const emptyStateActionBtn = document.getElementById('emptyStateActionBtn');

// Statistics & Progress
const totalTasksCount = document.getElementById('totalTasksCount');
const pendingTasksCount = document.getElementById('pendingTasksCount');
const completedTasksCount = document.getElementById('completedTasksCount');
const overdueTasksCount = document.getElementById('overdueTasksCount');
const overdueCard = document.getElementById('overdueCard');
const progressPercentage = document.getElementById('progressPercentage');
const progressFill = document.getElementById('progressFill');
const progressBar = document.getElementById('progressBar');

// Filter Tab Badges
const filterCountAll = document.getElementById('filterCountAll');
const filterCountPending = document.getElementById('filterCountPending');
const filterCountCompleted = document.getElementById('filterCountCompleted');
const filterTabs = document.querySelectorAll('.filter-tab');

// Search & Sort Controls
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const sortSelect = document.getElementById('sortSelect');

// Buttons & Actions
const loadSampleBtn = document.getElementById('loadSampleBtn');
const clearCompletedBtn = document.getElementById('clearCompletedBtn');
const currentDateDisplay = document.getElementById('currentDateDisplay');

// Modal Dialog
const deleteModal = document.getElementById('deleteModal');
const modalMessage = document.getElementById('modalMessage');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalConfirmBtn = document.getElementById('modalConfirmBtn');

// Toast Container
const toastContainer = document.getElementById('toastContainer');

// View Switcher Navigation
const viewPlannerBtn = document.getElementById('viewPlannerBtn');
const viewAssistantBtn = document.getElementById('viewAssistantBtn');
const plannerView = document.getElementById('plannerView');
const assistantView = document.getElementById('assistantView');

// AI Study Assistant Elements
const aiPlanForm = document.getElementById('aiPlanForm');
const aiTopicInput = document.getElementById('aiTopicInput');
const aiTimeInput = document.getElementById('aiTimeInput');
const aiDifficultySelect = document.getElementById('aiDifficultySelect');
const aiTopicError = document.getElementById('aiTopicError');
const aiTimeError = document.getElementById('aiTimeError');
const aiGenerateBtn = document.getElementById('aiGenerateBtn');
const aiBtnText = document.getElementById('aiBtnText');
const aiLoadingSkeleton = document.getElementById('aiLoadingSkeleton');
const aiResultsContainer = document.getElementById('aiResultsContainer');
const aiSourceBanner = document.getElementById('aiSourceBanner');
const aiStatusBadge = document.getElementById('aiStatusBadge');
const aiStatusText = document.getElementById('aiStatusText');
const aiModeNotice = document.getElementById('aiModeNotice');
const openApiHelpBtn = document.getElementById('openApiHelpBtn');
const apiHelpModal = document.getElementById('apiHelpModal');
const apiModalCloseBtn = document.getElementById('apiModalCloseBtn');
const apiModalDismissBtn = document.getElementById('apiModalDismissBtn');
const aiImportTasksBtn = document.getElementById('aiImportTasksBtn');

// AI Explanation and Results Elements
const aiExplanationSummary = document.getElementById('aiExplanationSummary');
const aiExplanationAnalogy = document.getElementById('aiExplanationAnalogy');
const aiExplanationKeyPoints = document.getElementById('aiExplanationKeyPoints');
const aiPlanSummarySubtitle = document.getElementById('aiPlanSummarySubtitle');
const aiPlanTimeline = document.getElementById('aiPlanTimeline');
const aiQuestionsList = document.getElementById('aiQuestionsList');

// Global holder for current generated study plan
let currentGeneratedPlan = null;

// ============================================================================
// 3. DATE UTILITY FUNCTIONS
// ============================================================================

/**
 * Parses an ISO date string ("YYYY-MM-DD") into a local Date object set to midnight.
 * This avoids common timezone offset bugs associated with new Date("YYYY-MM-DD").
 * 
 * @param {string} dateString - "YYYY-MM-DD"
 * @returns {Date}
 */
function parseDateOnly(dateString) {
  if (!dateString) return new Date();
  const parts = dateString.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Months are 0-indexed in JS
  const day = parseInt(parts[2], 10);
  return new Date(year, month, day);
}

/**
 * Returns today's date normalized to midnight (00:00:00.000).
 * @returns {Date}
 */
function getTodayDateOnly() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Formats a Date object to "YYYY-MM-DD" for HTML date input compatibility.
 * @param {Date} date
 * @returns {string}
 */
function formatDateToInputString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Determines whether a task is overdue.
 * A task is overdue ONLY if it is NOT completed AND its due date is before today.
 * 
 * @param {string} dueDateString - "YYYY-MM-DD"
 * @param {boolean} isCompleted
 * @returns {boolean}
 */
function isTaskOverdue(dueDateString, isCompleted) {
  if (isCompleted || !dueDateString) return false;
  const dueDate = parseDateOnly(dueDateString);
  const today = getTodayDateOnly();
  return dueDate.getTime() < today.getTime();
}

/**
 * Formats a due date into a human-friendly string with contextual label.
 * Examples: "Overdue by 2 days", "Due today", "Due tomorrow", "Oct 24, 2026"
 * 
 * @param {string} dueDateString - "YYYY-MM-DD"
 * @param {boolean} isCompleted
 * @returns {{ text: string, status: 'overdue' | 'today' | 'upcoming' | 'future' }}
 */
function formatDueDateDisplay(dueDateString, isCompleted) {
  const dueDate = parseDateOnly(dueDateString);
  const today = getTodayDateOnly();
  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (!isCompleted && diffDays < 0) {
    const absDays = Math.abs(diffDays);
    const dayWord = absDays === 1 ? 'day' : 'days';
    return {
      text: `⚠️ Overdue by ${absDays} ${dayWord}`,
      status: 'overdue'
    };
  }

  if (diffDays === 0) {
    return { text: '⏰ Due today', status: 'today' };
  }

  if (diffDays === 1) {
    return { text: '📅 Due tomorrow', status: 'upcoming' };
  }

  // Format standard date (e.g., "Oct 25, 2026")
  const options = { month: 'short', day: 'numeric', year: 'numeric' };
  return {
    text: dueDate.toLocaleDateString(undefined, options),
    status: 'future'
  };
}

// ============================================================================
// 4. STORAGE FUNCTIONS (localStorage CRUD)
// ============================================================================

/**
 * Loads tasks array from localStorage.
 * Handles JSON parsing errors and initializes with default empty array.
 */
function loadTasksFromStorage() {
  try {
    const rawData = localStorage.getItem(STORAGE_KEY);
    if (rawData) {
      const parsed = JSON.parse(rawData);
      if (Array.isArray(parsed)) {
        tasks = parsed;
        return;
      }
    }
  } catch (error) {
    console.error('Error loading tasks from localStorage:', error);
    showToast('Failed to load saved tasks from browser storage.', 'danger');
  }
  tasks = [];
}

/**
 * Saves the current tasks array into localStorage as a JSON string.
 */
function saveTasksToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (error) {
    console.error('Error saving tasks to localStorage:', error);
    showToast('Storage quota exceeded or storage disabled.', 'danger');
  }
}

// ============================================================================
// 5. TASK OPERATIONS (Add, Toggle, Delete, Clear)
// ============================================================================

/**
 * Handles adding a new task from the form.
 * Validates inputs, creates new task object, updates storage and UI.
 * 
 * @param {Event} event
 */
function handleAddTask(event) {
  event.preventDefault(); // Prevent page refresh on form submission

  // Clear previous validation error messages
  clearValidationErrors();

  const title = taskTitleInput.value.trim();
  const subject = taskSubjectInput.value.trim();
  const dueDate = taskDueDateInput.value;
  const priority = taskPriorityInput.value;

  // Validation
  let isValid = true;

  if (!title) {
    showFieldError(taskTitleInput, titleError, 'Please enter a task title.');
    isValid = false;
  } else if (title.length < 3) {
    showFieldError(taskTitleInput, titleError, 'Title must be at least 3 characters.');
    isValid = false;
  }

  if (!subject) {
    showFieldError(taskSubjectInput, subjectError, 'Please enter or select a subject.');
    isValid = false;
  }

  if (!dueDate) {
    showFieldError(taskDueDateInput, dateError, 'Please select a valid due date.');
    isValid = false;
  } else {
    // Check if entered date is a valid calendar date
    const parsed = parseDateOnly(dueDate);
    if (isNaN(parsed.getTime())) {
      showFieldError(taskDueDateInput, dateError, 'Invalid date format.');
      isValid = false;
    }
  }

  if (!isValid) return;

  // Construct Task Object
  const newTask = {
    id: 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    title: title,
    subject: subject,
    dueDate: dueDate,
    priority: priority, // 'low' | 'medium' | 'high'
    completed: false,
    createdAt: new Date().toISOString()
  };

  // Add to top of list
  tasks.unshift(newTask);
  saveTasksToStorage();
  renderApp();

  // Reset form inputs
  taskForm.reset();
  // Reset date picker default to today
  taskDueDateInput.value = formatDateToInputString(getTodayDateOnly());
  taskPriorityInput.value = 'medium';

  showToast(`Added: "${newTask.title}"`, 'success');
}

/**
 * Toggles a task's completed status.
 * @param {string} taskId
 */
function toggleTaskCompletion(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  task.completed = !task.completed;
  saveTasksToStorage();
  renderApp();

  if (task.completed) {
    showToast(`Completed: "${task.title}"`, 'success');
  } else {
    showToast(`Marked pending: "${task.title}"`, 'info');
  }
}

/**
 * Opens the delete confirmation modal.
 * @param {string} taskId
 */
function promptDeleteTask(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  taskToDeleteId = taskId;
  modalMessage.textContent = `Are you sure you want to delete "${task.title}"? This cannot be undone.`;
  deleteModal.style.display = 'flex';
  modalConfirmBtn.focus();
}

/**
 * Confirms and executes task deletion.
 */
function confirmDeleteTask() {
  if (!taskToDeleteId) return;

  const deletedTask = tasks.find(t => t.id === taskToDeleteId);
  tasks = tasks.filter(t => t.id !== taskToDeleteId);
  taskToDeleteId = null;

  saveTasksToStorage();
  closeDeleteModal();
  renderApp();

  showToast(`Deleted task: "${deletedTask ? deletedTask.title : 'Task'}"`, 'info');
}

/**
 * Closes the delete confirmation modal.
 */
function closeDeleteModal() {
  deleteModal.style.display = 'none';
  taskToDeleteId = null;
}

/**
 * Clears all completed tasks from list.
 */
function handleClearCompleted() {
  const completedCount = tasks.filter(t => t.completed).length;
  if (completedCount === 0) {
    showToast('No completed tasks to clear.', 'info');
    return;
  }

  if (confirm(`Remove all ${completedCount} completed task(s)?`)) {
    tasks = tasks.filter(t => !t.completed);
    saveTasksToStorage();
    renderApp();
    showToast(`Removed ${completedCount} completed task(s).`, 'info');
  }
}

// ============================================================================
// 6. SAMPLE DATA GENERATOR (For Hackathon Judges / Demos)
// ============================================================================

/**
 * Populates realistic Computer Science & Data Science sample tasks.
 * Uses dates relative to today so overdue, today, and future badges are always accurate!
 */
function loadSampleTasks() {
  const today = getTodayDateOnly();

  // Helper to add days to today
  const addDays = (days) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return formatDateToInputString(d);
  };

  const sampleTasks = [
    {
      id: 'sample_1',
      title: 'Implement Dijkstra & Bellman-Ford Algorithms',
      subject: 'Algorithms & Data Structures',
      dueDate: addDays(-2), // Overdue by 2 days (demonstrates overdue alert)
      priority: 'high',
      completed: false,
      createdAt: new Date().toISOString()
    },
    {
      id: 'sample_2',
      title: 'Exploratory Data Analysis (EDA) on Kaggle Dataset',
      subject: 'Data Science & AI',
      dueDate: addDays(0), // Due today
      priority: 'high',
      completed: false,
      createdAt: new Date().toISOString()
    },
    {
      id: 'sample_3',
      title: 'Prepare Chapter 4 Review: Eigenvalues & Vector Spaces',
      subject: 'Calculus & Linear Algebra',
      dueDate: addDays(1), // Due tomorrow
      priority: 'medium',
      completed: false,
      createdAt: new Date().toISOString()
    },
    {
      id: 'sample_4',
      title: 'Design 3NF Relational Database Schema for E-Commerce',
      subject: 'Database Systems',
      dueDate: addDays(4), // Future
      priority: 'medium',
      completed: false,
      createdAt: new Date().toISOString()
    },
    {
      id: 'sample_5',
      title: 'Submit Software Requirements Specification (SRS) Draft',
      subject: 'Software Engineering',
      dueDate: addDays(-4),
      priority: 'low',
      completed: true, // Completed task
      createdAt: new Date().toISOString()
    }
  ];

  // Merge sample tasks, avoiding duplicate IDs
  const existingIds = new Set(tasks.map(t => t.id));
  const newSamples = sampleTasks.filter(s => !existingIds.has(s.id));

  if (newSamples.length === 0) {
    // If user already loaded them, reset to samples
    tasks = sampleTasks;
  } else {
    tasks = [...newSamples, ...tasks];
  }

  saveTasksToStorage();
  renderApp();
  showToast('Loaded 5 sample CS & Data Science tasks!', 'success');
}

// ============================================================================
// 7. FILTERING & SORTING LOGIC
// ============================================================================

/**
 * Returns tasks matching the active status filter, search query, and sort order.
 * @returns {Array<Task>}
 */
function getFilteredAndSortedTasks() {
  let result = [...tasks];

  // 1. Status Filter
  if (currentFilter === 'pending') {
    result = result.filter(t => !t.completed);
  } else if (currentFilter === 'completed') {
    result = result.filter(t => t.completed);
  }

  // 2. Search Query Filter (checks both title and subject)
  if (searchQuery.trim() !== '') {
    const q = searchQuery.toLowerCase().trim();
    result = result.filter(t => 
      t.title.toLowerCase().includes(q) || 
      t.subject.toLowerCase().includes(q)
    );
  }

  // 3. Sorting
  result.sort((a, b) => {
    if (currentSort === 'due-asc') {
      // Earliest due date first
      return a.dueDate.localeCompare(b.dueDate);
    } else if (currentSort === 'due-desc') {
      // Latest due date first
      return b.dueDate.localeCompare(a.dueDate);
    } else if (currentSort === 'priority-desc') {
      // High (3) -> Medium (2) -> Low (1)
      const diff = PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority];
      if (diff !== 0) return diff;
      return a.dueDate.localeCompare(b.dueDate);
    } else if (currentSort === 'title-asc') {
      // Alphabetical A-Z
      return a.title.localeCompare(b.title);
    }
    return 0;
  });

  return result;
}

// ============================================================================
// 8. UI RENDERING FUNCTIONS
// ============================================================================

/**
 * Primary rendering controller.
 * Updates stats counters, progress bar, filter badges, and task list DOM.
 */
function renderApp() {
  updateStatistics();
  renderTaskList();
}

/**
 * Calculates statistics and updates header summary cards & progress bar.
 */
function updateStatistics() {
  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const pending = total - completed;
  const overdue = tasks.filter(t => isTaskOverdue(t.dueDate, t.completed)).length;

  // Counter displays
  totalTasksCount.textContent = total;
  pendingTasksCount.textContent = pending;
  completedTasksCount.textContent = completed;
  overdueTasksCount.textContent = overdue;

  // Overdue card alert styling
  if (overdue > 0) {
    overdueCard.classList.add('has-overdue');
  } else {
    overdueCard.classList.remove('has-overdue');
  }

  // Filter badge counters
  filterCountAll.textContent = total;
  filterCountPending.textContent = pending;
  filterCountCompleted.textContent = completed;

  // Progress Bar calculation
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
  progressPercentage.textContent = `${percentage}%`;
  progressFill.style.width = `${percentage}%`;
  progressBar.setAttribute('aria-valuenow', percentage);
}

/**
 * Renders the visible task cards or triggers the empty state.
 */
function renderTaskList() {
  const visibleTasks = getFilteredAndSortedTasks();

  // Clear current list content safely
  taskList.innerHTML = '';

  if (visibleTasks.length === 0) {
    taskList.style.display = 'none';
    emptyState.style.display = 'flex';

    if (tasks.length === 0) {
      emptyStateTitle.textContent = 'No tasks in your planner!';
      emptyStateText.textContent = 'Your study planner is currently empty. Add your coursework, assignments, or revision goals above to get started.';
      emptyStateActionBtn.style.display = 'inline-flex';
    } else {
      emptyStateTitle.textContent = 'No matching tasks found';
      emptyStateText.textContent = 'Try adjusting your search query or switching filters to see more tasks.';
      emptyStateActionBtn.style.display = 'none';
    }
    return;
  }

  taskList.style.display = 'flex';
  emptyState.style.display = 'none';

  // Build task cards
  visibleTasks.forEach(task => {
    const isOverdue = isTaskOverdue(task.dueDate, task.completed);
    const dateInfo = formatDueDateDisplay(task.dueDate, task.completed);

    const li = document.createElement('li');
    li.className = `task-item priority-${task.priority}`;
    if (task.completed) li.classList.add('is-completed');
    if (isOverdue) li.classList.add('is-overdue');
    li.dataset.id = task.id;

    // Checkbox element
    const checkboxContainer = document.createElement('div');
    checkboxContainer.className = 'task-checkbox-container';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'task-checkbox';
    checkbox.checked = task.completed;
    checkbox.setAttribute('aria-label', `Mark task "${task.title}" as ${task.completed ? 'incomplete' : 'complete'}`);
    checkbox.addEventListener('change', () => toggleTaskCompletion(task.id));
    checkboxContainer.appendChild(checkbox);

    // Body content
    const body = document.createElement('div');
    body.className = 'task-body';

    const titleRow = document.createElement('div');
    titleRow.className = 'task-title-row';
    const title = document.createElement('h3');
    title.className = 'task-title';
    title.textContent = task.title;
    titleRow.appendChild(title);

    // Meta row (subject tag, priority tag, due date)
    const metaRow = document.createElement('div');
    metaRow.className = 'task-meta-row';

    // Subject tag
    const subjectBadge = document.createElement('span');
    subjectBadge.className = 'badge-subject';
    subjectBadge.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
      </svg>
      <span>${escapeHtml(task.subject)}</span>
    `;

    // Priority tag
    const priorityBadge = document.createElement('span');
    priorityBadge.className = `badge-priority badge-priority-${task.priority}`;
    const priorityIcons = {
      high: '🔴 High',
      medium: '🟡 Medium',
      low: '🟢 Low'
    };
    priorityBadge.textContent = priorityIcons[task.priority] || task.priority;

    // Due date tag
    const dateBadge = document.createElement('span');
    dateBadge.className = `badge-date ${isOverdue ? 'badge-date-overdue' : (dateInfo.status === 'today' ? 'badge-date-today' : '')}`;
    dateBadge.textContent = dateInfo.text;

    metaRow.appendChild(subjectBadge);
    metaRow.appendChild(priorityBadge);
    metaRow.appendChild(dateBadge);

    body.appendChild(titleRow);
    body.appendChild(metaRow);

    // Actions container (Delete button)
    const actions = document.createElement('div');
    actions.className = 'task-actions';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'task-btn-delete';
    deleteBtn.title = 'Delete Task';
    deleteBtn.setAttribute('aria-label', `Delete task "${task.title}"`);
    deleteBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
    `;
    deleteBtn.addEventListener('click', () => promptDeleteTask(task.id));
    actions.appendChild(deleteBtn);

    // Assemble Item
    li.appendChild(checkboxContainer);
    li.appendChild(body);
    li.appendChild(actions);

    taskList.appendChild(li);
  });
}

// ============================================================================
// 9. VALIDATION & FEEDBACK HELPERS
// ============================================================================

/**
 * Highlights a form field with an error state and displays the helper message.
 */
function showFieldError(inputElement, errorElement, message) {
  inputElement.classList.add('is-invalid');
  errorElement.textContent = message;
}

/**
 * Clears all error states from form controls.
 */
function clearValidationErrors() {
  [taskTitleInput, taskSubjectInput, taskDueDateInput].forEach(input => {
    input.classList.remove('is-invalid');
  });
  titleError.textContent = '';
  subjectError.textContent = '';
  dateError.textContent = '';
}

/**
 * Displays a lightweight toast notification in the bottom right corner.
 * Auto-dismisses after 3 seconds.
 * 
 * @param {string} message
 * @param {'success' | 'info' | 'danger'} type
 */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 200ms ease';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 200);
  }, 3000);
}

/**
 * Safely escapes HTML strings to prevent XSS vulnerabilities.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================================
// 10. EVENT LISTENERS SETUP
// ============================================================================

function setupEventListeners() {
  // Form submission
  taskForm.addEventListener('submit', handleAddTask);

  // Clear validation styling dynamically when the user types/changes inputs
  taskTitleInput.addEventListener('input', () => {
    if (taskTitleInput.value.trim().length >= 3) {
      taskTitleInput.classList.remove('is-invalid');
      titleError.textContent = '';
    }
  });

  taskSubjectInput.addEventListener('input', () => {
    if (taskSubjectInput.value.trim().length > 0) {
      taskSubjectInput.classList.remove('is-invalid');
      subjectError.textContent = '';
    }
  });

  taskDueDateInput.addEventListener('change', () => {
    if (taskDueDateInput.value) {
      taskDueDateInput.classList.remove('is-invalid');
      dateError.textContent = '';
    }
  });

  // Filter tab switches
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      currentFilter = tab.dataset.filter;
      renderTaskList();
    });
  });

  // Search input handling (with real-time filtering)
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    clearSearchBtn.style.display = searchQuery.length > 0 ? 'block' : 'none';
    renderTaskList();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.style.display = 'none';
    searchInput.focus();
    renderTaskList();
  });

  // Sort dropdown change
  sortSelect.addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderTaskList();
  });

  // Sample tasks buttons
  loadSampleBtn.addEventListener('click', loadSampleTasks);
  emptyStateActionBtn.addEventListener('click', loadSampleTasks);

  // Clear completed tasks button
  clearCompletedBtn.addEventListener('click', handleClearCompleted);

  // Modal dialog buttons
  modalConfirmBtn.addEventListener('click', confirmDeleteTask);
  modalCancelBtn.addEventListener('click', closeDeleteModal);
  modalCloseBtn.addEventListener('click', closeDeleteModal);

  // Close modal when clicking outside dialog backdrop
  deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) {
      closeDeleteModal();
    }
  });

  // Keyboard accessibility: Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (deleteModal && deleteModal.style.display === 'flex') {
        closeDeleteModal();
      }
      if (apiHelpModal && apiHelpModal.style.display === 'flex') {
        closeApiHelpModal();
      }
    }
  });

  // View Switcher Navigation
  if (viewPlannerBtn) {
    viewPlannerBtn.addEventListener('click', () => switchView('planner'));
  }
  if (viewAssistantBtn) {
    viewAssistantBtn.addEventListener('click', () => switchView('assistant'));
  }

  // AI Assistant Form & Buttons
  if (aiPlanForm) {
    aiPlanForm.addEventListener('submit', handleAiPlanSubmit);
  }

  // Quick Topic Suggestions Chips
  document.querySelectorAll('.chip-btn').forEach(chip => {
    chip.addEventListener('click', () => {
      if (aiTopicInput) {
        aiTopicInput.value = chip.dataset.topic;
        aiTopicInput.classList.remove('is-invalid');
        if (aiTopicError) aiTopicError.textContent = '';
        aiTopicInput.focus();
      }
    });
  });

  // Quick Time Pills
  document.querySelectorAll('.time-pill-btn').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.time-pill-btn').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      if (aiTimeInput) {
        aiTimeInput.value = pill.dataset.mins;
        aiTimeInput.classList.remove('is-invalid');
        if (aiTimeError) aiTimeError.textContent = '';
      }
    });
  });

  // Import Study Milestones Button
  if (aiImportTasksBtn) {
    aiImportTasksBtn.addEventListener('click', handleImportStudyPlanToTasks);
  }

  // API Help Modal Buttons
  if (openApiHelpBtn) {
    openApiHelpBtn.addEventListener('click', openApiHelpModal);
  }
  if (apiModalCloseBtn) {
    apiModalCloseBtn.addEventListener('click', closeApiHelpModal);
  }
  if (apiModalDismissBtn) {
    apiModalDismissBtn.addEventListener('click', closeApiHelpModal);
  }
  if (apiHelpModal) {
    apiHelpModal.addEventListener('click', (e) => {
      if (e.target === apiHelpModal) closeApiHelpModal();
    });
  }
}

// ============================================================================
// 11. AI STUDY ASSISTANT CONTROLLER
// ============================================================================

/**
 * Toggles visible tab view between 'planner' and 'assistant'.
 * @param {'planner' | 'assistant'} viewName
 */
function switchView(viewName) {
  if (!plannerView || !assistantView) return;

  if (viewName === 'planner') {
    plannerView.style.display = 'block';
    assistantView.style.display = 'none';
    if (viewPlannerBtn) viewPlannerBtn.classList.add('active');
    if (viewAssistantBtn) viewAssistantBtn.classList.remove('active');
  } else if (viewName === 'assistant') {
    plannerView.style.display = 'none';
    assistantView.style.display = 'block';
    if (viewPlannerBtn) viewPlannerBtn.classList.remove('active');
    if (viewAssistantBtn) viewAssistantBtn.classList.add('active');
    checkAiBackendStatus();
  }
}

/**
 * Checks backend status to see if Google Gemini API key is configured.
 */
async function checkAiBackendStatus() {
  if (!aiStatusBadge || !aiStatusText || !aiModeNotice) return;

  try {
    const resp = await fetch('/api/status', { cache: 'no-store' });
    if (!resp.ok) throw new Error('Status API error');
    const data = await resp.json();

    if (data.has_api_key) {
      aiStatusBadge.className = 'ai-status-badge ai-status-live';
      aiStatusText.textContent = 'Live Gemini AI Connected';
      aiModeNotice.textContent = 'Connected to Google Gemini API securely through backend. Your API key is protected.';
    } else {
      aiStatusBadge.className = 'ai-status-badge ai-status-demo';
      aiStatusText.textContent = 'Demo Curriculum Mode';
      aiModeNotice.textContent = 'Demo Mode (No API key set): Using verified student curriculum templates, not live AI models.';
    }
  } catch (err) {
    // If running via direct file:// without server
    aiStatusBadge.className = 'ai-status-badge ai-status-demo';
    aiStatusText.textContent = 'Offline Demo Mode';
    aiModeNotice.textContent = 'Running directly without backend server. Outputs use local curriculum templates.';
  }
}

/**
 * Handles generating the AI study plan and practice questions.
 * @param {Event} event
 */
async function handleAiPlanSubmit(event) {
  event.preventDefault();
  if (!aiTopicInput || !aiTimeInput) return;

  const topic = aiTopicInput.value.trim();
  const timeMinutes = parseInt(aiTimeInput.value, 10);
  const difficulty = aiDifficultySelect ? aiDifficultySelect.value : 'Intermediate';

  // Validation
  let isValid = true;
  if (aiTopicError) aiTopicError.textContent = '';
  if (aiTimeError) aiTimeError.textContent = '';
  aiTopicInput.classList.remove('is-invalid');
  aiTimeInput.classList.remove('is-invalid');

  if (!topic || topic.length < 2) {
    if (aiTopicError) aiTopicError.textContent = 'Please enter a subject or topic (at least 2 characters).';
    aiTopicInput.classList.add('is-invalid');
    isValid = false;
  }

  if (isNaN(timeMinutes) || timeMinutes < 10 || timeMinutes > 300) {
    if (aiTimeError) aiTimeError.textContent = 'Study time must be between 10 and 300 minutes.';
    aiTimeInput.classList.add('is-invalid');
    isValid = false;
  }

  if (!isValid) return;

  // Show Loading state
  if (aiLoadingSkeleton) aiLoadingSkeleton.style.display = 'flex';
  if (aiResultsContainer) aiResultsContainer.style.display = 'none';
  if (aiGenerateBtn) {
    aiGenerateBtn.disabled = true;
    if (aiBtnText) aiBtnText.textContent = 'Generating Study Plan...';
  }

  try {
    const resp = await fetch('/api/generate-study-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, timeMinutes, difficulty })
    });

    if (!resp.ok) {
      throw new Error(`Server returned HTTP ${resp.status}`);
    }

    const result = await resp.json();
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to generate plan.');
    }

    renderAiResults(result);
  } catch (err) {
    console.warn('Backend unavailable, using client-side fallback template:', err);
    const fallbackData = generateClientFallbackCurriculum(topic, timeMinutes, difficulty);
    renderAiResults({
      success: true,
      is_demo: true,
      provider: 'Client-side Student Template',
      notice: 'DEMO MODE: Generated from structured curriculum templates (Backend not reached).',
      data: fallbackData
    });
  } finally {
    if (aiLoadingSkeleton) aiLoadingSkeleton.style.display = 'none';
    if (aiGenerateBtn) {
      aiGenerateBtn.disabled = false;
      if (aiBtnText) aiBtnText.textContent = 'Generate Study Plan & Practice';
    }
  }
}

/**
 * Renders the generated plan, explanation, and practice questions to the DOM.
 * @param {Object} response
 */
function renderAiResults(response) {
  if (!aiResultsContainer) return;

  const data = response.data;
  currentGeneratedPlan = data;

  // 1. Source / Mode Banner
  if (aiSourceBanner) {
    if (response.is_demo) {
      aiSourceBanner.className = 'ai-source-banner source-demo';
      aiSourceBanner.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <span><strong>Demo Curriculum Mode:</strong> ${escapeHtml(response.notice || 'Generated from structured student curriculum templates, not live AI models.')}</span>
      `;
    } else {
      aiSourceBanner.className = 'ai-source-banner source-live';
      aiSourceBanner.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        <span><strong>Live Generative AI:</strong> ${escapeHtml(response.notice || 'Generated in real-time by Google Gemini.')}</span>
      `;
    }
  }

  // 2. Explanation Section
  if (aiExplanationSummary) {
    aiExplanationSummary.textContent = data.explanation.summary;
  }
  if (aiExplanationAnalogy) {
    aiExplanationAnalogy.textContent = data.explanation.analogy;
  }
  if (aiExplanationKeyPoints) {
    aiExplanationKeyPoints.innerHTML = '';
    (data.explanation.keyPoints || []).forEach(pt => {
      const li = document.createElement('li');
      li.textContent = pt;
      aiExplanationKeyPoints.appendChild(li);
    });
  }

  // 3. Prioritized Study Plan Timeline
  if (aiPlanSummarySubtitle) {
    aiPlanSummarySubtitle.textContent = `${data.studyPlan.length} time-blocked phases totaling ${data.timeMinutes} minutes for ${data.difficulty} level`;
  }
  if (aiPlanTimeline) {
    aiPlanTimeline.innerHTML = '';
    (data.studyPlan || []).forEach((phase, idx) => {
      const card = document.createElement('div');
      card.className = `plan-phase-card priority-${phase.priority}`;

      const header = document.createElement('div');
      header.className = 'plan-phase-header';

      const title = document.createElement('h4');
      title.className = 'plan-phase-title';
      title.textContent = phase.phase;

      const badges = document.createElement('div');
      badges.className = 'plan-phase-badges';

      const durBadge = document.createElement('span');
      durBadge.className = 'plan-duration-badge';
      durBadge.textContent = `⏱ ${phase.durationMinutes} mins`;

      const priBadge = document.createElement('span');
      priBadge.className = `badge-priority badge-priority-${phase.priority}`;
      priBadge.textContent = phase.priority.toUpperCase();

      badges.appendChild(durBadge);
      badges.appendChild(priBadge);

      header.appendChild(title);
      header.appendChild(badges);

      const focusP = document.createElement('p');
      focusP.className = 'plan-phase-focus';
      focusP.innerHTML = `<strong>Focus Objective:</strong> ${escapeHtml(phase.focus)}`;

      const tasksUl = document.createElement('ul');
      tasksUl.className = 'plan-phase-tasks';
      (phase.tasks || []).forEach(t => {
        const li = document.createElement('li');
        li.textContent = t;
        tasksUl.appendChild(li);
      });

      card.appendChild(header);
      card.appendChild(focusP);
      card.appendChild(tasksUl);

      aiPlanTimeline.appendChild(card);
    });
  }

  // 4. Five Practice Questions
  if (aiQuestionsList) {
    aiQuestionsList.innerHTML = '';
    (data.practiceQuestions || []).forEach((q, index) => {
      const qCard = document.createElement('div');
      qCard.className = 'question-card';

      const topRow = document.createElement('div');
      topRow.className = 'question-top-row';

      const numBadge = document.createElement('span');
      numBadge.className = 'question-number-badge';
      numBadge.textContent = `Q${index + 1}`;

      const qText = document.createElement('p');
      qText.className = 'question-text';
      qText.textContent = q.question;

      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'btn-toggle-answer';
      toggleBtn.type = 'button';
      toggleBtn.textContent = 'Reveal Answer';

      topRow.appendChild(numBadge);
      topRow.appendChild(qText);
      topRow.appendChild(toggleBtn);

      const ansBox = document.createElement('div');
      ansBox.className = 'question-answer-box';
      ansBox.style.display = 'none';

      const ansHeader = document.createElement('span');
      ansHeader.className = 'answer-header';
      ansHeader.textContent = 'Correct Answer:';

      const ansP = document.createElement('p');
      ansP.className = 'answer-text';
      ansP.textContent = q.answer;

      const expP = document.createElement('p');
      expP.className = 'explanation-text';
      expP.innerHTML = `<strong>Explanation:</strong> ${escapeHtml(q.explanation)}`;

      ansBox.appendChild(ansHeader);
      ansBox.appendChild(ansP);
      ansBox.appendChild(expP);

      toggleBtn.addEventListener('click', () => {
        const isHidden = ansBox.style.display === 'none';
        ansBox.style.display = isHidden ? 'flex' : 'none';
        toggleBtn.textContent = isHidden ? 'Hide Answer' : 'Reveal Answer';
      });

      qCard.appendChild(topRow);
      qCard.appendChild(ansBox);
      aiQuestionsList.appendChild(qCard);
    });
  }

  aiResultsContainer.style.display = 'flex';
  aiResultsContainer.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Converts generated study plan phases into real planner tasks!
 */
function handleImportStudyPlanToTasks() {
  if (!currentGeneratedPlan || !currentGeneratedPlan.studyPlan) {
    showToast('No active study plan to import.', 'info');
    return;
  }

  const today = getTodayDateOnly();
  let count = 0;

  currentGeneratedPlan.studyPlan.forEach((phase, idx) => {
    // Schedule phases: phase 1 today, phase 2 tomorrow, etc.
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + idx);

    const newTask = {
      id: 'task_ai_' + Date.now() + '_' + idx,
      title: `${phase.phase} (${phase.durationMinutes}m)`,
      subject: currentGeneratedPlan.topic || 'AI Study Session',
      dueDate: formatDateToInputString(dueDate),
      priority: phase.priority || 'medium',
      completed: false,
      createdAt: new Date().toISOString()
    };

    tasks.unshift(newTask);
    count++;
  });

  saveTasksToStorage();
  renderApp();
  switchView('planner');
  showToast(`Imported ${count} study milestones into your Task Planner!`, 'success');
}

/**
 * Client-side fallback template generator if server is offline or opened via file://
 */
function generateClientFallbackCurriculum(topic, timeMinutes, difficulty) {
  const clean = topic.trim();
  const p1 = Math.max(5, Math.round(timeMinutes * 0.25));
  const p2 = Math.max(10, Math.round(timeMinutes * 0.40));
  const p3 = Math.max(5, Math.round(timeMinutes * 0.20));
  const p4 = Math.max(5, timeMinutes - (p1 + p2 + p3));

  return {
    topic: clean,
    difficulty: difficulty,
    timeMinutes: timeMinutes,
    explanation: {
      summary: `${clean} is an essential concept in Computer Science and Data Science. Focus on grasping its fundamental invariants, time/space trade-offs, and practical edge cases.`,
      analogy: `Mastering ${clean} is like building a modular data pipeline: understand each individual component thoroughly before assembling them into a complex system.`,
      keyPoints: [
        `Understand the core input constraints, expected output, and invariants of ${clean}.`,
        `Analyze algorithmic complexity and potential failure modes under ${difficulty.toLowerCase()} conditions.`,
        `Practice writing pseudo-code or minimal working examples by hand to solidify understanding.`
      ]
    },
    studyPlan: [
      {
        phase: `Phase 1: Concept Foundations & Invariants`,
        durationMinutes: p1,
        priority: 'high',
        focus: `Review the definitions, mathematical models, and operational rules of ${clean}.`,
        tasks: [
          `Read notes/documentation and define key terminology for ${clean}.`,
          `Identify the exact problem this technique is designed to solve.`
        ]
      },
      {
        phase: `Phase 2: Step-by-Step Deep Dive`,
        durationMinutes: p2,
        priority: 'high',
        focus: `Trace through concrete examples step-by-step at the ${difficulty} level.`,
        tasks: [
          `Manually work through two standard input cases on paper.`,
          `Investigate edge cases, boundary conditions, and common pitfalls.`
        ]
      },
      {
        phase: `Phase 3: Complexity & Trade-Off Analysis`,
        durationMinutes: p3,
        priority: 'medium',
        focus: `Analyze time/space efficiency and compare with alternative approaches.`,
        tasks: [
          `Derive best, average, and worst-case time complexities.`,
          `Understand when to use ${clean} versus competing algorithms.`
        ]
      },
      {
        phase: `Phase 4: Self-Assessment & Synthesis`,
        durationMinutes: p4,
        priority: 'low',
        focus: `Consolidate takeaways and answer the practice questions below.`,
        tasks: [
          `Solve the 5 practice questions below without looking at answers.`,
          `Summarize your learnings in a concise cheat sheet.`
        ]
      }
    ],
    practiceQuestions: [
      {
        id: 1,
        question: `What is the primary objective of studying and implementing ${clean}?`,
        answer: `To solve computational problems involving ${clean} with optimal efficiency and verified correctness.`,
        explanation: `Understanding ${clean} equips developers to choose the right data structures and algorithmic paradigms.`
      },
      {
        id: 2,
        question: `What is the typical time-complexity trade-off associated with optimizing ${clean}?`,
        answer: `Trading additional auxiliary memory (space complexity) for faster execution speed (time complexity).`,
        explanation: `Caching intermediate results or using auxiliary pointers frequently speeds up lookups at the expense of memory.`
      },
      {
        id: 3,
        question: `Why is it critical to test edge cases when working with ${clean}?`,
        answer: `Edge cases (such as null/empty inputs, single elements, or extreme values) often violate naive assumptions.`,
        explanation: `Standard algorithms frequently break down on boundaries unless explicit validation checks are enforced.`
      },
      {
        id: 4,
        question: `At a ${difficulty.toLowerCase()} level, what prerequisite knowledge is essential for mastering ${clean}?`,
        answer: `Strong understanding of fundamental data structures, basic mathematical logic, and recursion/iteration.`,
        explanation: `Advanced concepts build directly upon foundational discrete structures and operational patterns.`
      },
      {
        id: 5,
        question: `How do you verify the correctness of an implementation of ${clean}?`,
        answer: `By establishing loop invariants or inductive hypotheses, and running unit tests against varied test datasets.`,
        explanation: `Mathematical reasoning coupled with automated unit testing ensures reliable software execution.`
      }
    ]
  };
}

/**
 * Opens the API Help Modal.
 */
function openApiHelpModal() {
  if (apiHelpModal) {
    apiHelpModal.style.display = 'flex';
    if (apiModalDismissBtn) apiModalDismissBtn.focus();
  }
}

/**
 * Closes the API Help Modal.
 */
function closeApiHelpModal() {
  if (apiHelpModal) {
    apiHelpModal.style.display = 'none';
  }
}

// ============================================================================
// 12. INITIALIZATION ON PAGE LOAD
// ============================================================================

function initializeApp() {
  // Set default due date picker value to today
  const today = getTodayDateOnly();
  taskDueDateInput.value = formatDateToInputString(today);

  // Display human-readable today's date in header
  const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
  currentDateDisplay.textContent = today.toLocaleDateString(undefined, options);

  // Load existing tasks from browser localStorage
  loadTasksFromStorage();

  // Attach event handlers
  setupEventListeners();

  // Render initial UI
  renderApp();
}

// Run application when DOM content is fully loaded
document.addEventListener('DOMContentLoaded', initializeApp);
