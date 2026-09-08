import { PrismaClient } from "@prisma/client";

// Reuse a single PrismaClient across dev hot-reloads.
export const prisma = new PrismaClient();
