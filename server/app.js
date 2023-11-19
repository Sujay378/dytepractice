const http = require("node:http");
const path = require("node:path");

require("dotenv").config({
  path: path.join(require.main.path, `${process.env.prod ? "prod" : ""}.env`),
});
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { Schema, model } = mongoose;

const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, required: true },
  token: { type: String, default: "" },
});

const logSchema = new Schema({
  level: String,
  message: String,
  resourceId: String,
  timestamp: { type: Date, default: new Date() },
  traceId: String,
  spanId: String,
  commit: String,
  metadata: {
    type: {
      parentResourceId: String,
    },
  },
  access: { type: Number, default: 3 },
});

const Log = model("Log", logSchema);

const User = model("User", userSchema);

const accessPerRole = {
  admin: 1,
  manager: 2,
  developer: 3,
};

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.get("Authorization").split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_KEY);
    if (!payload) throw { type: "malformedToken" };
    const user = await User.findById(payload.id);
    const match = await bcrypt.compare(token, user.token);
    if (!match) throw { type: "badToken" };
    req.user = user;
    next();
  } catch (error) {
    console.log(error);
  }
};

const app = express();
app.use(bodyParser.json());
app.use(
  cors({
    origin: ["http://localhost:4200"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization"],
    exposedHeaders: ["Authorization"],
  })
);

app.post("/", async (req, res) => {
  if (req.body) {
    await new Log(req.body).save();
  }
  res.end();
});

app.post("/api/v1/auth/register", async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) throw { type: "incompleteData" };

    const existingUser = await User.findOne({ email });

    if (existingUser) throw { type: "existingUser" };

    const hashedPassword = await bcrypt.hash(password, 12);

    await new User({
      name,
      email,
      password: hashedPassword,
    }).save();

    res
      .status(200)
      .json({
        success: true,
        message: "User account created",
      })
      .end();
  } catch (error) {
    error.status = 500;
    error.message = "Some error occured during execution";
    if (!error.type) {
      error.type = "serverError";
    }
    next(error);
  }
});

app.post("/api/v1/auth/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw { type: "incompleteData" };

    const user = await User.findOne({ email });
    const match = await bcrypt.compare(password, user.password);
    if (!user || !match) throw { type: "invalidData" };

    const newToken = jwt.sign(
      { id: user._id.toString() },
      process.env.JWT_KEY,
      { expiresIn: "1h" }
    );

    const hashedToken = await bcrypt.hash(newToken, 12);

    await user.updateOne({
      $set: {
        token: hashedToken,
      },
    });

    res.setHeader("Authorization", `bearer ${newToken}`);

    res
      .status(200)
      .json({
        success: true,
        name: user.name,
        email: user.email,
      })
      .end();
  } catch (error) {
    error.status = 500;
    error.message = "Some error occured during execution";
    if (!error.type) {
      error.type = "serverError";
    }
    next(error);
  }
});

app.post(
  "/api/v1/logs/fetch/:page/:count",
  authMiddleware,
  async (req, res, next) => {
    const page = req.params.page || req.page || 1;
    const count = req.params.count || req.count || 20;
    const { query } = req.body;
    const logs = await Log.find(query)
      .sort("timestamp")
      .skip(count * (page - 1))
      .limit(20);
    res.status(200).json(logs).end();
  }
);

app.use((err, req, res, next) => {
  res.status(err.status).json({
    type: err.type,
    message: err.message,
  });
});

const server = http.createServer(app);
console.log();
mongoose
  .connect(process.env.MONGO_URI, {
    localPort: 27107,
  })
  .then(() => {
    server.listen(process.env.PORT, () =>
      console.log("Server is listening on port 3000")
    );
  })
  .catch((err) => console.log(err));
