const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;

// MongoDB Connection
mongoose.connect("mongodb://127.0.0.1:27017/sensorDataDB")
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log("Mongo Error", err));

app.set("view engine", "ejs");
app.set('views', path.resolve("./views"));

// Sensor Data Schema
const sensorDataSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        required: true, 
        ref: 'User'
      },
  temperature: {
    type: Number,
    required: true,
  },
  humidity: {
    type: Number,
    required: true,
  }
}, {
  timestamps: true // Adds createdAt and updatedAt timestamps
});

// Sensor Data Model
const SensorData = mongoose.model("SensorData", sensorDataSchema);

// User Schema
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
}, {
  timestamps: true // Adds createdAt and updatedAt timestamps
});

// User Model
const User = mongoose.model("User", userSchema);

// Middleware for parsing application/json and application/x-www-form-urlencoded
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

function verifyJWT(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Extract the token
    if (!token) {
        return res.status(403).send("A token is required for authentication");
    }
    try {
        const decoded = jwt.verify(token, 'yourSecretKey');
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).send("Invalid Token");
    }
}


// Adjusted POST route for sensor data to include userId in the URL
app.post('/api/sensor-data/:userId',  async (req, res) => {
    try {
        // Extracting userId from URL parameters
        const { userId } = req.params;
        const { temperature, humidity } = req.body;
        
        // Check if the user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Creating a new sensor data entry associated with the user
        const newSensorData = await SensorData.create({ userId, temperature, humidity });
        console.log("New sensor data saved for user:", userId);
        res.status(201).json({ message: "Sensor data saved successfully" });
    } catch (error) {
        console.error("Failed to save sensor data for user:", error);
        res.status(500).json({ error: "Failed to save sensor data" });
    }
});
  

// GET route to fetch the latest sensor data
app.get('/api/sensor-data/:userId', async (req, res) => {
    try {
        // Extracting userId from URL parameters
        const { userId } = req.params;
        
        // Fetching sensor data for the given userId
        const userSensorData = await SensorData.find({ userId }).sort({ createdAt: -1 });
    
        res.status(200).json(userSensorData);
    } catch (error) {
        console.error("Failed to retrieve sensor data:", error);
        res.status(500).json({ error: "Failed to retrieve sensor data" });
    }
});
  

// Adjusted GET route to display sensor data on the webpage for the logged-in user
app.get('/sensor-data', async (req, res) => {
    try {
      // Assuming you have some middleware that populates req.user with the logged-in user's info
      if (!req.user) {
        return res.status(401).send("Please login to view this page.");
      }
  
      const userId = req.user.id; // Get the logged-in user's ID
      const userSensorData = await SensorData.find({ userId }).sort({ createdAt: -1 });
  
      // Render the home page with only the logged-in user's sensor data
      res.render("home", { sensorData: userSensorData });
    } catch (error) {
      console.error("Failed to retrieve sensor data for page rendering:", error);
      res.status(500).send("Failed to load sensor data");
    }
  });
  

// Signup Route - Render Signup Page
app.get('/signup', (req, res) => {
  res.render("signup");
});

// Handle Signup Form Submission
app.post('/signup', async (req, res) => {
    try {
      const { name, email, password } = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);
  
      const newUser = await User.create({
        name,
        email,
        password: hashedPassword
      });
  
      console.log(`New user created successfully: ${newUser.email}`);
      res.redirect('/login'); // Redirect to login page after successful signup
    } catch (error) {
      if (error.code === 11000) {
        // This is a duplicate key error
        console.error("Signup error: A user with this email already exists.");
        res.status(400).send("A user with this email already exists.");
      } else {
        console.error("Signup error:", error);
        res.status(500).send("Error signing up");
      }
    }
  });
  
  

// Login Route - Render Login Page
app.get('/login', (req, res) => {
  res.render("login");
});

// Handle Login Form Submission
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (user && await bcrypt.compare(password, user.password)) {
            // User authenticated successfully, create JWT
            const token = jwt.sign(
                { userId: user._id },
                'yourSecretKey', // Replace 'yourSecretKey' with a real secret key
                { expiresIn: '24h' } // Token expires in 24 hours
            );

            console.log(`User logged in successfully: ${user.email}`);
            // Return the token to the client
            res.json({ message: "Auth successful", token: token });
        } else {
            res.status(401).send("Authentication failed");
        }
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).send("Error logging in");
    }
});

  

// Start the server
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
