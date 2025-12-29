# SQL Sorgu Paneli Filtre ve Kriter Kullanım Kılavuzu

Bu doküman, SQL Query platformunda kriterlerin (variables) ve akıllı filtrelerin nasıl kullanılacağını açıklar.

## 1. Temel Değişken Kullanımı

Sorgu içinde bir kriteri kullanmak için `{{ VARIABLE_NAME }}` yazımı kullanılır.

*   **Doğrudan Değer:** `SELECT * FROM sales WHERE amount > {{ MIN_AMOUNT }}`
*   **SQL Formatlı Değer:** `{{ VARIABLE_NAME | sql }}` (Metinleri otomatik tırnak içine alır, boş ise NULL yazar).

---

## 2. Akıllı Filtre Fonksiyonları

Akıllı filtreler, kolon adını ve operatörü otomatik yönetir. Kolon adı belirtilmezse değişkenin kendi adını kolon adı olarak kabul eder.

### `eq` (Eşittir / IN)
Tekli seçimlerde `=`, çoklu seçimlerde `IN` yapısı kurar. 
*   `{{ CATEGORY | eq }}` → `CATEGORY = 'Elektronik'`
*   `{{ CATEGORY | eq('p.cat_id') }}` → `p.cat_id = 'Elektronik'`
*   `{{ CATEGORY | eq }}` (Çoklu seçimse) → `CATEGORY IN ('A', 'B')`

### `ne` (Eşit Değildir / NOT IN)
*   `{{ STATUS | ne }}` → `STATUS <> 'DELETED'`

### `gt`, `gte`, `lt`, `lte` (Kıyaslama)
*   `{{ SEATS | gte }}` → `SEATS >= 10`
*   `{{ PRICE | lt('p.base_price') }}` → `p.base_price < 1000`

### `like` (Benzerlik)
Değeri otomatik `%` işaretleri arasına alır.
*   `{{ USER_NAME | like }}` → `USER_NAME LIKE '%ahmet%'`

### `between` (Aralık)
Aralık (range) tipindeki kriterler için kullanılır.
*   `{{ DATE_RANGE | between }}` → `DATE_RANGE BETWEEN '20240101' AND '20240131'`

---

## 3. Tarih ve Zaman Fonksiyonları

Sistem içinde bugünün tarihine ve bağıl tarihlere erişim için özel kısayollar bulunur.

### Kriter Varsayılan Değerlerinde Kullanım
Kriter ayarlarındaki "Varsayılan Değer" alanına şunları yazabilirsiniz:
*   `{{now}}` : Bugünün tarihi (`YYYYMMDD`)
*   `{{now}} -1d` : Dün
*   `{{now}} +1w` : 1 hafta sonrası
*   `{{now}} -1m` : 1 ay öncesi

### SQL İçinde Kullanım
*   `{{ now | add_days(-7) }}` : Sorgu içerisinde tarihten gün ekleyip çıkarmak için kullanılır.

---

## 4. Gelişmiş Özellikler

### Boşken Yazılacak Değer (emptyValue)
Kriter ayarlarında bir "Boşken Yazılacak Değer" tanımlanırsa, kullanıcı kriteri boş bıraktığında filtre yerine o ifade yazılır.
*   Örn: `1=1` yazarsanız, kriter boşken sorgu bozulmaz ve tüm kayıtlar gelir.
*   Örn: `{{ field }} IS NULL` yazarsanız, boş bırakıldığında o kolonun NULL olduğu kayıtlar gelir.

### Kısaltılmış Yazım (Shorthand)
Eğer kolon adınız değişken adıyla aynıysa şunlar aynı sonucu verir:
*   `{{ SEATS | eq }}` (Önerilen)
*   `{{ SEATS('SEATS') | eq }}`

### Tarih Aralıklarında Başlangıç/Bitiş Ayırma
`between` tipi bir kriterin içindeki değerlere ayrı ayrı erişebilirsiniz:
*   Başlangıç: `{{ DATE_VAR | start }}`
*   Bitiş: `{{ DATE_VAR | end }}`
