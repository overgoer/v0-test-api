const fastify = require('fastify')({ logger: true });
const fastifySwagger = require('@fastify/swagger');
const fastifySwaggerUi = require('@fastify/swagger-ui');

// Регистрация плагина Fastify Swagger в динамическом режиме с OpenAPI v3
fastify.register(fastifySwagger, {
    routePrefix: '/documentation',
    swagger: {
        openapi: {
            openapi: '3.0.0',
            info: {
                title: 'Test API',
                description: 'API для тестирования кандидатов на вакансии',
                version: '1.0.0'
            },
            host: 'v0-test-api-ten.vercel.app',
            basePath: '/',
            schemes: ['https'],
            consumes: ['application/json'],
            produces: ['application/json'],
            securitySchemes: { // Используем securitySchemes вместо securityDefinitions для OpenAPI v3
                apiKey: {
                    type: 'apiKey',
                    name: 'X-Fix-Bug',
                    in: 'header'
                }
            },
            tags: [
                { name: 'v1', description: 'Version 1 with bugs' },
                { name: 'v2', description: 'Version 2 with fixes' }
            ]
        }
    },
    exposeRoute: true // Включаем автосканирование маршрутов
});

// Регистрация плагина Swagger UI для интерактивной документации
fastify.register(fastifySwaggerUi, {
    routePrefix: '/documentation',
    uiConfig: {
        docExpansion: 'full',
        deepLinking: false
    },
    uiHooks: {
        onRequest: (request, reply, next) => { next(); },
        preHandler: (request, reply, next) => { next(); }
    },
    staticCSP: false, // Отключаем авто-CSP для кастомизации
    transformStaticCSP: (header) => {
        // Разрешаем встроенные стили и скрипты для Swagger UI
        return "style-src 'self' https: 'unsafe-inline'; script-src 'self' https: 'unsafe-eval' 'unsafe-inline'; default-src 'self' https:";
    },
    transformSpecification: (swaggerObject, request, reply) => { return swaggerObject; },
    transformSpecificationClone: true
});

// Определения схем для пользователей и ошибок в формате OpenAPI v3
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

// Обработка корневого пути / для устранения 404
fastify.get('/', {
    schema: {
        summary: 'Redirect to Swagger documentation',
        description: 'Redirects to the Swagger UI for API documentation',
        tags: ['meta'],
        responses: {
            302: {
                description: 'Redirect to /documentation',
                headers: {
                    Location: {
                        type: 'string',
                        description: 'Redirect URL'
                    }
                }
            }
        }
    }
}, async (request, reply) => {
    reply.code(302).header('Location', '/documentation').send();
});

// Обработка /favicon.ico для предотвращения 500
fastify.get('/favicon.ico', {
    schema: {
        summary: 'No favicon available',
        description: 'Returns No Content for favicon requests',
        tags: ['meta'],
        responses: {
            204: {
                description: 'No Content'
            }
        }
    }
}, async (request, reply) => {
    reply.code(204).send();
});

// Регистрация маршрутов для версии 1 (с багам)

// v1: Получить всех пользователей
fastify.get('/v1/api/users', {
    schema: {
        summary: 'Get all users (v1 with bugs)',
        description: 'Retrieve all users with potential bugs in versioning',
        tags: ['v1'],
        responses: {
            200: {
                description: 'Successful response',
                content: {
                    'application/json': {
                        schema: {
                            type: 'array',
                            items: userSchema
                        }
                    }
                }
            }
        }
    }
}, async (request, reply) => {
    reply.code(200).send(Object.values(data.users || {}));
});

// v1: Получить пользователя по ID (с багом: возвращает ID на 1 меньше)
fastify.get('/v1/api/users/:id', {
    schema: {
        summary: 'Get a user by ID (v1 with bug)',
        description: 'Retrieve a user by ID, but returns ID-1 (bug)',
        tags: ['v1'],
        parameters: [
            {
                in: 'path',
                name: 'id',
                required: true,
                schema: { type: 'string' },
                description: 'User ID'
            }
        ],
        responses: {
            200: {
                description: 'Successful response',
                content: {
                    'application/json': {
                        schema: userSchema
                    }
                }
            },
            404: {
                description: 'User not found',
                content: {
                    'application/json': {
                        schema: errorSchema
                    }
                }
            }
        }
    }
}, async (request, reply) => {
    const { id } = request.params;
    const requestedId = parseInt(id);
    const userId = requestedId - 1; // Баг: возвращаем ID на 1 меньше
    const user = data.users[userId];

    if (!user) {
        return reply.code(404).send({ message: 'User not found' });
    }

    reply.code(200).send(user);
});

// v1: Создать нового пользователя (с багам: нет проверки возраста > 65, принимает любые имена, age необязательное)
fastify.post('/v1/api/users', {
    schema: {
        summary: 'Create a new user (v1 with bugs)',
        description: 'Create a new user with potential bugs (no age > 65 check, any name, optional age)',
        tags: ['v1'],
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        properties: {
                            name: { type: 'string' },
                            age: { type: 'number' }
                        }
                    }
                }
            }
        },
        responses: {
            201: {
                description: 'User created',
                content: {
                    'application/json': {
                        schema: userSchema
                    }
                }
            },
            400: {
                description: 'Bad request',
                content: {
                    'application/json': {
                        schema: errorSchema
                    }
                }
            }
        }
    }
}, async (request, reply) => {
    const { name, age } = request.body;

    if (!name) {
        return reply.code(400).send({ message: 'Name is required' });
    }
    if (age !== undefined && age < 0) {
        return reply.code(400).send({ message: 'Invalid age value' });
    }
    const status = age === undefined || age < 18 ? 'minor' : 'candidate'; // Баг: нет проверки > 65

    const id = getNextId();
    const newUser = { id, name, age: age, status }; // age может быть null/undefined
    data.users[id] = newUser;
    reply.code(201).send(newUser);
});

// v1: Обновить пользователя (с багам: принимает любые имена, нет проверки возраста > 65)
fastify.patch('/v1/api/users/:id', {
    schema: {
        summary: 'Update a user (v1 with bugs)',
        description: 'Update a user with potential bugs (accepts any name, no age > 65 check)',
        tags: ['v1'],
        parameters: [
            {
                in: 'path',
                name: 'id',
                required: true,
                schema: { type: 'string' },
                description: 'User ID'
            }
        ],
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        properties: {
                            name: { type: 'string' },
                            age: { type: 'number' }
                        }
                    }
                }
            }
        },
        responses: {
            200: {
                description: 'User updated',
                content: {
                    'application/json': {
                        schema: userSchema
                    }
                }
            },
            400: {
                description: 'Bad request',
                content: {
                    'application/json': {
                        schema: errorSchema
                    }
                }
            },
            404: {
                description: 'User not found',
                content: {
                    'application/json': {
                        schema: errorSchema
                    }
                }
            }
        }
    }
}, async (request, reply) => {
    const { id } = request.params;
    const { name, age } = request.body;
    const user = data.users[id];

    if (!user) {
        return reply.code(404).send({ message: 'User not found' });
    }
    if (name) user.name = name; // Баг: принимает любые имена
    if (age !== undefined) {
        user.age = age;
        user.status = age < 18 ? 'minor' : 'candidate'; // Баг: нет проверки > 65
    }
    data.users[id] = user;
    reply.code(200).send(user);
});

// v1: Удалить пользователя
fastify.delete('/v1/api/users/:id', {
    schema: {
        summary: 'Delete a user (v1)',
        description: 'Delete a user by ID',
        tags: ['v1'],
        parameters: [
            {
                in: 'path',
                name: 'id',
                required: true,
                schema: { type: 'string' },
                description: 'User ID'
            }
        ],
        responses: {
            200: {
                description: 'User deleted successfully',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                message: { type: 'string' },
                                user: userSchema
                            }
                        }
                    }
                }
            },
            404: {
                description: 'User not found',
                content: {
                    'application/json': {
                        schema: errorSchema
                    }
                }
            }
        }
    }
}, async (request, reply) => {
    const { id } = request.params;
    const user = data.users[id];

    if (!user) {
        return reply.code(404).send({ message: 'User not found' });
    }
    delete data.users[id];
    reply.code(200).send({ message: 'User deleted successfully', user });
});

// Регистрация маршрутов для версии 2 (исправленная логика)

// v2: Получить всех пользователей
fastify.get('/v2/api/users', {
    schema: {
        summary: 'Get all users (v2 fixed)',
        description: 'Retrieve all users with fixed logic',
        tags: ['v2'],
        responses: {
            200: {
                description: 'Successful response',
                content: {
                    'application/json': {
                        schema: {
                            type: 'array',
                            items: userSchema
                        }
                    }
                }
            }
        }
    }
}, async (request, reply) => {
    reply.code(200).send(Object.values(data.users || {}));
});

// v2: Получить пользователя по ID
fastify.get('/v2/api/users/:id', {
    schema: {
        summary: 'Get a user by ID (v2 fixed)',
        description: 'Retrieve a user by ID with fixed logic',
        tags: ['v2'],
        parameters: [
            {
                in: 'path',
                name: 'id',
                required: true,
                schema: { type: 'string' },
                description: 'User ID'
            }
        ],
        responses: {
            200: {
                description: 'Successful response',
                content: {
                    'application/json': {
                        schema: userSchema
                    }
                }
            },
            404: {
                description: 'User not found',
                content: {
                    'application/json': {
                        schema: errorSchema
                    }
                }
            }
        }
    }
}, async (request, reply) => {
    const { id } = request.params;
    const user = data.users[id];

    if (!user) {
        return reply.code(404).send({ message: 'User not found' });
    }

    reply.code(200).send(user);
});

// v2: Создать нового пользователя (с проверками имени и возраста 18–65)
fastify.post('/v2/api/users', {
    schema: {
        summary: 'Create a new user (v2 fixed)',
        description: 'Create a new user with strict name and age validation (18–65)',
        tags: ['v2'],
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        required: ['name', 'age'],
                        properties: {
                            name: { type: 'string' },
                            age: { type: 'number' }
                        }
                    }
                }
            }
        },
        responses: {
            201: {
                description: 'User created',
                content: {
                    'application/json': {
                        schema: userSchema
                    }
                }
            },
            400: {
                description: 'Bad request',
                content: {
                    'application/json': {
                        schema: errorSchema
                    }
                }
            }
        }
    }
}, async (request, reply) => {
    const { name, age } = request.body;

    if (!name) {
        return reply.code(400).send({ message: 'Name is required' });
    }
    if (!validateName(name)) {
        return reply.code(400).send({ message: 'Name must contain only letters, hyphens, and spaces' });
    }
    if (age === undefined) {
        return reply.code(400).send({ message: 'Age is required and must be between 18 and 65' });
    }
    if (!validateAge(age)) {
        return reply.code(400).send({ message: 'Age must be between 18 and 65' });
    }

    const id = getNextId();
    const status = age < 18 ? 'minor' : age > 65 ? 'retired' : 'candidate';
    const newUser = { id, name, age, status };
    data.users[id] = newUser;
    reply.code(201).send(newUser);
});

// v2: Обновить пользователя (с проверками имени и возраста 18–65)
fastify.patch('/v2/api/users/:id', {
    schema: {
        summary: 'Update a user (v2 fixed)',
        description: 'Update a user with strict name and age validation (18–65)',
        tags: ['v2'],
        parameters: [
            {
                in: 'path',
                name: 'id',
                required: true,
                schema: { type: 'string' },
                description: 'User ID'
            }
        ],
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        properties: {
                            name: { type: 'string' },
                            age: { type: 'number' }
                        }
                    }
                }
            }
        },
        responses: {
            200: {
                description: 'User updated',
                content: {
                    'application/json': {
                        schema: userSchema
                    }
                }
            },
            400: {
                description: 'Bad request',
                content: {
                    'application/json': {
                        schema: errorSchema
                    }
                }
            },
            404: {
                description: 'User not found',
                content: {
                    'application/json': {
                        schema: errorSchema
                    }
                }
            }
        }
    }
}, async (request, reply) => {
    const { id } = request.params;
    const { name, age } = request.body;
    const user = data.users[id];

    if (!user) {
        return reply.code(404).send({ message: 'User not found' });
    }
    if (name && !validateName(name)) {
        return reply.code(400).send({ message: 'Name must contain only letters, hyphens, and spaces' });
    }
    if (age !== undefined && !validateAge(age)) {
        return reply.code(400).send({ message: 'Age must be between 18 and 65' });
    }

    if (name) user.name = name;
    if (age !== undefined) {
        user.age = age;
        user.status = age < 18 ? 'minor' : age > 65 ? 'retired' : 'candidate';
    }
    data.users[id] = user;
    reply.code(200).send(user);
});

// v2: Удалить пользователя
fastify.delete('/v2/api/users/:id', {
    schema: {
        summary: 'Delete a user (v2)',
        description: 'Delete a user by ID with fixed logic',
        tags: ['v2'],
        parameters: [
            {
                in: 'path',
                name: 'id',
                required: true,
                schema: { type: 'string' },
                description: 'User ID'
            }
        ],
        responses: {
            200: {
                description: 'User deleted successfully',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                message: { type: 'string' },
                                user: userSchema
                            }
                        }
                    }
                }
            },
            404: {
                description: 'User not found',
                content: {
                    'application/json': {
                        schema: errorSchema
                    }
                }
            }
        }
    }
}, async (request, reply) => {
    const { id } = request.params;
    const user = data.users[id];

    if (!user) {
        return reply.code(404).send({ message: 'User not found' });
    }
    delete data.users[id];
    reply.code(200).send({ message: 'User deleted successfully', user });
});

// Пинг для поддержания активности (опционально, может не работать на бесплатном плане Vercel)
setInterval(() => {
    fastify.log.info('Keeping server alive');
}, 300000); // Пинг каждые 5 минут

// Запуск сервера с отладкой для Swagger
const start = async () => {
    try {
        await fastify.ready(); // Ждём, пока все плагины и маршруты зарегистрированы
        fastify.log.info('Routes registered:', Object.keys(fastify.routes)); // Логируем зарегистрированные маршруты
        fastify.log.info('Swagger spec:', fastify.swagger()); // Проверяем объект Swagger для отладки
        await fastify.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' });
        fastify.log.info(`Server listening on ${fastify.server.address().port}`);
        fastify.log.info(`Swagger documentation available at https://v0-test-api-ten.vercel.app/documentation`);
    } catch (err) {
        fastify.log.error('Server error:', err);
        process.exit(1);
    }
};
start();
