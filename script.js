'use strict';

const STORAGE_KEY = 'life-os-data-v1';

const $ = (selector) => document.querySelector(selector);

const state = {
    tasks: [],
    goals: [],
    habits: [],
    notes: [],
    settings: {
        name: '',
        theme: 'dark'
    }
};

let toastTimer;

function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}

function showToast(message) {
    const toast = $('#toast');

    toast.textContent = message;
    toast.classList.add('show');

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 2800);
}

function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function formatDate(dateString) {
    if (!dateString) {
        return '';
    }

    const parts = dateString.split('-').map(Number);

    if (
        parts.length !== 3 ||
        parts.some((part) => !Number.isInteger(part)) ||
        parts[0] < 1000 ||
        parts[1] < 1 ||
        parts[1] > 12 ||
        parts[2] < 1 ||
        parts[2] > 31
    ) {
        return 'موعد غير صالح';
    }

    const date = new Date(parts[0], parts[1] - 1, parts[2]);

    if (
        date.getFullYear() !== parts[0] ||
        date.getMonth() !== parts[1] - 1 ||
        date.getDate() !== parts[2]
    ) {
        return 'موعد غير صالح';
    }

    return new Intl.DateTimeFormat('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }).format(date);
}

function saveData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        return true;
    } catch (error) {
        console.error('تعذر حفظ البيانات:', error);
        showToast('تعذر الحفظ. صدّر نسخة احتياطية من بياناتك.');
        return false;
    }
}

function validArray(value) {
    return Array.isArray(value)
        ? value.filter((item) =>
            item &&
            typeof item === 'object' &&
            !Array.isArray(item)
        )
        : [];
}

function normalizeState(data) {
    const normalized = {
        tasks: [],
        goals: [],
        habits: [],
        notes: [],
        settings: {
            name: '',
            theme: 'dark'
        }
    };

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return normalized;
    }

    normalized.tasks = validArray(data.tasks)
        .filter((item) =>
            typeof item.text === 'string' &&
            typeof item.id === 'string'
        )
        .map((item) => ({
            id: item.id,
            text: item.text.slice(0, 160),
            category: ['الدراسة', 'المشاريع', 'الشخصي', 'الصحة', 'أخرى']
                .includes(item.category) ? item.category : 'أخرى',
            priority: ['عالية', 'متوسطة', 'منخفضة']
                .includes(item.priority) ? item.priority : 'متوسطة',
            date: typeof item.date === 'string' ? item.date : '',
            completed: item.completed === true
        }));

    normalized.goals = validArray(data.goals)
        .filter((item) =>
            typeof item.text === 'string' &&
            typeof item.id === 'string'
        )
        .map((item) => ({
            id: item.id,
            text: item.text.slice(0, 120),
            completed: item.completed === true
        }));

    normalized.habits = validArray(data.habits)
        .filter((item) =>
            typeof item.text === 'string' &&
            typeof item.id === 'string'
        )
        .map((item) => ({
            id: item.id,
            text: item.text.slice(0, 100),
            days: Array.isArray(item.days)
                ? [...new Set(item.days.filter((day) =>
                    typeof day === 'string' &&
                    /^\d{4}-\d{2}-\d{2}$/.test(day)
                ))].slice(-1000)
                : []
        }));

    normalized.notes = validArray(data.notes)
        .filter((item) =>
            typeof item.title === 'string' &&
            typeof item.content === 'string' &&
            typeof item.id === 'string'
        )
        .map((item) => ({
            id: item.id,
            title: item.title.slice(0, 120),
            content: item.content.slice(0, 5000)
        }));

    if (data.settings && typeof data.settings === 'object') {
        normalized.settings.name =
            typeof data.settings.name === 'string'
                ? data.settings.name.slice(0, 40)
                : '';

        normalized.settings.theme =
            data.settings.theme === 'light' ? 'light' : 'dark';
    }

    return normalized;
}

function loadData() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (!saved) {
            return;
        }

        state.tasks = [];
        state.goals = [];
        state.habits = [];
        state.notes = [];

        Object.assign(state, normalizeState(JSON.parse(saved)));
    } catch (error) {
        console.error('تعذر تحميل البيانات:', error);
        showToast('تعذر قراءة البيانات المحفوظة.');
    }
}

function applySettings() {
    document.body.classList.toggle(
        'light',
        state.settings.theme === 'light'
    );

    $('#userName').value = state.settings.name;
    $('#themeSelect').value = state.settings.theme;

    $('#welcomeTitle').textContent = state.settings.name
        ? `أهلاً ${state.settings.name}، كل إنجاز يبدأ بخطوة.`
        : 'كل إنجاز يبدأ بخطوة.';
}

function updateDate() {
    $('#currentDate').textContent =
        new Intl.DateTimeFormat('ar-SA', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).format(new Date());
}

function updateStats() {
    const total = state.tasks.length;

    const completed = state.tasks.filter(
        (task) => task.completed
    ).length;

    const remaining = total - completed;

    const percentage = total
        ? Math.round((completed / total) * 100)
        : 0;

    $('#totalTasks').textContent = total;
    $('#completedTasks').textContent = completed;
    $('#remainingTasks').textContent = remaining;
    $('#completionRate').textContent = `${percentage}%`;
    $('#completionBar').style.width = `${percentage}%`;
}

function emptyState(message) {
    return `<div class="empty-state">${escapeHTML(message)}</div>`;
}

function taskHTML(task) {
    const completedClass = task.completed ? 'completed' : '';

    const due = task.date
        ? `<span class="badge">📅 ${escapeHTML(formatDate(task.date))}</span>`
        : '';

    return `
        <article class="task-item ${completedClass}">
            <input
                type="checkbox"
                data-action="toggle-task"
                data-id="${escapeHTML(task.id)}"
                aria-label="تغيير حالة المهمة"
                ${task.completed ? 'checked' : ''}
            >

            <div class="item-body">
                <div class="item-title">${escapeHTML(task.text)}</div>

                <div class="item-meta">
                    <span class="badge">${escapeHTML(task.category)}</span>
                    <span class="badge">أولوية ${escapeHTML(task.priority)}</span>
                    ${due}
                </div>
            </div>

            <div class="item-actions">
                <button
                    class="small-btn"
                    data-action="edit-task"
                    data-id="${escapeHTML(task.id)}"
                >تعديل</button>

                <button
                    class="small-btn"
                    data-action="delete-task"
                    data-id="${escapeHTML(task.id)}"
                >حذف</button>
            </div>
        </article>
    `;
}

function goalHTML(goal) {
    return `
        <article class="goal-item ${goal.completed ? 'completed' : ''}">
            <div class="item-body">
                <div class="item-title">${escapeHTML(goal.text)}</div>
                <div class="item-meta">
                    ${goal.completed ? 'تم إنجاز هذا الهدف ✓' : 'هدف قيد العمل'}
                </div>
            </div>

            <div class="item-actions">
                <button
                    class="small-btn"
                    data-action="toggle-goal"
                    data-id="${escapeHTML(goal.id)}"
                >${goal.completed ? 'إعادة فتح' : 'إنجاز ✓'}</button>

                <button
                    class="small-btn"
                    data-action="edit-goal"
                    data-id="${escapeHTML(goal.id)}"
                >تعديل</button>

                <button
                    class="small-btn"
                    data-action="delete-goal"
                    data-id="${escapeHTML(goal.id)}"
                >حذف</button>
            </div>
        </article>
    `;
}

function renderTasks() {
    const filter = $('#taskFilter').value;

    const filtered = state.tasks.filter((task) => {
        if (filter === 'active') {
            return !task.completed;
        }

        if (filter === 'completed') {
            return task.completed;
        }

        return true;
    });

    $('#allTasks').innerHTML = filtered.length
        ? filtered.map(taskHTML).join('')
        : emptyState('لا توجد مهام في هذا القسم.');

    const upcoming = state.tasks
        .filter((task) => !task.completed)
        .slice(0, 5);

    $('#dashboardTasks').innerHTML = upcoming.length
        ? upcoming.map(taskHTML).join('')
        : emptyState('لا توجد مهام معلقة. أضف مهمة جديدة لتبدأ.');

    updateStats();
}

function renderGoals() {
    $('#allGoals').innerHTML = state.goals.length
        ? state.goals.map(goalHTML).join('')
        : emptyState('لم تضف أهدافًا بعد. ابدأ بهدف صغير.');

    $('#dashboardGoals').innerHTML = state.goals.length
        ? state.goals.slice(0, 4).map(goalHTML).join('')
        : emptyState('أضف هدفك الأول هنا.');
}

function renderHabits() {
    const today = localDateKey();

    $('#allHabits').innerHTML = state.habits.length
        ? state.habits.map((habit) => {
            const completedToday = habit.days.includes(today);

            return `
                <article class="habit-item">
                    <div class="task-item">
                        <input
                            type="checkbox"
                            data-action="toggle-habit"
                            data-id="${escapeHTML(habit.id)}"
                            aria-label="إنجاز العادة اليوم"
                            ${completedToday ? 'checked' : ''}
                        >

                        <div class="item-body">
                            <div class="item-title">${escapeHTML(habit.text)}</div>
                            <div class="item-meta">
                                ${habit.days.length} يوم إنجاز مسجل
                            </div>
                        </div>

                        <div class="item-actions">
                            <button
                                class="small-btn"
                                data-action="edit-habit"
                                data-id="${escapeHTML(habit.id)}"
                            >تعديل</button>

                            <button
                                class="small-btn"
                                data-action="delete-habit"
                                data-id="${escapeHTML(habit.id)}"
                            >حذف</button>
                        </div>
                    </div>
                </article>
            `;
        }).join('')
        : emptyState('أضف عادة جديدة تريد الالتزام بها.');
}

function renderNotes() {
    $('#allNotes').innerHTML = state.notes.length
        ? state.notes.map((note) => `
            <article class="note-item">
                <h3>${escapeHTML(note.title)}</h3>
                <p>${escapeHTML(note.content)}</p>

                <div class="item-actions">
                    <button
                        class="small-btn"
                        data-action="edit-note"
                        data-id="${escapeHTML(note.id)}"
                    >تعديل</button>

                    <button
                        class="small-btn"
                        data-action="delete-note"
                        data-id="${escapeHTML(note.id)}"
                    >حذف</button>
                </div>
            </article>
        `).join('')
        : emptyState('مساحة الأفكار جاهزة. دوّن أول ملاحظة.');
}

function renderAll() {
    renderTasks();
    renderGoals();
    renderHabits();
    renderNotes();
    applySettings();
}

const pageInfo = {
    dashboard: {
        title: 'لوحة التحكم',
        subtitle: 'خطط ليومك، وابدأ إنجاز أهدافك.'
    },
    tasks: {
        title: 'إدارة المهام',
        subtitle: 'نظّم أولوياتك وتابع تقدمك.'
    },
    goals: {
        title: 'الأهداف',
        subtitle: 'حوّل طموحاتك إلى خطوات قابلة للإنجاز.'
    },
    habits: {
        title: 'العادات',
        subtitle: 'ابنِ روتينك اليومي خطوة بخطوة.'
    },
    notes: {
        title: 'الملاحظات',
        subtitle: 'احتفظ بأفكارك وخططك في مكان واحد.'
    },
    settings: {
        title: 'الإعدادات',
        subtitle: 'خصّص التطبيق بما يناسبك.'
    }
};

function navigateTo(pageId) {
    if (!pageInfo[pageId]) {
        return;
    }

    document.querySelectorAll('.page').forEach((page) => {
        page.classList.toggle('active', page.id === pageId);
    });

    document.querySelectorAll('.nav-item').forEach((button) => {
        button.classList.toggle(
            'active',
            button.dataset.page === pageId
        );
    });

    $('#pageTitle').textContent = pageInfo[pageId].title;
    $('#pageSubtitle').textContent = pageInfo[pageId].subtitle;

    if (pageId === 'tasks') {
        $('#taskTitle').focus();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function addTask(event) {
    event.preventDefault();

    const text = $('#taskTitle').value.trim();

    if (!text) {
        showToast('اكتب اسم المهمة أولاً.');
        return;
    }

    state.tasks.unshift({
        id: createId(),
        text,
        category: $('#taskCategory').value,
        priority: $('#taskPriority').value,
        date: $('#taskDate').value,
        completed: false
    });

    $('#taskForm').reset();

    saveData();
    renderAll();
    showToast('تمت إضافة المهمة بنجاح.');
}

function addGoal(event) {
    event.preventDefault();

    const text = $('#goalTitle').value.trim();

    if (!text) {
        showToast('اكتب اسم الهدف أولاً.');
        return;
    }

    state.goals.unshift({
        id: createId(),
        text,
        completed: false
    });

    $('#goalForm').reset();

    saveData();
    renderAll();
    showToast('تمت إضافة الهدف.');
}

function addHabit(event) {
    event.preventDefault();

    const text = $('#habitTitle').value.trim();

    if (!text) {
        showToast('اكتب اسم العادة أولاً.');
        return;
    }

    state.habits.unshift({
        id: createId(),
        text,
        days: []
    });

    $('#habitForm').reset();

    saveData();
    renderAll();
    showToast('تمت إضافة العادة.');
}

function addNote(event) {
    event.preventDefault();

    const title = $('#noteTitle').value.trim();
    const content = $('#noteContent').value.trim();

    if (!title || !content) {
        showToast('أدخل عنوان الملاحظة ومحتواها.');
        return;
    }

    state.notes.unshift({
        id: createId(),
        title,
        content
    });

    $('#noteForm').reset();

    saveData();
    renderAll();
    showToast('تم حفظ الملاحظة.');
}

function findById(collection, id) {
    return collection.find((item) => item.id === id);
}

function editText(item, label, maxLength) {
    const updated = prompt(`تعديل ${label}:`, item.text);

    if (updated === null) {
        return false;
    }

    const text = updated.trim();

    if (!text) {
        showToast('لا يمكن ترك النص فارغًا.');
        return false;
    }

    item.text = text.slice(0, maxLength);

    return true;
}

function handleAction(action, id, element) {
    let changed = false;

    switch (action) {
        case 'toggle-task': {
            const task = findById(state.tasks, id);

            if (task) {
                task.completed = element.checked;
                changed = true;
            }

            break;
        }

        case 'edit-task': {
            const task = findById(state.tasks, id);

            if (task && editText(task, 'المهمة', 160)) {
                changed = true;
            }

            break;
        }

        case 'delete-task': {
            const task = findById(state.tasks, id);

            if (task && confirm(`هل تريد حذف المهمة "${task.text}"؟`)) {
                state.tasks = state.tasks.filter((item) => item.id !== id);
                changed = true;
            }

            break;
        }

        case 'toggle-goal': {
            const goal = findById(state.goals, id);

            if (goal) {
                goal.completed = !goal.completed;
                changed = true;
            }

            break;
        }

        case 'edit-goal': {
            const goal = findById(state.goals, id);

            if (goal && editText(goal, 'الهدف', 120)) {
                changed = true;
            }

            break;
        }

        case 'delete-goal': {
            const goal = findById(state.goals, id);

            if (goal && confirm(`هل تريد حذف الهدف "${goal.text}"؟`)) {
                state.goals = state.goals.filter((item) => item.id !== id);
                changed = true;
            }

            break;
        }

        case 'toggle-habit': {
            const habit = findById(state.habits, id);

            if (habit) {
                const today = localDateKey();

                habit.days = element.checked
                    ? [...new Set([...habit.days, today])]
                    : habit.days.filter((day) => day !== today);

                changed = true;
            }

            break;
        }

        case 'edit-habit': {
            const habit = findById(state.habits, id);

            if (habit && editText(habit, 'العادة', 100)) {
                changed = true;
            }

            break;
        }

        case 'delete-habit': {
            const habit = findById(state.habits, id);

            if (habit && confirm(`هل تريد حذف العادة "${habit.text}"؟`)) {
                state.habits = state.habits.filter((item) => item.id !== id);
                changed = true;
            }

            break;
        }

        case 'edit-note': {
            const note = findById(state.notes, id);

            if (note) {
                const title = prompt('عنوان الملاحظة:', note.title);

                if (title === null) {
                    break;
                }

                const content = prompt('محتوى الملاحظة:', note.content);

                if (content === null) {
                    break;
                }

                if (!title.trim() || !content.trim()) {
                    showToast('لا يمكن ترك العنوان أو المحتوى فارغًا.');
                    break;
                }

                note.title = title.trim().slice(0, 120);
                note.content = content.trim().slice(0, 5000);

                changed = true;
            }

            break;
        }

        case 'delete-note': {
            const note = findById(state.notes, id);

            if (note && confirm(`هل تريد حذف الملاحظة "${note.title}"؟`)) {
                state.notes = state.notes.filter((item) => item.id !== id);
                changed = true;
            }

            break;
        }
    }

    if (changed) {
        saveData();
        renderAll();
        showToast('تم تحديث بياناتك.');
    }
}

function exportData() {
    const blob = new Blob(
        [JSON.stringify(state, null, 2)],
        { type: 'application/json;charset=utf-8' }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `life-os-backup-${localDateKey()}.json`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    showToast('تم تجهيز النسخة الاحتياطية.');
}

function importData(file) {
    if (!file) {
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showToast('حجم الملف كبير. الحد الأقصى 5 ميغابايت.');
        return;
    }

    const reader = new FileReader();

    reader.onload = () => {
        try {
            const parsed = JSON.parse(reader.result);

            if (
                !parsed ||
                typeof parsed !== 'object' ||
                Array.isArray(parsed) ||
                !Array.isArray(parsed.tasks) ||
                !Array.isArray(parsed.goals) ||
                !Array.isArray(parsed.habits) ||
                !Array.isArray(parsed.notes)
            ) {
                throw new Error('تنسيق النسخة الاحتياطية غير صحيح.');
            }

            if (!confirm('سيتم استبدال بياناتك الحالية بالبيانات الموجودة في الملف. هل تريد المتابعة؟')) {
                return;
            }

            const normalized = normalizeState(parsed);

            state.tasks = normalized.tasks;
            state.goals = normalized.goals;
            state.habits = normalized.habits;
            state.notes = normalized.notes;
            state.settings = normalized.settings;

            saveData();
            renderAll();

            showToast('تم استيراد البيانات بنجاح.');
        } catch (error) {
            console.error('خطأ في استيراد البيانات:', error);
            showToast('تعذر استيراد الملف. تأكد من اختيار نسخة صحيحة.');
        } finally {
            $('#importFile').value = '';
        }
    };

    reader.onerror = () => {
        showToast('تعذرت قراءة الملف.');
        $('#importFile').value = '';
    };

    reader.readAsText(file);
}

function saveSettings() {
    state.settings.name = $('#userName').value.trim().slice(0, 40);
    state.settings.theme = $('#themeSelect').value === 'light'
        ? 'light'
        : 'dark';

    saveData();
    applySettings();

    showToast('تم حفظ الإعدادات.');
}

function resetData() {
    if (!confirm('هل أنت متأكد؟ سيتم حذف جميع بيانات LIFE OS المحفوظة محليًا.')) {
        return;
    }

    state.tasks = [];
    state.goals = [];
    state.habits = [];
    state.notes = [];

    state.settings = {
        name: '',
        theme: 'dark'
    };

    saveData();
    renderAll();

    showToast('تمت إعادة ضبط التطبيق.');
}

function initialize() {
    loadData();
    updateDate();
    renderAll();

    document.querySelectorAll('.nav-item').forEach((button) => {
        button.addEventListener('click', () => {
            navigateTo(button.dataset.page);
        });
    });

    document.querySelectorAll('[data-open]').forEach((button) => {
        button.addEventListener('click', () => {
            navigateTo(button.dataset.open);
        });
    });

    $('#quickAdd').addEventListener('click', () => {
        navigateTo('tasks');
    });

    $('#taskForm').addEventListener('submit', addTask);
    $('#goalForm').addEventListener('submit', addGoal);
    $('#habitForm').addEventListener('submit', addHabit);
    $('#noteForm').addEventListener('submit', addNote);

    $('#taskFilter').addEventListener('change', renderTasks);

    document.addEventListener('click', (event) => {
        const button = event.target.closest('[data-action]');

        if (!button) {
            return;
        }

        handleAction(
            button.dataset.action,
            button.dataset.id,
            button
        );
    });

    document.addEventListener('change', (event) => {
        const checkbox = event.target.closest(
            'input[data-action="toggle-task"], input[data-action="toggle-habit"]'
        );

        if (!checkbox) {
            return;
        }

        handleAction(
            checkbox.dataset.action,
            checkbox.dataset.id,
            checkbox
        );
    });

    $('#saveSettings').addEventListener('click', saveSettings);
    $('#exportData').addEventListener('click', exportData);

    $('#importButton').addEventListener('click', () => {
        $('#importFile').click();
    });

    $('#importFile').addEventListener('change', (event) => {
        importData(event.target.files[0]);
    });

    $('#resetData').addEventListener('click', resetData);

    updateDate();
}

initialize();