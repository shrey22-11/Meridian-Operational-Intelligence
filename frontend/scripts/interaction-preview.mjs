// Local UI verification only; never used by the production build.
import { createServer } from "vite";
const apiOrigin = process.argv[2];
if (!apiOrigin || !/^https:\/\//.test(apiOrigin)) throw new Error("Supply the public HTTPS API origin as the first argument.");
const server = await createServer({ server: { host: "127.0.0.1", port: 5173, strictPort: true, proxy: { "/api": { target: apiOrigin, changeOrigin: true, secure: true } } } });
await server.listen();
server.printUrls();
