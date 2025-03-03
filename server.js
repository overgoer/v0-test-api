const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');

const app = express();

// Middleware для парсинга JSON
app.use(express.json());

// Определения схем для OpenAPI v3
const userSchema = {
    type: 'object',
    properties: {
        id: { type: 'number' },
        name: { type: 'string' },
        age: { type: 'number' },
        status: { type: 'string', enum: ['minor', 'candidate', 'retired'] }
    },
    required: ['id', 'name', 'age', 'status']
};

const errorSchema = {
    type: 'object',
    properties: {
        message: { type: 'string' }
    },
    required: ['message']
};

// Глобальное состояние для хранения данных
const data = {
    settings: { counter: 0 },
    users: {}
};

// Вспомогательные функции
function getNextId() {
    data.settings.counter += 1;
    return data.settings.counter;
}

function validateName(name) {
    return name && /^[A-Za-z\s-]+$/.test(name);
}

function validateAge(age) {
    return age >= 18 && age <= 65;
}

// Настройка Swagger/OpenAPI v3
const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Test API',
            description: 'API для тестирования кандидатов на вакансии',
            version: '1.0.0'
        },
        host: 'v0-test-api-ten.vercel.app',
        basePath: '/',
        schemes: ['https'],
        components: {
            schemas: {
                User: userSchema,
                Error: errorSchema
            },
            securitySchemes: {
                apiKey: {
                    type: 'apiKey',
                    name: 'X-Fix-Bug',
                    in: 'header'
                }
            }
        },
        tags: [
            { name: 'v1', description: 'Version 1 with bugs' },
            { name: 'v2', description: 'Version 2 with fixes' }
        ]
    },
    apis: ['./server.js'] // Укажи путь к файлу с маршрутами (здесь сам server.js)
};

const swaggerSpec = swaggerJsDoc(options);

// Подключение Swagger UI
app.use('/documentation', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Обработка корневого пути для устранения 404
app.get('/', (req, res) => {
    res.redirect('/documentation');
});

// Обработка /favicon.ico для предотвращения 500
app.get('/favicon.ico', (req, res) => {
    res.status(204).send();
});

// Регистрация маршрутов для версии 1 (с багам)

// v1: Получить всех пользователей
/**
 * @route GET /v1/api/users
 * @group v1 - Version 1 with bugs
 * @returns {Array<User>} 200 - List of users
 */
app.get('/v1/api/users', (req, res) => {
    res.status(200).json(Object.values(data.users || {}));
});

// v1: Получить пользователя по ID (с багом: возвращает ID на 1 меньше)
/**
 * @route GET /v1/api/users/{id}
 * @group v1 - Version 1 with bugs
 * @param {string} id.path.required - User ID
 * @returns {User} 200 - User details
 * @returns {Error} 404 - User not found
 */
app.get('/v1/api/users/:id', (req, res) => {
    const { id } = req.params;
    const requestedId = parseInt(id);
    const userId = requestedId - 1; // Баг: возвращаем ID на 1 меньше
    const user = data.users[userId];

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user);
});

// v1: Создать нового пользователя (с багам: нет проверки возраста > 65, принимает любые имена, age обязательное)
/**
 * @route POST /v1/api/users
 * @group v1 - Version 1 with bugs
 * @param {object} request.body.required - User data
 * @returns {User} 201 - Created user
 * @returns {Error} 400 - Bad request
 */
app.post('/v1/api/users', (req, res) => {
    const { name, age } = req.body;

    // Проверка на обязательность обоих полей
    if (!name || age === undefined || age === null) {
        return res.status(400).json({ message: 'Both name and age are required' });
    }
    // Проверка, что возраст не отрицательный (баг: нет проверки > 65)
    if (age < 0) {
        return res.status(400).json({ message: 'Invalid age value' });
    }
    // Баг: статус устанавливает только на основе < 18, нет проверки > 65
    const status = age < 18 ? 'minor' : 'candidate';

    const id = getNextId();
    const newUser = { id, name, age, status }; // age теперь всегда присутствует
    data.users[id] = newUser;
    res.status(201).json(newUser);
});
// v1: Обновить пользователя (с багам: принимает любые имена, нет проверки возраста > 65)
/**
 * @route PATCH /v1/api/users/{id}
 * @group v1 - Version 1 with bugs
 * @param {string} id.path.required - User ID
 * @param {object} request.body.required - User data
 * @returns {User} 200 - Updated user
 * @returns {Error} 400 - Bad request
 * @returns {Error} 404 - User not found
 */
app.patch('/v1/api/users/:id', (req, res) => {
    const { id } = req.params;
    const { name, age } = req.body;
    const user = data.users[id];

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }
    // Проверка на обязательность обоих полей
    if (!name || age === undefined || age === null) {
        return res.status(400).json({ message: 'Both name and age are required' });
    }
    // Проверка, что возраст не отрицательный (баг: нет проверки > 65)
    if (age < 0) {
        return res.status(400).json({ message: 'Invalid age value' });
    }
    // Баг: статус устанавливает только на основе < 18, нет проверки > 65
    user.status = age < 17 ? 'minor' : 'candidate';

    // Обновляем имя (баг: принимает любые имена) и возраст
    user.name = name;
    user.age = age;
    data.users[id] = user;
    res.status(200).json(user);
});

// v1: Удалить пользователя
/**
 * @route DELETE /v1/api/users/{id}
 * @group v1 - Version 1 with bugs
 * @param {string} id.path.required - User ID
 * @returns {object} 200 - Deletion result
 * @returns {Error} 404 - User not found
 */
app.delete('/v1/api/users/:id', (req, res) => {
    const { id } = req.params;
    const user = data.users[id];

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }
    delete data.users[id];
    res.status(200).json({ message: 'User deleted successfully', user });
});

// Регистрация маршрутов для версии 2 (исправленная логика)

// v2: Получить всех пользователей
/**
 * @route GET /v2/api/users
 * @group v2 - Version 2 with fixes
 * @returns {Array<User>} 200 - List of users
 */
app.get('/v2/api/users', (req, res) => {
    res.status(200).json(Object.values(data.users || {}));
});

// v2: Получить пользователя по ID
/**
 * @route GET /v2/api/users/{id}
 * @group v2 - Version 2 with fixes
 * @param {string} id.path.required - User ID
 * @returns {User} 200 - User details
 * @returns {Error} 404 - User not found
 */
app.get('/v2/api/users/:id', (req, res) => {
    const { id } = req.params;
    const user = data.users[id];

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user);
});

// v2: Создать нового пользователя (с проверками имени и возраста 18–65)
/**
 * @route POST /v2/api/users
 * @group v2 - Version 2 with fixes
 * @param {object} request.body.required - User data
 * @returns {User} 201 - Created user
 * @returns {Error} 400 - Bad request
 */
app.post('/v2/api/users', (req, res) => {
    const { name, age } = req.body;

    if (!name) {
        return res.status(400).json({ message: 'Name is required' });
    }
    if (!validateName(name)) {
        return res.status(400).json({ message: 'Name must contain only letters, hyphens, and spaces' });
    }
    if (age === undefined) {
        return res.status(400).json({ message: 'Age is required and must be between 18 and 65' });
    }
    if (!validateAge(age)) {
        return res.status(400).json({ message: 'Age must be between 18 and 65' });
    }

    const id = getNextId();
    const status = age < 18 ? 'minor' : age > 65 ? 'retired' : 'candidate';
    const newUser = { id, name, age, status };
    data.users[id] = newUser;
    res.status(201).json(newUser);
});

// v2: Обновить пользователя (с проверками имени и возраста 18–65)
/**
 * @route PATCH /v2/api/users/{id}
 * @group v2 - Version 2 with fixes
 * @param {string} id.path.required - User ID
 * @param {object} request.body.required - User data
 * @returns {User} 200 - Updated user
 * @returns {Error} 400 - Bad request
 * @returns {Error} 404 - User not found
 */
app.patch('/v2/api/users/:id', (req, res) => {
    const { id } = req.params;
    const { name, age } = req.body;
    const user = data.users[id];

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }
    if (name && !validateName(name)) {
        return res.status(400).json({ message: 'Name must contain only letters, hyphens, and spaces' });
    }
    if (age !== undefined && !validateAge(age)) {
        return res.status(400).json({ message: 'Age must be between 18 and 65' });
    }

    if (name) user.name = name;
    if (age !== undefined) {
        user.age = age;
        user.status = age < 18 ? 'minor' : age > 65 ? 'retired' : 'candidate';
    }
    data.users[id] = user;
    res.status(200).json(user);
});

// v2: Удалить пользователя
/**
 * @route DELETE /v2/api/users/{id}
 * @group v2 - Version 2 with fixes
 * @param {string} id.path.required - User ID
 * @returns {object} 200 - Deletion result
 * @returns {Error} 404 - User not found
 */
app.delete('/v2/api/users/:id', (req, res) => {
    const { id } = req.params;
    const user = data.users[id];

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }
    delete data.users[id];
    res.status(200).json({ message: 'User deleted successfully', user });
});

// Запуск сервера для Vercel
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Swagger documentation available at https://v0-test-api-ten.vercel.app/documentation`);
});
