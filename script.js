const supabase = window.supabase.createClient(
    'https://mfrsawuiepxignmkalup.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcnNhd3VpZXB4aWdubWthbHVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM3MDkwNzcsImV4cCI6MjA1OTI4NTA3N30.z6i2SRp5oAegWDsvhPIk03Hahw8k8vbi1ONaBgjF4wQ'
);

document.addEventListener('DOMContentLoaded', function() {
    if (!window.supabase) {
        console.error('Supabase не загружен! Проверьте подключение скрипта');
        return;
    }

    const modals = document.querySelectorAll('.modal');
    const addCardButtons = document.querySelectorAll('.add-card');
    const cardForm = document.getElementById('card-form');
    const columns = document.querySelectorAll('.kanban-column');
// Инициализация Supabase


    let currentUser = null;

    // Добавление задачи
    async function addTaskToDB(task) {
        const { data, error } = await supabase
            .from('tasks')
            .insert({
                ...task,
                user_id: currentUser.id
            })
            .select();

        if (error) throw error;
        return data[0];
    }

// Получение задач
    async function loadTasks() {
        try {
            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Ошибка загрузки задач:', error);
            return [];
        }
    }

// Обновление статуса задачи
    async function updateTaskStatus(taskId, newStatus) {
        const { error } = await supabase
            .from('tasks')
            .update({ status: newStatus })
            .eq('id', taskId);

        if (error) throw error;
    }

// Удаление задачи
    async function deleteTaskFromDB(taskId) {
        const { error } = await supabase
            .from('tasks')
            .delete()
            .eq('id', taskId);

        if (error) throw error;
    }

// Обновленные обработчики форм
    document.getElementById('login-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;

            currentUser = data.user;
            updateAuthUI();
            hideAllModals();

            // Перезагружаем задачи
            const tasks = await loadTasks();
            document.querySelectorAll('.cards-container').forEach(container => container.innerHTML = '');
            tasks.forEach(task => {
                const card = createCardElement(task);
                document.querySelector(`.cards-container[data-column="${task.status}"]`).appendChild(card);
            });
        } catch (error) {
            alert('Ошибка входа: ' + error.message);
        }
    });

    document.getElementById('register-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm-password').value;

        if (password !== confirmPassword) {
            alert('Пароли не совпадают');
            return;
        }

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        name: name
                    }
                }
            });

            if (error) throw error;

            alert('Регистрация успешна! Проверьте вашу почту для подтверждения');
            hideAllModals();
        } catch (error) {
            alert(error.message);
        }
    });

// Проверка состояния аутентификации
    async function checkAuth() {
        const { data: { user } } = await supabase.auth.getUser();
        currentUser = user;
        updateAuthUI();
        if (user) {
            try {
                const tasks = await loadTasks();
                tasks.forEach(task => {
                    const card = createCardElement(task);
                    document.querySelector(`.cards-container[data-column="${task.status}"]`).appendChild(card);
                });
            } catch (error) {
                console.error('Ошибка загрузки задач:', error);
            }
        }
    }

// Обновление UI
    function updateAuthUI() {
        const authButtons = document.querySelector('.auth-buttons');
        const addCardButtons = document.querySelectorAll('.add-card');

        if (currentUser) {
            authButtons.innerHTML = `
            <span>Добро пожаловать, ${currentUser.user_metadata.name || currentUser.email}!</span>
            <button id="logout-button">Выйти</button>
        `;
            document.getElementById('logout-button').addEventListener('click', logout);
            addCardButtons.forEach(btn => btn.style.display = 'block');
        } else {
            authButtons.innerHTML = `
            <button id="login-button">Вход</button>
            <button id="register-button">Регистрация</button>
        `;
            addCardButtons.forEach(btn => btn.style.display = 'none');
        }

        // Назначаем обработчики для новых кнопок
        document.getElementById('login-button')?.addEventListener('click', () => showModal('login-modal'));
        document.getElementById('register-button')?.addEventListener('click', () => showModal('register-modal'));
    }

// Выход
    async function logout() {
        const { error } = await supabase.auth.signOut();
        if (error) alert(error.message);
        currentUser = null;
        updateAuthUI();
    }

// Слушатель изменений аутентификации
    supabase.auth.onAuthStateChange((event, session) => {
        currentUser = session?.user || null;
        updateAuthUI();
    });

// Инициализация при загрузке
    checkAuth();


    // Добавьте кнопку "Забыли пароль?" в форму входа
    document.querySelector('#login-form').insertAdjacentHTML('beforeend', `
    <p class="auth-switch">
        <a href="#" id="forgot-password">Забыли пароль?</a>
    </p>
`);

    async function updateProfile(name) {
        const { error } = await supabase.auth.updateUser({
            data: { name: name }
        });
        if (error) throw error;
    }

    document.getElementById('forgot-password').addEventListener('click', async (e) => {
        e.preventDefault();
        const email = prompt('Введите ваш email для восстановления пароля:');
        if (email) {
            const { error } = await supabase.auth.resetPasswordForEmail(email);
            if (error) alert(error.message);
            else alert('Письмо для восстановления отправлено!');
        }
    });
    // Общие функции для работы с модальными окнами
    function showModal(modalId) {
        document.getElementById(modalId).style.display = 'block';
    }

    function hideAllModals() {
        modals.forEach(modal => modal.style.display = 'none');
    }

    // Обработчики для кнопок авторизации
    document.getElementById('login-button').addEventListener('click', () => showModal('login-modal'));
    document.getElementById('register-button').addEventListener('click', () => showModal('register-modal'));

    // Переключение между модальными окнами авторизации
    document.getElementById('switch-to-register').addEventListener('click', (e) => {
        e.preventDefault();
        hideAllModals();
        showModal('register-modal');
    });

    document.getElementById('switch-to-login').addEventListener('click', (e) => {
        e.preventDefault();
        hideAllModals();
        showModal('login-modal');
    });

    // Обработчики закрытия модальных окон
    document.querySelectorAll('.close-modal').forEach(closeBtn => {
        closeBtn.addEventListener('click', hideAllModals);
    });

    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            hideAllModals();
        }
    });

    // Логика для карточек задач
    addCardButtons.forEach(button => {
        button.addEventListener('click', function() {
            document.getElementById('target-column').value = this.dataset.column;
            showModal('card-modal');
        });
    });

    cardForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        if (!currentUser) {
            alert('Для создания задачи необходимо авторизоваться!');
            hideAllModals();
            return;
        }

        const title = document.getElementById('card-title').value;
        const description = document.getElementById('card-desc').value;
        const deadline = document.getElementById('card-deadline').value;
        const targetColumn = document.getElementById('target-column').value;

        try {
            const newTask = await addTaskToDB({
                title,
                description,
                deadline,
                status: targetColumn
            });

            const card = createCardElement(newTask);
            document.querySelector(`.cards-container[data-column="${targetColumn}"]`).appendChild(card);
            cardForm.reset();
            hideAllModals();
        } catch (error) {
            alert('Ошибка при создании задачи: ' + error.message);
        }
    });

    function createCardElement(task) {
        const card = document.createElement('div');
        card.className = 'card';
        card.draggable = true;
        card.dataset.id = task.id;
        card.dataset.column = task.status;

        let moveButtonHTML = task.status !== 'done' ? '<button class="move-card">></button>' : '';

        card.innerHTML = `
        <h3>${task.title}</h3>
        <p>${task.description}</p>
        ${task.deadline ? `<div class="deadline">До: ${task.deadline}</div>` : ''}
        ${moveButtonHTML}
        <button class="delete-card">Удалить</button>
    `;

        setupDragAndDrop(card);

        if (task.status !== 'done') {
            card.querySelector('.move-card').addEventListener('click', () => moveCardToNextColumn(card));
        }

        card.querySelector('.delete-card').addEventListener('click', async () => {
            try {
                await deleteTaskFromDB(task.id);
                card.remove();
            } catch (error) {
                alert('Ошибка при удалении задачи: ' + error.message);
            }
        });

        return card;
    }

    // Drag and drop логика
    function setupDragAndDrop(card) {
        card.addEventListener('dragstart', function(e) {
            e.dataTransfer.setData('text/plain', card.dataset.id);
            card.classList.add('dragging');
            setTimeout(() => card.style.display = 'none', 0);
        });

        card.addEventListener('dragend', function() {
            card.style.display = 'block';
            card.classList.remove('dragging');
        });
    }

    async function moveCardToNextColumn(card) {
        const currentColumn = card.dataset.column;
        const nextColumn = {
            'todo': 'inprogress',
            'inprogress': 'done'
        }[currentColumn];

        if (!nextColumn) return;

        try {
            await updateTaskStatus(card.dataset.id, nextColumn);
            card.dataset.column = nextColumn;
            document.querySelector(`.cards-container[data-column="${nextColumn}"]`).appendChild(card);
        } catch (error) {
            alert('Ошибка при перемещении задачи: ' + error.message);
        }
    }

    columns.forEach(column => {
        const cardsContainer = column.querySelector('.cards-container');

        cardsContainer.addEventListener('dragover', e => e.preventDefault());

        cardsContainer.addEventListener('drop', async function(e) {
            e.preventDefault();
            const id = e.dataTransfer.getData('text/plain');
            const draggable = document.querySelector(`.card[data-id="${id}"]`);
            const newStatus = this.parentElement.id;

            try {
                await updateTaskStatus(id, newStatus);
                draggable.dataset.column = newStatus;
                this.appendChild(draggable);
            } catch (error) {
                alert('Ошибка перемещения: ' + error.message);
            }
        });
    });
});