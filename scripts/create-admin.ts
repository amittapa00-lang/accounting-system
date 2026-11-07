/**
 * Creates an ADMIN user, or resets the password of an existing one.
 *
 *   npm run create-admin -- <username> <password>
 *   ADMIN_USERNAME=admin ADMIN_PASSWORD=... npm run create-admin
 *
 * There is no built-in default password on purpose.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";

import { prisma } from "../lib/prisma";

const MIN_PASSWORD_LENGTH = 8;

async function main() {
  const [argUsername, argPassword] = process.argv.slice(2);
  const username = (argUsername ?? process.env.ADMIN_USERNAME ?? "").trim();
  const password = argPassword ?? process.env.ADMIN_PASSWORD ?? "";

  if (!username || !password) {
    console.error("Usage: npm run create-admin -- <username> <password>");
    console.error("   or: set ADMIN_USERNAME and ADMIN_PASSWORD");
    process.exit(1);
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({ where: { username } });

  if (existing) {
    await prisma.user.update({
      where: { username },
      data: { password: hashedPassword, role: "ADMIN", isActive: true },
    });
    console.log(`Password reset for existing user "${username}" (role ADMIN).`);
    return;
  }

  await prisma.user.create({
    data: {
      username,
      password: hashedPassword,
      name: "Administrator",
      role: "ADMIN",
      isActive: true,
    },
  });

  console.log(`Admin user "${username}" created.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
