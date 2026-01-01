# Acme Project

Bu proje Next.js tabanlı bir frontend ve Python tabanlı bir backend'den oluşmaktadır.

## Kurulum ve Çalıştırma

Projeyi tam fonksiyonel olarak kullanabilmek için hem backend hem de frontend servislerinin çalışıyor olması gerekmektedir.

### 1. Backend (Sunucu)

Backend servisi veri işleme ve sorgu motorunu barındırır. Python ortamında çalışır.

Terminalde `backend` klasörüne gidin ve aşağıdaki komutları çalıştırın:

```bash
cd backend

# Gerekli Python paketlerini yükleyin (uv kurulu varsayılmaktadır)
uv pip install -r requirements.txt

# Sunucuyu başlatın
uv run run_server.py
```

Başarılı olduğunda `StreamFlightServer listening on grpc://0.0.0.0:8815` mesajını görmelisiniz.

### 2. Frontend (Arayüz)

Kullanıcı arayüzü Next.js ile geliştirilmiştir.

Yeni bir terminal açın, `frontend` klasörüne gidin ve aşağıdaki komutları çalıştırın:

```bash
cd frontend

# Gerekli Node modüllerini yükleyin
npm install

# Geliştirme sunucusunu başlatın
npm run dev
```

Uygulamaya tarayıcınızdan [http://localhost:3000](http://localhost:3000) adresine giderek erişebilirsiniz.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
