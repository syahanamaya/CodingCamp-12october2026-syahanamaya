# Requirements Document

## Introduction

To-Do List Life Dashboard adalah halaman web sederhana yang membantu pengguna mengatur aktivitas harian mereka. Dashboard ini menampilkan waktu dan tanggal saat ini, salam berdasarkan waktu, daftar tugas harian (to-do list), pengukur waktu fokus (focus timer) berbasis teknik Pomodoro, dan tautan cepat (quick links) ke situs favorit pengguna. Semua data disimpan di sisi klien menggunakan browser Local Storage API. Dashboard dibangun hanya dengan HTML, CSS, dan Vanilla JavaScript — tanpa framework atau server backend.

---

## Glossary

- **Dashboard**: Halaman web utama yang menampilkan semua widget secara bersamaan.
- **Greeting_Widget**: Komponen yang menampilkan waktu, tanggal, dan salam berdasarkan waktu hari.
- **Clock**: Komponen yang menampilkan waktu dan tanggal saat ini secara real-time.
- **Focus_Timer**: Komponen pengukur waktu hitung-mundur 25 menit untuk sesi fokus kerja.
- **Todo_List**: Komponen pengelola daftar tugas yang memungkinkan pengguna menambah, mengedit, menandai selesai, dan menghapus tugas.
- **Task**: Satu item tugas dalam Todo_List, dengan teks deskripsi dan status selesai/belum.
- **Quick_Links**: Komponen yang menampilkan tombol-tombol tautan ke situs web favorit pengguna.
- **Link**: Satu item tautan dalam Quick_Links, terdiri dari nama tampilan dan URL tujuan.
- **Local_Storage**: Browser Local Storage API yang digunakan untuk menyimpan data Task dan Link secara persisten di sisi klien.
- **Modern_Browser**: Browser terkini yang mendukung ES6+, Local Storage API, dan CSS Flexbox/Grid (Chrome, Firefox, Edge, Safari versi terbaru).

---

## Requirements

### Requirement 1: Tampilan Waktu dan Salam

**User Story:** Sebagai pengguna, saya ingin melihat waktu, tanggal, dan salam yang sesuai saat membuka dashboard, sehingga saya langsung mengetahui konteks waktu dan merasa disambut.

#### Acceptance Criteria

1. THE Clock SHALL menampilkan waktu saat ini dalam format HH:MM:SS (jam 00–23, menit 00–59, detik 00–59) dan memperbarui tampilan tepat setiap 1 detik.
2. THE Clock SHALL menampilkan tanggal saat ini dalam format hari, tanggal bulan tahun menggunakan nama hari dan nama bulan dalam Bahasa Indonesia (contoh: Kamis, 16 Oktober 2026).
3. WHEN waktu saat ini berada di antara pukul 05:00:00 dan 11:59:59, THE Greeting_Widget SHALL menampilkan teks "Selamat Pagi".
4. WHEN waktu saat ini berada di antara pukul 12:00:00 dan 17:59:59, THE Greeting_Widget SHALL menampilkan teks "Selamat Siang".
5. WHEN waktu saat ini berada di antara pukul 18:00:00 dan 20:59:59, THE Greeting_Widget SHALL menampilkan teks "Selamat Sore".
6. WHEN waktu saat ini berada di antara pukul 21:00:00 dan 04:59:59, THE Greeting_Widget SHALL menampilkan teks "Selamat Malam".
7. IF waktu sistem tidak tersedia atau tidak dapat dibaca, THEN THE Clock SHALL menampilkan teks "--:--:--" sebagai pengganti waktu dan THE Greeting_Widget SHALL menampilkan teks "Halo".

---

### Requirement 2: Focus Timer

**User Story:** Sebagai pengguna, saya ingin menggunakan timer 25 menit untuk sesi fokus kerja, sehingga saya dapat bekerja secara terstruktur menggunakan teknik Pomodoro.

#### Acceptance Criteria

1. THE Focus_Timer SHALL menampilkan hitung-mundur dimulai dari 25:00 (dua puluh lima menit nol detik) dalam format MM:SS saat halaman pertama kali dimuat.
2. WHEN halaman dimuat dalam kondisi awal (idle), THE Focus_Timer SHALL menampilkan tombol "Start" dalam kondisi aktif (enabled) dan tombol "Stop" dalam kondisi nonaktif (disabled).
3. WHEN pengguna menekan tombol "Start" saat Focus_Timer dalam kondisi idle, THE Focus_Timer SHALL memulai hitung-mundur dan mengurangi tampilan waktu sebesar satu detik setiap detiknya.
4. WHILE Focus_Timer sedang berjalan, THE Focus_Timer SHALL menonaktifkan tombol "Start" (disabled) sehingga tidak dapat ditekan ulang, dan mengaktifkan tombol "Stop" (enabled).
5. WHEN pengguna menekan tombol "Stop" saat Focus_Timer sedang berjalan, THE Focus_Timer SHALL menghentikan hitung-mundur pada posisi waktu saat ini dan mengaktifkan kembali tombol "Start".
6. WHEN pengguna menekan tombol "Reset" saat Focus_Timer dalam kondisi idle (tidak berjalan), THE Focus_Timer SHALL mengembalikan tampilan waktu ke 25:00 tanpa mengubah status tombol.
7. IF pengguna menekan tombol "Reset" saat Focus_Timer sedang berjalan, THEN THE Focus_Timer SHALL menghentikan hitung-mundur, mengembalikan tampilan waktu ke 25:00, dan mengembalikan tombol ke kondisi awal (Start enabled, Stop disabled).
8. WHEN hitung-mundur mencapai 00:00, THE Focus_Timer SHALL menghentikan hitung-mundur secara otomatis, menampilkan indikator visual yang jelas (contoh: teks berwarna berbeda atau pesan "Sesi Selesai!"), dan membunyikan bunyi notifikasi bawaan browser (jika didukung).

---

### Requirement 3: Pengelolaan Tugas (To-Do List)

**User Story:** Sebagai pengguna, saya ingin menambah, mengedit, menandai selesai, dan menghapus tugas, sehingga saya dapat melacak dan mengelola aktivitas harian saya secara efektif.

#### Acceptance Criteria

1. WHEN pengguna memasukkan teks tugas (1–500 karakter) ke dalam input field dan menekan tombol "Tambah" atau menekan tombol Enter, THE Todo_List SHALL menambahkan Task baru dengan teks tersebut dan status belum selesai ke daftar tugas, lalu mengosongkan input field.
2. IF pengguna mencoba menambah Task dengan input field yang kosong atau hanya berisi spasi, THEN THE Todo_List SHALL menampilkan indikator visual kesalahan pada input field dan tidak menambahkan Task baru.
3. WHEN pengguna menekan tombol edit pada suatu Task, THE Todo_List SHALL menampilkan input field yang dapat diedit dengan teks Task saat ini, serta tombol "Simpan" dan tombol "Batal".
4. WHEN pengguna menekan tombol "Simpan" atau menekan tombol Enter saat dalam mode edit, THE Todo_List SHALL memperbarui teks Task dengan teks yang baru dimasukkan (jika tidak kosong) dan keluar dari mode edit.
5. WHEN pengguna menekan tombol "Batal" atau menekan tombol Escape saat dalam mode edit, THE Todo_List SHALL membatalkan perubahan dan mengembalikan teks Task ke nilai aslinya.
6. WHEN pengguna menekan tombol selesai/centang pada suatu Task yang belum selesai, THE Todo_List SHALL mengubah status Task tersebut menjadi selesai dan menampilkan indikator visual berupa teks dicoret (strikethrough).
7. WHEN pengguna menekan kembali tombol selesai/centang pada Task yang sudah selesai, THE Todo_List SHALL mengubah status Task tersebut kembali menjadi belum selesai dan menghapus indikator visual dicoret.
8. WHEN pengguna menekan tombol hapus pada suatu Task, THE Todo_List SHALL menghapus Task tersebut dari daftar tugas.
9. WHEN Todo_List mengalami perubahan (penambahan, pengeditan, penandaan selesai, atau penghapusan Task), THE Todo_List SHALL menyimpan seluruh daftar Task terbaru ke Local_Storage dengan kunci (key) yang tetap konsisten.
10. WHEN pengguna membuka atau memuat ulang Dashboard, THE Todo_List SHALL memuat dan menampilkan semua Task yang sebelumnya tersimpan di Local_Storage beserta status selesai/belum selesai masing-masing Task.
11. IF Local_Storage tidak tersedia atau operasi penyimpanan gagal, THEN THE Todo_List SHALL tetap berfungsi dalam sesi saat ini dan menampilkan pesan peringatan yang tidak mengganggu (non-blocking) kepada pengguna.

---

### Requirement 4: Quick Links

**User Story:** Sebagai pengguna, saya ingin menyimpan dan mengakses tautan ke situs web favorit saya langsung dari dashboard, sehingga navigasi ke situs yang sering dikunjungi menjadi lebih cepat.

#### Acceptance Criteria

1. WHEN pengguna memasukkan nama tampilan (1–50 karakter) dan URL yang valid (diawali "http://" atau "https://") lalu menekan tombol "Tambah Link", THE Quick_Links SHALL menambahkan Link baru dan menampilkannya sebagai tombol atau kartu yang dapat diklik dengan nama tampilan sebagai labelnya.
2. IF pengguna mencoba menambah Link dengan nama tampilan atau URL yang kosong atau hanya berisi spasi, THEN THE Quick_Links SHALL menampilkan indikator visual kesalahan pada field yang kosong dan tidak menambahkan Link baru.
3. IF pengguna memasukkan URL yang tidak diawali dengan "http://" atau "https://", THEN THE Quick_Links SHALL secara otomatis menambahkan prefiks "https://" pada URL tersebut sebelum menyimpannya.
4. WHEN pengguna menekan tombol atau kartu suatu Link, THE Dashboard SHALL membuka URL tujuan Link tersebut di tab baru browser menggunakan atribut target="_blank".
5. WHEN pengguna menekan tombol hapus pada suatu Link, THE Quick_Links SHALL menghapus Link tersebut dari daftar secara langsung tanpa konfirmasi tambahan.
6. WHEN Quick_Links mengalami perubahan (penambahan atau penghapusan Link), THE Quick_Links SHALL menyimpan seluruh daftar Link terbaru ke Local_Storage dengan kunci (key) yang tetap konsisten.
7. WHEN pengguna membuka atau memuat ulang Dashboard, THE Quick_Links SHALL memuat dan menampilkan semua Link yang sebelumnya tersimpan di Local_Storage.
8. IF Local_Storage tidak tersedia atau operasi pemuatan gagal, THEN THE Quick_Links SHALL menampilkan daftar kosong dan menampilkan pesan peringatan yang tidak mengganggu (non-blocking) kepada pengguna.

---

### Requirement 5: Struktur dan Kompatibilitas Teknis

**User Story:** Sebagai pengembang, saya ingin dashboard dibangun dengan HTML, CSS, dan Vanilla JavaScript tanpa framework atau backend, sehingga mudah di-deploy dan digunakan langsung dari file lokal maupun browser.

#### Acceptance Criteria

1. THE Dashboard SHALL dibangun hanya menggunakan satu file HTML (index.html), satu file CSS (di dalam folder `css/`), dan satu file JavaScript (di dalam folder `js/`), tanpa library atau framework eksternal.
2. THE Dashboard SHALL dapat dimuat dan berfungsi penuh pada Modern_Browser yang didefinisikan sebagai: Chrome 90+, Firefox 88+, Edge 90+, dan Safari 14+, tanpa memerlukan server backend atau proses build.
3. WHEN halaman Dashboard dimuat di Modern_Browser, THE Dashboard SHALL menampilkan keempat widget (Greeting_Widget, Focus_Timer, Todo_List, Quick_Links) dalam kondisi siap digunakan dalam waktu kurang dari 3 detik pada koneksi lokal (file://).
4. THE Dashboard SHALL menyimpan dan membaca semua data persisten (Task dan Link) menggunakan Local_Storage API tanpa melakukan komunikasi jaringan eksternal apa pun.
5. THE Dashboard SHALL menampilkan layout yang dapat dibaca dan digunakan pada lebar layar mulai dari 320px (mobile) hingga 1920px (desktop wide), dengan semua widget tetap terlihat tanpa horizontal scrolling.
6. IF Local_Storage tidak tersedia pada browser yang digunakan, THEN THE Dashboard SHALL menampilkan pesan peringatan satu kali kepada pengguna bahwa data tidak akan tersimpan secara persisten.
