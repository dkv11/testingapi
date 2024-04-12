const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Connection
mongoose.connect(process.env.DB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => console.log("MongoDB Connected"))
    .catch((err) => console.log("Mongo Error:", err));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Sensor Data Schema
const sensorDataSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    temperature: { type: Number, required: true },
    humidity: { type: Number, required: true }
}, { timestamps: true });

// Sensor Data Model
const SensorData = mongoose.model("SensorData", sensorDataSchema);

// User Schema
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
}, { timestamps: true });

// User Model
const User = mongoose.model("User", userSchema);

// Middleware for JWT token verification (if needed elsewhere)
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'No token provided.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Token is invalid or expired.' });
        req.user = user;
        next();
    });
};

// POST API for Sensor Data (authenticated)
app.post('/sensor-datas/:userId', authenticateToken, async (req, res) => {
    const { userId } = req.params;
    const { temperature, humidity } = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const newSensorData = await SensorData.create({ userId, temperature, humidity });
        res.status(201).json({ message: "Sensor data saved successfully", data: newSensorData });
    } catch (error) {
        res.status(500).json({ message: "Failed to save sensor data", error: error.message });
    }
});

// Define the route for POST request without user authentication
app.post('/sensor-datas', (req, res) => {
    const { temperature, humidity } = req.body;
    
    // Log the received data
    console.log(`Received: Temperature = ${temperature}, Humidity = ${humidity}`);

    // Respond to the client
    res.status(201).json({
        message: "Data received successfully",
        data: req.body
    });
});

// Start the server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
