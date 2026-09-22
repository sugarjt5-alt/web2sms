# WEB2SMS

Bulk SMS илгээх систем. Next.js + Express + PostgreSQL + Redis (BullMQ) + Docker.

## Stack

| Давхарга      | Технологи                          |
|---------------|-------------------------------------|
| Frontend      | Next.js (App Router, JavaScript)    |
| Backend       | Node.js + Express                   |
| Database      | PostgreSQL                          |
| Queue         | Redis + BullMQ                      |
| SMS Provider  | Mock (одоо) → Mobicom API (дараа)   |
| Deployment    | Docker / docker-compose             |
| CI/CD         | GitHub Actions                      |

## Архитектур

```
User → Next.js → Express API → PostgreSQL
                       ↓
                  Redis Queue (BullMQ)
                       ↓
                  SMS Worker
                       ↓
              Mock SMS / Mobicom API
                       ↓
                    Receiver
```

`POST /api/messages/send` дуудагдмагц backend нь:
1. `messages` мөр үүсгэж, `message_recipients` мөрүүдийг (хүлээн авагч бүрд) `pending` статустай үүсгэнэ.
2. Хүлээн авагч тус бүрийг тусдаа **job** болгож Redis Queue-д тавина.
3. `sms-worker` эдгээр job-уудыг зэрэгцээ (concurrency: 5) боловсруулж, `sms.service.js`-ээр илгээгээд, статусыг `sent`/`failed` болгож бааздаа бичнэ.
4. Бүх recipient дууссаны дараа `messages.status` нь `sent` / `partial` / `failed` болж шинэчлэгдэнэ.

## Хурдан эхлэх (Docker)

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api
- PostgreSQL: localhost:5432 (schema.sql автоматаар ачаалагдана)
- Redis: localhost:6379

## Локал хөгжүүлэлт (Docker-гүйгээр)

### 1. PostgreSQL + Redis асаах (доор нь Docker ашиглаж болно эсвэл өөрөө суулгасан байж болно)
```bash
docker compose up postgres redis
```

### 2. Backend
```bash
cd backend
cp .env.example .env
npm install
npm run dev          # API server, PORT=5000
```
Өөр terminal-д worker-ийг тусад нь асаана:
```bash
npm run worker:dev   # SMS worker (Redis queue-г сонсоно)
```

### 3. Frontend
```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev           # http://localhost:3000
```

## Анхны хэрэглэгч

Хамгийн эхэлж бүртгүүлсэн хэрэглэгч автоматаар `admin` role авна (`auth.controller.js` дахь bootstrap логик). Дараагийн бүх бүртгэл `user` role-той байна. Admin `/api/admin/users` endpoint-оор бусад хэрэглэгчийн role-ийг өөрчилж болно.

## MVP checklist

- [x] Login / Register (JWT)
- [x] Dashboard (статистик)
- [x] Contact нэмэх
- [x] Contact group үүсгэх
- [x] SMS бичих (compose)
- [x] Bulk SMS илгээх (contacts эсвэл group-оор)
- [x] SMS history
- [x] Sent / Failed status (per recipient + нийт)
- [x] Admin / User role
- [x] Mock SMS provider (Mobicom-руу шилжих бэлэн `sms.service.js`)

## Mobicom API-руу шилжих

`backend/src/services/sms.service.js` доторх `sendViaMobicom()` функцийг Mobicom-ийн SMS Gateway-ийн бодит spec-ээр бөглөөд, `.env` дэх:

```
SMS_PROVIDER=mobicom
MOBICOM_API_URL=<бодит URL>
MOBICOM_API_KEY=<бодит key>
```

гэж солиход өөр ямар ч код өөрчлөх шаардлагагүйгээр систем даруй Mobicom ашиглаж эхэлнэ (worker болон controller-үүд `sms.service.js`-ийн интерфэйсээр л ажилладаг тул).

## Дараагийн шат (MVP-ээс хойш)

- Refresh token / logout blacklist
- Rate limiting (per user SMS quota)
- CSV-ээр contact import хийх
- SMS template-ууд
- WebSocket-оор realtime status (polling-ийг солих)
- Unit / integration тестүүд, CI дээр бодитоор ажиллуулах
