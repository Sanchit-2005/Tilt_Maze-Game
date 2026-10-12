# Tilt Maze

## Install and run

From the repository root:

```text
cd backend
npm install
npm start
```

Open the game at `http://localhost:5000/` and the admin page at `http://localhost:5000/admin` (the port can be changed with `PORT`).

## Admin credentials

Admin login uses the existing backend API. The `Admin` collection stores a bcrypt password hash. Keep the plaintext provisioning values only in the ignored `backend/.env` file:

Edit `backend/.env` to add `ADMIN_EMAIL` and `ADMIN_PASSWORD`, then run:

```text
cd backend
npm run create-admin
```

Do not commit `backend/.env`. The admin page sends the email and password to the same-origin `/api/admin/login` endpoint and stores only the short-lived JWT session in `sessionStorage`.

## Storage limitations

Scores still use `localStorage`, so they exist only in the same browser and origin and can be edited locally. Admin authentication is server-backed, but it does not make local leaderboard scores tamper-resistant.

Live Server on port 5500 has a different origin and therefore a separate localStorage. Run the game from `http://localhost:5000/` (or your configured `PORT`) when you want the game and `/admin` to see the same scores.
