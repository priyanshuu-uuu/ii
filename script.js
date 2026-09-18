(() => {
  'use strict';

  const STORAGE_KEY = 'student-os-v1';
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const DEFAULT_SUBJECTS = [
    { id: uid(), name: 'Mathematics', progress: 38, color: '#6256e8' },
    { id: uid(), name: 'Computer Science', progress: 64, color: '#22a879' },
    { id: uid(), name: 'Physics', progress: 52, color: '#f09a55' }
  ];

  const DEFAULT_STATE = {
    theme: 'light',
    tasks: [],
    notes: [],
    subjects: DEFAULT_SUBJECTS,
    plans: [],
    focus: {
      sessions: 0,
      minutes: 0,
      days: {}
    }
  };

  let state = loadState();
  let currentView = 'dashboard';
  let taskFilter = 'all';
  let selectedDate = todayISO();
  let calendarDate = new Date();

  const timer = {
    total: 25 * 60,
    seconds: 25 * 60,
    interval: null,
    running: false
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return {
        ...DEFAULT_STATE,
        ...parsed,
        subjects: Array.isArray(parsed.subjects) && parsed.subjects.length ? parsed.subjects : DEFAULT_SUBJECTS,
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        notes: Array.isArray(parsed.notes) ? parsed.notes : [],
        plans: Array.isArray(parsed.plans) ? parsed.plans : [],
        focus: {
          sessions: Number(parsed?.focus?.sessions) || 0,
          minutes: Number(parsed?.focus?.minutes) || 0,
          days: parsed?.focus?.days && typeof parsed.focus.days === 'object' ? parsed.focus.days : {}
        }
      };
    } catch {
      return JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderAll();
  }

  function esc(value = '') {
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function toast(message) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  function openModal(html) {
    const modalContent = $('#modalContent');
    const backdrop = $('#modalBackdrop');
    if (!modalContent || !backdrop) return;
    modalContent.innerHTML = html;
    backdrop.classList.add('open');
    setTimeout(() => {
      const firstField = modalContent.querySelector('input, textarea, button');
      if (firstField) firstField.focus();
    }, 30);
  }

  function closeModal() {
    const modal = $('#modalBackdrop');
    if (modal) modal.classList.remove('open');
  }

  function modalForm(title, fields, submitText, callback) {
    openModal(`
      <h2>${title}</h2>
      <form id="modalForm">
        ${fields}
        <div class="form-actions">
          <button type="button" class="secondary" id="cancelModal">Cancel</button>
          <button type="submit" class="primary">${submitText}</button>
        </div>
      </form>
    `);

    $('#cancelModal')?.addEventListener('click', closeModal);
    $('#modalForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      callback(form);
      closeModal();
    });
  }

  function formatSeconds(totalSeconds) {
    const safe = Math.max(0, Number(totalSeconds) || 0);
    const minutes = Math.floor(safe / 60);
    const seconds = safe % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function lastDays() {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      return {
        iso: date.toISOString().slice(0, 10),
        label: date.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3)
      };
    });
  }

  function doneTasksCount() {
    return state.tasks.filter((task) => task.done).length;
  }

  function streak() {
    let count = 0;
    const cursor = new Date();
    while (true) {
      const iso = cursor.toISOString().slice(0, 10);
      const focusMinutes = Number(state.focus.days[iso] || 0);
      const tasksDone = state.tasks.some((task) => task.done && task.date === iso);
      if (focusMinutes > 0 || tasksDone) {
        count += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return count;
  }

  function getCurrentFocusMinutes() {
    return Number(state.focus.days[todayISO()] || 0);
  }

  function navigate(view) {
    currentView = view;

    $$('.view').forEach((section) => {
      section.classList.toggle('active', section.id === `${view}View`);
    });

    $$('.nav-item').forEach((button) => {
      button.classList.toggle('active', button.dataset.view === view);
    });

    const pageName = $('#pageName');
    if (pageName) {
      pageName.textContent = view.charAt(0).toUpperCase() + view.slice(1);
    }

    const sidebar = $('#sidebar');
    const backdrop = $('#backdrop');
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderMiniChart() {
    const days = lastDays();
    const values = days.map((day) => Number(state.focus.days[day.iso] || 0));
    const max = Math.max(30, ...values, 1);

    const chart = $('#weeklyChart');
    if (!chart) return;

    chart.innerHTML = days.map((day, index) => {
      const value = values[index];
      const height = Math.max(6, (value / max) * 100);
      return `
        <div class="chart-column">
          <div class="chart-bar" style="height:${height}%"></div>
          <small>${day.label}</small>
        </div>
      `;
    }).join('');
  }

  function renderDashboard() {
    const total = state.tasks.length;
    const done = doneTasksCount();
    const percent = total ? Math.round((done / total) * 100) : 0;
    const focusMinutes = getCurrentFocusMinutes();
    const bestStreak = Math.max(0, ...Object.values(state.focus.days).map(Number), 0);

    const dashFocus = $('#dashFocus');
    const dashTasks = $('#dashTasks');
    const dashStreak = $('#dashStreak');
    const bestStreakEl = $('#bestStreak');
    const dailyPercent = $('#dailyPercent');
    const dailyDone = $('#dailyDone');
    const dailyTotal = $('#dailyTotal');
    const dailyBar = $('#dailyBar');
    const dailyHeadline = $('#dailyHeadline');
    const upNext = $('#upNext');

    if (dashFocus) dashFocus.textContent = `${focusMinutes}m`;
    if (dashTasks) dashTasks.textContent = `${done}/${total}`;
    if (dashStreak) dashStreak.textContent = `${streak()} day streak`;
    if (bestStreakEl) bestStreakEl.textContent = `${bestStreak}`;
    if (dailyPercent) dailyPercent.textContent = `${percent}%`;
    if (dailyDone) dailyDone.textContent = `${done}`;
    if (dailyTotal) dailyTotal.textContent = `${total}`;
    if (dailyBar) dailyBar.style.width = `${percent}%`;
    if (dailyHeadline) {
      dailyHeadline.textContent = percent >= 100 ? 'Beautiful focus.' : percent >= 50 ? "You're in the flow." : 'A fresh start.';
    }

    if (upNext) {
      const queued = state.tasks.filter((task) => !task.done).slice(0, 3);
      upNext.innerHTML = queued.length
        ? queued.map((task) => `
            <div class="next-item">
              <strong>${esc(task.title)}</strong>
              <small>${task.subject ? esc(task.subject) : 'General'} · ${task.date === todayISO() ? 'Today' : task.date || 'No date'}</small>
            </div>
          `).join('')
        : '<div class="empty">Nothing queued. Enjoy the space.</div>';
    }

    renderMiniChart();
  }

  function renderTasks() {
    const searchQuery = ($('#taskSearch')?.value || '').toLowerCase().trim();
    const filteredTasks = state.tasks.filter((task) => {
      const matchesText = (task.title || '').toLowerCase().includes(searchQuery) || (task.subject || '').toLowerCase().includes(searchQuery);
      if (!matchesText) return false;
      if (taskFilter === 'all') return true;
      if (taskFilter === 'active') return !task.done;
      if (taskFilter === 'done') return task.done;
      if (taskFilter === 'today') return task.date === todayISO();
      return true;
    });

    const taskCount = $('#taskCount');
    if (taskCount) taskCount.textContent = state.tasks.filter((task) => !task.done).length;

    const taskList = $('#taskList');
    if (!taskList) return;

    taskList.innerHTML = filteredTasks.length
      ? filteredTasks.map((task) => `
          <div class="task-row ${task.done ? 'done' : ''}">
            <button class="check" data-check-task="${task.id}" aria-label="Complete task">${task.done ? '✓' : ''}</button>
            <div class="task-info">
              <strong>${esc(task.title)}</strong>
              <small>${task.subject ? esc(task.subject) : 'General'} · ${task.date ? esc(task.date) : 'No date'}</small>
            </div>
            <span class="tag">${task.subject ? esc(task.subject) : 'General'}</span>
            <button class="row-delete" data-delete-task="${task.id}" aria-label="Delete task">×</button>
          </div>
        `).join('')
      : '<div class="empty">No tasks here yet. Add one small thing to get moving.</div>';

    $$('.filter-tab').forEach((button) => {
      button.classList.toggle('active', button.dataset.filter === taskFilter);
    });
  }

  function renderNotes() {
    const query = ($('#noteSearch')?.value || '').toLowerCase().trim();
    const notes = state.notes.filter((note) => {
      const text = `${note.title || ''} ${note.body || ''}`.toLowerCase();
      return text.includes(query);
    });

    const grid = $('#notesGrid');
    if (!grid) return;

    grid.innerHTML = notes.length
      ? notes.map((note) => `
          <article class="note-card">
            <button class="note-delete" data-delete-note="${note.id}" aria-label="Delete note">×</button>
            <h3>${esc(note.title || 'Untitled')}</h3>
            <p>${esc(note.body || '')}</p>
            <div class="note-meta">
              <span>${note.date || 'Today'}</span>
              <span>Local note</span>
            </div>
          </article>
        `).join('')
      : '<div class="empty">No notes yet. Capture the thought while it is here.</div>';
  }

  function renderSubjects() {
    const grid = $('#subjectGrid');
    const summary = $('#subjectSummary');
    if (!grid) return;

    grid.innerHTML = state.subjects.length
      ? state.subjects.map((subject) => `
          <article class="subject-card">
            <div class="subject-top">
              <h3>${esc(subject.name)}</h3>
              <strong class="subject-percent">${subject.progress || 0}%</strong>
            </div>
            <div class="bar">
              <span style="width:${subject.progress || 0}%; background:${subject.color || '#6256e8'}"></span>
            </div>
            <small>
              <button class="link-button" data-edit-subject="${subject.id}">Update</button>
              <button class="link-button" data-delete-subject="${subject.id}">Delete</button>
            </small>
          </article>
        `).join('')
      : '<div class="empty">Add your first subject to start tracking progress.</div>';

    if (summary) {
      summary.innerHTML = state.subjects.map((subject) => `
        <div class="summary-row">
          <div class="summary-line"><b>${esc(subject.name)}</b><span>${subject.progress || 0}%</span></div>
          <div class="bar"><span style="width:${subject.progress || 0}%; background:${subject.color || '#6256e8'}"></span></div>
        </div>
      `).join('');
    }
  }

  function renderCalendar() {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const monthTitle = $('#monthTitle');
    if (monthTitle) monthTitle.textContent = calendarDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1);
    const startingDay = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const lastMonthDays = new Date(year, month, 0).getDate();

    const cells = [];
    for (let i = 0; i < startingDay; i += 1) {
      const dayNumber = lastMonthDays - startingDay + i + 1;
      cells.push(`<button class="muted-day" disabled>${dayNumber}</button>`);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const hasPlans = state.plans.some((plan) => plan.date === iso);
      const classNames = ['day', iso === selectedDate ? 'selected' : '', iso === todayISO() ? 'today' : ''];
      cells.push(`<button class="${classNames.filter(Boolean).join(' ')}" data-date="${iso}"><span>${day}</span>${hasPlans ? '<i></i>' : ''}</button>`);
    }

    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i += 1) {
      cells.push(`<button class="muted-day" disabled>${i}</button>`);
    }

    const calendarGrid = $('#calendarGrid');
    if (calendarGrid) calendarGrid.innerHTML = cells.join('');

    const selectedText = $('#selectedDate');
    if (selectedText) {
      selectedText.textContent = selectedDate === todayISO()
        ? 'Today'
        : new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    renderDayPlans();
  }

  function renderDayPlans() {
    const plans = state.plans.filter((plan) => plan.date === selectedDate);
    const dayPlans = $('#dayPlans');
    if (!dayPlans) return;

    dayPlans.innerHTML = plans.length
      ? plans.map((plan) => `
          <div class="plan-item">
            <input type="checkbox" data-plan-check="${plan.id}" ${plan.done ? 'checked' : ''}>
            <div>
              <strong>${esc(plan.title)}</strong>
              <small>${plan.time || 'Any time'}</small>
            </div>
            <button class="row-delete" data-delete-plan="${plan.id}" aria-label="Delete plan">×</button>
          </div>
        `).join('')
      : '<div class="empty">Nothing planned for this day.</div>';
  }

  function renderFocus() {
    const minutes = getCurrentFocusMinutes();
    const sessionCount = $('#sessionCount');
    const focusMinutes = $('#focusMinutes');
    const timerDisplay = $('#timerDisplay');
    const timerLabel = $('#timerLabel');
    const timerRing = $('#timerRing');
    const timerStart = $('#timerStart');

    if (sessionCount) sessionCount.textContent = state.focus.sessions;
    if (focusMinutes) focusMinutes.textContent = minutes;
    if (timerDisplay) timerDisplay.textContent = formatSeconds(timer.seconds);
    if (timerLabel) timerLabel.textContent = timer.running ? 'In progress' : 'Ready when you are';
    if (timerRing) {
      const progress = timer.total ? (timer.seconds / timer.total) * 100 : 0;
      timerRing.style.background = `conic-gradient(var(--accent) ${progress}%, rgba(98,86,232,0.15) ${progress}% 100%)`;
    }
    if (timerStart) timerStart.textContent = timer.running ? 'Pause timer' : 'Start timer';
  }

  function renderStats() {
    const days = lastDays();
    const values = days.map((day) => Number(state.focus.days[day.iso] || 0));
    const totalMinutes = values.reduce((sum, value) => sum + value, 0);
    const max = Math.max(30, ...values, 1);
    const chartTotal = $('#chartTotal');
    const bars = $('#largeBars');

    if (chartTotal) chartTotal.textContent = `${totalMinutes}m`;
    if (bars) {
      bars.innerHTML = days.map((day, index) => `
        <div class="large-bar-col">
          <div class="large-bar" style="height:${Math.max(8, (values[index] / max) * 100)}%">
            <em>${values[index]}</em>
          </div>
          <small>${day.label}</small>
        </div>
      `).join('');
    }
  }

  function renderAll() {
    document.body.classList.toggle('dark', state.theme === 'dark');
    const toggle = $('#themeToggle');
    if (toggle) {
      toggle.innerHTML = state.theme === 'dark' ? '☀ <span>Light mode</span>' : '☾ <span>Dark mode</span>';
    }

    renderDashboard();
    renderTasks();
    renderNotes();
    renderSubjects();
    renderCalendar();
    renderFocus();
    renderStats();
  }

  function taskModal() {
    modalForm(
      'Add a task',
      `
        <label class="form-field">
          <span>Task title</span>
          <input name="title" required placeholder="e.g. Review chapter 4">
        </label>
        <label class="form-field">
          <span>Subject</span>
          <input name="subject" placeholder="e.g. Mathematics">
        </label>
        <label class="form-field">
          <span>Due date</span>
          <input name="date" type="date" value="${todayISO()}">
        </label>
      `,
      'Add task',
      (formData) => {
        const title = (formData.get('title') || '').toString().trim();
        if (!title) return;
        state.tasks.unshift({
          id: uid(),
          title,
          subject: (formData.get('subject') || '').toString().trim(),
          date: (formData.get('date') || todayISO()).toString(),
          done: false
        });
        saveState();
        toast('Task added');
      }
    );
  }

  function noteModal() {
    modalForm(
      'New note',
      `
        <label class="form-field">
          <span>Title</span>
          <input name="title" required placeholder="A thought worth keeping">
        </label>
        <label class="form-field">
          <span>Note</span>
          <textarea name="body" rows="5" required placeholder="Write freely..."></textarea>
        </label>
      `,
      'Save note',
      (formData) => {
        const title = (formData.get('title') || '').toString().trim();
        const body = (formData.get('body') || '').toString().trim();
        if (!title || !body) return;
        state.notes.unshift({
          id: uid(),
          title,
          body,
          date: todayISO()
        });
        saveState();
        toast('Note saved');
      }
    );
  }

  function subjectModal(subject = null) {
    modalForm(
      subject ? 'Update subject' : 'Add subject',
      `
        <label class="form-field">
          <span>Subject name</span>
          <input name="name" required value="${esc(subject?.name || '')}" placeholder="e.g. Biology">
        </label>
        <label class="form-field">
          <span>Progress (0-100)</span>
          <input name="progress" type="number" min="0" max="100" value="${subject?.progress ?? 0}">
        </label>
      `,
      'Save subject',
      (formData) => {
        const name = (formData.get('name') || '').toString().trim();
        const progress = Number(formData.get('progress') || 0);
        if (!name) return;

        if (subject) {
          subject.name = name;
          subject.progress = Math.min(100, Math.max(0, progress));
        } else {
          state.subjects.push({
            id: uid(),
            name,
            progress: Math.min(100, Math.max(0, progress)),
            color: '#6256e8'
          });
        }

        saveState();
        toast('Subject saved');
      }
    );
  }

  function planModal() {
    modalForm(
      'Add a plan',
      `
        <label class="form-field">
          <span>What will you study?</span>
          <input name="title" required placeholder="e.g. Read lecture notes">
        </label>
        <label class="form-field">
          <span>Date</span>
          <input name="date" type="date" value="${selectedDate}">
        </label>
        <label class="form-field">
          <span>Time</span>
          <input name="time" type="time">
        </label>
      `,
      'Add to planner',
      (formData) => {
        const title = (formData.get('title') || '').toString().trim();
        if (!title) return;
        state.plans.push({
          id: uid(),
          title,
          date: (formData.get('date') || selectedDate).toString(),
          time: (formData.get('time') || '').toString(),
          done: false
        });
        selectedDate = (formData.get('date') || selectedDate).toString();
        saveState();
        toast('Plan added');
      }
    );
  }

  function attachEvents() {
    const openSidebar = $('#openSidebar');
    const closeSidebar = $('#closeSidebar');
    const backdrop = $('#backdrop');
    const sidebar = $('#sidebar');

    if (openSidebar) openSidebar.addEventListener('click', () => {
      sidebar?.classList.add('open');
      backdrop?.classList.add('open');
    });

    if (closeSidebar) closeSidebar.addEventListener('click', () => {
      sidebar?.classList.remove('open');
      backdrop?.classList.remove('open');
    });

    if (backdrop) backdrop.addEventListener('click', () => {
      sidebar?.classList.remove('open');
      backdrop.classList.remove('open');
    });

    $$('.nav-item').forEach((button) => {
      button.addEventListener('click', () => navigate(button.dataset.view));
    });

    const themeToggle = $('#themeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        saveState();
      });
    }

    $('#exportBtn')?.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `student-os-backup-${todayISO()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast('Backup exported');
    });

    $('#importInput')?.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          state = {
            ...DEFAULT_STATE,
            ...parsed,
            focus: {
              sessions: Number(parsed?.focus?.sessions) || 0,
              minutes: Number(parsed?.focus?.minutes) || 0,
              days: parsed?.focus?.days || {}
            }
          };
          saveState();
          toast('Backup restored');
        } catch {
          toast('That backup file is not valid');
        }
      };
      reader.readAsText(file);
      event.target.value = '';
    });

    $('#addTaskBtn')?.addEventListener('click', taskModal);
    $('#addNoteBtn')?.addEventListener('click', noteModal);
    $('#addSubjectBtn')?.addEventListener('click', () => subjectModal());
    $('#addPlanBtn')?.addEventListener('click', planModal);

    $('#saveQuickNote')?.addEventListener('click', () => {
      const input = $('#quickNote');
      const value = (input?.value || '').trim();
      if (!value) {
        toast('Write a quick thought first');
        return;
      }
      state.notes.unshift({
        id: uid(),
        title: 'Quick capture',
        body: value,
        date: todayISO()
      });
      if (input) input.value = '';
      saveState();
      toast('Saved to notes');
    });

    $('#quickNote')?.addEventListener('keydown', (event) => {
      if ((event.key === 'Enter' || event.key === 'NumpadEnter') && (event.metaKey || event.ctrlKey)) {
        $('#saveQuickNote')?.click();
      }
    });

    document.querySelectorAll('[data-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        taskFilter = button.dataset.filter;
        renderTasks();
      });
    });

    $('#taskSearch')?.addEventListener('input', renderTasks);
    $('#noteSearch')?.addEventListener('input', renderNotes);

    document.addEventListener('click', (event) => {
      const taskCheck = event.target.closest('[data-check-task]');
      if (taskCheck) {
        const task = state.tasks.find((item) => item.id === taskCheck.dataset.checkTask);
        if (task) {
          task.done = !task.done;
          saveState();
        }
      }

      const taskDelete = event.target.closest('[data-delete-task]');
      if (taskDelete) {
        state.tasks = state.tasks.filter((task) => task.id !== taskDelete.dataset.deleteTask);
        saveState();
      }

      const noteDelete = event.target.closest('[data-delete-note]');
      if (noteDelete) {
        state.notes = state.notes.filter((note) => note.id !== noteDelete.dataset.deleteNote);
        saveState();
      }

      const subjectEdit = event.target.closest('[data-edit-subject]');
      if (subjectEdit) {
        const subject = state.subjects.find((item) => item.id === subjectEdit.dataset.editSubject);
        if (subject) subjectModal(subject);
      }

      const subjectDelete = event.target.closest('[data-delete-subject]');
      if (subjectDelete) {
        state.subjects = state.subjects.filter((subject) => subject.id !== subjectDelete.dataset.deleteSubject);
        saveState();
      }

      const planDelete = event.target.closest('[data-delete-plan]');
      if (planDelete) {
        state.plans = state.plans.filter((plan) => plan.id !== planDelete.dataset.deletePlan);
        saveState();
      }

      const planCheck = event.target.closest('[data-plan-check]');
      if (planCheck) {
        const plan = state.plans.find((item) => item.id === planCheck.dataset.planCheck);
        if (plan) {
          plan.done = !plan.done;
          saveState();
        }
      }

      const dateButton = event.target.closest('[data-date]');
      if (dateButton) {
        selectedDate = dateButton.dataset.date;
        renderCalendar();
      }
    });

    document.querySelectorAll('[data-minutes]').forEach((button) => {
      button.addEventListener('click', () => {
        const minutes = Number(button.dataset.minutes || 25);
        timer.total = minutes * 60;
        timer.seconds = timer.total;
        timer.running = false;
        clearInterval(timer.interval);
        timer.interval = null;
        renderFocus();
      });
    });

    $('#timerStart')?.addEventListener('click', () => {
      if (timer.running) {
        clearInterval(timer.interval);
        timer.running = false;
        timer.interval = null;
        renderFocus();
        return;
      }

      timer.running = true;
      timer.interval = setInterval(() => {
        if (timer.seconds > 0) {
          timer.seconds -= 1;
          renderFocus();
          return;
        }

        clearInterval(timer.interval);
        timer.running = false;
        timer.interval = null;
        const acquired = Math.round(timer.total / 60);
        state.focus.sessions += 1;
        state.focus.minutes += acquired;
        state.focus.days[todayISO()] = Number(state.focus.days[todayISO()] || 0) + acquired;
        saveState();
        toast('Session complete');
        timer.seconds = timer.total;
        renderFocus();
      }, 1000);

      renderFocus();
    });

    $('#timerReset')?.addEventListener('click', () => {
      clearInterval(timer.interval);
      timer.running = false;
      timer.interval = null;
      timer.seconds = timer.total;
      renderFocus();
    });

    $('#prevMonth')?.addEventListener('click', () => {
      calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
      renderCalendar();
    });

    $('#nextMonth')?.addEventListener('click', () => {
      calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
      renderCalendar();
    });
  }

  attachEvents();
  renderAll();
})();
