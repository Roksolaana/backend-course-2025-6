// Підключення модулів
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";

// Налаштування параметрів командного рядка
const program = new Command();
program
  .requiredOption("-h, --host <string>", "Адреса сервера")
  .requiredOption("-p, --port <number>", "Порт сервера")
  .requiredOption("-c, --cache <path>", "Шлях до директорії кешу");

program.parse(process.argv);

const { host, port, cache } = program.opts();

// Створення директорії кешу, якщо вона відсутня
async function ensureCacheDir() {
  try {
    await fs.mkdir(cache, { recursive: true });
  } catch (err) {
    console.error("Помилка створення директорії кешу:", err);
    process.exit(1);
  }
}

// Створення простого веб-сервера
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Сервер запущено!");
});

//  Запуск сервера
await ensureCacheDir();

server.listen(port, host, () => {
  console.log(`Сервер запущено: http://${host}:${port}`);
  console.log(`Директорія кешу: ${path.resolve(cache)}`);
});
