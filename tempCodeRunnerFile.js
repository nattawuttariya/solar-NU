const express = require('express');
const { MongoClient } = require('mongodb');
const WebSocket = require('ws');
const path = require('path');

const url = 'mongodb://localhost:27017'; // URL ของ MongoDB
const dbName = 'Nut'; // ชื่อฐานข้อมูล
const collectionName = 'Building9'; // ชื่อคอลเลกชัน

const app = express(); // สร้างแอป Express
const PORT = process.env.PORT || 3000; // กำหนดพอร์ต

// เสิร์ฟไฟล์สถิตจากโฟลเดอร์ 'public'
app.use(express.static(path.join(__dirname, 'public'))); // เสิร์ฟไฟล์สถิต

// สร้างเซิร์ฟเวอร์ HTTP
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// สร้างเซิร์ฟเวอร์ WebSocket
const wss = new WebSocket.Server({ server });

wss.on('connection', async (ws) => {
    console.log('Client connected'); // เมื่อไคลเอนต์เชื่อมต่อ

    const pollData = async () => {
        const client = new MongoClient(url);

        try {
            await client.connect(); // เชื่อมต่อกับ MongoDB
            const db = client.db(dbName); // เข้าถึงฐานข้อมูล
            const collection = db.collection(collectionName); // เข้าถึงคอลเลกชัน

            const documents = await collection.find({}).toArray(); // ดึงข้อมูลทั้งหมด

            // ส่งค่า V1 ให้กับไคลเอนต์แบบเรียลไทม์
            documents.forEach((doc) => {
                const v1 = doc.V1 || 0; // ถ้าไม่มี V1 ให้ใช้ 0
                ws.send(JSON.stringify({ v1 })); // ส่งค่า V1 ไปยังไคลเอนต์
            });
        } catch (err) {
            console.error('Error fetching data from MongoDB:', err);
        } finally {
            client.close(); // ปิดการเชื่อมต่อ
        }
    };

    pollData(); // ดึงข้อมูลครั้งแรก

    const pollIntervalId = setInterval(pollData, 5000); // ดึงข้อมูลทุก 5 วินาที

    ws.on('close', () => {
        console.log('Client disconnected');
        clearInterval(pollIntervalId); // หยุดเมื่อไคลเอนต์ตัดการเชื่อมต่อ
    });
});
