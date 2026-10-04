FROM node:20-slim

# node:20-slim ships without OpenSSL, so Prisma can't detect which
# engine binary to use and silently guesses (see the "Prisma failed to
# detect the libssl/openssl version" build warning). That guess isn't
# always right, and when it's wrong the failure shows up later, as a
# startup crash, not a build error — installing openssl explicitly
# removes the guesswork.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# Copy the lockfile too so the image installs the exact, audited
# dependency versions (package.json alone lets npm re-resolve them).
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate && npm run build
EXPOSE 4000
ENV NODE_ENV=production
# Run as the unprivileged "node" user that the official image provides,
# not root — a compromised process then can't modify the image's files.
RUN chown -R node:node /app
USER node
# `npm start` applies pending Prisma migrations first (see package.json),
# so a fresh database never boots into "table does not exist" errors —
# and the same holds on Render's Node runtime, not just Docker.
CMD ["npm", "start"]
