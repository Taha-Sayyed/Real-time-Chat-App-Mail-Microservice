# Real-time Chat App — Mail Microservice
Asynchronous email notification worker for a real-time chat application. Consumes RabbitMQ events and sends emails via Gmail SMTP.
This service has no public API. It runs as a background worker, listening to a RabbitMQ queue for OTP email requests published by the User service during login

---

## How It Works
1. **User Service** publishes a message to the `send-otp` queue when a user logs in
2. **Mail Service** consumes the message from RabbitMQ
3. **Nodemailer** sends the OTP via Gmail SMTP to the user's email address

---

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22 (Alpine) |
| Language | TypeScript 6.x |
| Message Broker | RabbitMQ (AMQP) |
| Email | Nodemailer |
| Container | Docker multi-stage build |
| Cloud | AWS ECS Fargate |

---

## Project Structure
```text
backend/mail/
├── src/
│   ├── consumer.ts          # RabbitMQ consumer logic
│   └── index.ts             # Entry point: starts HTTP health server + consumer
├── dockerignore             # docker ignore file
├── Dockerfile               # Multi-stage production build
├── docker-compose.yml       # Local development (connects to shared network)
├── package.json
└── tsconfig.json
```

## Local Development
This service requires a running RabbitMQ instance

###### Start Mail service
```text
cd backend/mail
docker-compose up --build
```