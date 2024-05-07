const express = require('express');
const { MongoClient } = require('mongodb');
const xlsx = require('xlsx'); // สำหรับสร้างไฟล์ Excel
const WebSocket = require('ws'); // สำหรับ WebSocket
const axios = require('axios'); // สำหรับเชื่อมต่อกับ API
const path = require('path'); // สำหรับจัดการเส้นทางไฟล์

const url = 'mongodb://localhost:27017'; // URL ของ MongoDB
const dbName = 'Nut'; // ชื่อฐานข้อมูล
const collectionName = 'Building9'; // ชื่อคอลเลกชัน
const weatherApiKey = '2d2eb45b08fd234543ff7908ecafe1f9'; // คีย์ API สำหรับสภาพอากาศ
const weatherLocation = 'Phitsanulok,TH'; // สถานที่สำหรับข้อมูลสภาพอากาศ

const app = express(); // สร้างแอป Express
const PORT = process.env.PORT || 3000; // กำหนดพอร์ต

// ให้บริการไฟล์สถิตจากโฟลเดอร์ 'public'
app.use(express.static(path.join(__dirname, 'public'))); // เสิร์ฟไฟล์สถิต

// สร้างเส้นทางเริ่มต้นเพื่อเสิร์ฟ 'index.html'
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html')); // เสิร์ฟ `index.html`
  });

// สร้างเซิร์ฟเวอร์ HTTP
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// ฟังก์ชันเพื่อดึงข้อมูลสภาพอากาศจาก OpenWeatherMap
const fetchWeatherData = async () => {
    try {
        const response = await axios.get(
            `https://api.openweathermap.org/data/2.5/weather?q=${weatherLocation}&units=metric&appid=${weatherApiKey}`
        );
        const temperature = response.data.main.temp; // อุณหภูมิ
        return { temperature };
    } catch (err) {
        console.error('Error fetching weather data:', err);
        return null;
    }
};

// สร้างเซิร์ฟเวอร์ WebSocket
const wss = new WebSocket.Server({ server });

wss.on('connection', async (ws) => {
    console.log('Client connected'); // เมื่อไคลเอนต์เชื่อมต่อ

    const sendWeatherData = async () => {
        const weatherData = await fetchWeatherData();
        if (weatherData) {
            ws.send(JSON.stringify(weatherData)); // ส่งข้อมูลสภาพอากาศ
        }
    };

    const pollData = async () => {
        const client = new MongoClient(url);

        try {
            await client.connect(); // เชื่อมต่อกับ MongoDB
            const db = client.db(dbName); // เข้าถึงฐานข้อมูล
            const collection = db.collection(collectionName); // เข้าถึงคอลเลกชัน 'Building2'

            const documents = await collection.find({}).toArray(); // ดึงข้อมูลทั้งหมด

            ws.send(JSON.stringify(documents)); // ส่งข้อมูลไปยังไคลเอนต์
        } catch (err) {
            console.error('Error fetching data from MongoDB:', err);
        } finally {
            client.close(); // ปิดการเชื่อมต่อ
        }
    };

    sendWeatherData(); // ส่งข้อมูลสภาพอากาศทันทีที่เชื่อมต่อ
    pollData(); // ส่งข้อมูลจาก MongoDB

    // เรียกใช้ฟังก์ชัน `sendWeatherData` และ `pollData` เป็นระยะ
    const weatherIntervalId = setInterval(sendWeatherData, 60000); // ส่งข้อมูลสภาพอากาศทุก ๆ 60 วินาที
    const pollIntervalId = setInterval(pollData, 5000); // ส่งข้อมูล MongoDB ทุก ๆ 5 วินาที

    ws.on('close', () => {
        console.log('Client disconnected');
        clearInterval(pollIntervalId); // หยุด interval ของ MongoDB
        clearInterval(weatherIntervalId); // หยุด interval สำหรับสภาพอากาศ
    });
});

// เส้นทางสำหรับการส่งออกข้อมูลเป็น Excel
app.get('/export', async (req, res) => {
    const client = new MongoClient(url);

    try {
        await client.connect(); // เชื่อมต่อกับ MongoDB
        const db = client.db(dbName); // เข้าถึงฐานข้อมูล
        const collection = db.collection(collectionName); // เข้าถึงคอลเลกชัน 'Building2'

        const selectedFields = req.query.fields; // เก็บข้อมูลที่ต้องการส่งออก
        const queryProjection = {}; // สำหรับการกำหนดข้อมูลที่ต้องการดึง

        if (selectedFields) {
            const fields = Array.isArray(selectedFields) ? selectedFields : [selectedFields]; // ทำให้เป็นอาร์เรย์
            fields.forEach(field => {
                queryProjection[field] = 1; // กำหนดให้ดึงข้อมูลตามตัวเลือก
            });
        }

        const data = await collection.find({}, { projection: queryProjection }).toArray(); 

        // สร้าง workbook และ worksheet สำหรับ Excel
        const workbook = xlsx.utils.book_new(); 
        const worksheet = xlsx.utils.json_to_sheet(data); 
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Data'); 

        // สร้าง buffer ของไฟล์ Excel
        const excelBuffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });

        // ตั้งค่าเพื่อส่งออกไฟล์ Excel
        res.setHeader('Content-Disposition', 'attachment; filename="exported_data.xlsx"'); 
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); 
        res.send(excelBuffer); // ส่งไฟล์ให้ไคลเอนต์ดาวน์โหลด
    } catch (err) {
        console.error('Error exporting data:', err); 
        res.status(500).send('Error exporting data'); 
    } finally {
        client.close(); // ปิดการเชื่อมต่อกับ MongoDB
    }
});
