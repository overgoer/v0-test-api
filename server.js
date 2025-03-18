const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');
const fs = require('fs');
const nodemailer = require('nodemailer');

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

// Функция для генерации случайного ключа (длина 16 символов)
function generateApiKey() {
    return [...Array(16)]
        .map(() => Math.random().toString(36)[2])
        .join('')
        .toUpperCase();
}

// Функция загрузки или генерации ключей
function loadOrGenerateKeys(targetAvailableCount = 100) {
    let keysData = { availableKeys: [], usedKeys: [] };
    try {
        if (fs.existsSync('api_keys.json')) {
            const data = fs.readFileSync('api_keys.json', 'utf8');
            keysData = JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading keys:', error);
    }

    // Дополняем availableKeys до целевого числа
    while (keysData.availableKeys.length < targetAvailableCount) {
        const newKey = generateApiKey();
        if (!keysData.availableKeys.includes(newKey) && !keysData.usedKeys.includes(newKey)) {
            keysData.availableKeys.push(newKey);
        }
    }

    // Сохраняем обновлённые данные
    fs.writeFileSync('api_keys.json', JSON.stringify(keysData, null, 2));
    return keysData;
}

// Глобальные переменные для ключей
const keysData = loadOrGenerateKeys();
const availableKeys = keysData.availableKeys;
const usedKeys = keysData.usedKeys;
console.log(`Loaded ${availableKeys.length} available keys and ${usedKeys.length} used keys`);

// Middleware для проверки API-ключа
const validateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-fix-bug']; // Проверяем ключ из заголовка
    if (apiKey && (availableKeys.includes(apiKey) || usedKeys.includes(apiKey))) {
        next(); // Ключ валиден (как доступный, так и использованный)
    } else {
        return res.status(401).json({ message: 'Invalid or missing API key' });
    }
};

// Настройка транспорта для Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'eddythetest@gmail.com', // Твой email
        pass: 'Bowtie12345' // Код приложения для Gmail
    }
});

// Функция отправки письма
function sendApiKeyEmail(to, apiKey, postmanLink, docLink) {
    const mailOptions = {
        from: 'eddythetest@gmail.com',
        to,
        subject: 'Ваш API-ключ для практикума',
        text: `Привет! Спасибо за покупку. Твой API-ключ: ${apiKey}. Postman-коллекция: ${postmanLink}, Документация: ${docLink}. Пишите вопросы на eddythetest@gmail.com или в телеграм канал https://t.me/+0SEZp8u5TbdhMmFi`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending email:', error);
        } else {
            console.log('Email sent:', info.response);
        }
    });
}

// Маршрут для получения ключа
app.post('/get-api-key', (req, res) => {
    const { email } = req.body; // Предполагается, что email приходит в теле запроса
    if (!email) return res.status(400).json({ message: 'Email is required' });

    if (availableKeys.length === 0) {
        return res.status(400).json({ message: 'No available API keys' });
    }

    const newKey = availableKeys.shift(); // Берем первый ключ и удаляем из доступных
    usedKeys.push(newKey); // Добавляем в использованные
    fs.writeFileSync('api_keys.json', JSON.stringify({ availableKeys, usedKeys }, null, 2)); // Сохраняем изменения
    sendApiKeyEmail(email, newKey, 'https://drive.google.com/...', 'https://drive.google.com/...'); // Замени ссылки
    res.status(200).json({ message: 'Key issued', apiKey: newKey });
});

// Пример webhook для ЮKassa
app.post('/webhook', express.json(), (req, res) => {
    const { object } = req.body;
    if (object.status === 'succeeded' && object.metadata && object.metadata.email) {
        const email = object.metadata.email;
        if (availableKeys.length === 0) {
            return res.status(400).json({ message: 'No available API keys' });
        }
        const newKey = availableKeys.shift();
        usedKeys.push(newKey);
        sendApiKeyEmail(email, newKey, 'https://drive.google.com/...', 'https://drive.google.com/...'); // Замени ссылки
        fs.writeFileSync('api_keys.json', JSON.stringify({ availableKeys, usedKeys }, null, 2)); // Сохраняем изменения
    }
    res.status(200).send('Webhook received');
});

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
 * @security apiKey
 * @returns {Array<User>} 200 - List of users
 */
app.get('/v1/api/users', validateApiKey, (req, res) => {
    res.status(200).json(Object.values(data.users || {}));
});

// v1: Получить пользователя по ID (с багом: возвращает ID на 1 меньше)
/**
 * @route GET /v1/api/users/{id}
 * @group v1 - Version 1 with bugs
 * @security apiKey
 * @param {string} id.path.required - User ID
 * @returns {User} 200 - User details
 * @returns {Error} 404 - User not found
 */
app.get('/v1/api/users/:id', validateApiKey, (req, res) => {
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
 * @security apiKey
 * @param {object} request.body.required - User data
 * @returns {User} 201 - Created user
 * @returns {Error} 400 - Bad request
 */
app.post('/v1/api/users', validateApiKey, (req, res) => {
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
    const status = age < 17 ? 'minor' : 'candidate';

    const id = getNextId();
    const newUser = { id, name, age, status }; // age теперь всегда присутствует
    data.users[id] = newUser;
    res.status(201).json(newUser);
});

// v1: Обновить пользователя (с багам: принимает любые имена, нет проверки возраста > 65)
/**
 * @route PATCH /v1/api/users/{id}
 * @group v1 - Version 1 with bugs
 * @security apiKey
 * @param {string} id.path.required - User ID
 * @param {object} request.body.required - User data
 * @returns {User} 200 - Updated user
 * @returns {Error} 400 - Bad request
 * @returns {Error} 404 - User not found
 */
app.patch('/v1/api/users/:id', validateApiKey, (req, res) => {
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
    // Баг: статус устанавливает только на основе < 17 (вместо 18), нет проверки > 65
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
 * @security apiKey
 * @param {string} id.path.required - User ID
 * @returns {object} 200 - Deletion result
 * @returns {Error} 404 - User not found
 */
app.delete('/v1/api/users/:id', validateApiKey, (req, res) => {
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
 * @security apiKey
 * @returns {Array<User>} 200 - List of users
 */
app.get('/v2/api/users', validateApiKey, (req, res) => {
    res.status(200).json(Object.values(data.users || {}));
});

// v2: Получить пользователя по ID
/**
 * @route GET /v2/api/users/{id}
 * @group v2 - Version 2 with fixes
 * @security apiKey
 * @param {string} id.path.required - User ID
 * @returns {User} 200 - User details
 * @returns {Error} 404 - User not found
 */
app.get('/v2/api/users/:id', validateApiKey, (req, res) => {
    const { id } = req.params;
    const user = data.users[id];

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user);
});

// v2: Создать нового пользователя (с проверками имени, возраст любой, статус по возрасту)
/**
 * @route POST /v2/api/users
 * @group v2 - Version 2 with fixes
 * @security apiKey
 * @param {object} request.body.required - User data
 * @returns {User} 201 - Created user
 * @returns {Error} 400 - Bad request
 */
app.post('/v2/api/users', validateApiKey, (req, res) => {
    const { name, age } = req.body;

    if (!name) {
        return res.status(400).json({ message: 'Name is required' });
    }
    if (!validateName(name)) {
        return res.status(400).json({ message: 'Name must contain only letters, hyphens, and spaces' });
    }
    if (age === undefined || age === null) {
        return res.status(400).json({ message: 'Age is required and must be a positive number' });
    }
    if (age < 0) {
        return res.status(400).json({ message: 'Age must be a positive number' });
    }

    const id = getNextId();
    const status = age < 18 ? 'minor' : age > 65 ? 'retired' : 'candidate';
    const newUser = { id, name, age, status };
    data.users[id] = newUser;
    res.status(201).json(newUser);
});

// v2: Обновить пользователя (с проверками имени, возраст любой, статус по возрасту)
/**
 * @route PATCH /v2/api/users/{id}
 * @group v2 - Version 2 with fixes
 * @security apiKey
 * @param {string} id.path.required - User ID
 * @param {object} request.body.required - User data
 * @returns {User} 200 - Updated user
 * @returns {Error} 400 - Bad request
 * @returns {Error} 404 - User not found
 */
app.patch('/v2/api/users/:id', validateApiKey, (req, res) => {
    const { id } = req.params;
    const { name, age } = req.body;
    const user = data.users[id];

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }
    if (name && !validateName(name)) {
        return res.status(400).json({ message: 'Name must contain only letters, hyphens, and spaces' });
    }
    if (age !== undefined && (age === null || age < 0)) {
        return res.status(400).json({ message: 'Age must be a positive number' });
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
 * @security apiKey
 * @param {string} id.path.required - User ID
 * @returns {object} 200 - Deletion result
 * @returns {Error} 404 - User not found
 */
app.delete('/v2/api/users/:id', validateApiKey, (req, res) => {
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