import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import swaggerUi from "swagger-ui-express";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "default_secret";
const APP_PORT = Number(process.env.APP_PORT) || 10001;
const SERVER_PORT = Number(process.env.SERVER_PORT) || 20002;
const ADMIN_USERNAME = process.env.USERNAME || "admin";
const ADMIN_PASSWORD = process.env.PASSWORD || "admin";

// Middleware to verify JWT tokens
const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies.token; // Token stored in HTTP-only cookies

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ message: "Forbidden" });
    }
    (req as any).user = user; // Attach user info to the request
    next(); // Proceed to the next middleware or route handler
  });
};

// Dynamically load DTOs
const loadDTOs = () => {
  const dtoPath = path.join(__dirname, "../dto");
  const dtos: Record<string, Record<string, string>> = {};

  if (fs.existsSync(dtoPath)) {
    const files = fs.readdirSync(dtoPath);
    files.forEach((file) => {
      const modelName = path.basename(file, ".dto.ts");
      const dtoContent = fs.readFileSync(path.join(dtoPath, file), "utf-8");

      // Extract interface properties
      const properties: Record<string, string> = {};
      const matches = dtoContent.match(/(\w+): (\w+);/g);
      matches?.forEach((match) => {
        const [key, type] = match
          .replace(";", "")
          .split(": ")
          .map((s) => s.trim());
        properties[key] = type;
      });

      dtos[modelName] = properties;
    });
  }
  return dtos;
};

const dtos = loadDTOs();

// Generate Swagger documentation for models
const generateSwaggerDocs = (models: string[]) => {
  const paths: Record<string, any> = {};

  models.forEach((model) => {
    const lowerModel = model.toLowerCase();

    paths[`/${lowerModel}`] = {
      get: {
        tags: [model],
        summary: `Get all ${model}s`,
        responses: {
          200: {
            description: `List of ${model}s`,
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: `#/components/schemas/${model}` },
                },
              },
            },
          },
        },
      },
      post: {
        tags: [model],
        summary: `Create a ${model}`,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: `#/components/schemas/${model}` },
            },
          },
        },
        responses: {
          201: {
            description: `${model} created`,
          },
        },
      },
    };

    paths[`/${lowerModel}/{id}`] = {
      get: {
        tags: [model],
        summary: `Get a ${model} by ID`,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: `${model} data` },
          404: { description: `${model} not found` },
        },
      },
      put: {
        tags: [model],
        summary: `Update a ${model} by ID`,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: `#/components/schemas/${model}` },
            },
          },
        },
        responses: {
          200: { description: `${model} updated` },
        },
      },
      delete: {
        tags: [model],
        summary: `Delete a ${model}`,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: `${model} deleted` },
        },
      },
    };
  });

  const components = {
    schemas: models.reduce((acc, model) => {
      if (dtos[model]) {
        acc[model] = {
          type: "object",
          properties: Object.entries(dtos[model]).reduce(
            (fields, [key, type]) => ({
              ...fields,
              [key]: { type },
            }),
            {}
          ),
        };
      } else {
        acc[model] = { type: "object" }; // Fallback if DTO is not found
      }
      return acc;
    }, {} as Record<string, any>),
  };

  // Add login endpoint schema
  components.schemas["Login"] = {
    type: "object",
    properties: {
      username: { type: "string" },
      password: { type: "string" },
    },
  };

  return {
    openapi: "3.0.0",
    info: {
      title: "CRUD API",
      version: "1.0.0",
    },
    servers: [{ url: `http://localhost:${SERVER_PORT}` }],
    paths: {
      ...paths,
      "/login": {
        post: {
          tags: ["Auth"],
          summary: "Login to get a token",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: `#/components/schemas/Login` },
              },
            },
          },
          responses: {
            200: { description: "Successful login" },
            401: { description: "Invalid credentials" },
          },
        },
      },
    },
    components,
  };
};

// Load schema
const parsedSchemaPath = path.join(__dirname, "../schema/schema.parsed.json");
if (!fs.existsSync(parsedSchemaPath)) {
  console.error("Schema file not found. Ensure schema.parsed.json exists.");
  process.exit(1);
}
const schema = JSON.parse(fs.readFileSync(parsedSchemaPath, "utf-8"));
const models = Object.keys(schema);

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(cors({ origin: [`http://localhost:${APP_PORT}`], credentials: true }));
app.use(cookieParser());

// Swagger setup
const swaggerDocs = generateSwaggerDocs(models);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Authentication routes
// @ts-ignore
app.post("/login", (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "1h" });
    res.cookie("token", token, { httpOnly: true }); // Set HTTP-only cookie
    return res.json({ message: "Logged in successfully" });
  }

  return res.status(401).json({ message: "Invalid credentials" });
});

app.post("/logout", (req: Request, res: Response) => {
  res.clearCookie("token");
  res.json({ message: "Logged out successfully" });
});

// CRUD routes
models.forEach((model) => {
  const lowerModel = model.toLowerCase();

  // @ts-ignore
  app.get(`/${lowerModel}`, authenticateJWT, (req, res) =>
    res.json([{ id: 1, name: `${model} Example` }])
  );

  // @ts-ignore
  app.post(`/${lowerModel}`, authenticateJWT, (req, res) =>
    res.status(201).json(req.body)
  );

  // @ts-ignore
  app.get(`/${lowerModel}/:id`, authenticateJWT, (req, res) =>
    res.json({ id: req.params.id, name: `${model} Example` })
  );

  // @ts-ignore
  app.put(`/${lowerModel}/:id`, authenticateJWT, (req, res) =>
    res.json({ id: req.params.id, ...req.body })
  );

  // @ts-ignore
  app.delete(`/${lowerModel}/:id`, authenticateJWT, (req, res) =>
    res.json({ id: req.params.id, message: `${model} deleted` })
  );
});

// Start server
app.listen(SERVER_PORT, () => {
  console.log(`Server is running on http://localhost:${SERVER_PORT}`);
  console.log(
    `Swagger Docs available at http://localhost:${SERVER_PORT}/api-docs`
  );
});
