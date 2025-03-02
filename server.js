const fastify = require('fastify')({ logger: true });
const fastifySwagger = require('@fastify/swagger');
const fastifySwaggerUi = require('@fastify/swagger-ui');

// Настройка Swagger с автосканированием маршрутов и тегами
fastify.register(fastifySwagger, {
    routePrefix: '/documentation',
    swagger: {
        info: {
            title: 'Test API',
            description: 'API для тестирования кандидатов на вакансии',
            version: '1.0.0'
        },
        host: 'v0-test-api-ten.vercel.app', // Укажи реальный хост Vercel
        schemes: ['https'],
        consumes: ['application/json'],
        produces: ['application/json'],
        securityDefinitions: {
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
    },
    exposeRoute: true
});

fastify.register(fastifySwaggerUi, {
    routePrefix: '/documentation',
    uiConfig: {
        docExpansion: 'full',
        deepLinking: false
    },
    uiHooks: {
        onRequest: (request, reply, next) => { next() },
        preHandler: (request, reply, next) => { next() }
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
    transformSpecification: (swaggerObject, request, reply) => { return swaggerObject },
    transformSpecificationClone: true
});

// Schema definitions
const userSchema = {
    type: 'object',
    properties: {
        id: { type: 'number' },
        name: { type: 'string' },
        age: { type: 'number' },
        status: { type: 'string' }
    }
};

const errorSchema = {
    type: 'object',
    properties: {
        message: { type: 'string' }
    }
};

// Глобальный объект для хранения данных
const data = {
    settings: { counter: 0 },
    users: {}
};

// Функция для получения следующего ID
function getNextId() {
    data.settings.counter += 1;
    return data.settings.counter;
}

// Вспомогательная функция для валидации имени
function validateName(name) {
    if (!name || !/^[A-Za-z\s-]+$/.test(name)) {
        return false;
    }
    return true;
}

// Вспомогательная функция для валидации возраста
function validateAge(age) {
    return age >= 18 && age <= 65;
}

// Получить всех пользователей (v1) — добавляем теги
fastify.get('/v1/api/users', {
    schema: {
        description: 'Get all users (v1 with bugs)',
        tags: ['v1'],
        response: {
            200: {
                type: 'array',
                items: userSchema
            }
        }
    }
}, async (request, reply) => {
    reply.code(200).send(Object.values(data.users || {}));
});

// Получить конкретного пользователя по ID (v1, с багом) — добавляем теги
fastify.get('/v1/api/users/:id', {
    schema: {
        description: 'Get a user by ID (v1 with bug)',
        tags: ['v1'],
        params: {
            type: 'object',
            properties: {
                id: { type: 'string' }
            }
        },
        response: {
            200: userSchema,
            404: errorSchema
        }
    }
}, async (request, reply) => {
    const { id } = request.params;
    const requestedId = parseInt(id);
    const userId = requestedId - 1; // Баг: возвращаем id на 1 меньше
    const user = data.users[userId];

    if (!user) {
        return reply.code(404).send({ message: 'User not found' });
    }

    reply.code(200).send(user);
});

// Получить конкретного пользователя по ID (v2, исправленная логика) — добавляем теги
fastify.get('/v2/api/users/:id', {
    schema: {
        description: 'Get a user by ID (v2 fixed)',
        tags: ['v2'],
        params: {
            type: 'object',
            properties: {
                id: { type: 'string' }
            }
        },
        response: {
            200: userSchema,
            404: errorSchema
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

// Создать нового пользователя (v1, с багам) — добавляем теги
fastify.post('/v1/api/users', {
    schema: {
        description: 'Create a new user (v1 with bugs)',
        tags: ['v1'],
        body: {
            type: 'object',
            properties: {
                name: { type: 'string' },
                age: { type: 'number' }
            }
        },
        response: {
            201: userSchema,
            400: errorSchema
        }
    }
}, async (request, reply) => {
    const { name, age } = request.body;

    if (!name) return reply.code(400).send({ message: 'Name is required' });
    // Баг 1: Не проверяем верхнюю границу возраста (> 65)
    if (age !== undefined && age < 0) return reply.code(400).send({ message: 'Invalid age value' });
    // Баг 2: Принимаем имя с цифрами/символами
    // Баг 3: age необязательное, присваиваем null/undefined, если не указано
    const status = age === undefined || age < 18 ? 'minor' : 'candidate'; // Нет проверки > 65

    const id = getNextId();
    const newUser = { id, name, age: age, status }; // age может быть null/undefined
    data.users[id] = newUser;
    reply.code(201).send(newUser);
});

// Создать нового пользователя (v2, исправленная логика) — добавляем теги
fastify.post('/v2/api/users', {
    schema: {
        description: 'Create a new user (v2 fixed)',
        tags: ['v2'],
        body: {
            type: 'object',
            required: ['name', 'age'],
            properties: {
                name: { type: 'string' },
                age: { type: 'number' }
            }
        },
        response: {
            201: userSchema,
            400: errorSchema
        }
    }
}, async (request, reply) => {
    const { name, age } = request.body;

    if (!name) return reply.code(400).send({ message: 'Name is required' });
    if (!validateName(name)) return reply.code(400).send({ message: 'Name must contain only letters, hyphens, and spaces' });
    if (age === undefined) return reply.code(400).send({ message: 'Age is required and must be between 18 and 65' });
    if (!validateAge(age)) return reply.code(400).send({ message: 'Age must be between 18 and 65' });

    const id = getNextId();
    const status = age < 18 ? 'minor' : age > 65 ? 'retired' : 'candidate';
    const newUser = { id, name, age, status };
    data.users[id] = newUser;
    reply.code(201).send(newUser);
});

// Обновить пользователя (v1, с багам) — добавляем теги
fastify.patch('/v1/api/users/:id', {
    schema: {
        description: 'Update a user (v1 with bugs)',
        tags: ['v1'],
        params: {
            type: 'object',
            properties: {
                id: { type: 'string' }
            }
        },
        body: {
            type: 'object',
            properties: {
                name: { type: 'string' },
                age: { type: 'number' }
            }
        },
        response: {
            200: userSchema,
            400: errorSchema,
            404: errorSchema
        }
    }
}, async (request, reply) => {
    const { id } = request.params;
    const { name, age } = request.body;
    const user = data.users[id];

    if (!user) return reply.code(404).send({ message: 'User not found' });
    if (name) user.name = name; // Баг: Принимаем имя с цифрами/символами
    if (age !== undefined) {
        user.age = age;
        user.status = age < 18 ? 'minor' : 'candidate'; // Баг: Нет проверки > 65
    }
    data.users[id] = user;
    reply.code(200).send(user);
});

// Обновить пользователя (v2, исправленная логика) — добавляем теги
fastify.patch('/v2/api/users/:id', {
    schema: {
        description: 'Update a user (v2 fixed)',
        tags: ['v2'],
        params: {
            type: 'object',
            properties: {
                id: { type: 'string' }
            }
        },
        body: {
            type: 'object',
            properties: {
                name: { type: 'string' },
                age: { type: 'number' }
            }
        },
        response: {
            200: userSchema,
            400: errorSchema,
            404: errorSchema
        }
    }
}, async (request, reply) => {
    const { id } = request.params;
    const { name, age } = request.body;
    const user = data.users[id];

    if (!user) return reply.code(404).send({ message: 'User not found' });
    if (name && !validateName(name)) return reply.code(400).send({ message: 'Name must contain only letters, hyphens, and spaces' });
    if (age !== undefined && !validateAge(age)) return reply.code(400).send({ message: 'Age must be between 18 and 65' });

    if (name) user.name = name;
    if (age !== undefined) {
        user.age = age;
        user.status = age < 18 ? 'minor' : age > 65 ? 'retired' : 'candidate';
    }
    data.users[id] = user;
    reply.code(200).send(user);
});

// Удалить пользователя (v1/v2, одинаковый) — добавляем теги
fastify.delete('/v1/api/users/:id', {
    schema: {
        description: 'Delete a user (v1)',
        tags: ['v1'],
        params: {
            type: 'object',
            properties: {
                id: { type: 'string' }
            }
        },
        response: {
            200: {
                type: 'object',
                properties: {
                    message: { type: 'string' },
                    user: userSchema
                }
            },
            404: errorSchema
        }
    }
}, async (request, reply) => {
    const { id } = request.params;
    const user = data.users[id];
    if (!user) return reply.code(404).send({ message: 'User not found' });
    delete data.users[id];
    reply.code(200).send({ message: 'User deleted successfully', user });
});

fastify.delete('/v2/api/users/:id', {
    schema: {
        description: 'Delete a user (v2)',
        tags: ['v2'],
        params: {
            type: 'object',
            properties: {
                id: { type: 'string' }
            }
        },
        response: {
            200: {
                type: 'object',
                properties: {
                    message: { type: 'string' },
                    user: userSchema
                }
            },
            404: errorSchema
        }
    }
}, async (request, reply) => {
    const { id } = request.params;
    const user = data.users[id];
    if (!user) return reply.code(404).send({ message: 'User not found' });
    delete data.users[id];
    reply.code(200).send({ message: 'User deleted successfully', user });
});

// Пинг для поддержания активности (опционально, может не работать на бесплатном плане)
setInterval(() => {
    fastify.log.info('Keeping server alive');
}, 300000); // Пинг каждые 5 минут

// Запуск сервера
const start = async () => {
    try {
        await fastify.listen(process.env.PORT || 3000, '0.0.0.0');
        fastify.log.info(`Server listening on ${fastify.server.address().port}`);
        fastify.log.info(`Swagger documentation available at https://v0-test-api-ten.vercel.app/documentation`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};
start();
