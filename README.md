# Hermes Horeca content bot — shablon rejimi

Pullik AI API ishlatilmaydi. Bot yuborilgan original rasmlarni ishlatadi,
berilgan faktlardan oddiy matn shabloni tayyorlaydi. Yangi rasm yaratmaydi.

## Ishlatish
- Botga `/start` yuboring.
- Mahsulot rasmini `/add Nomi | aniq tavsif` izohi bilan yuboring (900 belgigacha).
- `/auto` katalogdan postni adminga ko‘rsatadi.
- Rasm + oddiy izoh darhol loyiha tayyorlaydi.
- `/new Nomi | tavsif` rasmsiz matn loyihasini tayyorlaydi.
- Tasdiqlash kanalga yuboradi; rad etish yubormaydi.
- Matnni o‘zgartirish tayyor matnni qabul qiladi (1000 belgigacha).
- Shablon matni tugmasi dastlabki faktlardan matnni qayta tiklaydi.
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
