import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import express from "express";
import multer from "multer";
import bodyParser from "body-parser";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import { v4 as uuidv4 } from "uuid";

const program = new Command();
program
  .requiredOption("-h, --host <string>", "Server host address")
  .requiredOption("-p, --port <number>", "Server port")
  .requiredOption("-c, --cache <path>", "Path to cache directory");
program.parse(process.argv);

const { host, port, cache } = program.opts();

const ensureDirs = async () => {
  await fs.mkdir(cache, { recursive: true });
  await fs.mkdir("inventory", { recursive: true });
  await fs.mkdir("photos", { recursive: true });
};

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("."));

const upload = multer({ dest: "photos/" });

const loadDB = async () => {
  try {
    const data = await fs.readFile("inventory/db.json", "utf8");
    return JSON.parse(data);
  } catch {
    return [];
  }
};

const saveDB = async (db) => {
  await fs.writeFile("inventory/db.json", JSON.stringify(db, null, 2));
};

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Inventory API",
      version: "1.0.0",
      description: "Inventory service documentation (Lab №6)",
    },
  },
  apis: ["./main.js"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * /register:
 *   post:
 *     summary: Register a new inventory item
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               inventory_name:
 *                 type: string
 *                 description: Item name
 *               description:
 *                 type: string
 *                 description: Item description
 *               photo:
 *                 type: string
 *                 format: binary
 *                 description: Item photo file
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         description: Missing name field
 */
app.post("/register", upload.single("photo"), async (req, res) => {
  const { inventory_name, description } = req.body;

  if (!inventory_name) {
    return res.status(400).send("Bad Request");
  }

  const db = await loadDB();
  const newItem = {
    id: uuidv4(),
    name: inventory_name,
    description: description || "",
    photo: req.file ? `/photos/${req.file.filename}` : null,
  };

  db.push(newItem);
  await saveDB(db);

  res.status(201).json({ message: "Created", item: newItem });
});

/**
 * @swagger
 * /inventory:
 *   get:
 *     summary: Get full inventory list
 *     responses:
 *       200:
 *         description: OK
 */
app.get("/inventory", async (req, res) => {
  const db = await loadDB();
  res.status(200).json(db);
});

/**
 * @swagger
 * /inventory/{id}:
 *   get:
 *     summary: Get one inventory item by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Inventory item ID
 *     responses:
 *       200:
 *         description: OK
 *       404:
 *         description: Not found
 */
app.get("/inventory/:id", async (req, res) => {
  const db = await loadDB();
  const item = db.find((i) => i.id == req.params.id);

  if (!item) return res.status(404).send("Not Found");

  res.status(200).json(item);
});

/**
 * @swagger
 * /inventory/{id}:
 *   put:
 *     summary: Update item information
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Inventory item ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated
 *       404:
 *         description: Not found
 */
app.put("/inventory/:id", async (req, res) => {
  const db = await loadDB();
  const item = db.find((i) => i.id == req.params.id);

  if (!item) return res.status(404).send("Not Found");

  const { name, description } = req.body;
  if (name) item.name = name;
  if (description) item.description = description;

  await saveDB(db);
  res.status(200).json({ message: "Updated", item });
});

/**
 * @swagger
 * /inventory/{id}/photo:
 *   get:
 *     summary: Download item photo
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Inventory item ID
 *     responses:
 *       200:
 *         description: OK (JPEG image)
 *       404:
 *         description: Not found
 */
app.get("/inventory/:id/photo", async (req, res) => {
  const db = await loadDB();
  const item = db.find((i) => i.id == req.params.id);

  if (!item || !item.photo) return res.status(404).send("Not Found");

  const filePath = path.join(".", item.photo);

  res.setHeader("Content-Type", "image/jpeg");
  res.status(200).sendFile(filePath, { root: "." });
});

/**
 * @swagger
 * /inventory/{id}/photo:
 *   put:
 *     summary: Update item photo
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Inventory item ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *                 description: New photo file
 *     responses:
 *       200:
 *         description: Photo updated
 *       404:
 *         description: Not found
 */
app.put("/inventory/:id/photo", upload.single("photo"), async (req, res) => {
  const db = await loadDB();
  const item = db.find((i) => i.id == req.params.id);

  if (!item) return res.status(404).send("Not Found");

  item.photo = `/photos/${req.file.filename}`;
  await saveDB(db);

  res.status(200).json({ message: "Photo updated", item });
});

/**
 * @swagger
 * /inventory/{id}:
 *   delete:
 *     summary: Delete inventory item
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Inventory item ID
 *     responses:
 *       200:
 *         description: Deleted
 *       404:
 *         description: Not found
 */
app.delete("/inventory/:id", async (req, res) => {
  let db = await loadDB();
  const item = db.find((i) => i.id == req.params.id);

  if (!item) return res.status(404).send("Not Found");

  db = db.filter((i) => i.id != req.params.id);
  await saveDB(db);

  res.status(200).json({ message: "Deleted" });
});
/**
 * @swagger
 * /search:
 *   post:
 *     summary: Search inventory item by ID (using x-www-form-urlencoded)
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: Inventory item ID (required)
 *               includePhoto:
 *                 type: string
 *                 enum: [on]
 *                 description: "Set to 'on' to include photo URL"
 *     responses:
 *       200:
 *         description: OK
 *       404:
 *         description: Not found
 */
app.post("/search", async (req, res) => { 
  const { id, includePhoto } = req.body;

  if (!id) return res.status(400).send("Bad Request: Missing ID");

  const db = await loadDB();
  const item = db.find((i) => i.id == id);

  if (!item) return res.status(404).send("Not Found");

  let result = {
    id: item.id,
    name: item.name,
    description: item.description,
  };

  if (includePhoto === "on") {
    result.photo = item.photo;
  }

  res.status(200).json(result);
});

app.get('/RegisterForm.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'RegisterForm.html'));
});

app.get('/SearchForm.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'SearchForm.html'));
});

app.use((req, res) => {
  res.status(405).send("Method Not Allowed");
});

await ensureDirs();

app.listen(port, host, () => {
  console.log(`Inventory service running at http://${host}:${port}`);
  console.log(`Swagger docs available at http://${host}:${port}/docs`);
});
