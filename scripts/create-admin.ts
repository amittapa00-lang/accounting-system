import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL ?? "file:./dev.db";

const adapter = new PrismaBetterSqlite3({
  url: connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  const username = "admin";
  const password = "admin1234";
  const name = "Administrator";

  const hashedPassword = await bcrypt.hash(password, 10);

  const existingUser = await prisma.user.findUnique({
    where: {
      username,
    },
  });

  if (existingUser) {
    console.log("Admin user already exists.");
    return;
  }

  const user = await prisma.user.create({
    data: {
      username,
      password: hashedPassword,
      name,
      role: "ADMIN",
      isActive: true,
    },
  });

  console.log("Admin user created successfully.");
  console.log("Username:", user.username);
  console.log("Role:", user.role);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });