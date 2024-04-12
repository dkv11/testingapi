const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const secret = process.env.JWT_SECRET;
const cors=require('cors');
require('dotenv').config()

const app = express();
const PORT = process.env.PORT;

// MongoDB Connection
mongoose.connect(process.env.DB_URI)
    .then(() => console.log("MongoDB Connected"))
    .catch((err) => console.log("Mongo Error", err));

app.set("view engine", "ejs");
app.set('views', path.resolve("./views"));

// Middleware for parsing application/json and application/x-www-form-urlencoded
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

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

// Helper functions for JWT handling
function setUser(user) {
    return jwt.sign(
        {
            _id: user._id,
            email: user.email,
        }, secret
    );
};

function getUser(token) {
    if (!token) return null;
    try {
        return jwt.verify(token, secret);
    } catch (error) {
        return null;
    }
}

// function checkforAuthentication(req,res,next){
//     const authorizationHeaderValue = req.header["authorization"];
//     req.user =null;
//     if (!authorizationHeaderValue || !authorizationHeaderValue.startWith("Bearer"))
//     return next();
//     const token = authorizationHeaderValue.split("Bearer ")[1];
//     const user = getUser(token);

//     req.user = user;
//     return next();

   
// }


//middleWare
async function restrictToLoggedinUserOnly(req, res, next) {
    console.log('Checking authentication for access to sensor data...');
    const userUid = req.headers["authorization"] || req.cookies.uid;
    if (!userUid) {
        console.log('No auth token found, redirecting to login...');
        return res.redirect("/login");
    }
    const token = userUid.split("Bearer ")[1] || userUid;
    const user = getUser(token);
    if (!user) {
        console.log('Invalid token, redirecting to login...');
        return res.redirect("/login");
    }
    console.log(`User ${user.email} authenticated, proceeding to sensor data...`);
    req.user = user;
    next();
}



async function checkAuth(req, res, next) {
    let token;

    // Try to extract token from Authorization header or cookies
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split('Bearer ')[1]; // For Flutter app or other API clients
    } else if (req.cookies.uid) {
        token = req.cookies.uid; // For web clients
    }

    if (!token) {
        // No token found in either Authorization header or cookies
        // Handle the absence of a token based on the type of client
        if (req.path.startsWith('/api/')) {
            // API route
            return res.status(401).json({ error: 'Authentication token is required.' });
        } else {
            // Web route
            return res.redirect('/login');
        }
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, secret);
        req.user = decoded;

        // Proceed to the next middleware/function
        next();
    } catch (error) {
        // Token verification failed
        console.error('Authentication token verification failed:', error);

        // Handle verification failure based on the type of client
        if (req.path.startsWith('/api/')) {
            // API route
            return res.status(401).json({ error: 'Invalid or expired authentication token.' });
        } else {
            // Web route
            return res.redirect('/login');
        }
    }
}


app.use(cors());
// Adjusted POST route for sensor data to include userId in the URL
app.post('/sensor-datas/:userId', async (req, res) => {
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
// app.get('/api/sensor-data/:userId', async (req, res) => {
//     try {
//         // Extracting userId from URL parameters
//         const { userId } = req.params;

//         // Fetching sensor data for the given userId
//         const userSensorData = await SensorData.find({ userId }).sort({ createdAt: -1 });
//         res.status(200).json(userSensorData);
//     } catch (error) {
//         console.error("Failed to retrieve sensor data:", error);
//         res.status(500).json({ error: "Failed to retrieve sensor data" });
//     }
// });

 
app.get('/', checkAuth, (req, res) => {
    if (req.user) {
      res.redirect('/sensor-data');
    } else {
      res.render("login");
    }
  });

// Login Route - Render Login Page
app.get('/login', (req, res) => {
    res.render("login");
});

// Handle Login Form Submission for mobile client
app.post('/api/login', async (req, res) => {
    console.log('Login attempt with:', req.body);
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (user && await bcrypt.compare(password, user.password)) {
      const token = setUser(user);
      //res.cookie("uid", token, { httpOnly: true }); // Securely set the token in cookies
      return res.json({ token });
      
    } else {
      res.render("login", { error: "Invalid Email or Password" });
    }
  });

  //website
  app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (user && await bcrypt.compare(password, user.password)) {
      const token = setUser(user);
      res.cookie("uid", token, { httpOnly: true, secure: true, sameSite: 'strict' }); // Securely set the token in cookies
      res.redirect("/sensor-data");
      //return res.json({ token });
    } else {
      res.render("login", { error: "Invalid Email or Password" });
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
        const newUser = await User.create({ name, email, password: hashedPassword });
        const token = setUser(newUser); // Generate JWT token for the new user
        
        // Choose one of the following based on your client's needs:
        
        // For API clients:
        // res.status(201).json({ token });

        // For web clients:
        
        res.redirect("/login"); // Or wherever you want to redirect after signup
    } catch (error) {
        // It's good practice to provide more user-friendly error messages
        console.error("Signup error:", error);
        res.status(500).render("signup", { error: "An error occurred during signup. Please try again." });
    }
});



// Adjusted GET route to display sensor data on the webpage for the logged-in user
app.get('/sensor-data', restrictToLoggedinUserOnly, async (req, res) => {
    const sensorData = await SensorData.find({ userId: req.user._id });
    res.render("home", { sensorData }); // Assumes a "dashboard.ejs" template
  });

app.get('/api/sensor-data', restrictToLoggedinUserOnly, async (req, res) => {
    
    const { userId } = req.params;

    //         // Fetching sensor data for the given userId
            const userSensorData = await SensorData.findOne({ userId: req.user._id }).sort({ createdAt: -1 });
            console.log(userSensorData);
            res.status(200).json(userSensorData);
  });




// Start the server
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
