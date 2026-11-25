# MediX frontend

React frontend for the separate MediX backend. Start the backend first from `../MediX` with `docker compose up -d --build`, then start this project with `docker compose up -d --build`. Open http://localhost:3000. The standalone frontend container proxies `/api` to the backend gateway at host port 8080.

For local development, run `npm install` and `npm run dev` in this directory. Vite proxies `/api` to http://localhost:8080.
