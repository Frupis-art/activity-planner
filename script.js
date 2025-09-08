document.addEventListener('DOMContentLoaded', () => {
    // Элементы DOM
    const activitiesContainer = document.getElementById('activities-container');
    const addActivityBtn = document.getElementById('add-activity-btn');
    const removeActivityBtn = document.getElementById('remove-activity-btn');
    const resetCacheBtn = document.getElementById('reset-cache-btn');
    const activityTemplate = document.getElementById('activity-template');
    const eventTemplate = document.getElementById('event-template');
    const startSound = document.getElementById('start-sound');
    const alertSound = document.getElementById('alert-sound');

    // Переменные для управления звуками
    let alertTimeout = null;

    // Состояние приложения (загружается из localStorage)
    let activities = JSON.parse(localStorage.getItem('activities')) || [];

    // ========== ИНИЦИАЛИЗАЦИЯ ==========
    function initApp() {
        // Если нет занятий, создаем дефолтное "Варёные яйца"
        if (activities.length === 0) {
            activities = [
                {
                    id: Date.now(),
                    title: "Варёные яйца",
                    isExpanded: false,
                    isActive: false,
                    events: [
                        { 
                            id: 1, 
                            title: "положить яйца в воду", 
                            durationHours: 0, durationMinutes: 0, durationSeconds: 0, durationHundredths: 0,
                            elapsed: 0, isRunning: false, isPaused: false,
                            alertTriggered: false
                        },
                        { 
                            id: 2, 
                            title: "кипятить воду", 
                            durationHours: 0, durationMinutes: 10, durationSeconds: 0, durationHundredths: 0,
                            elapsed: 0, isRunning: false, isPaused: false,
                            alertTriggered: false
                        },
                        { 
                            id: 3, 
                            title: "слить воду", 
                            durationHours: 0, durationMinutes: 0, durationSeconds: 0, durationHundredths: 0,
                            elapsed: 0, isRunning: false, isPaused: false,
                            alertTriggered: false
                        },
                        { 
                            id: 4, 
                            title: "поставить яйца в холодную воду", 
                            durationHours: 0, durationMinutes: 10, durationSeconds: 0, durationHundredths: 0,
                            elapsed: 0, isRunning: false, isPaused: false,
                            alertTriggered: false
                        }
                    ]
                }
            ];
        }
        renderActivities();
        // Запускаем глобальный тикер каждые 10 миллисекунд
        setInterval(updateAllTimers, 10);
        
        // Предзагрузка звуков
        startSound.load();
        alertSound.load();
    }

    // ========== УПРАВЛЕНИЕ ЗВУКАМИ ==========
    function playStartSound() {
        startSound.currentTime = 0;
        startSound.play().catch(e => console.log("Не удалось воспроизвести звук старта:", e));
    }

    function playAlert() {
        alertSound.currentTime = 0;
        alertSound.play().catch(e => console.log("Не удалось воспроизвести звук оповещения:", e));
    }

    function stopAllSounds() {
        startSound.pause();
        startSound.currentTime = 0;
        alertSound.pause();
        alertSound.currentTime = 0;
        if (alertTimeout) {
            clearTimeout(alertTimeout);
            alertTimeout = null;
        }
    }

    // ========== ОБНОВЛЕНИЕ СОСТОЯНИЯ КНОПОК ==========
    function updateEventButtons(event, playBtn, stopBtn, pauseBtn, prevBtn, nextBtn) {
        // Кнопка Play активна только если событие неактивно
        playBtn.disabled = event.isRunning || event.isPaused;
        
        // Остальные кнопки активны только если событие активно
        const isActive = event.isRunning || event.isPaused;
        stopBtn.disabled = !isActive;
        pauseBtn.disabled = !isActive;
        
        // Кнопки навигации активны только если событие активно
        if (prevBtn) prevBtn.disabled = !isActive;
        if (nextBtn) nextBtn.disabled = !isActive;
        
        // Если событие на паузе, меняем иконку кнопки Pause
        if (event.isPaused) {
            pauseBtn.innerHTML = '▶';
            pauseBtn.title = 'Продолжить';
        } else {
            pauseBtn.innerHTML = '❚❚';
            pauseBtn.title = 'Пауза';
        }
    }

    // ========== ОТОБРАЖЕНИЕ ЗАНЯТИЙ И СОБЫТИЙ ==========
    function renderActivities() {
        activitiesContainer.innerHTML = '';
        activities.forEach(activity => {
            const activityEl = createActivityElement(activity);
            activitiesContainer.appendChild(activityEl);
        });
        // Сохраняем состояние после любого рендера
        saveState();
        updateRemoveActivityButton();
    }

    function createActivityElement(activity) {
        const clone = activityTemplate.content.cloneNode(true);
        const activityEl = clone.querySelector('.activity');
        const toggleBtn = clone.querySelector('.toggle-btn');
        const titleInput = clone.querySelector('.activity-title');
        const eventsContainer = clone.querySelector('.events-container');
        const addEventBtn = clone.querySelector('.add-event-btn');
        const removeEventBtn = clone.querySelector('.remove-event-btn');
        const playActivityBtn = clone.querySelector('.play-activity-btn');
        const stopActivityBtn = clone.querySelector('.stop-activity-btn');

        activityEl.dataset.id = activity.id;
        titleInput.value = activity.title;

        // Устанавливаем активное состояние занятия
        if (activity.isActive) {
            activityEl.classList.add('active');
        }

        // Обработчик сворачивания/разворачивания
        toggleBtn.addEventListener('click', () => toggleActivity(activity, toggleBtn, eventsContainer));
        if (activity.isExpanded) {
            toggleBtn.textContent = '-';
            eventsContainer.style.display = 'block';
        }

        // Обновление названия занятия
        titleInput.addEventListener('change', (e) => {
            activity.title = e.target.value;
            saveState();
        });

        // Рендерим события внутри занятия
        activity.events.forEach(event => {
            const eventEl = createEventElement(activity, event);
            eventsContainer.querySelector('.event-controls').before(eventEl);
        });

        // Кнопка добавления события
        addEventBtn.addEventListener('click', () => addNewEvent(activity, eventsContainer));
        // Кнопка удаления события
        removeEventBtn.addEventListener('click', () => removeLastEvent(activity, eventsContainer));
        // Обновляем состояние кнопки удаления
        updateRemoveEventButton(removeEventBtn, activity);

        // Обработчики кнопок управления занятием
        playActivityBtn.addEventListener('click', () => {
            // Останавливаем все другие занятия
            activities.forEach(otherActivity => {
                if (otherActivity.id !== activity.id && otherActivity.isActive) {
                    const otherActivityEl = document.querySelector(`.activity[data-id="${otherActivity.id}"]`);
                    if (otherActivityEl) {
                        const otherStopBtn = otherActivityEl.querySelector('.stop-activity-btn');
                        otherStopBtn.click();
                    }
                }
            });

            // Запускаем первое событие в занятии
            if (activity.events.length > 0) {
                const firstEvent = activity.events[0];
                const firstEventEl = document.querySelector(`.event[data-id="${firstEvent.id}"]`);
                if (firstEventEl) {
                    activity.isActive = true;
                    activityEl.classList.add('active');
                    const playBtn = firstEventEl.querySelector('.play-btn');
                    const stopBtn = firstEventEl.querySelector('.stop-btn');
                    const pauseBtn = firstEventEl.querySelector('.pause-btn');
                    const prevBtn = firstEventEl.querySelector('.prev-btn');
                    const nextBtn = firstEventEl.querySelector('.next-btn');
                    const elapsedSpan = firstEventEl.querySelector('.elapsed-time');
                    startEvent(activity, firstEvent, firstEventEl, elapsedSpan, playBtn, stopBtn, pauseBtn, prevBtn, nextBtn);
                }
            }
        });

        stopActivityBtn.addEventListener('click', () => {
            // Останавливаем все события в занятии
            activity.events.forEach(event => {
                const eventEl = document.querySelector(`.event[data-id="${event.id}"]`);
                if (eventEl) {
                    const playBtn = eventEl.querySelector('.play-btn');
                    const stopBtn = eventEl.querySelector('.stop-btn');
                    const pauseBtn = eventEl.querySelector('.pause-btn');
                    const prevBtn = eventEl.querySelector('.prev-btn');
                    const nextBtn = eventEl.querySelector('.next-btn');
                    const elapsedSpan = eventEl.querySelector('.elapsed-time');
                    stopEvent(activity, event, eventEl, elapsedSpan, playBtn, stopBtn, pauseBtn, prevBtn, nextBtn);
                }
            });
            activity.isActive = false;
            activityEl.classList.remove('active');
            stopAllSounds();
        });

        return activityEl;
    }

    function createEventElement(activity, event) {
        const clone = eventTemplate.content.cloneNode(true);
        const eventEl = clone.querySelector('.event');
        const titleInput = clone.querySelector('.event-title');
        const durationHInput = clone.querySelector('.event-duration-h');
        const durationMInput = clone.querySelector('.event-duration-m');
        const durationSInput = clone.querySelector('.event-duration-s');
        const durationMsInput = clone.querySelector('.event-duration-ms');
        const elapsedSpan = clone.querySelector('.elapsed-time');
        const prevBtn = clone.querySelector('.prev-btn');
        const playBtn = clone.querySelector('.play-btn');
        const stopBtn = clone.querySelector('.stop-btn');
        const pauseBtn = clone.querySelector('.pause-btn');
        const nextBtn = clone.querySelector('.next-btn');

        eventEl.dataset.id = event.id;
        titleInput.value = event.title;
        durationHInput.value = event.durationHours || 0;
        durationMInput.value = event.durationMinutes || 0;
        durationSInput.value = event.durationSeconds || 0;
        durationMsInput.value = event.durationHundredths || 0;

        // Обновляем таймер
        updateEventTimerDisplay(event, elapsedSpan);

        // Если событие активно - подсвечиваем
        if (event.isRunning || event.isPaused) {
            eventEl.classList.add('active');
        }

        // Обновляем состояние кнопок
        updateEventButtons(event, playBtn, stopBtn, pauseBtn, prevBtn, nextBtn);

        // Изменение названия события
        titleInput.addEventListener('change', (e) => {
            event.title = e.target.value;
            saveState();
        });

        // Изменение длительности
        const updateDuration = () => {
            event.durationHours = Math.max(0, parseInt(durationHInput.value) || 0);
            event.durationMinutes = Math.min(59, Math.max(0, parseInt(durationMInput.value) || 0));
            event.durationSeconds = Math.min(59, Math.max(0, parseInt(durationSInput.value) || 0));
            event.durationHundredths = Math.min(99, Math.max(0, parseInt(durationMsInput.value) || 0));
            
            // Корректируем значения в полях ввода
            durationMInput.value = event.durationMinutes;
            durationSInput.value = event.durationSeconds;
            durationMsInput.value = event.durationHundredths;
            
            updateEventTimerDisplay(event, elapsedSpan);
            saveState();
        };

        durationHInput.addEventListener('change', updateDuration);
        durationMInput.addEventListener('change', updateDuration);
        durationSInput.addEventListener('change', updateDuration);
        durationMsInput.addEventListener('change', updateDuration);

        // Назначение обработчиков кнопок
        playBtn.addEventListener('click', () => startEvent(activity, event, eventEl, elapsedSpan, playBtn, stopBtn, pauseBtn, prevBtn, nextBtn));
        stopBtn.addEventListener('click', () => stopEvent(activity, event, eventEl, elapsedSpan, playBtn, stopBtn, pauseBtn, prevBtn, nextBtn));
        pauseBtn.addEventListener('click', () => pauseEvent(event, playBtn, stopBtn, pauseBtn, prevBtn, nextBtn));
        nextBtn.addEventListener('click', () => moveToNextEvent(activity, event));
        prevBtn.addEventListener('click', () => moveToPrevEvent(activity, event));

        return eventEl;
    }

    // ========== ОСНОВНАЯ ЛОГИКА ==========
    function toggleActivity(activity, toggleBtn, eventsContainer) {
        activity.isExpanded = !activity.isExpanded;
        if (activity.isExpanded) {
            toggleBtn.textContent = '-';
            eventsContainer.style.display = 'block';
        } else {
            toggleBtn.textContent = '+';
            eventsContainer.style.display = 'none';
        }
        saveState();
    }

    function addNewEvent(activity, eventsContainer) {
        const newEvent = {
            id: Date.now(),
            title: "Новое событие",
            durationHours: 0,
            durationMinutes: 0,
            durationSeconds: 0,
            durationHundredths: 0,
            elapsed: 0,
            isRunning: false,
            isPaused: false,
            alertTriggered: false
        };
        activity.events.push(newEvent);
        const eventEl = createEventElement(activity, newEvent);
        // Вставляем новое событие перед кнопками управления
        eventsContainer.querySelector('.event-controls').before(eventEl);
        // Обновляем кнопку удаления для этого занятия
        const removeBtn = eventsContainer.querySelector('.remove-event-btn');
        updateRemoveEventButton(removeBtn, activity);
        saveState();
    }

    function removeLastEvent(activity, eventsContainer) {
        if (activity.events.length <= 1) return;
        const lastEvent = activity.events.pop();
        // Находим DOM-элемент последнего события и удаляем его
        const lastEventEl = eventsContainer.querySelector(`.event[data-id="${lastEvent.id}"]`);
        if (lastEventEl) {
            lastEventEl.remove();
        }
        // Обновляем кнопку удаления
        const removeBtn = eventsContainer.querySelector('.remove-event-btn');
        updateRemoveEventButton(removeBtn, activity);
        saveState();
    }

    function updateRemoveEventButton(button, activity) {
        button.disabled = activity.events.length <= 1;
    }

    function updateRemoveActivityButton() {
        removeActivityBtn.disabled = activities.length <= 1;
    }

    function startEvent(activity, event, eventEl, elapsedSpan, playBtn, stopBtn, pauseBtn, prevBtn, nextBtn) {
        // Останавливаем все другие занятия
        activities.forEach(otherActivity => {
            if (otherActivity.id !== activity.id && otherActivity.isActive) {
                const otherActivityEl = document.querySelector(`.activity[data-id="${otherActivity.id}"]`);
                if (otherActivityEl) {
                    const otherStopBtn = otherActivityEl.querySelector('.stop-activity-btn');
                    otherStopBtn.click();
                }
            }
        });

        // Останавливаем все другие события в этом занятии
        activity.events.forEach(otherEvent => {
            if (otherEvent.id !== event.id && (otherEvent.isRunning || otherEvent.isPaused)) {
                const otherEventEl = document.querySelector(`.event[data-id="${otherEvent.id}"]`);
                if (otherEventEl) {
                    const otherPlayBtn = otherEventEl.querySelector('.play-btn');
                    const otherStopBtn = otherEventEl.querySelector('.stop-btn');
                    const otherPauseBtn = otherEventEl.querySelector('.pause-btn');
                    const otherPrevBtn = otherEventEl.querySelector('.prev-btn');
                    const otherNextBtn = otherEventEl.querySelector('.next-btn');
                    const otherElapsedSpan = otherEventEl.querySelector('.elapsed-time');
                    stopEvent(activity, otherEvent, otherEventEl, otherElapsedSpan, otherPlayBtn, otherStopBtn, otherPauseBtn, otherPrevBtn, otherNextBtn);
                }
            }
        });

        // Если событие было на паузе, продолжаем
        if (event.isPaused) {
            event.isPaused = false;
            event.isRunning = true;
            eventEl.classList.add('active');
            activity.isActive = true;
            document.querySelector(`.activity[data-id="${activity.id}"]`).classList.add('active');
            updateEventButtons(event, playBtn, stopBtn, pauseBtn, prevBtn, nextBtn);
            playStartSound();
            return;
        }
        // Иначе запускаем заново
        event.elapsed = 0;
        event.isRunning = true;
        event.isPaused = false;
        event.alertTriggered = false;
        eventEl.classList.add('active');
        activity.isActive = true;
        document.querySelector(`.activity[data-id="${activity.id}"]`).classList.add('active');
        // Запускаем обновление таймера
        updateEventTimerDisplay(event, elapsedSpan);
        // Обновляем состояние кнопок
        updateEventButtons(event, playBtn, stopBtn, pauseBtn, prevBtn, nextBtn);
        // Воспроизводим звук старта
        playStartSound();
    }

    function stopEvent(activity, event, eventEl, elapsedSpan, playBtn, stopBtn, pauseBtn, prevBtn, nextBtn) {
        event.isRunning = false;
        event.isPaused = false;
        event.elapsed = 0;
        event.alertTriggered = false;
        eventEl.classList.remove('active');
        updateEventTimerDisplay(event, elapsedSpan);
        // Обновляем состояние кнопок
        updateEventButtons(event, playBtn, stopBtn, pauseBtn, prevBtn, nextBtn);
        stopAllSounds();
        
        // Проверяем, есть ли другие активные события в занятии
        const hasActiveEvents = activity.events.some(ev => ev.isRunning || ev.isPaused);
        if (!hasActiveEvents) {
            activity.isActive = false;
            document.querySelector(`.activity[data-id="${activity.id}"]`).classList.remove('active');
        }
    }

    function pauseEvent(event, playBtn, stopBtn, pauseBtn, prevBtn, nextBtn) {
        if (event.isRunning && !event.isPaused) {
            event.isRunning = false;
            event.isPaused = true;
            updateEventButtons(event, playBtn, stopBtn, pauseBtn, prevBtn, nextBtn);
            stopAllSounds();
        } else if (event.isPaused) {
            event.isPaused = false;
            event.isRunning = true;
            updateEventButtons(event, playBtn, stopBtn, pauseBtn, prevBtn, nextBtn);
            playStartSound();
        }
    }

    function moveToNextEvent(activity, currentEvent) {
        const currentIndex = activity.events.findIndex(ev => ev.id === currentEvent.id);
        if (currentIndex < activity.events.length - 1) {
            // Полностью сбрасываем текущее событие
            currentEvent.isRunning = false;
            currentEvent.isPaused = false;
            currentEvent.elapsed = 0;
            currentEvent.alertTriggered = false;
            
            // Снимаем выделение с текущего события
            const currentEventEl = document.querySelector(`.event[data-id="${currentEvent.id}"]`);
            if (currentEventEl) {
                currentEventEl.classList.remove('active');
                const elapsedSpan = currentEventEl.querySelector('.elapsed-time');
                const playBtn = currentEventEl.querySelector('.play-btn');
                const stopBtn = currentEventEl.querySelector('.stop-btn');
                const pauseBtn = currentEventEl.querySelector('.pause-btn');
                const prevBtn = currentEventEl.querySelector('.prev-btn');
                const nextBtn = currentEventEl.querySelector('.next-btn');
                
                // Обновляем отображение и кнопки
                updateEventTimerDisplay(currentEvent, elapsedSpan);
                updateEventButtons(currentEvent, playBtn, stopBtn, pauseBtn, prevBtn, nextBtn);
            }
            
            // Запускаем следующее
            const nextEvent = activity.events[currentIndex + 1];
            const nextEventEl = document.querySelector(`.event[data-id="${nextEvent.id}"]`);
            if (nextEventEl) {
                const playBtn = nextEventEl.querySelector('.play-btn');
                const stopBtn = nextEventEl.querySelector('.stop-btn');
                const pauseBtn = nextEventEl.querySelector('.pause-btn');
                const prevBtn = nextEventEl.querySelector('.prev-btn');
                const nextBtn = nextEventEl.querySelector('.next-btn');
                const elapsedSpan = nextEventEl.querySelector('.elapsed-time');
                startEvent(activity, nextEvent, nextEventEl, elapsedSpan, playBtn, stopBtn, pauseBtn, prevBtn, nextBtn);
            }
        }
    }

    function moveToPrevEvent(activity, currentEvent) {
        const currentIndex = activity.events.findIndex(ev => ev.id === currentEvent.id);
        if (currentIndex > 0) {
            // Полностью сбрасываем текущее событие
            currentEvent.isRunning = false;
            currentEvent.isPaused = false;
            currentEvent.elapsed = 0;
            currentEvent.alertTriggered = false;
            
            // Снимаем выделение с текущего события
            const currentEventEl = document.querySelector(`.event[data-id="${currentEvent.id}"]`);
            if (currentEventEl) {
                currentEventEl.classList.remove('active');
                const elapsedSpan = currentEventEl.querySelector('.elapsed-time');
                const playBtn = currentEventEl.querySelector('.play-btn');
                const stopBtn = currentEventEl.querySelector('.stop-btn');
                const pauseBtn = currentEventEl.querySelector('.pause-btn');
                const prevBtn = currentEventEl.querySelector('.prev-btn');
                const nextBtn = currentEventEl.querySelector('.next-btn');
                
                // Обновляем отображение и кнопки
                updateEventTimerDisplay(currentEvent, elapsedSpan);
                updateEventButtons(currentEvent, playBtn, stopBtn, pauseBtn, prevBtn, nextBtn);
            }
            
            // Запускаем предыдущее
            const prevEvent = activity.events[currentIndex - 1];
            const prevEventEl = document.querySelector(`.event[data-id="${prevEvent.id}"]`);
            if (prevEventEl) {
                const playBtn = prevEventEl.querySelector('.play-btn');
                const stopBtn = prevEventEl.querySelector('.stop-btn');
                const pauseBtn = prevEventEl.querySelector('.pause-btn');
                const prevBtn = prevEventEl.querySelector('.prev-btn');
                const nextBtn = prevEventEl.querySelector('.next-btn');
                const elapsedSpan = prevEventEl.querySelector('.elapsed-time');
                startEvent(activity, prevEvent, prevEventEl, elapsedSpan, playBtn, stopBtn, pauseBtn, prevBtn, nextBtn);
            }
        }
    }

    // ========== УТИЛИТЫ ДЛЯ РАБОТЫ С ВРЕМЕНЕМ ==========
    function timeToHundredths(hours, minutes, seconds, hundredths) {
        return hours * 360000 + minutes * 6000 + seconds * 100 + hundredths;
    }

    function hundredthsToTime(hundredths) {
        const hours = Math.floor(hundredths / 360000);
        hundredths %= 360000;
        const minutes = Math.floor(hundredths / 6000);
        hundredths %= 6000;
        const seconds = Math.floor(hundredths / 100);
        const hundredthsRemaining = hundredths % 100;
        
        return { hours, minutes, seconds, hundredths: hundredthsRemaining };
    }

    function formatTime(hours, minutes, seconds, hundredths) {
        return [
            String(hours).padStart(2, '0'),
            String(minutes).padStart(2, '0'),
            String(seconds).padStart(2, '0'),
            String(hundredths).padStart(2, '0')
        ].join(':');
    }

    function updateEventTimerDisplay(event, elapsedSpan) {
        // Преобразуем прошедшее время в компоненты
        const elapsedTime = hundredthsToTime(event.elapsed);
        elapsedSpan.textContent = formatTime(
            elapsedTime.hours, 
            elapsedTime.minutes, 
            elapsedTime.seconds, 
            elapsedTime.hundredths
        );
    }

    // ========== ТАЙМЕРЫ ==========
    function updateAllTimers() {
        activities.forEach(activity => {
            activity.events.forEach(event => {
                if (event.isRunning) {
                    event.elapsed += 1; // Увеличиваем на 1 сотую секунды
                    
                    // Обновляем отображение для этого события
                    const eventEl = document.querySelector(`.event[data-id="${event.id}"]`);
                    if (eventEl) {
                        const elapsedSpan = eventEl.querySelector('.elapsed-time');
                        updateEventTimerDisplay(event, elapsedSpan);
                    }

                    // Проверяем, не подходит ли время к концу
                    const totalHundredths = timeToHundredths(
                        event.durationHours,
                        event.durationMinutes,
                        event.durationSeconds,
                        event.durationHundredths
                    );
                    const timeLeft = totalHundredths - event.elapsed;
                    
                    // Исправленное условие для воспроизведения звука
                    if (timeLeft <= 500 && timeLeft > 495 && !event.alertTriggered) {
                        event.alertTriggered = true;
                        playAlert();
                    }

                    // Если время вышло, автоматически переходим к следующему
                    if (event.elapsed >= totalHundredths && totalHundredths > 0) {
                        const eventEl = document.querySelector(`.event[data-id="${event.id}"]`);
                        if (eventEl) {
                            const elapsedSpan = eventEl.querySelector('.elapsed-time');
                            const playBtn = eventEl.querySelector('.play-btn');
                            const stopBtn = eventEl.querySelector('.stop-btn');
                            const pauseBtn = eventEl.querySelector('.pause-btn');
                            const prevBtn = eventEl.querySelector('.prev-btn');
                            const nextBtn = eventEl.querySelector('.next-btn');
                            stopEvent(activity, event, eventEl, elapsedSpan, playBtn, stopBtn, pauseBtn, prevBtn, nextBtn);
                            moveToNextEvent(activity, event);
                        }
                    }
                }
            });
        });
    }

    // ========== СОХРАНЕНИЕ И ЗАГРУЗКА ==========
    function saveState() {
        localStorage.setItem('activities', JSON.stringify(activities));
    }

    // ========== ДОБАВЛЕНИЕ И УДАЛЕНИЕ ЗАНЯТИЙ ==========
    addActivityBtn.addEventListener('click', () => {
        const newActivity = {
            id: Date.now(),
            title: "Новое занятие",
            isExpanded: true,
            isActive: false,
            events: [
                { 
                    id: Date.now() + 1, 
                    title: "Разминка", 
                    durationHours: 0, durationMinutes: 0, durationSeconds: 0, durationHundredths: 0,
                    elapsed: 0, isRunning: false, isPaused: false,
                    alertTriggered: false
                }
            ]
        };
        activities.push(newActivity);
        renderActivities();
    });

    removeActivityBtn.addEventListener('click', () => {
        if (activities.length > 1) {
            activities.pop();
            renderActivities();
        }
    });

    // ========== СБРОС КЭША ==========
    resetCacheBtn.addEventListener('click', () => {
        if (confirm("Вы уверены, что хотите сбросить все данные? Это действие нельзя отменить.")) {
            localStorage.clear();
            location.reload();
        }
    });

    // Запускаем приложение
    initApp();
});