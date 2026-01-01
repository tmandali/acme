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
