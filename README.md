# Safety-Count

SafetyCount คือระบบบริหารความปลอดภัยและการเช็คชื่อพนักงานสำหรับใช้งานภายในองค์กร โดยมีทั้งส่วนจัดการพนักงาน, การเช็คชื่อรายวัน, การตรวจสอบกับข้อมูลแตะบัตร และการแจ้งเตือนผ่านอีเมล

## 1) วัตถุประสงค์ของระบบ

- เก็บข้อมูลพนักงานที่ต้องติดตามด้านความปลอดภัย
- บันทึกสถานะการมาทำงานรายวัน (Present / Absent)
- ตรวจสอบข้อมูลเช็คชื่อเทียบกับไฟล์แตะบัตรจากระบบภายนอก
- สรุปผลและรายงานข้อมูลเพื่อการตัดสินใจอย่างรวดเร็ว
- รองรับกรณีวันหยุด และการตั้งค่าวันทำงานแบบยืดหยุ่น

## 2) โครงสร้างโครงการ

- safetycount-web: Frontend (React + Vite)
- SafetyCount.Api: Backend API (ASP.NET Core .NET 9 + EF Core + SQL Server)
- SafetyCount.Api.Tests: Unit Tests ของฝั่ง API
- SafetyCount.slnx: Solution ของโปรเจค

## 3) เทคโนโลยีหลัก

### Frontend

- React 19
- Vite 8
- React Router
- Tailwind CSS
- ESLint

### Backend

- ASP.NET Core .NET 9
- Entity Framework Core 9
- SQL Server
- OpenAPI + Scalar API reference

## 4) ฟีเจอร์หลัก

### 4.1 Employee Management

- เพิ่ม / ลบ / เรียกดูพนักงานจากฐานข้อมูลภายใน
- รองรับการดึงรายชื่อจาก Employee API ภายนอก
- ตั้งค่านโยบายการลงเวลา (Attendance Policy) ต่อคนได้

### 4.2 Attendance Management

- แสดง Attendance รายวัน และตารางแบบสัปดาห์
- สลับสถานะ Present / Absent รายบุคคล
- ตั้งค่า Working Day / Holiday รายวันได้ (override ได้)
- วันอนาคตในสัปดาห์แสดงเป็นสถานะอ่านอย่างเดียว

### 4.3 Monthly Pivot / History

- สรุปข้อมูลในมุมมองรายเดือน
- ดูสถิติย้อนหลังตามช่วงวันที่ต้องการ

### 4.4 Badge Cross-Check

- รองรับการอัปโหลดไฟล์แตะบัตรเพื่อตรวจสอบกับ Attendance
- รองรับการอ่านไฟล์จาก network share

### 4.5 Notification

- ส่งอีเมลแจ้งเตือนจากระบบ
- ส่งอีเมลพร้อมตาราง Attendance
- รองรับ flow ตรวจ Badge แล้วส่งอีเมลในขั้นตอนเดียว

## 5) กติกาธุรกิจ: Manager vs Regular Employee

ระบบใช้ field `RequiresBadgeSwipe` เพื่อกำหนดรูปแบบการเช็คชื่อ

- Manager / Administrative Staff (`RequiresBadgeSwipe = false`)
	- ไม่ต้องแตะบัตรเข้าทำงาน
	- ระบบตั้งต้นเป็น Present อัตโนมัติในวันทำงาน
	- สถานะถูกล็อก ไม่อนุญาตให้แก้ไขผ่านหน้าจอ Attendance

- Regular Employee (`RequiresBadgeSwipe = true`)
	- ต้องแตะบัตรเข้าทำงาน
	- สถานะสามารถปรับเป็น Present / Absent ได้ตามการตรวจสอบ

ผลลัพธ์คือผู้ใช้งานเห็นนิยามตรงกับการใช้งานจริง: ผู้จัดการไม่ต้องแตะบัตร ส่วนพนักงานทั่วไปต้องแตะบัตร

## 6) API สำคัญ (ตัวอย่าง)

### Attendance

- GET /api/attendance/{date}
- PUT /api/attendance/{date}/{employeeId}
- GET /api/attendance/history?from=yyyy-MM-dd&to=yyyy-MM-dd
- GET /api/attendance/working-days?from=yyyy-MM-dd&to=yyyy-MM-dd
- PUT /api/attendance/working-days/{date}

### Employees

- GET /api/employees
- POST /api/employees
- PATCH /api/employees/{id}/badge-requirement
- DELETE /api/employees/{id}
- GET /api/employees/external

### Notifications

- POST /api/notifications/email
- POST /api/notifications/crosscheck-share-and-email

## 7) วิธีเริ่มใช้งานในเครื่องพัฒนา

### 7.1 เตรียมเครื่อง

- ติดตั้ง .NET SDK 9
- ติดตั้ง Node.js LTS
- ติดตั้ง SQL Server ที่เข้าถึงได้

### 7.2 Backend

1. เข้าโฟลเดอร์ SafetyCount.Api
2. ตั้งค่า ConnectionStrings และ Options ใน appsettings
3. รันคำสั่ง migration/update database
4. รัน API

ตัวอย่างคำสั่ง:

```powershell
cd SafetyCount.Api
dotnet restore
dotnet ef database update
dotnet run
```

### 7.3 Frontend

1. เข้าโฟลเดอร์ safetycount-web
2. ติดตั้ง package
3. รัน dev server

ตัวอย่างคำสั่ง:

```powershell
cd safetycount-web
npm install
npm run dev
```

## 8) การตรวจคุณภาพโค้ด

### Frontend Lint

```powershell
cd safetycount-web
npx eslint . --format stylish
```

### Backend Build

```powershell
cd SafetyCount.Api
dotnet build --no-restore -v quiet
```

### Backend Tests

```powershell
cd SafetyCount.Api.Tests
dotnet test
```

## 9) หมายเหตุด้านความปลอดภัย

- ไม่ควรเก็บรหัสผ่านหรือ connection string จริงไว้ใน source control
- ควรย้ายค่าลับไปที่ environment variable, secret manager หรือระบบจัดการความลับขององค์กร
- จำกัดสิทธิ์การเข้าถึง network share และ mail service ตามหลัก least privilege

## 10) แนวทางพัฒนาต่อ

- เพิ่ม role-based authorization ใน endpoint สำคัญ
- เพิ่ม integration tests สำหรับ business flow หลัก
- เพิ่ม monitoring และ structured logging สำหรับ production
- เพิ่มเอกสาร deployment แยกตามสภาพแวดล้อม (DEV/UAT/PROD)
