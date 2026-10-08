# Hermes Horeca — Cloudflare Workers AI

FLUX.2 klein 4B reklama maketi (1024×1280), Llama 3.3 o‘zbekcha tahririy post matni.
Uch xil kompozitsiya: iliq restoran, ko‘k studiya, to‘q yashil jurnal uslubi.
Sarlavha va Hermes Horeca yozuvi bot tomonidan DejaVu Sans Bold shriftida alohida tasmalarga chiziladi. AI faqat mahsulot fotosini yaratadi. Matn mazmunini admin tekshiradi.
Matn 1000 belgidan oshsa faktlarga asoslangan oddiy shablonga qaytiladi.
Rasm yuborilsa namuna sifatida ishlatiladi; rasmsiz /new tavsifdan rasm yaratadi.
AI mahsulot ko‘rinishini o‘zgartirishi mumkin — admin tekshiradi.
Kuniga 5 ta generatsiya urinishi, UTC 00:00 (Toshkent 05:00) da yangilanadi.
Cloudflare Workers AI bepul kvotasi hisob bo‘yicha umumiy; boshqa ilovalar ham
sarflashi mumkin. Kvota yoki xizmat xatosida original rasm yangi AI rasm sifatida
yuborilmaydi. Pullik tarifga avtomatik o‘tish va OpenAI API yo‘q.
AI binding wrangler orqali ulanadi. Boshqa sozlamalar o‘zgarmaydi.

## Ishlatish
- Botga `/start` yuboring.
- Mahsulot rasmini `/add Nomi | aniq tavsif` izohi bilan yuboring (900 belgigacha).
- `/auto` katalogdan postni adminga ko‘rsatadi.
- Rasm + oddiy izoh darhol loyiha tayyorlaydi.
- `/new Nomi | tavsif` AI rasmli loyihani tayyorlaydi.
- Tasdiqlash kanalga yuboradi; rad etish yubormaydi.
- Matnni o‘zgartirish tayyor matnni qabul qiladi (1000 belgigacha).
- Yangi AI rasm tugmasi yangi rasm yaratadi.
- Dushanba va payshanba 10:00 Toshkent vaqti katalogdan navbat bilan loyiha tayyorlanadi.
- `/products`, `/remove ID`, `/drafts`, `/show ID`, `/cancel` qo‘llab-quvvatlanadi.

## Cloudflare
Workers + D1 + Workflows. GitHub main orqali `npm run check`, `npm run deploy`.
Bepul platforma limitlari amal qiladi; cheksiz xizmat kafolati emas.
Runtime secrets: TELEGRAM_BOT_TOKEN, ADMIN_USER_ID, WEBHOOK_SECRET, SETUP_SECRET.
CHANNEL_ID: @HermesHoreca. WEBHOOK_SECRET 32–256 lotin harfi/raqam/_/-;
SETUP_SECRET kamida 32 belgi, boshqa parol bo‘lsin.
Bot kanalda post yuborish huquqiga ega admin bo‘lishi kerak.
/setup sahifasida SETUP_SECRET orqali ulash, /id orqali admin raqamini olish.
Mavjud o‘rnatishda qayta setup kerak emas. OPENAI_API_KEY kerak emas.

## Tekshirish
`npm test` va `npm run check`.
Tasdiqlash atomik; eskirgan tugmalar bloklanadi. Noma’lum yuborish natijasi
uncertain holatiga o‘tadi va avtomatik takrorlanmaydi. Kanalni qo‘lda tekshiring.
