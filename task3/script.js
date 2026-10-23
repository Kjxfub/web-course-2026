// ==========================================================================
// Логика приложения Todo-List (Лабораторная работа №3)
// ==========================================================================

// 1. Хранение данных в массиве объектов (согласно требованиям)
let todos = []; 
let currentFilter = 'all'; // Возможные значения: 'all', 'active', 'completed'

// 2. Элементы DOM
const todoForm = document.getElementById('todo-form');
const todoInput = document.getElementById('todo-input');
const todoList = document.getElementById('todo-list');
const errorMessage = document.getElementById('error-message');
const statsActive = document.getElementById('stats-active');
const statsCompleted = document.getElementById('stats-completed');
const filterButtons = document.querySelectorAll('.filter-btn');

// 3. Главная функция отрисовки (render)
function render() {
    todoList.innerHTML = ''; // Очищаем старый список

    // Фильтрация задач через метод .filter() без изменения исходного массива
    const filteredTodos = todos.filter(todo => {
        if (currentFilter === 'active') return !todo.completed;
        if (currentFilter === 'completed') return todo.completed;
        return true; // 'all'
    });

    // Если список пустой
    if (filteredTodos.length === 0) {
        const emptyLi = document.createElement('li');
        emptyLi.className = 'empty-state';
        emptyLi.textContent = todos.length === 0 
            ? 'Список задач пуст. Добавьте новую задачу выше!' 
            : 'В этой категории пока нет задач.';
        todoList.appendChild(emptyLi);
    } else {
        // Отрисовка элементов с помощью метода .forEach()
        filteredTodos.forEach(todo => {
            const li = document.createElement('li');
            li.className = `todo-item ${todo.completed ? 'completed' : ''}`;

            const contentDiv = document.createElement('div');
            contentDiv.className = 'todo-item-content';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'todo-checkbox';
            checkbox.checked = todo.completed;
            // Обработчик события изменения состояния чекбокса
            checkbox.addEventListener('change', () => toggleTodo(todo.id));

            const textSpan = document.createElement('span');
            textSpan.className = 'todo-text';
            textSpan.textContent = todo.text;

            contentDiv.appendChild(checkbox);
            contentDiv.appendChild(textSpan);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-delete';
            deleteBtn.textContent = 'Удалить';
            // Обработчик события удаления задачи
            deleteBtn.addEventListener('click', () => deleteTodo(todo.id));

            li.appendChild(contentDiv);
            li.appendChild(deleteBtn);

            todoList.appendChild(li);
        });
    }

    updateStats();
}

// 4. Добавление новой задачи
function addTodo(text) {
    const trimmedText = text.trim();

    // Валидация на пустую строку
    if (!trimmedText) {
        errorMessage.classList.add('visible');
        return;
    }

    errorMessage.classList.remove('visible');

    const newTodo = {
        id: Date.now(), // Уникальный идентификатор
        text: trimmedText,
        completed: false
    };

    todos.push(newTodo);
    todoInput.value = '';
    render();
}

// 5. Переключение статуса задачи
function toggleTodo(id) {
    todos = todos.map(todo => {
        if (todo.id === id) {
            return { ...todo, completed: !todo.completed };
        }
        return todo;
    });
    render();
}

// 6. Удаление задачи
function deleteTodo(id) {
    todos = todos.filter(todo => todo.id !== id);
    render();
}

// 7. Обновление счётчиков статистики
function updateStats() {
    const activeCount = todos.filter(todo => !todo.completed).length;
    const completedCount = todos.filter(todo => todo.completed).length;

    statsActive.textContent = `Осталось: ${activeCount}`;
    statsCompleted.textContent = `Выполнено: ${completedCount}`;
}

// 8. Навешивание событий (без inline-атрибутов вроде onclick в HTML)
todoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    addTodo(todoInput.value);
});

todoInput.addEventListener('input', () => {
    if (errorMessage.classList.contains('visible')) {
        errorMessage.classList.remove('visible');
    }
});

filterButtons.forEach(button => {
    button.addEventListener('click', () => {
        filterButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        currentFilter = button.dataset.filter;
        render();
    });
});

// Первоначальный вызов рендера
render();