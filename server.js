const fastify = require("fastify")({ logger: true })
const fastifySwagger = require("@fastify/swagger")
const fastifySwaggerUi = require("@fastify/swagger-ui")

// Add this before defining any routes
fastify.register(fastifySwagger, {
  swagger: {
    info: {
      title: "Test API",
      description: "Testing the Fastify swagger API",
      version: "0.1.0",
    },
    host: "localhost",
    schemes: ["http"],
    consumes: ["application/json"],
    produces: ["application/json"],
  },
})

fastify.register(fastifySwaggerUi, {
  routePrefix: "/documentation",
  uiConfig: {
    docExpansion: "full",
    deepLinking: false,
  },
  uiHooks: {
    onRequest: (request, reply, next) => {
      next()
    },
    preHandler: (request, reply, next) => {
      next()
    },
  },
  staticCSP: true,
  transformStaticCSP: (header) => header,
  transformSpecification: (swaggerObject, request, reply) => {
    return swaggerObject
  },
  transformSpecificationClone: true,
})

// Schema definitions
const userSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    name: { type: "string" },
    age: { type: "number" },
    status: { type: "string" },
  },
}

const errorSchema = {
  type: "object",
  properties: {
    message: { type: "string" },
  },
}

// Глобальный объект для хранения данных
const data = {
  settings: { counter: 0 },
  users: {},
}

// Функция для получения следующего ID
function getNextId() {
  data.settings.counter += 1
  return data.settings.counter
}

// Вспомогательная функция для валидации имени
function validateName(name) {
  if (!name || !/^[A-Za-z\s-]+$/.test(name)) {
    return false
  }
  return true
}

// Вспомогательная функция для валидации возраста
function validateAge(age) {
  return age >= 18 && age <= 65
}

// Получить всех пользователей (v1)
fastify.get("/v1/api/users", async (request, reply) => {
  reply.code(200).send(Object.values(data.users || {}))
})

// Получить конкретного пользователя по ID (v1, с багом)
fastify.get("/v1/api/users/:id", async (request, reply) => {
  const { id } = request.params
  const requestedId = Number.parseInt(id)
  const userId = requestedId - 1 // Баг: возвращаем id на 1 меньше
  const user = data.users[userId]

  if (!user) {
    return reply.code(404).send({ message: "User not found" })
  }

  reply.code(200).send(user)
})

// Получить конкретного пользователя по ID (v2, исправленная логика)
fastify.get(
  "/v2/api/users/:id",
  {
    schema: {
      description: "Get a user by ID",
      params: {
        type: "object",
        properties: {
          id: { type: "string" },
        },
      },
      response: {
        200: userSchema,
        404: errorSchema,
      },
    },
  },
  async (request, reply) => {
    const { id } = request.params
    const user = data.users[id]

    if (!user) {
      return reply.code(404).send({ message: "User not found" })
    }

    reply.code(200).send(user)
  },
)

// Создать нового пользователя (v1, с багам)
fastify.post("/v1/api/users", async (request, reply) => {
  const { name, age } = request.body

  if (!name) return reply.code(400).send({ message: "Name is required" })
  // Баг 1: Не проверяем верхнюю границу возраста (> 65)
  if (age !== undefined && age < 0) return reply.code(400).send({ message: "Invalid age value" })
  // Баг 2: Принимаем имя с цифрами/символами
  // Баг 3: age необязательное, присваиваем null/undefined, если не указано
  const status = age === undefined || age < 18 ? "minor" : "candidate" // Нет проверки > 65

  const id = getNextId()
  const newUser = { id, name, age: age, status } // age может быть null/undefined
  data.users[id] = newUser
  reply.code(201).send(newUser)
})

// Создать нового пользователя (v2, исправленная логика)
fastify.post(
  "/v2/api/users",
  {
    schema: {
      description: "Create a new user",
      body: {
        type: "object",
        required: ["name", "age"],
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
      },
      response: {
        201: userSchema,
        400: errorSchema,
      },
    },
  },
  async (request, reply) => {
    const { name, age } = request.body

    if (!name) return reply.code(400).send({ message: "Name is required" })
    if (!validateName(name))
      return reply.code(400).send({ message: "Name must contain only letters, hyphens, and spaces" })
    if (age === undefined) return reply.code(400).send({ message: "Age is required and must be between 18 and 65" })
    if (!validateAge(age)) return reply.code(400).send({ message: "Age must be between 18 and 65" })

    const id = getNextId()
    const status = age < 18 ? "minor" : age > 65 ? "retired" : "candidate"
    const newUser = { id, name, age, status }
    reply.code(201).send(newUser)
  },
)

// Обновить пользователя (v1, с багам)
fastify.patch("/v1/api/users/:id", async (request, reply) => {
  const { id } = request.params
  const { name, age } = request.body
  const user = data.users[id]

  if (!user) return reply.code(404).send({ message: "User not found" })
  if (name) user.name = name // Баг: Принимаем имя с цифрами/символами
  if (age !== undefined) {
    user.age = age
    user.status = age < 18 ? "minor" : "candidate" // Баг: Нет проверки > 65
  }
  data.users[id] = user
  reply.code(200).send(user)
})

// Обновить пользователя (v2, исправленная логика)
fastify.patch("/v2/api/users/:id", async (request, reply) => {
  const { id } = request.params
  const { name, age } = request.body
  const user = data.users[id]

  if (!user) return reply.code(404).send({ message: "User not found" })
  if (name && !validateName(name))
    return reply.code(400).send({ message: "Name must contain only letters, hyphens, and spaces" })
  if (age !== undefined && !validateAge(age)) return reply.code(400).send({ message: "Age must be between 18 and 65" })

  if (name) user.name = name
  if (age !== undefined) {
    user.age = age
    user.status = age < 18 ? "minor" : age > 65 ? "retired" : "candidate"
  }
  data.users[id] = user
  reply.code(200).send(user)
})

// Удалить пользователя (v1/v2, одинаковый)
fastify.delete("/v1/api/users/:id", async (request, reply) => {
  const { id } = request.params
  const user = data.users[id]
  if (!user) return reply.code(404).send({ message: "User not found" })
  delete data.users[id]
  reply.code(200).send({ message: "User deleted successfully", user })
})
fastify.delete("/v2/api/users/:id", async (request, reply) => {
  const { id } = request.params
  const user = data.users[id]
  if (!user) return reply.code(404).send({ message: "User not found" })
  delete data.users[id]
  reply.code(200).send({ message: "User deleted successfully", user })
})

// Пинг для поддержания активности (опционально, может не работать на бесплатном плане)
setInterval(() => {
  fastify.log.info("Keeping server alive")
}, 300000) // Пинг каждые 5 минут

// Modify the start function to log the documentation URL
const start = async () => {
  try {
    await fastify.listen(process.env.PORT || 3000, "0.0.0.0")
    fastify.log.info(`Server listening on ${fastify.server.address().port}`)
    fastify.log.info(
      `Swagger documentation available at http://localhost:${fastify.server.address().port}/documentation`,
    )
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}
start()

