# Hermes Horeca Content Agent — Cloudflare

Telegram bot: @HermesHorecabot. Kanal: @HermesHoreca.

Mahsulot rasmi va tavsifidan reklama rasmi + o‘zbekcha matn tayyorlaydi. Rasmsiz so‘rov ham mumkin. Dushanba/payshanba 10:00 Toshkent vaqti katalogdan post tayyorlaydi. **Faqat admin ✅ Tasdiqlash bosgandan keyin kanalga yuboradi.**

## 1. GitHub’ga yuklash

ZIP’ni kompyuterda oching (Extract All). Ichidagi `src`, `tests`, `package.json`, `package-lock.json`, `wrangler.jsonc`, README.md fayllarini repo asosiy sahifasiga **Add file → Upload files** orqali yuklang. ZIP’ning o‘zini yuklamang. `package.json` repo ildizida bo‘lsin. Commit changes.

Hech qanday haqiqiy token bu paketda yo‘q. Ochiq repoga kalit yoki `.env` yuklamang.

## 2. Cloudflare’da GitHub’dan deploy

Workers & Pages → Create application → Import a repository → `bekzodkomilov/hermes-content-agent`.

- Worker/project name: `hermes-content-agent`
- Production branch: `main`
- Root directory: repo ildizi (bo‘sh yoki `/`)
- Build command: `npm run check`
- Deploy command: `npm run deploy`

Wrangler D1 bazasini birinchi deployda avtomatik yaratadi. Workflows va haftalik Cron konfiguratsiyada bor. **Workers** loyihasini tanlang, statik Pages emas.

Agar build D1 ruxsati/provisioning xatosi bersa: Cloudflare’da D1 → Create database → `hermes-content-db`; Database ID’ni `wrangler.jsonc` dagi `d1_databases` obyektiga `"database_id":"olingan-UUID"` qilib qo‘shing. Bu ID maxfiy token emas. Keyin qayta deploy qiling. D1 jadvalini keyingi `/setup` qadami yaratadi.

## 3. Maxfiy sozlamalar

Worker → Settings → Variables and Secrets. Quyidagilarni **Secret** qilib kiriting va Deploy/Save qiling:

| Nomi | Qiymati |
|---|---|
| TELEGRAM_BOT_TOKEN | BotFather’dan @HermesHorecabot tokeni |
| OPENAI_API_KEY | Rasm yaratish huquqi va API balansi mavjud OpenAI API kaliti |
| WEBHOOK_SECRET | O‘zingiz yaratgan tasodifiy 32–64 belgi: harf, raqam, `_`, `-` |
| SETUP_SECRET | WEBHOOK_SECRET’dan boshqa kuchli tasodifiy 32–64 belgili ulash paroli |
| ADMIN_USER_ID | Sizning raqamli Telegram ID; quyidagi qadamdan so‘ng qo‘shsa bo‘ladi |

Parollarni password manager generatori orqali yarating. Ularni chatga yoki GitHub’ga yozmang. ChatGPT Plus obunasi OpenAI API xarajatini qoplamaydi.

`CHANNEL_ID`, `TEXT_MODEL`, `IMAGE_MODEL`, `BRAND_FACTS` oddiy sozlamalari `wrangler.jsonc` ichida. Keyingi GitHub deploy ularni konfiguratsiyadan oladi; o‘zgartirish kerak bo‘lsa shu faylda tahrirlang. Mahsulot narxi, aloqa yoki boshqa faktlar faqat tasdiqlangan ma’lumot bo‘lsa qo‘shilsin.

## 4. Botni ulash

1. Bot kanal administratori bo‘lsin; **Post Messages** huquqi yoqilgan bo‘lsin.
2. Deploydan chiqqan `https://hermes-content-agent.…workers.dev/setup` sahifasini oching.
3. SETUP_SECRET parolini kiriting, **Telegram bilan ulash** ni bosing. Baza tayyorlanadi va webhook o‘rnatiladi. Avvalgi server shu bot tokeni bilan polling ishlatayotgan bo‘lsa, uni to‘xtating.
4. Telegram’da @HermesHorecabot ni oching, Start bosing, `/id` yuboring.
5. Raqamni Cloudflare’da `ADMIN_USER_ID` secretiga yozing. Save/Deploy.
6. Botga `/start` yuboring.
7. Mahsulot rasmini `/add Burger noni | 1 qutida 48 dona` kabi **haqiqiy tavsif** bilan yuboring.
8. `/auto` yuboring. Preview kelgach matn va rasmni tekshirib, xohlasangiz tasdiqlang. Birinchi tasdiq kanalga haqiqiy post yuboradi.

Cron faqat katalogdan foydalanadi. Katalog bo‘sh bo‘lsa mahsulot uydirmaydi, adminni ogohlantiradi. Rasm bo‘lmasa, matndagi ma’lumot asosida illustrativ reklama rasmi yaratadi.

## Buyruqlar

- Rasm + tavsif: darhol yangi loyiha tayyorlash (katalogga avtomatik qo‘shilmaydi).
- `/add Nomi | tavsif`: rasm izohida yuborilsa rasmni ham katalogga saqlaydi; oddiy xabar sifatida ham ishlaydi.
- `/new Mahsulot tavsifi`: rasmsiz loyiha yaratish.
- `/auto`: katalogdan navbatdagi mahsulot uchun loyiha.
- `/products`, `/remove ID`: katalog.
- `/drafts`, `/show ID`: saqlangan loyihalar va holat.
- `/cancel`: boshlangan matn tahririni bekor qilish.
- `/id`: faqat so‘rovchining o‘z Telegram ID sini ko‘rsatadi.
- **✏️ Matnni o‘zgartirish**: yangi tayyor matnni yuboring, so‘ng yana tasdiqlang.
- **🎨 Qayta rasm**: shu mahsulot uchun yangi rasm va matn yaratadi; yana tasdiqlash kerak.

## Ishlash va cheklovlar

Kompyuter yoqilib turishi shart emas. Telegram webhook va Cron Cloudflare’da ishga tushadi; doim ishlab turadigan Python process kerak emas. Cloudflare Free limitlari amal qiladi, cheksiz yoki kafolatlangan uptime emas. OpenAI rasm/matn generatsiyasi alohida pullik. Rasm quality=low; modelni va sifatni koddan o‘zgartirish mumkin.

Workflow uzoq AI javobini kutadi. D1 katalog/loyihalar/ishga tushgan vazifalarni saqlaydi. Tayyor rasmlar Telegram `file_id` orqali qayta ishlatiladi; boshqa bot tokeniga o‘tsangiz rasmlarni qayta yuklash kerak bo‘lishi mumkin. AI mahsulot yorlig‘ini aynan saqlashiga kafolat yo‘q — tasdiqlashdan oldin tekshiring.

Duplicate update va ikki marta tasdiqlash DB orqali himoyalangan; eski tahrir tugmalari ishlamaydi. Tarmoq uzilib post ketgani noma’lum bo‘lsa `uncertain`, keskin server uzilishida `publishing` qolishi mumkin. **Bunday holatda avval kanalni tekshiring**; bot avtomatik qayta yubormaydi. `generating` holati uzoq qolsa Cloudflare Workflows’da vazifani tekshiring. Crashda avtomatik AI qayta urinish o‘chirilgan: keraksiz to‘lov va duplicate postdan saqlash uchun qo‘lda yangi so‘rov yuboriladi.

Matn tahririda yangi matn aynan ishlatiladi. Rasmlar Telegram’ning oddiy Photo formati orqali yuborilsin; albomdagi har bir rasm alohida so‘rov. Hozir bitta admin qo‘llanadi.

## Dasturchi uchun

Node.js 22+ tavsiya. `npm ci`, `npm test`, `npm run check`. `npm run dev` lokal rivojlantirish uchun. Secrets lokal `.dev.vars` faylida berilishi mumkin, Git’ga commit qilinmasin.

SQLite testlari admin nazorati, persistent deduplication, parallel approval, stale revision va noaniq yuborish holatini tekshiradi. Tashqi API testlari mock; haqiqiy Telegram/OpenAI kalitlari bilan deploydan keyin sinov kerak.

Manbalar: [Cloudflare Workflows](https://developers.cloudflare.com/workflows/build/workers-api/), [avtomatik D1 provisioning](https://developers.cloudflare.com/changelog/post/2025-10-24-automatic-resource-provisioning/), [Cron](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [Telegram Bot API](https://core.telegram.org/bots/api), [OpenAI image edits](https://developers.openai.com/api/reference/resources/images/methods/edit).
